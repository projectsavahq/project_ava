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
  private voiceService: VoiceLiveService;
  private activeSessions: Map<string, { socket: Socket; userId: string; service: VoiceLiveService }> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.voiceService = new VoiceLiveService();
    this.setupVoiceNamespace();
    this.setupServiceEventHandlers();
  }

  /**
   * EXPLANATION: Set up the /voice namespace for voice conversations
   */
  private setupVoiceNamespace(): void {
    const voiceNamespace = this.io.of('/voice');

    voiceNamespace.on('connection', (socket: Socket) => {
      logInfo(`[VoiceLiveGateway] Client connected: ${socket.id}`);

      // Handle voice connection request
      socket.on('voice:connect', (data: VoiceConnectDto) => {
        this.handleVoiceConnect(socket, data);
      });

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

      // Handle socket disconnect
      socket.on('disconnect', (reason) => {
        logInfo(`[VoiceLiveGateway] Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleSocketDisconnect(socket);
      });
    });
  }

  /**
   * EXPLANATION: Set up event handlers for VoiceLiveService
   */
  private setupServiceEventHandlers(): void {
    // Handle Azure messages
    this.voiceService.on('message', (message) => {
      this.handleAzureMessage(message);
    });

    // Handle audio deltas
    this.voiceService.on('audio-delta', (message) => {
      this.handleAudioDelta(message);
    });

    // Handle transcript deltas
    this.voiceService.on('transcript-delta', (message) => {
      this.handleTranscriptDelta(message);
    });

    // Handle transcript completion
    this.voiceService.on('transcript-done', (message) => {
      this.handleTranscriptDone(message);
    });

    // Handle user transcripts
    this.voiceService.on('user-transcript', (message) => {
      this.handleUserTranscript(message);
    });

    // Handle speech events
    this.voiceService.on('speech-started', () => {
      this.handleSpeechStarted();
    });

    this.voiceService.on('speech-stopped', () => {
      this.handleSpeechStopped();
    });

    // Handle service disconnection
    this.voiceService.on('disconnected', (data) => {
      this.handleServiceDisconnected(data.sessionId);
    });

    // Handle errors
    this.voiceService.on('error', (error) => {
      this.handleServiceError(error);
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

      // Generate session ID if not provided
      const finalSessionId = sessionId || `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logInfo(`[VoiceLiveGateway] Connecting session: ${finalSessionId} for user: ${userId}`);

      // Create new VoiceLiveService instance for this session
      const sessionService = new VoiceLiveService();

      // Connect to Azure
      await sessionService.connect(finalSessionId, userId, userPreferences);

      // Store session info
      this.activeSessions.set(finalSessionId, {
        socket,
        userId,
        service: sessionService
      });

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
      logError('[VoiceLiveGateway] Voice connect failed', error);
      socket.emit('voice:error', {
        error: 'Failed to establish voice connection',
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

      // Convert audio to Buffer if it's a string
      const audioBuffer = typeof data.audio === 'string'
        ? Buffer.from(data.audio, 'base64')
        : data.audio;

      // Send to Azure via service
      sessionEntry.service.sendAudio(audioBuffer);

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
      logInfo(`[VoiceLiveGateway] Disconnecting session: ${sessionEntry.service['state'].sessionId}`);
      sessionEntry.service.disconnect();
      this.activeSessions.delete(sessionEntry.service['state'].sessionId!);
    }
  }

  /**
   * EXPLANATION: Handle socket disconnection
   */
  private handleSocketDisconnect(socket: Socket): void {
    // Find and clean up any sessions for this socket
    for (const [sessionId, sessionEntry] of this.activeSessions.entries()) {
      if (sessionEntry.socket === socket) {
        logInfo(`[VoiceLiveGateway] Cleaning up session ${sessionId} due to socket disconnect`);
        sessionEntry.service.disconnect();
        this.activeSessions.delete(sessionId);
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
  private handleTranscriptDelta(message: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    if (message.delta) {
      session.socket.emit('voice:assistant-transcript', {
        transcript: message.delta,
        isFinal: false
      });
    }
  }

  /**
   * EXPLANATION: Handle transcript completion from Azure
   */
  private handleTranscriptDone(message: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    session.socket.emit('voice:assistant-transcript', {
      transcript: '',
      isFinal: true
    });
  }

  /**
   * EXPLANATION: Handle user transcript from Azure
   */
  private handleUserTranscript(message: any, sessionId?: string): void {
    const session = sessionId ? this.activeSessions.get(sessionId) : null;
    if (!session) return;

    if (message.transcript) {
      session.socket.emit('voice:user-transcript', {
        transcript: message.transcript,
        isFinal: true,
        confidence: message.confidence || 0.9
      });
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
  private handleServiceDisconnected(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.socket.emit('voice:session-ended', {
        sessionId,
        endedAt: new Date().toISOString()
      });
      this.activeSessions.delete(sessionId);
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
   * EXPLANATION: Clean up all sessions
   */
  public cleanup(): void {
    for (const [sessionId, sessionEntry] of this.activeSessions.entries()) {
      sessionEntry.service.disconnect();
    }
    this.activeSessions.clear();
  }
}