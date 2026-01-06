/**
 * EXPLANATION: Voice Live Gateway
 *
 * WebSocket gateway for real-time voice conversations using Socket.IO.
 * Handles client connections, audio streaming, and coordinates with VoiceLiveService.
 *
 * Key responsibilities:
 * 1. Manage Socket.IO connections for voice sessions
 * 2. Route audio data between clients and Azure Voice Live API
 * 3. Handle session lifecycle (connect/disconnect)
 * 4. Integrate with emotion detection and crisis detection services
 * 5. Forward real-time responses back to clients
 */

import { Server, Socket } from 'socket.io';
import { VoiceLiveService } from '../services/voiceLiveService';
import { logInfo, logError, logWarn } from '../utils/logger';
import { Session, Message } from '../models/schemas';
import { authService } from '../services/authService';
import jwt from 'jsonwebtoken';
import {
  VoiceGatewayEvents,
  VoiceServerEvents,
  ProcessingContext
} from '../types/voiceLive';
import {
  VoiceConnectDto,
  VoiceAudioChunkDto,
  VoiceTextInputDto,
  VoiceDisconnectDto,
  VoiceHeartbeatDto,
  validateVoiceConnect,
  validateAudioChunk
} from '../dtos/voiceLive.dto';

export class VoiceLiveGateway {
  private io: Server;
  // pending cleanups for sessions after socket disconnect - gives client time to reconnect
  private pendingDisconnects: Map<string, NodeJS.Timeout> = new Map();
  private reconnectGraceMs: number = parseInt(process.env.SESSION_RECONNECT_GRACE_MS || '30000', 10); // 30s default
  private activeSessions: Map<string, { socket: Socket; userId: string; service: VoiceLiveService }> = new Map();
  private assistantMessages: Map<string, { content: string; responseId: string }> = new Map();

  constructor(io: Server) {
    this.io = io;
    // per-session services are created on connect; only set up namespace
    this.setupVoiceNamespace();
  }

