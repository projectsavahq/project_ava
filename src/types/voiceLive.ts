/**
 * EXPLANATION: Voice Live Types
 * These interfaces define the data structures used throughout the Voice Live integration.
 * They correspond to Azure Voice Live API specifications and our application needs.
 */

// ============================================================================
// AZURE VOICE LIVE CONFIGURATION TYPES
// ============================================================================

/**
 * EXPLANATION: Turn Detection Configuration
 * This tells Azure when the user has finished speaking and it's the AI's turn to respond.
 * It uses Voice Activity Detection (VAD) - detects when someone is/isn't speaking.
 */
export interface TurnDetectionConfig {
  type: "azure_semantic_vad"; // Type of voice activity detection
  threshold: number; // Sensitivity (0-1): lower = more sensitive
  prefix_padding_ms: number; // How many ms of audio to capture before speech starts
  silence_duration_ms: number; // How long silence = end of user's utterance (100-500ms typical)
  remove_filler_words: boolean; // Remove "um", "uh", etc. for faster processing
  end_of_utterance_detection: {
    model: string; // AI model for detecting end of sentence
    threshold: number; // Lower = more sensitive to sentence endings
    timeout: number; // Max seconds to wait for end detection
  };
}

/**
 * EXPLANATION: Audio Input Configuration
 * Configures how Azure processes incoming audio from the user.
 */
export interface AudioInputConfig {
  sampling_rate?: number; // Should be 24000 Hz for best results
  noise_reduction: {
    type: "azure_deep_noise_suppression"; // Deep learning noise removal
  };
  echo_cancellation: {
    type: "server_echo_cancellation"; // Remove echo from speaker
  };
}

/**
 * EXPLANATION: Voice Output Configuration
 * Defines how the AI speaks back to the user.
 */
export interface VoiceOutputConfig {
  name: string; // Voice name like "en-US-Ava:DragonHDLatestNeural"
  type: string; // "azure-standard" for standard voices
  temperature: number; // 0-1: lower = more deterministic, higher = more creative
  rate: string; // Speaking speed: "0.5" (slow) to "1.5" (fast)
}

/**
 * EXPLANATION: Complete Session Configuration
 * This is sent to Azure on connection to configure the entire session behavior.
 * Similar to the "session_update" in the Python script.
 */
export interface SessionConfig {
  type: "session.update";
  session: {
    instructions: string; // System prompt telling AI how to behave
    modalities?: string[]; // Communication modes: ['text', 'audio']
    turn_detection: TurnDetectionConfig;
    input_audio_noise_reduction: {
      type: string;
    };
    input_audio_echo_cancellation: {
      type: string;
    };
    voice: VoiceOutputConfig;
    input_audio_transcription?: {
      enabled: boolean;
      model: string;
      format: string;
    };
  };
  event_id?: string;
}

// ============================================================================
// AZURE VOICE LIVE CONNECTION TYPES
// ============================================================================

/**
 * EXPLANATION: Voice Live Connection Status
 * Tracks whether the WebSocket to Azure is open, closed, or has errors.
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * EXPLANATION: Message from Azure Voice Live API
 * These are the different types of messages Azure sends us.
 */
export interface AzureVoiceLiveMessage {
  type: string; // Message type: "response.audio", "response.transcript", etc.
  response?: {
    id: string; // Unique response ID for tracking
    output_item?: {
      id: string;
      type: string; // "audio" or "text"
    };
  };
  delta?: {
    index: number; // Position in the stream
    type: string; // "content_block_delta"
    content_block_index: number;
  };
  item_index?: number;
  content_index?: number;
  index?: number;
  audio?: string; // Base64 encoded audio data
  transcript?: string; // Text transcript
  [key: string]: any;
}

// ============================================================================
// WEBSOCKET GATEWAY EVENT TYPES
// ============================================================================

/**
 * EXPLANATION: Client → Server Events
 * These are messages the client (browser/mobile) sends to the server via WebSocket.
 */
