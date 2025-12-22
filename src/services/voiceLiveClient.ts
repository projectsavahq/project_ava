/**
 * EXPLANATION: Voice Live Client Service
 * 
 * This service handles the WebSocket connection to Azure Voice Live API.
 * It's equivalent to the VoiceLiveConnection and AzureVoiceLive classes in the Python script.
 * 
 * Key responsibilities:
 * 1. Establish WebSocket connection to Azure
 * 2. Send/receive messages from Azure
 * 3. Manage session lifecycle (connect, disconnect, error handling)
 * 4. Queue messages for processing
 * 5. Handle reconnection logic
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger';
import {
  AzureVoiceLiveMessage,
  VoiceLiveClientState,
  ConnectionStatus,
  SessionConfig,
} from '../types/voiceLive';

/**
 * EXPLANATION: VoiceLiveClient class
 * Manages the WebSocket connection to Azure Voice Live API.
 * 
 * Flow (like Python script):
 * 1. Constructor receives Azure endpoint, API key, model name
 * 2. connect() creates WebSocket connection
 * 3. WebSocket opens, we send session config
 * 4. Then we can send/receive audio and messages
 * 5. disconnect() closes the connection
 */
export class VoiceLiveClient extends EventEmitter {
  private websocket: WebSocket | null = null;
  private state: VoiceLiveClientState = {
    connectionStatus: 'disconnected',
    messageQueue: [],
    reconnectAttempts: 0,
  };

  // Configuration from environment
  private azureEndpoint: string;
  private apiKey: string;
  private apiVersion: string;
  private model: string;

  // Reconnection logic
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // ms

  constructor(config: {
    azureEndpoint: string;
    apiKey: string;
    apiVersion: string;
    model: string;
  }) {
    super();

    this.azureEndpoint = "https://proj-defauhvhvhvhf.cognitiveservices.azure.com";
    this.apiKey = '1mIAkhlPML6S59V83ZJgLqomUQiT1OOhbwwv0Jp9sPKzbItqpOVIJQQJ99BLACYeBjFXJ3w3AAAAACOGhMcW';
    this.apiVersion = config.apiVersion;
    this.model = config.model;

    logInfo(`[VoiceLiveClient] Initialized with endpoint: ${this.azureEndpoint}`);
  }

  /**
   * EXPLANATION: Establish connection to Azure Voice Live API
   * 
   * This mimics the Python script's VoiceLiveConnection.connect() method.
   * 
   * Steps:
   * 1. Build WebSocket URL from Azure endpoint
   * 2. Create auth headers with API key
   * 3. Open WebSocket connection
   * 4. Wait for connection to be ready
   * 
   * The WebSocket URL format:
   * wss://[region].voice.azure.com/voice-live/realtime?api-version=2025-05-01-preview&model=gpt-4o
   */
  async connect(sessionId: string, userId: string): Promise<void> {
    try {
      // Update state
      this.state.connectionStatus = 'connecting';
      this.state.sessionId = sessionId;
      this.state.userId = userId;

      // Step 1: Build WebSocket URL from HTTPS endpoint
      // EXPLANATION: Azure uses HTTPS for REST but wss:// for WebSocket
      // wss:// = WebSocket Secure (like HTTPS but for WebSocket)
      const wsEndpoint = this.azureEndpoint
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')
        .replace(/\/$/, ''); // Remove trailing slash

      const url = `${wsEndpoint}/voice-live/realtime?api-version=${this.apiVersion}&model=${this.model}`;

      logInfo(
        `[VoiceLiveClient] Connecting to Azure Voice Live: ${this.model}`
      );

      // Step 2: Create authentication headers
      // EXPLANATION: Azure Voice Live requires API key in header for authentication
      const headers = {
        'api-key': this.apiKey,
        'x-ms-client-request-id': uuidv4(), // Unique ID for tracking this request
      };

      this.state.websocketUrl = url;
      this.state.authHeaders = headers;

      // Step 3: Create WebSocket connection
      // EXPLANATION: ws library creates the connection with headers
      this.websocket = new WebSocket(url, {
        headers,
        perMessageDeflate: false, // Disable compression for lower latency
      });

      // Step 4: Set up WebSocket event handlers
      this.setupWebSocketHandlers();

      // Step 5: Wait for connection to be ready
      // EXPLANATION: We don't return until WebSocket is OPEN
      await this.waitForConnection();

      this.state.connectionStatus = 'connected';
      this.state.reconnectAttempts = 0; // Reset reconnect counter

      logInfo(`[VoiceLiveClient] Successfully connected to Azure`);

      // Emit event so other services know connection is ready
      this.emit('connected', { sessionId, userId });
    } catch (error) {
      this.state.connectionStatus = 'error';
      logError('[VoiceLiveClient] Connection failed', error);
      throw error;
    }
  }

