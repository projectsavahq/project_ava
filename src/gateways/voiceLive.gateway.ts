/**
 * EXPLANATION: Voice Live Gateway
 * 
 * This is the WebSocket (Socket.IO) handler for real-time voice communication.
 * It's the bridge between:
 * 1. Client (browser/mobile with WebSocket)
 * 2. VoiceLiveService (orchestration)
 * 3. Azure Voice Live API
 * 
 * Socket.IO provides:
 * - Automatic reconnection handling
 * - Message ordering
 * - Binary data support (important for audio)
 * - Rooms for multiplexing
 * 
 * Real-time flow:
 * Client sends audio → Gateway receives → VoiceLiveService processes → Gateway emits response → Client receives
 * All in real-time with WebSocket!
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { logInfo, logError } from '../utils/logger';
import { VoiceLiveService } from '../services/voiceLiveService';
import { authService } from '../services/authService';
import {
  VoiceGatewayEvents,
  VoiceServerEvents,
  AzureVoiceLiveMessage,
} from '../types/voiceLive';

/**
 * EXPLANATION: WebSocket Gateway Decorator
 * @WebSocketGateway() configuration:
 * - namespace: 'voice' - clients connect to /voice
 * - cors: required for cross-origin WebSocket connections
 */
@WebSocketGateway({ namespace: 'voice', cors: { origin: '*' } })
@Injectable()
export class VoiceLiveGateway {
  @WebSocketServer() server!: Server;

  private voiceLiveService: VoiceLiveService;
  // Track which socket is using which session
  private socketToSession: Map<string, string> = new Map();
  // Monitor Azure response streams
  private responseStreams: Map<string, any> = new Map();

  constructor() {
    this.voiceLiveService = new VoiceLiveService();
  }