export interface VoiceGatewayEvents {
  // Event name: event data structure

  /**
   * EXPLANATION: Initialize voice connection
   * Client sends: user wants to start a voice conversation
   * Server does: creates session, connects to Azure, sends session config
   */
  "voice:connect": {
    userId: string; // Who is calling
    sessionId?: string; // Resume existing or create new
    userPreferences?: {
      voicePreference?: string; // Preferred voice
      temperatureLevel?: number; // Response creativity preference
    };
  };

  /**
   * EXPLANATION: Send audio data
   * Client sends: audio chunk from microphone
   * Server does: forwards to Azure, processes responses in parallel
   */
  "voice:audio": {
    audio: Buffer | string; // Audio data (PCM 24000 Hz, mono, 16-bit)
    timestamp: number; // When audio was captured
  };

  /**
   * EXPLANATION: User is typing instead of speaking
   * Client sends: text input instead of voice
   * Server does: sends to Azure as if user spoke it
   */
  "voice:text-input": {
    text: string; // User's typed message
    timestamp: number;
  };

  /**
   * EXPLANATION: End conversation
   * Client sends: user is done talking
   * Server does: closes Azure connection, saves session, sends summary
   */
  "voice:disconnect": {
    reason?: string; // Why session is ending
  };

  /**
   * EXPLANATION: Keep session alive
   * Client sends: periodic heartbeat
   * Server does: updates lastActivity timestamp, prevents timeout
   */
  "voice:heartbeat": {
    sessionId: string;
  };
}

/**
 * EXPLANATION: Server → Client Events
 * These are messages the server sends to the client via WebSocket in real-time.
 */
export interface VoiceServerEvents {
  /**
   * EXPLANATION: Connection established
   * Server sends: when connection to Azure is ready
   * Client does: can now start sending audio
   */
  "voice:connected": {
    sessionId: string;
    userId: string;
    status: "ready";
    metadata: {
      connectedAt: string;
      sampleRate: number;
      channels: number;
    };
  };

  /**
   * EXPLANATION: Streaming audio response from AI
   * Server sends: audio chunks as they arrive from Azure
   * Client does: plays audio in real-time (don't wait for all chunks)
   */
  "voice:audio": {
    audio: string; // Base64 encoded PCM audio chunk
    sequenceNumber: number; // Order of chunks (1, 2, 3...)
    isLastChunk: boolean; // Is this the final chunk?
  };

  /**
   * EXPLANATION: Real-time transcript
   * Server sends: what the user said (as they're speaking)
   * Client does: displays transcript for user feedback
   */
  "voice:user-transcript": {
    transcript: string; // What user said
    isFinal: boolean; // Is this the final version or still being updated?
    confidence: number; // 0-1 accuracy confidence
  };

  /**
   * EXPLANATION: AI's response text
   * Server sends: what the AI is saying (before audio is ready)
   * Client does: displays text, waits for or plays concurrent audio
   */
  "voice:assistant-transcript": {
    transcript: string; // What AI said
    isFinal: boolean;
  };

  /**
   * EXPLANATION: Emotion detected in user's voice
   * Server sends: emotion analysis results from our emotion detection service
   * Client does: displays emotion indicator, updates UI emotionally
   */
  "voice:emotion": {
    emotion: {
      primary: string; // Main emotion: "sad", "anxious", "angry", etc.
      confidence: number; // 0-1 how confident we are
      emotions: {
        [key: string]: number; // All emotions with scores: { sad: 0.8, anxious: 0.2 }
      };
      timestamp: string;
    };
  };

  /**
   * EXPLANATION: Crisis detected in conversation
   * Server sends: when crisis detection service finds danger indicators
   * Client does: shows alert, provides emergency resources, escalates
   */
  "voice:crisis-alert": {
    severity: "low" | "medium" | "high" | "critical";
    keywords: string[]; // What triggered the alert
    message: string; // Appropriate guidance/resources
    escalated: boolean; // Was this escalated to human?
  };

