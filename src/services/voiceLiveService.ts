/**
 * EXPLANATION: Voice Live Service
 *
 * Core service that handles communication with Azure Voice Live API.
 * Manages WebSocket connection, audio streaming, and real-time conversation processing.
 *
 * Key responsibilities:
 * 1. Establish and maintain WebSocket connection to Azure
 * 2. Send session configuration and audio data
 * 3. Process incoming messages and audio from Azure
 * 4. Handle connection lifecycle and error recovery
 * 5. Emit events for gateway to forward to clients
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { loadVoiceLiveConfig } from '../config/voiceLive.config';
import { logInfo, logError, logWarn } from '../utils/logger';
import {
  SessionConfig,
  VoiceLiveClientState,
  ConnectionStatus,
  AzureVoiceLiveMessage,
  VoiceLiveWebSocketMessage
} from '../types/voiceLive';

export class VoiceLiveService extends EventEmitter {
  private config = loadVoiceLiveConfig();
  private ws: WebSocket | null = null;
  private state: VoiceLiveClientState;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.state = {
      connectionStatus: 'disconnected',
      messageQueue: [],
      reconnectAttempts: 0
    };
  }

  /**
   * EXPLANATION: Connect to Azure Voice Live API
   */
  async connect(sessionId: string, userId: string, userPreferences?: any): Promise<void> {
    try {
      logInfo(`[VoiceLiveService] Connecting session ${sessionId} for user ${userId}`);

      this.state.sessionId = sessionId;
      this.state.userId = userId;
      this.state.connectionStatus = 'connecting';

      // Build WebSocket URL
      const wsUrl = this.buildWebSocketUrl();
      const headers = this.buildAuthHeaders();

      logInfo(`[VoiceLiveService] Connecting to: ${wsUrl}`);

      this.ws = new WebSocket(wsUrl, { headers });

      return new Promise((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket creation failed'));

        const connectionTimeout = setTimeout(() => {
          this.state.connectionStatus = 'error';
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          logInfo(`[VoiceLiveService] WebSocket connected for session ${sessionId}`);
          this.state.connectionStatus = 'connected';
          this.state.reconnectAttempts = 0;

          // Send session configuration
          this.sendSessionConfig(userPreferences);

          // Start heartbeat
          this.startHeartbeat();

          // Start session timeout
          this.resetSessionTimeout();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          logError(`[VoiceLiveService] WebSocket error for session ${sessionId}`, error);
          this.state.connectionStatus = 'error';
          reject(error);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(connectionTimeout);
          logInfo(`[VoiceLiveService] WebSocket closed for session ${sessionId}: ${code} - ${reason}`);
          this.state.connectionStatus = 'disconnected';
          this.handleDisconnection();
        });
      });

    } catch (error) {
      logError(`[VoiceLiveService] Connection failed for session ${sessionId}`, error);
      this.state.connectionStatus = 'error';
      throw error;
    }
  }

  /**
   * EXPLANATION: Send audio data to Azure
   */
  sendAudio(audioBuffer: Buffer): void {
    if (this.state.connectionStatus !== 'connected' || !this.ws) {
      logWarn(`[VoiceLiveService] Cannot send audio - not connected`);
      return;
    }

    try {
      // Convert to base64
      const base64Audio = audioBuffer.toString('base64');

      const message = {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
        event_id: uuidv4()
      };

      this.ws.send(JSON.stringify(message));
      this.resetSessionTimeout();

    } catch (error) {
      logError(`[VoiceLiveService] Error sending audio`, error);
      this.emit('error', error);
    }
  }

  /**
   * EXPLANATION: Send text input (alternative to audio)
   */
  sendTextInput(text: string): void {
    if (this.state.connectionStatus !== 'connected' || !this.ws) {
      logWarn(`[VoiceLiveService] Cannot send text - not connected`);
      return;
    }

    try {
      const message = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{
            type: 'input_text',
            text: text
          }]
        },
        event_id: uuidv4()
      };

      this.ws.send(JSON.stringify(message));

      // After creating the conversation item, trigger a response
      const responseMessage = {
        type: 'response.create',
        event_id: uuidv4()
      };

      this.ws.send(JSON.stringify(responseMessage));
      this.resetSessionTimeout();

    } catch (error) {
      logError(`[VoiceLiveService] Error sending text input`, error);
      this.emit('error', error);
    }
  }

  /**
   * EXPLANATION: Disconnect from Azure
   */
  disconnect(): void {
    logInfo(`[VoiceLiveService] Disconnecting session ${this.state.sessionId}`);

    this.clearTimeouts();
    this.state.connectionStatus = 'disconnected';

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.emit('disconnected', { sessionId: this.state.sessionId });
  }

  /**
   * EXPLANATION: Reset session timeout
   */
  resetSessionTimeout(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
    }

    this.sessionTimeout = setTimeout(() => {
      logWarn(`[VoiceLiveService] Session ${this.state.sessionId} timed out`);
      this.disconnect();
    }, (this.config.sessionTimeout || 30) * 60 * 1000); // Convert minutes to milliseconds
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private buildWebSocketUrl(): string {
    const endpoint = this.config.azureEndpoint.replace(/^https:/, 'wss:').replace(/\/$/, '');
    const url = `${endpoint}/voice-live/realtime?api-version=${this.config.apiVersion}&model=${this.config.model}&api-key=${this.config.apiKey}`;
    return url;
  }

  private buildAuthHeaders(): Record<string, string> {
    return {
      'x-ms-client-request-id': uuidv4()
    };
  }

  private buildSessionConfig(userPreferences?: any): SessionConfig {
    const voiceName = userPreferences?.voicePreference || 'en-US-Ava:DragonHDLatestNeural';
    const temperature = userPreferences?.temperatureLevel || 0.7;

    return {
      type: 'session.update',
      session: {
        instructions: 'You are a helpful AI assistant. Respond quickly and concisely in natural, engaging language. Keep responses brief and conversational.',
        turn_detection: {
          type: 'azure_semantic_vad',
          threshold: 0.2,
          prefix_padding_ms: 100,
          silence_duration_ms: 100,
          remove_filler_words: true,
          end_of_utterance_detection: {
            model: 'semantic_detection_v1',
            threshold: 0.005,
            timeout: 1
          }
        },
        input_audio_noise_reduction: {
          type: 'azure_deep_noise_suppression'
        },
        input_audio_echo_cancellation: {
          type: 'server_echo_cancellation'
        },
        voice: {
          name: voiceName,
          type: 'azure-standard',
          temperature: temperature,
          rate: '1.3'
        }
      },
      event_id: uuidv4()
    };
  }

  private sendSessionConfig(userPreferences?: any): void {
    if (!this.ws || this.state.connectionStatus !== 'connected') {
      return;
    }

    try {
      const sessionConfig = this.buildSessionConfig(userPreferences);
      this.ws.send(JSON.stringify(sessionConfig));
      logInfo(`[VoiceLiveService] Session config sent for ${this.state.sessionId}`);
    } catch (error) {
      logError(`[VoiceLiveService] Error sending session config`, error);
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: any = JSON.parse(data.toString());
      this.state.lastMessageAt = new Date();

      // Emit raw message for gateway to handle
      this.emit('message', message);

      // Handle specific message types
      switch (message.type) {
        case 'session.created':
          logInfo(`[VoiceLiveService] Session created: ${message.session?.id}`);
          break;

        case 'session.updated':
          logInfo(`[VoiceLiveService] Session updated`);
          break;

        case 'input_audio_buffer.speech_started':
          this.emit('speech-started');
          break;

        case 'input_audio_buffer.speech_stopped':
          this.emit('speech-stopped');
          break;

        case 'conversation.item.created':
          logInfo(`[VoiceLiveService] Conversation item created: ${message.item?.id}`);
          break;

        case 'response.created':
          logInfo(`[VoiceLiveService] Response created: ${message.response?.id}`);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            this.emit('user-transcript', {
              transcript: message.transcript,
              response_id: message.response_id,
              item_id: message.item_id
            });
          }
          break;

        case 'response.audio_transcript.delta':
          if (message.delta) {
            this.emit('transcript-delta', {
              delta: message.delta,
              response_id: message.response_id,
              item_id: message.item_id
            });
          }
          break;

        case 'response.audio_transcript.done':
          logInfo(`[VoiceLiveService] Audio transcript completed`);
          this.emit('transcript-done', {
            response_id: message.response_id,
            item_id: message.item_id
          });
          break;

        case 'response.audio.delta':
          if (message.delta) {
            this.emit('audio-delta', {
              delta: message.delta,
              response_id: message.response_id,
              item_id: message.item_id,
              sequenceNumber: message.sequenceNumber || 1
            });
          }
          break;

        case 'response.audio.done':
          logInfo(`[VoiceLiveService] Audio response completed`);
          this.emit('audio-delta', {
            delta: null,
            response_id: message.response_id,
            item_id: message.item_id,
            type: 'response.audio.done'
          });
          break;

        case 'error':
          logError(`[VoiceLiveService] Azure error: ${message.error?.message}`, message);
          this.emit('error', new Error(message.error?.message || 'Azure API error'));
          break;

        default:
          // Log other message types for debugging
          logInfo(`[VoiceLiveService] Unhandled message type: ${message.type}`);
      }

    } catch (error) {
      logError(`[VoiceLiveService] Error parsing message`, error);
    }
  }

  private handleDisconnection(): void {
    this.clearTimeouts();

    // Attempt reconnection if configured
    if (this.state.reconnectAttempts < (this.config.maxReconnectAttempts || 3)) {
      this.state.reconnectAttempts++;
      logInfo(`[VoiceLiveService] Attempting reconnection ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts}`);

      this.reconnectTimeout = setTimeout(() => {
        if (this.state.sessionId && this.state.userId) {
          this.connect(this.state.sessionId, this.state.userId).catch(error => {
            logError(`[VoiceLiveService] Reconnection failed`, error);
          });
        }
      }, this.config.reconnectDelay);
    } else {
      this.emit('disconnected', { sessionId: this.state.sessionId });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.state.connectionStatus === 'connected') {
        // Azure doesn't require explicit heartbeats, but we can send a ping
        this.ws.ping();
      }
    }, 30000); // 30 seconds
  }

  private clearTimeouts(): void {
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}