  /**
   * EXPLANATION: Set up WebSocket event handlers
   * 
   * WebSocket events in order:
   * 1. 'open' - connection established
   * 2. 'message' - received data from Azure
   * 3. 'error' - connection error
   * 4. 'close' - connection closed
   */
  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    // When connection opens successfully
    this.websocket.on('open', () => {
      logInfo('[VoiceLiveClient] WebSocket opened', {
        url: this.state.websocketUrl,
        sessionId: this.state.sessionId,
        userId: this.state.userId,
      });
    });

    // When we receive a message from Azure
    // EXPLANATION: This could be audio data, transcript, or status updates
    this.websocket.on('message', (data: Buffer) => {
      try {
        // Azure sends messages as JSON strings
        const message = JSON.parse(data.toString()) as AzureVoiceLiveMessage;

        // Queue the message for processing
        // EXPLANATION: We queue instead of process immediately because
        // the message might need to be ordered relative to audio chunks
        this.state.messageQueue.push(message);
        this.state.lastMessageAt = new Date();

        logInfo(
          `[VoiceLiveClient] Received message type: ${message.type}`
        );

        // Emit event so services can react to specific message types
        this.emit('message', message);
      } catch (error) {
        logError('[VoiceLiveClient] Failed to parse message', error);
      }
    });

    // When an error occurs
    this.websocket.on('error', (error: Error) => {
      this.state.connectionStatus = 'error';
      logError('[VoiceLiveClient] WebSocket error', error && (error.stack || error));
      this.emit('error', error);
    });

    // When connection closes
    this.websocket.on('close', (code: number, reason: Buffer) => {
      this.state.connectionStatus = 'disconnected';
      const reasonStr = reason ? reason.toString() : undefined;
      logInfo('[VoiceLiveClient] WebSocket closed', { code, reason: reasonStr });
      this.emit('closed', { code, reason: reasonStr });
    });