  /**
   * EXPLANATION: Gateway initialization
   * Called when the gateway is initialized.
   * Set up any resources that need to exist before connections happen.
   */
  afterInit(server: Server) {
    logInfo('[VoiceLiveGateway] Initialized');

    // Optional: Set up periodic cleanup of idle sessions
    setInterval(async () => {
      const cleaned = await this.voiceLiveService.cleanupIdleSessions();
      if (cleaned > 0) {
        logInfo(
          `[VoiceLiveGateway] Cleaned up ${cleaned} idle sessions`
        );
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * EXPLANATION: Client connects to WebSocket
   * Called when a new client connects.
   * Useful for logging, but actual session is created in @SubscribeMessage
   */
  handleConnection(client: Socket) {
    logInfo(`[VoiceLiveGateway] Client connected: ${client.id}`);

    // Emit welcome message (optional)
    client.emit('voice:ready', {
      message: 'Voice gateway ready for connection',
      socketId: client.id,
    });
  }

  /**
   * EXPLANATION: Client disconnects from WebSocket
   * Called when client disconnects (network loss, page close, etc.)
   * Must clean up associated voice session
   */
  async handleDisconnect(client: Socket) {
    logInfo(`[VoiceLiveGateway] Client disconnected: ${client.id}`);

    // Check if this socket had an active session
    const sessionId = this.socketToSession.get(client.id);
    if (sessionId) {
      logInfo(
        `[VoiceLiveGateway] Ending session ${sessionId} due to disconnect`
      );

      // End the voice session
      try {
        await this.voiceLiveService.endSession(sessionId);
      } catch (error) {
        logError(
          '[VoiceLiveGateway] Error ending session on disconnect',
          error
        );
      }

      // Clean up tracking
      this.socketToSession.delete(client.id);
      this.responseStreams.delete(sessionId);
    }
  }

  /**
   * EXPLANATION: Client initiates voice connection
   * 
   * Event: 'voice:connect'
   * Client sends: userId and optional preferences
   * Server does: creates session, connects to Azure, sends config
   * Returns: sessionId and configuration
   * 
   * EXPLANATION of what happens:
   * 1. VoiceLiveService.startSession() creates:
   *    - MongoDB session document
   *    - Azure WebSocket connection
   *    - Session context (stored in memory)
   * 2. Session config sent to Azure with system prompt
   * 3. Returns sessionId to client
   * 4. Client can now send audio
   */
  @SubscribeMessage('voice:connect')
  async handleVoiceConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: VoiceGatewayEvents['voice:connect']
  ) {
    try {
      let { userId, sessionId, userPreferences, token } = payload as any;

      // Also accept token sent on the Socket.IO handshake
      const hsToken = (client.handshake && (client.handshake as any).auth && (client.handshake as any).auth.token) || undefined;
      token = token || hsToken;

      // If a token is provided, validate it and derive the authenticated userId
      if (token) {
        try {
          const validatedUser = await authService.validateToken(token);
          // authService may return different shapes; prefer `userId` then `id`
          const derivedId = (validatedUser as any).userId || (validatedUser as any).id || (validatedUser as any)._id;
          if (derivedId) userId = derivedId;
          logInfo(`[VoiceLiveGateway] Authenticated socket ${client.id} as user ${userId}`);
        } catch (err) {
          logError('[VoiceLiveGateway] Invalid auth token for socket connect', err);
          client.emit('voice:error', {
            error: 'Authentication failed',
            code: 'AUTH_FAILED',
            recoverable: false,
          });
          // Disconnect immediately
          try { client.disconnect(true); } catch (e) {}
          return;
        }
      }

      // If no token and no userId provided, reject
      if (!userId) {
        client.emit('voice:error', {
          error: 'Missing user credentials',
          code: 'AUTH_REQUIRED',
          recoverable: false,
        });
        try { client.disconnect(true); } catch (e) {}
        return;
      }

      // proceed with the (possibly authenticated) userId

      logInfo(`[VoiceLiveGateway] Voice connect request from user: ${userId}`);

      // Start the session with VoiceLiveService
      const sessionResult = await this.voiceLiveService.startSession(
        userId,
        client.id,
        userPreferences
      );

      // Track this socket → session mapping
      this.socketToSession.set(client.id, sessionResult.sessionId);

      // Join client to a room for this session
      // EXPLANATION: Socket.IO rooms allow sending to specific groups
      // Useful if multiple clients are in same conversation
      client.join(`session:${sessionResult.sessionId}`);

      // Send success response back to client
      client.emit('voice:connected', {
        sessionId: sessionResult.sessionId,
        userId,
        status: 'ready',
        metadata: sessionResult.config,
      });

      logInfo(
        `[VoiceLiveGateway] Session started: ${sessionResult.sessionId}`
      );

      // Start listening for Azure responses in background
      // EXPLANATION: This doesn't block - it starts a background task
      this.startAzureResponseListener(sessionResult.sessionId, client);
    } catch (error) {
      logError('[VoiceLiveGateway] Error in voice connect', error);

      client.emit('voice:error', {
        error: 'Failed to start voice session',
        code: 'VOICE_CONNECT_ERROR',
        recoverable: true,
      });
    }
  }

  /**
   * EXPLANATION: Client sends audio chunk
   * 
   * Event: 'voice:audio'
   * Client sends: audio data, timestamp
   * Server does: forwards to Azure, starts async processing
   * Returns: nothing (async, will emit responses later)
   * 
   * EXPLANATION of audio handling:
   * Audio must be:
   * - PCM format (raw uncompressed)
   * - 24000 Hz sample rate
   * - Mono (1 channel)
   * - 16-bit signed integers
   * 
   * Typical audio chunk size: 1200 samples (~50ms of audio)
   * Higher frequency = lower latency (more responsive)
   * Lower frequency = less bandwidth
   * 50ms is a good balance
   */
  @SubscribeMessage('voice:audio')
  async handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: VoiceGatewayEvents['voice:audio']
  ) {
    try {
      const sessionId = this.socketToSession.get(client.id);
      if (!sessionId) {
        client.emit('voice:error', {
          error: 'No active voice session',
          code: 'NO_SESSION',
          recoverable: false,
        });
        return;
      }

      // Extract audio data (could be Buffer or base64 string)
      const audioData =
        typeof payload.audio === 'string'
          ? Buffer.from(payload.audio, 'base64')
          : payload.audio;

      // Send to Azure immediately (don't wait)
      // EXPLANATION: This is async but we don't await it
      // Client doesn't need to wait, we process in background
        this.voiceLiveService.processAudioChunk(sessionId, audioData).catch(
          (error: any) => {
            logError('[VoiceLiveGateway] Error processing audio chunk', error);
            client.emit('voice:error', {
              error: 'Failed to process audio',
              code: 'AUDIO_ERROR',
              recoverable: true,
            });
          }
        );

      // NOTE: We emit success immediately, then stream responses as they arrive
      // This is key to real-time feel - client sees immediate feedback
    } catch (error) {
      logError('[VoiceLiveGateway] Error in audio handler', error);
      client.emit('voice:error', {
        error: 'Audio processing error',
        code: 'AUDIO_HANDLER_ERROR',
        recoverable: true,
      });
    }
  }

  /**
   * EXPLANATION: Client indicates end of audio turn (VAD detected silence)
   *
   * Event: 'voice:audio-end'
   * Server action: flush Azure audio buffer so Azure begins generating response
   */
  @SubscribeMessage('voice:audio-end')
  async handleAudioEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string }
  ) {
    try {
      const sessionId = this.socketToSession.get(client.id);
      if (!sessionId) {
        client.emit('voice:error', {
          error: 'No active voice session',
          code: 'NO_SESSION',
          recoverable: false,
        });
        return;
      }

      const voiceLiveClient = await this.voiceLiveService.getVoiceLiveClient(sessionId);
      if (!voiceLiveClient) {
        client.emit('voice:error', {
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          recoverable: false,
        });
        return;
      }

      logInfo(`[VoiceLiveGateway] Received audio-end from client for session ${sessionId} — flushing audio buffer`);
      try {
        voiceLiveClient.flushAudioBuffer();
      } catch (e) {
        logError('[VoiceLiveGateway] Error flushing audio buffer', e);
      }
    } catch (error) {
      logError('[VoiceLiveGateway] Error in audio-end handler', error);
    }
  }