  /**
   * EXPLANATION: Session ended
   * Server sends: when conversation is finished
   * Client does: stops recording, closes connection, shows summary
   */
  "voice:session-ended": {
    sessionId: string;
    endedAt: string;
    summary?: {
      duration: number; // Conversation length in seconds
      messageCount: number; // How many exchanges
      averageEmotion: string; // Overall mood
      crisisDetected: boolean; // Any crisis moments?
    };
  };

  /**
   * EXPLANATION: Error occurred
   * Server sends: when something goes wrong
   * Client does: shows error message, suggests retry
   */
  "voice:error": {
    error: string; // Error message
    code?: string; // Error code
    recoverable: boolean; // Can user retry?
  };
}

// ============================================================================
// DATABASE / CONVERSATION TRACKING TYPES
// ============================================================================

/**
 * EXPLANATION: Message Content Structure
 * Represents a single message in a conversation (user or assistant).
 */
export interface MessageContent {
  role: "user" | "assistant";
  content: string; // The actual text
  timestamp: Date;
  audioUrl?: string; // Link to audio file if available
  emotionData?: {
    primaryEmotion: string;
    confidence: number;
    emotions: { [key: string]: number };
  };
}

/**
 * EXPLANATION: Voice Session Metadata
 * Stores important info about the voice session for resumption and analytics.
 */
export interface VoiceSessionMetadata {
  audioSampleRate: number; // 24000 Hz
  audioChannels: number; // 1 (mono)
  startedAt: Date;
  endedAt?: Date;
  duration?: number; // in seconds
  totalAudioBytes?: number; // Size of audio processed
  messageCount?: number;
  crisisDetected?: boolean;
  crisisLevels?: ("low" | "medium" | "high" | "critical")[];
  topEmotions?: string[];
}

// ============================================================================
// SERVICE INTERNAL TYPES
// ============================================================================

/**
 * EXPLANATION: Internal state tracking for Voice Live Client
 * Used internally by VoiceLiveClient to manage Azure connection lifecycle.
 */
export interface VoiceLiveClientState {
  connectionStatus: ConnectionStatus;
  sessionId?: string;
  userId?: string;
  websocketUrl?: string;
  authHeaders?: Record<string, string>;
  lastMessageAt?: Date;
  reconnectAttempts: number;
}

/**
 * EXPLANATION: Data flowing through services in parallel
 * When user speaks, we process in multiple streams simultaneously:
 * 1. Send to Azure for AI response
 * 2. Detect emotion from audio
 * 3. Check for crisis keywords
 * 4. Save to database
 * All happen in parallel without blocking each other.
 */
export interface ProcessingContext {
  sessionId: string;
  userId: string;
  userInput: {
    text?: string; // Transcribed speech
    audio?: Buffer; // Raw audio bytes
  };
  detectedEmotion?: {
    primary: string;
    confidence: number;
    emotions: { [key: string]: number };
  };
  crisisResult?: {
    isCrisis: boolean;
    severity: "low" | "medium" | "high" | "critical";
    keywords: string[];
    confidence: number;
  };
  conversationHistory: MessageContent[];
}

// ============================================================================
// AZURE API RESPONSE TYPES
// ============================================================================

/**
 * EXPLANATION: Azure Voice Live error response
 * When something fails, Azure sends error details.
 */
export interface AzureVoiceLiveError {
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * EXPLANATION: Azure turn detection result
 * Tells us when user finished speaking.
 */
export interface TurnDetectionResult {
  type: "input_audio_buffer.committed" | "input_audio_buffer.speech_started";
  audio_start_ms: number;
  audio_index: number;
}

export type VoiceLiveWebSocketMessage =
  | AzureVoiceLiveMessage
  | TurnDetectionResult
  | AzureVoiceLiveError;