    // Unexpected HTTP response during websocket handshake
    // Useful to capture 401/403 or other HTTP failure responses from Azure
    try {
      (this.websocket as any).on && (this.websocket as any).on('unexpected-response', (req: any, res: any) => {
        try {
          const statusCode = res && res.statusCode;
          const headers = res && res.headers;
          logError('[VoiceLiveClient] Unexpected response during WebSocket handshake', { statusCode, headers });
          this.emit('unexpected-response', { statusCode, headers });
        } catch (e) {
          logError('[VoiceLiveClient] Error handling unexpected-response', e);
        }
      });
    } catch (e) {
      // ignore if ws instance doesn't support unexpected-response in this runtime
    }
  }

  /**
   * EXPLANATION: Wait for WebSocket to be in OPEN state
   * 
   * Returns when the WebSocket is ready to send/receive data.
   * Has timeout to prevent hanging forever.
   * 
   * WebSocket states:
   * CONNECTING (0) - connection opening
   * OPEN (1) - ready to use
   * CLOSING (2) - closing
   * CLOSED (3) - closed
   */
  private waitForConnection(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      // If already open, resolve immediately
      if (this.websocket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Set timeout to prevent infinite waiting
      const timeoutId = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout after ${timeout}ms`));
      }, timeout);

      // Wait for open event
      const onOpen = () => {
        clearTimeout(timeoutId);
        this.websocket?.removeEventListener('open', onOpen);
        resolve();
      };

      this.websocket.addEventListener('open', onOpen);
    });
  }

  /**
   * EXPLANATION: Send session configuration to Azure
   * 
   * This is required before any voice interaction.
   * Configures:
   * - System instructions (how AI should behave)
   * - Turn detection (when to stop listening)
   * - Voice settings (how AI speaks)
   * - Audio processing (noise reduction)
   * 
   * Same as the session_update dict in the Python script.
   */
  sendSessionConfig(config: SessionConfig): void {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    logInfo('[VoiceLiveClient] Sending session configuration');

    // Add timestamp for tracking
    const configWithId = {
      ...config,
      event_id: uuidv4(),
    };

    // Send as JSON string (Azure expects JSON)
    this.websocket.send(JSON.stringify(configWithId));
  }

  /**
   * EXPLANATION: Send audio data to Azure
   * 
   * Audio must be:
   * - PCM format (raw uncompressed audio)
   * - 24000 Hz sample rate (24kHz)
   * - Mono (1 channel)
   * - 16-bit signed integers
   * - Little-endian byte order
   * 
   * We send audio in chunks (not all at once) for:
   * 1. Low latency - user hears AI faster
   * 2. Streaming - can detect voice while more audio arriving
   * 3. Memory - don't buffer huge files
   * 
   * Typical flow:
   * Send 1200 audio samples (~50ms of audio)
   * → Azure processes immediately
   * → More samples arrive
   * → Send next 1200 samples
   * Repeat while user is speaking
   */
  sendAudioChunk(audioData: Buffer | Uint8Array): void {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    try {
      // Azure expects audio appended as a JSON message with base64 payload
      // matching the Python client's `input_audio_buffer.append` format.
      const b64 = Buffer.isBuffer(audioData)
        ? audioData.toString('base64')
        : Buffer.from(audioData).toString('base64');

      const message = {
        type: 'input_audio_buffer.append',
        audio: b64,
        event_id: uuidv4(),
      };

      const json = JSON.stringify(message);
      this.websocket.send(json);
      logInfo('[VoiceLiveClient] Sent audio append', { length: b64.length, sessionId: this.state.sessionId });
    } catch (error: unknown) {
      const errDetails =
        error instanceof Error
          ? (error.stack || error.message)
          : (typeof error === 'string' ? error : JSON.stringify(error));
      logError('[VoiceLiveClient] Failed to send audio chunk', errDetails);
      throw error;
    }
  }

  /**
   * EXPLANATION: Send a text message to Azure
   * 
   * Sometimes users type instead of speaking.
   * We wrap the text in Azure's expected format and send it.
   */
  sendTextMessage(text: string): void {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'input_text.append',
      content: text,
      event_id: uuidv4(),
    };

    this.websocket.send(JSON.stringify(message));
  }

  /**
   * EXPLANATION: Flush audio buffer - tell Azure we're done sending audio
   * 
   * This signals to Azure: "No more audio coming, process what you have and respond."
   * Important for:
   * 1. Telling Azure user finished speaking
   * 2. Getting Azure to start generating response
   * 3. Proper turn detection
   */
  flushAudioBuffer(): void {
    if (!this.websocket || this.state.connectionStatus !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'input_audio_buffer.commit',
      event_id: uuidv4(),
    };

    this.websocket.send(JSON.stringify(message));
    logInfo('[VoiceLiveClient] Audio buffer flushed');
  }

  /**
   * EXPLANATION: Get next message from queue
   * 
   * Messages from Azure are queued as they arrive.
   * This retrieves them in order.
   * 
   * Useful for processing responses sequentially:
   * 1. Get transcript message
   * 2. Get audio messages in order
   * 3. Get completion message
   */
  getNextMessage(): AzureVoiceLiveMessage | null {
    return this.state.messageQueue.shift() || null;
  }

  /**
   * EXPLANATION: Peek at next message without removing it
   * 
   * Check what's coming without consuming it from the queue.
   */
  peekNextMessage(): AzureVoiceLiveMessage | null {
    return this.state.messageQueue[0] || null;
  }

  /**
   * EXPLANATION: Check if there are queued messages
   */
  hasMessages(): boolean {
    return this.state.messageQueue.length > 0;
  }

  /**
   * EXPLANATION: Get current connection status
   * 
   * Check if client is connected, connecting, or disconnected.
   */
  getStatus(): ConnectionStatus {
    return this.state.connectionStatus;
  }

  /**
   * EXPLANATION: Disconnect from Azure
   * 
   * Gracefully close the WebSocket connection.
   * Clean up resources.
   */
  disconnect(): void {
    logInfo('[VoiceLiveClient] Disconnecting');

    if (this.websocket) {
      if (this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.close(1000, 'Client disconnect');
      }
      this.websocket = null;
    }

    this.state.connectionStatus = 'disconnected';
    this.state.messageQueue = [];
  }

  /**
   * EXPLANATION: Get client state (for debugging)
   */
  getState(): Readonly<VoiceLiveClientState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * EXPLANATION: Check if connection is healthy
   * 
   * A connection is healthy if:
   * 1. WebSocket is connected
   * 2. We recently received a message (within 30 seconds)
   */
  isHealthy(): boolean {
    if (this.state.connectionStatus !== 'connected') {
      return false;
    }

    if (this.state.lastMessageAt) {
      const timeSinceLastMessage =
        Date.now() - this.state.lastMessageAt.getTime();
      // If no message in 30 seconds, connection might be stale
      return timeSinceLastMessage < 30000;
    }

    return true;
  }
}
