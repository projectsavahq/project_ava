/**
 * EXPLANATION: Voice Live DTOs (Data Transfer Objects)
 * 
 * DTOs define the structure of data being sent via WebSocket.
 * They act as contracts between client and server.
 * 
 * Benefits:
 * 1. Type safety - TypeScript validates the data
 * 2. Documentation - shows what fields are expected
 * 3. Validation - can add decorators to validate data
 * 4. Auto-documentation - tools can generate API docs from DTOs
 */

/**
 * EXPLANATION: Voice Connect Request DTO
 * Sent by client when initiating voice connection
 * 
 * Example payload from client:
 * {
 *   userId: "user123",
 *   sessionId: undefined,  // For new session
 *   userPreferences: {
 *     voicePreference: "en-US-Ava:DragonHDLatestNeural",
 *     temperatureLevel: 0.7
 *   }
 * }
 */
export class VoiceConnectDto {
  // EXPLANATION: Unique user identifier (from authentication)
  // Required - must match JWT token
  userId!: string;

  // EXPLANATION: Resume existing session or create new
  // Optional - if provided, reconnects to existing session
  sessionId?: string;

  // EXPLANATION: User's voice and response preferences
  // Optional - uses defaults if not provided
  userPreferences?: {
    // Which voice the AI should use
    voicePreference?: string; // e.g., "en-US-Ava:DragonHDLatestNeural"

    // How creative/deterministic AI responses should be (0-1)
    temperatureLevel?: number; // 0 = very consistent, 1 = very creative
  };
}

/**
 * EXPLANATION: Audio Chunk DTO
 * Sent repeatedly by client as user speaks
 * 
 * Example (after connection established):
 * {
 *   audio: <Buffer [audio data]> or "base64-encoded-audio-string",
 *   timestamp: 1703084400000
 * }
 * 
 * EXPLANATION of audio encoding:
 * Client can send audio as:
 * 1. Buffer (binary data) - preferred, lower latency
 * 2. Base64 string - if binary not supported
 */
export class VoiceAudioChunkDto {
  // EXPLANATION: Raw audio data
  // Format required: PCM, 24000 Hz, Mono, 16-bit
  // Size: typically 1200 samples (~50ms)
  // Can be Buffer or Base64 string
  audio!: Buffer | string;

  // EXPLANATION: When this audio chunk was captured (milliseconds since epoch)
  // Useful for:
  // - Synchronizing with other data
  // - Detecting network delays
  // - Calculating real-time metrics
  timestamp!: number;
}

/**
 * EXPLANATION: Text Input DTO
 * Sent by client when user types instead of speaking
 */
export class VoiceTextInputDto {
  // EXPLANATION: The user's text message
  // Will be processed as if user spoke it
  text!: string;

  // EXPLANATION: When this text was entered
  timestamp!: number;
}

/**
 * EXPLANATION: Voice Disconnect DTO
 * Sent by client when ending conversation
 */
export class VoiceDisconnectDto {
  // EXPLANATION: Why the session is ending
  // Useful for logging/analytics:
  // - "user_clicked_end"
  // - "browser_closed"
  // - "switching_sessions"
  reason?: string;
}

/**
 * EXPLANATION: Voice Heartbeat DTO
 * Sent periodically by client to keep connection alive
 */
export class VoiceHeartbeatDto {
  // EXPLANATION: Which session this heartbeat is for
  sessionId!: string;
}

// ============================================================================
// SERVER RESPONSE DTOs (what server sends to client)
// ============================================================================

/**
 * EXPLANATION: Voice Connected Response DTO
 * Sent by server when session is ready
 */
export class VoiceConnectedResponseDto {
  // EXPLANATION: The session ID created by server
  // Client uses this for all subsequent messages
  sessionId!: string;

  // EXPLANATION: User ID echoed back
  userId!: string;

  // EXPLANATION: Session status
  // "ready" = ready to send audio
  status!: "ready" | "error";

  // EXPLANATION: Configuration info about this session
  metadata!: {
    connectedAt: string; // ISO timestamp
    sampleRate: number; // 24000 Hz
    channels: number; // 1 (mono)
  };
}

/**
 * EXPLANATION: Voice Audio Response DTO
 * Sent by server as AI response arrives
 * 
 * Multiple chunks are sent as audio streams in
 * giving real-time playback feel
 */
export class VoiceAudioResponseDto {
  // EXPLANATION: Audio data chunk from AI
  // Format: Base64 encoded PCM
  // Same format as input audio
  audio!: string;

  // EXPLANATION: Position in the response
  // Allows client to order chunks correctly
  // 1st chunk: sequenceNumber = 1
  // 2nd chunk: sequenceNumber = 2
  // etc.
  sequenceNumber!: number;

  // EXPLANATION: Is this the last chunk?
  // true = no more audio coming for this response
  // false = more chunks will arrive
  isLastChunk!: boolean;
}

/**
 * EXPLANATION: Transcript Response DTO
 * Sent by server as speech is converted to text
 * 
 * Two types:
 * 1. User's speech being transcribed
 * 2. AI's response being transcribed
 */
export class VoiceTranscriptResponseDto {
  // EXPLANATION: The transcribed text
  // For user: what they just said
  // For AI: what it's saying
  transcript!: string;

  // EXPLANATION: Is this the final version?
  // false = might be updated (interim transcript)
  // true = this is the final version
  // 
  // Example:
  // interim: "I'm feeling..." → "I'm feeling really..."
  // final: "I'm feeling really anxious today"
  isFinal!: boolean;