  /**
   * EXPLANATION: Set up the /voice namespace for voice conversations
   */
  private setupVoiceNamespace(): void {
    const voiceNamespace = this.io.of('/voice');

    // Authenticate incoming socket connections for /voice namespace
    // Accept token via socket.handshake.auth.token or Authorization header
    voiceNamespace.use((socket: Socket, next) => {
      const authToken = socket.handshake.auth?.token
        || (socket.handshake.headers?.authorization && (socket.handshake.headers.authorization as string).startsWith('Bearer ')
          ? (socket.handshake.headers.authorization as string).split(' ')[1]
          : undefined);

      if (!authToken) {
        logWarn(`[VoiceLiveGateway] Socket auth failed: no token (socket=${socket.id})`);
        return next(new Error('AUTH_REQUIRED'));
      }

      // Try authService.verifyToken first, fallback to JWT verify
      if (authService && typeof (authService as any).verifyToken === 'function') {
        (authService as any).verifyToken(authToken)
          .then((user: any) => {
            socket.data.user = user;
            logInfo(`[VoiceLiveGateway] Socket authenticated: ${user?.email || user?.userId} (socket=${socket.id})`);
            next();
          })
          .catch((err: any) => {
            logWarn(`[VoiceLiveGateway] Token validation failed (socket=${socket.id}): ${err?.message || err}`);
            next(new Error('AUTH_INVALID'));
          });
      } else {
        try {
          const secret = process.env.JWT_SECRET || '';
          const user = jwt.verify(authToken, secret);
          socket.data.user = user;
          logInfo(`[VoiceLiveGateway] Socket JWT authenticated (socket=${socket.id})`);
          next();
        } catch (e) {
          // Normalize the caught error (catch binding is 'unknown' in TS)
          const errMsg = e instanceof Error ? e.message : String(e);
          logWarn(`[VoiceLiveGateway] JWT auth failed (socket=${socket.id}): ${errMsg}`);
          next(new Error('AUTH_INVALID'));
        }
      }
    });

    voiceNamespace.on('connection', (socket: Socket) => {
      const authUser = (socket as any).data?.user;
      logInfo(`[VoiceLiveGateway] Client connected: ${socket.id} user=${authUser?.email || authUser?.userId || 'anonymous'}`);

      // Log more details about disconnect reason for debugging
       // Handle voice connection request
       socket.on('voice:connect', (data: VoiceConnectDto) => {
         this.handleVoiceConnect(socket, data);
       });

      // If low-level socket disconnect happens, schedule session cleanup (grace period)
       // Handle audio data
       socket.on('voice:audio', (data: VoiceAudioChunkDto) => {
         this.handleVoiceAudio(socket, data);
       });

      // Handle text input
      socket.on('voice:text-input', (data: VoiceTextInputDto) => {
        this.handleVoiceTextInput(socket, data);
      });

      // Handle heartbeat
      socket.on('voice:heartbeat', (data: VoiceHeartbeatDto) => {
        this.handleVoiceHeartbeat(socket, data);
      });

      // Handle disconnect
      socket.on('voice:disconnect', (data: VoiceDisconnectDto) => {
        this.handleVoiceDisconnect(socket, data);
      });

      // Handle socket disconnect: schedule cleanup with grace period to allow quick reconnect
      socket.on('disconnect', (reason) => {
        logInfo(`[VoiceLiveGateway] Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleSocketDisconnect(socket);
      });
    });
  }

  /**
   * EXPLANATION: Handle voice connection request
   */
  private async handleVoiceConnect(socket: Socket, data: VoiceConnectDto): Promise<void> {
    try {
      // Validate input
      const validation = validateVoiceConnect(data);
      if (!validation.valid) {
        socket.emit('voice:error', {
          error: validation.error,
          code: 'VALIDATION_ERROR',
          recoverable: false
        });
        return;
      }

      const { userId, sessionId, userPreferences } = data;
      // Ensure authenticated user (if present) is used
      const authUser = (socket as any).data?.user;
      let effectiveUserId = userId;
      if (authUser) {
        if (userId && userId !== authUser.userId) {
          logWarn(`[VoiceLiveGateway] Mismatched userId in connect payload (socket=${socket.id}). Using authenticated userId.`);
        }
        effectiveUserId = authUser.userId;
      }

      // Generate session ID if not provided
      const finalSessionId = sessionId || `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // If session already exists, reattach socket (cancel pending cleanup)
      const existing = this.activeSessions.get(finalSessionId);
      if (existing) {
        // cancel scheduled cleanup if any
        const pending = this.pendingDisconnects.get(finalSessionId);
        if (pending) {
          clearTimeout(pending);
          this.pendingDisconnects.delete(finalSessionId);
          logInfo(`[VoiceLiveGateway] Cancelled cleanup for session ${finalSessionId} due to reconnect`);
        }

        // attach new socket
        existing.socket = socket;
        existing.userId = effectiveUserId;

        // echo ready and re-initialize handlers from this socket perspective
        socket.emit('voice:connected', {
          sessionId: finalSessionId,
          userId: effectiveUserId,
          status: 'ready',
          metadata: {
            connectedAt: new Date().toISOString(),
            sampleRate: 24000,
            channels: 1
          }
        });
        logInfo(`[VoiceLiveGateway] Session ${finalSessionId} reattached to socket ${socket.id}`);
        return;
      }

      logInfo(`[VoiceLiveGateway] Connecting session: ${finalSessionId} for user: ${userId}`);

      // Create new VoiceLiveService instance for this session
      const sessionService = new VoiceLiveService();

      // Connect to Azure
      await sessionService.connect(finalSessionId, effectiveUserId, userPreferences);

      // Store session info
      this.activeSessions.set(finalSessionId, {
        socket,
        userId,
        service: sessionService
      });

      // Save session to database
      try {
        await Session.create({
          userId,
          status: 'active',
          startTime: new Date(), // ensure start time is set for duration calculations
          userPreferences,
          metadata: {
            connectedAt: new Date().toISOString(),
            sampleRate: 24000,
            channels: 1,
            userAgent: socket.handshake.headers['user-agent']
          }
        });
        logInfo(`[VoiceLiveGateway] Session ${finalSessionId} saved to database`);
      } catch (dbError) {
        logError(`[VoiceLiveGateway] Failed to save session ${finalSessionId} to database`, dbError);
        // Continue anyway - don't block the connection
      }

      // Set up event handlers for this session's service
      this.setupSessionServiceHandlers(sessionService, finalSessionId);

      // Send success response
      const response = {
        sessionId: finalSessionId,
        userId,
        status: 'ready',
        metadata: {
          connectedAt: new Date().toISOString(),
          sampleRate: 24000,
          channels: 1
        }
      };

      socket.emit('voice:connected', response);
      logInfo(`[VoiceLiveGateway] Session ${finalSessionId} connected successfully`);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logError('[VoiceLiveGateway] Voice connect failed', error);
      socket.emit('voice:error', {
        error: `Failed to establish voice connection: ${errMsg}`,
        code: 'CONNECTION_FAILED',
        recoverable: true
      });
    }
  }

  /**
   * EXPLANATION: Handle audio data from client
   */
  private handleVoiceAudio(socket: Socket, data: VoiceAudioChunkDto): void {
    try {
      // Find the session for this socket
      const sessionEntry = Array.from(this.activeSessions.values())
        .find(entry => entry.socket === socket);

      if (!sessionEntry) {
        socket.emit('voice:error', {
          error: 'No active voice session',
          code: 'NO_SESSION',
          recoverable: false
        });
        return;
      }

      // Validate audio chunk
      const validation = validateAudioChunk(data);
      if (!validation.valid) {
        socket.emit('voice:error', {
          error: validation.error,
          code: 'INVALID_AUDIO',
          recoverable: true
        });
        return;
      }

      // Pass audio data to service (string or Buffer)
      // Optimization: If it's already a base64 string, pass it directly to avoid Buffer conversion overhead
      sessionEntry.service.sendAudio(data.audio);

      // Reset session timeout
      sessionEntry.service.resetSessionTimeout();

    } catch (error) {
      logError('[VoiceLiveGateway] Error handling voice audio', error);
      socket.emit('voice:error', {
        error: 'Failed to process audio',
        code: 'AUDIO_PROCESSING_ERROR',
        recoverable: true
      });
    }
  }

  /**
   * EXPLANATION: Handle text input from client
   */
  private handleVoiceTextInput(socket: Socket, data: VoiceTextInputDto): void {
    try {
      const sessionEntry = Array.from(this.activeSessions.values())
        .find(entry => entry.socket === socket);

      if (!sessionEntry) {
        socket.emit('voice:error', {
          error: 'No active voice session',
          code: 'NO_SESSION',
          recoverable: false
        });
        return;
      }

      // Send text to Azure
      sessionEntry.service.sendTextInput(data.text);

      // Reset session timeout
      sessionEntry.service.resetSessionTimeout();

    } catch (error) {
      logError('[VoiceLiveGateway] Error handling text input', error);
      socket.emit('voice:error', {
        error: 'Failed to process text input',
        code: 'TEXT_PROCESSING_ERROR',
        recoverable: true
      });
    }
  }

  /**
   * EXPLANATION: Handle heartbeat from client
   */
  private handleVoiceHeartbeat(socket: Socket, data: VoiceHeartbeatDto): void {
    const sessionEntry = this.activeSessions.get(data.sessionId);
    if (sessionEntry && sessionEntry.socket === socket) {
      // Reset session timeout
      sessionEntry.service.resetSessionTimeout();

      // Send heartbeat acknowledgment
      socket.emit('voice:heartbeat-ack', {
        timestamp: Date.now(),
        sessionId: data.sessionId
      });
    }
  }

  /**
   * EXPLANATION: Handle voice disconnect request
   */
  private handleVoiceDisconnect(socket: Socket, data: VoiceDisconnectDto): void {
    const sessionEntry = Array.from(this.activeSessions.values())
      .find(entry => entry.socket === socket);

    if (sessionEntry) {
      const sid = sessionEntry.service['state'].sessionId!;
      logInfo(`[VoiceLiveGateway] User-initiated disconnect for session: ${sid}`);

      sessionEntry.service.disconnect();
      this.cleanupSession(sid);
    }
  }

  /**
   * EXPLANATION: Handle socket disconnection
   */
  private handleSocketDisconnect(socket: Socket): void {
    // Find sessions belonging to this socket and schedule cleanup after grace period
    for (const [sessionId, sessionEntry] of this.activeSessions.entries()) {
      if (sessionEntry.socket === socket) {
        logInfo(`[VoiceLiveGateway] Scheduling cleanup for session ${sessionId} in ${this.reconnectGraceMs}ms due to socket disconnect`);

        // Don't schedule multiple timers for same session
        if (this.pendingDisconnects.has(sessionId)) continue;

        const timeout = setTimeout(async () => {
          try {
            logInfo(`[VoiceLiveGateway] Grace period expired; cleaning up session ${sessionId}`);
            // Perform same cleanup as service disconnected
            sessionEntry.service.disconnect();

            // Update DB session end info
            try {
              const sessionDoc = await Session.findOne({ sessionId });
              if (sessionDoc) {
                const endTime = new Date();
                sessionDoc.endTime = endTime;
                sessionDoc.status = 'ended';
                sessionDoc.duration = endTime.getTime() - sessionDoc.startTime.getTime();
                await sessionDoc.save();
                logInfo(`[VoiceLiveGateway] Session ${sessionId} ended and updated in database (grace cleanup)`);
              }
            } catch (dbError) {
              logError(`[VoiceLiveGateway] Failed to update session ${sessionId} during grace cleanup`, dbError);
            }

            this.cleanupSession(sessionId);
          } catch (error) {
            logError(`[VoiceLiveGateway] Error during session cleanup`, error);
          }
        }, this.reconnectGraceMs);

        this.pendingDisconnects.set(sessionId, timeout);
      }
    }
  }

  /**
   * EXPLANATION: Set up event handlers for a session's service
   */
  private setupSessionServiceHandlers(service: VoiceLiveService, sessionId: string): void {
    service.on('message', (message) => {
      this.handleAzureMessage(message, sessionId);
    });

    service.on('audio-delta', (message) => {
      this.handleAudioDelta(message, sessionId);
    });

    service.on('transcript-delta', (message) => {
      this.handleTranscriptDelta(message, sessionId);
    });

    service.on('transcript-done', (message) => {
      this.handleTranscriptDone(message, sessionId);
    });

    service.on('user-transcript', (message) => {
      this.handleUserTranscript(message, sessionId);
    });

    service.on('speech-started', () => {
      this.handleSpeechStarted(sessionId);
    });

    service.on('speech-stopped', () => {
      this.handleSpeechStopped(sessionId);
    });

    service.on('disconnected', (data) => {
      this.handleServiceDisconnected(data.sessionId);
    });

    service.on('error', (error) => {
      this.handleServiceError(error, sessionId);
    });
  }

  /**
   * EXPLANATION: Handle messages from Azure Voice Live API
   */
  private handleAzureMessage(message: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    // Forward relevant events to client
    switch (message.type) {
      case 'session.created':
        session.socket.emit('voice:session-ready');
        break;

      case 'session.updated':
        // Session configuration acknowledged
        break;

      case 'conversation.item.created':
        // Conversation item acknowledged
        break;

      case 'response.created':
        session.socket.emit('voice:response-started');
        break;

      case 'error':
        session.socket.emit('voice:error', {
          error: message.error?.message || 'Azure API error',
          code: 'AZURE_ERROR',
          recoverable: true
        });
        break;
    }
  }

  /**
   * EXPLANATION: Handle audio delta from Azure
   */
  private handleAudioDelta(message: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    if (message.delta) {
      session.socket.emit('voice:audio', {
        audio: message.delta,
        sequenceNumber: message.sequenceNumber || 1,
        isLastChunk: message.type === 'response.audio.done'
      });
    }
  }

  /**
   * EXPLANATION: Handle transcript delta from Azure
   */
  private async handleTranscriptDelta(message: any, sessionId?: string): Promise<void> {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    if (message.delta) {
      const responseId = message.response_id || 'unknown';
      session.socket.emit('voice:assistant-transcript', {
        transcript: message.delta,
        isFinal: false,
        responseId
      });

      // Accumulate assistant message content
      const key = `${sessionId}_${responseId}`;

      if (!this.assistantMessages.has(key)) {
        this.assistantMessages.set(key, { content: '', responseId });
      }

      const msgBuffer = this.assistantMessages.get(key)!;
      msgBuffer.content += message.delta;
    }
  }

  /**
   * EXPLANATION: Handle transcript completion from Azure
   */
  private async handleTranscriptDone(message: any, sessionId?: string): Promise<void> {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    // Send final accumulated assistant transcript to client (so they can display it)
    const responseId = message.response_id || 'unknown';
    const key = `${sessionId}_${responseId}`;
    const msgBuffer = this.assistantMessages.get(key);
    const finalTranscript = (msgBuffer && msgBuffer.content.trim()) ? msgBuffer.content.trim() : (message.transcript || '');

    // Emit final transcript (include responseId)
    session.socket.emit('voice:assistant-transcript', {
      transcript: finalTranscript,
      isFinal: true,
      responseId
    });

    // Save accumulated assistant message to database (if present)
    if (msgBuffer && msgBuffer.content.trim()) {
      try {
        await Message.create({
          sessionId,
          userId: session.userId,
          role: 'assistant',
          content: msgBuffer.content.trim(),
          timestamp: new Date(),
          metadata: {
            responseId,
            source: 'voice_synthesis'
          }
        });
        logInfo(`[VoiceLiveGateway] Assistant message saved for session ${sessionId}`);
      } catch (dbError) {
        logError(`[VoiceLiveGateway] Failed to save assistant message for session ${sessionId}`, dbError);
      }

      // Clean up the buffer
      this.assistantMessages.delete(key);
    }
  }

  /**
   * EXPLANATION: Handle user transcript from Azure
   */
  private async handleUserTranscript(message: any, sessionId?: string): Promise<void> {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    if (message.transcript) {
      session.socket.emit('voice:user-transcript', {
        transcript: message.transcript,
        isFinal: true,
        confidence: message.confidence || 0.9
      });

      // Save user message to database
      try {
        await Message.create({
          sessionId,
          userId: session.userId,
          role: 'user',
          content: message.transcript,
          timestamp: new Date(),
          metadata: {
            confidence: message.confidence || 0.9,
            source: 'voice_transcription'
          }
        });
        logInfo(`[VoiceLiveGateway] User message saved for session ${sessionId}`);
      } catch (dbError) {
        logError(`[VoiceLiveGateway] Failed to save user message for session ${sessionId}`, dbError);
      }
    }
  }

  /**
   * EXPLANATION: Handle speech started event
   */
  private handleSpeechStarted(sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (session) {
      session.socket.emit('voice:speech-started');
    }
  }

  /**
   * EXPLANATION: Handle speech stopped event
   */
  private handleSpeechStopped(sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (session) {
      session.socket.emit('voice:speech-stopped');
    }
  }

  /**
   * EXPLANATION: Handle service disconnection
   */
  private async handleServiceDisconnected(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      const endTime = new Date();
      session.socket.emit('voice:session-ended', {
        sessionId,
        endedAt: endTime.toISOString()
      });

      // Update session in database
      try {
        const sessionDoc = await Session.findOne({ sessionId });
        if (sessionDoc) {
          sessionDoc.endTime = endTime;
          sessionDoc.status = 'ended';
          sessionDoc.duration = endTime.getTime() - sessionDoc.startTime.getTime();
          await sessionDoc.save();
          logInfo(`[VoiceLiveGateway] Session ${sessionId} ended and updated in database`);
        }
      } catch (dbError) {
        logError(`[VoiceLiveGateway] Failed to update session ${sessionId} in database`, dbError);
      }

      this.cleanupSession(sessionId);
    }
  }

  /**
   * EXPLANATION: Handle service errors
   */
  private handleServiceError(error: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (session) {
      session.socket.emit('voice:error', {
        error: error.message || 'Voice service error',
        code: 'SERVICE_ERROR',
        recoverable: true
      });
    }
  }

  /**
   * EXPLANATION: Get active session count
   */
  public getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * EXPLANATION: Clean up a specific session and its resources
   */
  private cleanupSession(sessionId: string): void {
    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    // Remove pending disconnect timeout
    const pending = this.pendingDisconnects.get(sessionId);
    if (pending) {
      clearTimeout(pending);
      this.pendingDisconnects.delete(sessionId);
    }

    // Clean up assistant messages for this session
    for (const key of this.assistantMessages.keys()) {
      if (key.startsWith(`${sessionId}_`)) {
        this.assistantMessages.delete(key);
      }
    }
    
    // logInfo(`[VoiceLiveGateway] Cleaned up resources for session ${sessionId}`);
  }

  /**
   * EXPLANATION: Clean up all sessions
   */
  public cleanup(): void {
    for (const [sessionId, sessionEntry] of this.activeSessions.entries()) {
      sessionEntry.service.disconnect();
    }
    this.activeSessions.clear();
    this.assistantMessages.clear();
  }
}