  /**
   * EXPLANATION: Client sends text instead of audio
   * 
   * Sometimes users prefer typing.
   * This sends text directly to Azure instead of processing audio.
   */
  @SubscribeMessage('voice:text-input')
  async handleTextInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: VoiceGatewayEvents['voice:text-input']
  ) {
    try {
      const sessionId = this.socketToSession.get(client.id);
      if (!sessionId) {
        client.emit('voice:error', {
          error: 'No active voice session',
          code: 'NO_SESSION',
          recoverable: false,
        });
        return;
      }

      const { text } = payload;

      logInfo(
        `[VoiceLiveGateway] Text input for session ${sessionId}: ${text.substring(0, 50)}`
      );

      // Get the session's Azure client and send text
      const voiceLiveClient = await this.voiceLiveService.getVoiceLiveClient(sessionId);
      
      if (!voiceLiveClient) {
        client.emit('voice:error', {
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
          recoverable: false,
        });
        return;
      }

      // EXPLANATION: Send text input to Azure via voiceLiveClient
      // Similar to audio, we send text to Azure for processing.
      // Azure will treat it as if the user spoke these words and generate a response.
      voiceLiveClient.sendTextMessage(text);

      logInfo(`[VoiceLiveGateway] Text sent to Azure for session ${sessionId}`);

      // Emit receipt confirmation to client
      client.emit('voice:text-acknowledged', {
        text,
        timestamp: Date.now(),
      });
    } catch (error) {
      logError('[VoiceLiveGateway] Error in text input', error);
      client.emit('voice:error', {
        error: 'Failed to process text input',
        code: 'TEXT_INPUT_ERROR',
        recoverable: true,
      });
    }
  }

  /**
   * EXPLANATION: Client ends session
   * 
   * Called when user clicks "End Conversation"
   * Gracefully closes everything and saves summary
   */
  @SubscribeMessage('voice:disconnect')
  async handleVoiceDisconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: VoiceGatewayEvents['voice:disconnect']
  ) {
    try {
      const sessionId = this.socketToSession.get(client.id);
      if (!sessionId) {
        return;
      }

      logInfo(`[VoiceLiveGateway] User ended session: ${sessionId}`);

      // End the session (saves summary, closes Azure connection)
      const summary = await this.voiceLiveService.endSession(sessionId);

      // Send session summary to client
      client.emit('voice:session-ended', {
        sessionId,
        endedAt: new Date().toISOString(),
        summary: summary.summary,
      });

      // Clean up tracking
      this.socketToSession.delete(client.id);
      this.responseStreams.delete(sessionId);
    } catch (error) {
      logError('[VoiceLiveGateway] Error ending session', error);
      client.emit('voice:error', {
        error: 'Failed to end session',
        code: 'DISCONNECT_ERROR',
        recoverable: false,
      });
    }
  }

  /**
   * EXPLANATION: Client sends heartbeat
   * 
   * Periodically (every 30 seconds), client sends heartbeat to prevent timeout.
   * Server responds with acknowledgment.
   * Useful for:
   * - Detecting stale connections
   * - Keeping connection alive through proxies/firewalls
   * - Measuring latency
   */
  @SubscribeMessage('voice:heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: VoiceGatewayEvents['voice:heartbeat']
  ) {
    const sessionId = payload.sessionId;

    // Respond immediately
    client.emit('voice:heartbeat-ack', {
      timestamp: Date.now(),
      sessionId,
    });
  }

  /**
   * EXPLANATION: Listen for Azure responses
   * 
   * Background task that continuously polls Azure for responses.
   * When responses arrive, emits them to the client via WebSocket.
   * 
   * This is the key to real-time streaming!
   * 
   * Flow:
   * 1. Client sends audio
   * 2. This listener gets responses from Azure
   * 3. Emits to client immediately
   * 4. Client plays audio/shows transcript in real-time
   * 
   * Different message types from Azure:
   * - response.transcript → emit as 'voice:user-transcript' or 'voice:assistant-transcript'
   * - response.audio → emit as 'voice:audio'
   * - response.done → emit as 'voice:done'
   */
  private async startAzureResponseListener(
    sessionId: string,
    client: Socket
  ) {
    try {
      const stream = {
        active: true,
        lastMessageTime: Date.now(),
      };

      this.responseStreams.set(sessionId, stream);

      // EXPLANATION: This is a background loop that runs indefinitely
      // while the session is active, listening for Azure responses
      while (stream.active) {
        try {
          // Get the VoiceLiveClient for this session
          const voiceLiveClient = await this.voiceLiveService.getVoiceLiveClient(sessionId);

          if (!voiceLiveClient) {
            // Session ended or client disconnected
            stream.active = false;
            break;
          }

          // Get next message from Azure queue (non-blocking)
          // EXPLANATION: VoiceLiveClient queues messages as they arrive from Azure
          // We retrieve them here to send to the client via WebSocket
          const azureMessage = voiceLiveClient.getNextMessage();

          if (azureMessage) {
            // Process and emit the message to client based on type
            // EXPLANATION: Different message types from Azure need different handling:
            // 1. response.audio - stream audio to client
            // 2. response.transcript - show what user/assistant said
            // 3. response.done - conversation turn is complete
            await this.processAndEmitAzureMessage(sessionId, client, azureMessage);
            stream.lastMessageTime = Date.now();
          } else {
            // No message yet, small delay to prevent busy-waiting
            await this.sleep(50);
          }

          // Check for timeout (no messages for 30 seconds)
          if (Date.now() - stream.lastMessageTime > 30000) {
            logInfo(`[VoiceLiveGateway] Response stream timeout for ${sessionId}`);
            stream.active = false;
            client.emit('voice:error', {
              error: 'Connection timeout',
              code: 'TIMEOUT',
              recoverable: true,
            });
          }
        } catch (error) {
          if (stream.active) {
            logError('[VoiceLiveGateway] Error in response listener', error);
            client.emit('voice:error', {
              error: 'Response stream error',
              code: 'STREAM_ERROR',
              recoverable: true,
            });
          }
          break;
        }
      }

      logInfo(`[VoiceLiveGateway] Response listener ended for ${sessionId}`);
    } catch (error) {
      logError('[VoiceLiveGateway] Error starting response listener', error);
    }
  }

  /**
   * EXPLANATION: Emit emotion data to client
   * 
   * Called by VoiceLiveService when emotion is detected.
   * Shows real-time emotion indicator to user.
   */
  async emitEmotion(
    sessionId: string,
    emotionData: any
  ): Promise<void> {
    // Find the socket for this session
    for (const [socketId, sid] of this.socketToSession) {
      if (sid === sessionId) {
        const client = this.server.sockets.sockets.get(socketId);
        if (client) {
          client.emit('voice:emotion', { emotion: emotionData });
        }
        break;
      }
    }
  }

  /**
   * EXPLANATION: Emit crisis alert to client
   * 
   * Called by VoiceLiveService when crisis is detected.
   * Shows urgent alert and resources to user.
   */
  async emitCrisisAlert(
    sessionId: string,
    crisisData: any
  ): Promise<void> {
    for (const [socketId, sid] of this.socketToSession) {
      if (sid === sessionId) {
        const client = this.server.sockets.sockets.get(socketId);
        if (client) {
          client.emit('voice:crisis-alert', {
            severity: crisisData.severity,
            keywords: crisisData.keywords,
            message: this.getCrisisMessage(crisisData.severity),
            escalated: crisisData.escalated,
          });
        }
        break;
      }
    }
  }

  /**
   * EXPLANATION: Get appropriate message for crisis severity
   */
  private getCrisisMessage(severity: string): string {
    const messages = {
      critical: `🚨 Crisis Support Available:
National Suicide Prevention Lifeline: 988
Crisis Text Line: Text HOME to 741741
Emergency: Call 911`,

      high: `⚠️ Support Resources:
Crisis Text Line: Text HOME to 741741
National Suicide Prevention Lifeline: 988`,

      medium: `We're here for you. Consider reaching out to:
- A trusted friend or family member
- A mental health professional
- A crisis counselor`,

      low: `Remember to take care of yourself. What would feel supportive right now?`,
    };

    return messages[severity as keyof typeof messages] || messages.low;
  }

  /**
   * EXPLANATION: Utility to sleep (delay)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  /**
   * EXPLANATION: Process and emit Azure messages to client
   * 
   * Handles different message types from Azure:
   * - audio: stream to client for playback
   * - transcript: show text in real-time
   * - done: conversation turn complete
   * 
   * Based on Python script's message handling logic
   */
  private async processAndEmitAzureMessage(
    sessionId: string,
    client: Socket,
    azureMessage: any
  ): Promise<void> {
    try {
      if (!azureMessage) return;

      // EXPLANATION: Route message handling based on type from Azure
      // Similar to how Python script checks message['type']
      const messageType = azureMessage.type || '';

      if (messageType.includes('audio')) {
        // EXPLANATION: Stream audio response from Azure to client
        // Audio is sent in chunks as it arrives from Azure
        if (azureMessage.audio) {
          client.emit('voice:audio', {
            audio: azureMessage.audio, // Base64 encoded PCM audio
            sequenceNumber: azureMessage.index || 0,
            isLastChunk: azureMessage.final || false,
          });
        }
      } else if (messageType.includes('transcript')) {
        // EXPLANATION: Show AI's response text in real-time
        // This is what the AI is saying (transcription of TTS)
        if (azureMessage.transcript) {
          client.emit('voice:assistant-transcript', {
            transcript: azureMessage.transcript,
            isFinal: !messageType.includes('delta'),
          });
        }
      } else if (messageType.includes('input') && messageType.includes('transcript')) {
        // EXPLANATION: Show user's speech transcription
        // What the user said (speech-to-text result)
        if (azureMessage.transcript) {
          client.emit('voice:user-transcript', {
            transcript: azureMessage.transcript,
            isFinal: !messageType.includes('delta'),
            confidence: azureMessage.confidence || 0.95,
          });

          // Update session with user input for emotion/crisis detection
          await this.voiceLiveService.recordUserInput(
            sessionId,
            azureMessage.transcript
          );
        }
      } else if (messageType === 'response.done' || messageType.includes('done')) {
        // EXPLANATION: Turn is complete, ready for next user input
        client.emit('voice:turn-complete', {
          sessionId,
          timestamp: Date.now(),
        });
      } else if (messageType.includes('error')) {
        // EXPLANATION: Azure encountered an error
        logError('[VoiceLiveGateway] Azure error in message', azureMessage);
        client.emit('voice:error', {
          error: azureMessage.error || 'Azure processing error',
          code: 'AZURE_ERROR',
          recoverable: true,
        });
      }
    } catch (error) {
      logError('[VoiceLiveGateway] Error processing Azure message', error);
      client.emit('voice:error', {
        error: 'Message processing error',
        code: 'MESSAGE_PROCESS_ERROR',
        recoverable: true,
      });
    }
  }

}