  // EXPLANATION: Confidence score (0-1)
  // 0.95 = very confident
  // 0.7 = somewhat confident
  // Helps client decide to highlight text
  confidence?: number;
}

/**
 * EXPLANATION: Emotion Response DTO
 * Sent when emotion is detected in user's speech
 */
export class VoiceEmotionResponseDto {
  emotion!: {
    // EXPLANATION: Primary emotion detected
    // Examples: "sad", "anxious", "angry", "stressed", "calm", "happy", "hopeful"
    primary: string;

    // EXPLANATION: How confident we are (0-1)
    // 0.9 = very confident it's this emotion
    // 0.5 = not very sure
    confidence: number;

    // EXPLANATION: All emotions with scores
    // {
    //   sad: 0.85,
    //   anxious: 0.5,
    //   angry: 0.1,
    //   ...
    // }
    // Allows UI to show multi-emotion view
    emotions: {
      [key: string]: number;
    };

    // EXPLANATION: When this emotion was detected
    timestamp: string; // ISO timestamp
  };
}

/**
 * EXPLANATION: Crisis Alert DTO
 * Sent when crisis is detected in conversation
 * 
 * URGENT - treated as high priority
 */
export class VoiceCrisisAlertDto {
  // EXPLANATION: How severe is the crisis?
  // "low" = minor concerns
  // "medium" = moderate concern, suggest resources
  // "high" = significant danger, provide crisis numbers
  // "critical" = immediate danger, provide emergency numbers
  severity!: "low" | "medium" | "high" | "critical";

  // EXPLANATION: What keywords triggered the alert
  // Examples: ["suicide", "self-harm", "pain", "hopeless"]
  // Helps track what caused the alert
  keywords!: string[];

  // EXPLANATION: Appropriate message/resources for this severity
  // Client displays this to user
  message!: string;

  // EXPLANATION: Was this escalated to human?
  // true = alert sent to counselor/administrator
  // false = automated detection only
  escalated!: boolean;
}

/**
 * EXPLANATION: Session Ended DTO
 * Sent when conversation ends
 */
export class VoiceSessionEndedDto {
  // EXPLANATION: The session ID that ended
  sessionId!: string;

  // EXPLANATION: When the session ended
  endedAt!: string; // ISO timestamp

  // EXPLANATION: Summary statistics of the session
  summary?: {
    // EXPLANATION: How long was the conversation (seconds)
    // Helps track engagement
    duration: number;

    // EXPLANATION: How many message exchanges
    // User message + AI response = 1 exchange
    messageCount: number;

    // EXPLANATION: Most common emotion detected
    // Useful for understanding overall mood
    topEmotion: string;

    // EXPLANATION: Was any crisis detected?
    // true = crisis was detected during session
    // false = no crisis indicators
    crisisDetected: boolean;
  };
}

/**
 * EXPLANATION: Error DTO
 * Sent when something goes wrong
 */
export class VoiceErrorDto {
  // EXPLANATION: Human-readable error message
  // "WebSocket disconnected"
  // "Failed to process audio"
  // "Session not found"
  error!: string;

  // EXPLANATION: Machine-readable error code
  // Used by client to decide how to handle error
  // "VOICE_CONNECT_ERROR" → can retry
  // "NO_SESSION" → must reconnect
  // "AUDIO_ERROR" → can retry sending audio
  code?: string;

  // EXPLANATION: Can the client recover?
  // true = client should retry the operation
  // false = requires manual intervention
  recoverable!: boolean;
}

/**
 * EXPLANATION: Heartbeat Acknowledgment DTO
 * Sent by server in response to client heartbeat
 */
export class VoiceHeartbeatAckDto {
  // EXPLANATION: Server time (milliseconds)
  // Client can use to calculate latency:
  // latency = Date.now() - heartbeat.timestamp
  timestamp!: number;

  // EXPLANATION: Which session this ack is for
  sessionId!: string;
}

// ============================================================================
// HELPER VALIDATION FUNCTIONS
// ============================================================================

/**
 * EXPLANATION: Validate audio chunk DTO
 * 
 * Checks:
 * 1. Audio data exists and is valid
 * 2. Timestamp is reasonable
 * 3. Audio size is not too large
 */
export function validateAudioChunk(dto: VoiceAudioChunkDto): {
  valid: boolean;
  error?: string;
} {
  if (!dto.audio) {
    return { valid: false, error: "Audio data is required" };
  }

  if (!dto.timestamp || typeof dto.timestamp !== "number") {
    return { valid: false, error: "Valid timestamp is required" };
  }

  // Check audio size (max 1MB per chunk)
  const audioBuffer =
    typeof dto.audio === "string"
      ? Buffer.from(dto.audio, "base64")
      : dto.audio;

  if (audioBuffer.length > 1024 * 1024) {
    return { valid: false, error: "Audio chunk too large (max 1MB)" };
  }

  // Check timestamp is not in the future
  if (dto.timestamp > Date.now() + 5000) {
    // Allow 5 seconds clock skew
    return { valid: false, error: "Timestamp appears to be in the future" };
  }

  return { valid: true };
}

/**
 * EXPLANATION: Validate voice connect DTO
 */
export function validateVoiceConnect(dto: VoiceConnectDto): {
  valid: boolean;
  error?: string;
} {
  if (!dto.userId) {
    return { valid: false, error: "userId is required" };
  }

  if (dto.userPreferences?.temperatureLevel !== undefined) {
    const temp = dto.userPreferences.temperatureLevel;
    if (typeof temp !== "number" || temp < 0 || temp > 1) {
      return {
        valid: false,
        error: "temperatureLevel must be between 0 and 1",
      };
    }
  }

  return { valid: true };
}
