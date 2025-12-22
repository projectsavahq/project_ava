/**
 * EXPLANATION: Voice Live Service
 * 
 * This is the orchestration layer that coordinates:
 * 1. Azure Voice Live Client (connection to Azure)
 * 2. Emotion Detection (analyzing user's emotional state)
 * 3. Crisis Detection (checking for danger indicators)
 * 4. Message Storage (saving to database)
 * 5. Session Management (tracking conversation state)
 * 
 * Think of it as the "conductor" that makes all services work together.
 * 
 * Main flow:
 * 1. Client connects via WebSocket
 * 2. Service creates Azure connection + session
 * 3. Audio arrives from client
 * 4. Service sends to Azure
 * 5. While Azure processes, we also:
 *    - Detect emotion in the audio
 *    - Check for crisis keywords
 *    - Save to database
 * 6. Azure responds, we send back to client
 */

import { Injectable } from '@nestjs/common';
import { logInfo, logError } from '../utils/logger';
import { ConversationSession } from '../models/schemas/ConversationSession';
import { Message } from '../models/schemas/Message';
import { VoiceLiveClient } from './voiceLiveClient';
import { EmotionDetectionService } from './emotionDetection';
import { CrisisDetectionService } from './crisisDetection';
import { SessionConfig } from '../types/voiceLive';
import { v4 as uuidv4 } from 'uuid';

/**
 * EXPLANATION: Session context for tracking a conversation
 * Stores session-specific data that multiple async operations need access to.
 */
interface SessionContext {
  sessionId: string;
  userId: string;
  voiceLiveClient: VoiceLiveClient;
  azureClient: any; // Will be set on connect
  status: 'active' | 'paused' | 'ended';
  startedAt: Date;
  lastActivity: Date;
  messageCount: number;
  crisisDetected: boolean;
  topEmotions: Map<string, number>;
}

@Injectable()
export class VoiceLiveService {
  // Map of active sessions: sessionId → SessionContext
  private activeSessions: Map<string, SessionContext> = new Map();

  // Dependencies injected
  private emotionService: EmotionDetectionService;
  private crisisService: CrisisDetectionService;

  // Environment configuration
  private azureEndpoint: string = process.env.AZURE_VOICE_LIVE_ENDPOINT || '';
  private azureApiKey: string = process.env.AZURE_VOICE_LIVE_API_KEY || '';
  private azureApiVersion: string =
    process.env.AZURE_VOICE_LIVE_API_VERSION || '2025-05-01-preview';
  private azureModel: string = process.env.AZURE_VOICE_LIVE_MODEL || 'gpt-4o';

  constructor() {
    this.emotionService = new EmotionDetectionService();
    this.crisisService = new CrisisDetectionService();

    logInfo('[VoiceLiveService] Initialized with Azure config');
  }

  /**
   * EXPLANATION: Start a new voice conversation session
   * 
   * Steps:
   * 1. Validate inputs (userId, preferences)
   * 2. Create MongoDB session document
   * 3. Create Azure Voice Live connection
   * 4. Send session config to Azure (system prompt, voice settings, etc.)
   * 5. Return session info to client
   * 
   * This is called when user clicks "Start Voice Chat"
   */
  async startSession(
    userId: string,
    socketId: string,
    userPreferences?: any
  ): Promise<{
    sessionId: string;
    status: string;
    config: any;
  }> {
    try {
      // Step 1: Validate inputs
      if (!userId) {
        throw new Error('userId is required');
      }

      logInfo(
        `[VoiceLiveService] Starting session for user: ${userId}, socket: ${socketId}`
      );

      // Step 2: Create session in MongoDB
      // EXPLANATION: We create a database record immediately so we have a reference
      const sessionId = uuidv4();
      const session = await ConversationSession.create({
        sessionId,
        userId,
        status: 'active',
        webSocketConnectionId: socketId,
        totalMessages: 0,
        audioMetadata: {
          sampleRate: 24000, // Azure Voice Live standard
          channels: 1, // Mono (single channel)
        },
        lastActivity: new Date(),
      });

      logInfo(`[VoiceLiveService] Session created: ${sessionId}`);

      // Step 3: Create Azure Voice Live client connection
      // EXPLANATION: This opens a WebSocket to Azure
      const voiceLiveClient = new VoiceLiveClient({
        azureEndpoint: this.azureEndpoint,
        apiKey: this.azureApiKey,
        apiVersion: this.azureApiVersion,
        model: this.azureModel,
      });

      // Connect to Azure (waits for WebSocket to be open)
      await voiceLiveClient.connect(sessionId, userId);

      // Step 4: Store session context for later use
      // EXPLANATION: We keep this in memory so we can access it in other methods
      const sessionContext: SessionContext = {
        sessionId,
        userId,
        voiceLiveClient,
        azureClient: null, // Set on next step
        status: 'active',
        startedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        crisisDetected: false,
        topEmotions: new Map(),
      };

      this.activeSessions.set(sessionId, sessionContext);

      // Step 5: Send session configuration to Azure
      // EXPLANATION: This tells Azure how to behave for this conversation
      const sessionConfig = this.buildSessionConfig(userPreferences);
      voiceLiveClient.sendSessionConfig(sessionConfig);

      logInfo(`[VoiceLiveService] Session configured in Azure: ${sessionId}`);

      // Step 6: Return success response
      return {
        sessionId,
        status: 'ready',
        config: {
          sampleRate: 24000,
          channels: 1,
          model: this.azureModel,
        },
      };
    } catch (error) {
      logError('[VoiceLiveService] Error starting session', error);
      throw new Error(`Failed to start voice session: ${error}`);
    }
  }

  /**
   * EXPLANATION: Build Azure session configuration
   * 
   * This creates the "system prompt" and settings that tell Azure:
   * - How to behave (instructions)
   * - When to detect turn (turn_detection)
   * - What voice to use (voice settings)
   * 
   * Configuration values:
   * - threshold: 0.2 (lower = faster detection but more false positives)
   * - silence_duration_ms: 100 (user paused 100ms = end of speech)
   * - temperature: 0.7 (0-1, higher = more creative)
   * - rate: "1.3" (speaking speed)
   * 
   * You can modify these for your use case!
   */
  private buildSessionConfig(userPreferences?: any): SessionConfig {
    const voicePreference =
      userPreferences?.voicePreference || 'en-US-Ava:DragonHDLatestNeural';
    const temperature = userPreferences?.temperatureLevel || 0.7;

    return {
      type: 'session.update',
      session: {
        // EXPLANATION: System instructions - how the AI should behave
        // This is critical for an AI therapist!
        instructions: `You are AVA, a compassionate AI therapy assistant. Your role is to:
1. Listen actively and with empathy to the user's concerns
2. Validate their feelings and experiences
3. Ask clarifying questions to better understand their situation
4. Offer supportive guidance and coping strategies
5. Never replace professional medical help - encourage users to seek professional support if needed
6. Maintain appropriate boundaries while being warm and supportive
7. Respect user privacy and confidentiality
8. Use person-first language and avoid stigmatizing terms

Keep your responses concise and natural. Speak directly and genuinely. If the user mentions crisis or harm, respond with appropriate urgency while staying calm and supportive.`,

        // EXPLANATION: Turn Detection - when to switch from listening to speaking
        turn_detection: {
          type: 'azure_semantic_vad',
          threshold: 0.2, // 0-1: lower = more sensitive, detects speech earlier
          prefix_padding_ms: 100, // Capture 100ms before speech starts
          silence_duration_ms: 100, // User silent 100ms = probably done speaking
          remove_filler_words: true, // Remove "um", "uh" for clarity
          end_of_utterance_detection: {
            model: 'semantic_detection_v1',
            threshold: 0.005, // How sure we are that sentence ended
            timeout: 1, // Max wait time in seconds
          },
        },

        // EXPLANATION: Audio Input Processing
        // Noise reduction helps understand user even in noisy environments
        input_audio_noise_reduction: {
          type: 'azure_deep_noise_suppression',
        },
        // Echo cancellation removes sound bouncing back from speaker
        input_audio_echo_cancellation: {
          type: 'server_echo_cancellation',
        },

        // EXPLANATION: Voice Configuration - how AI speaks back
        voice: {
          name: voicePreference, // Which voice to use
          type: 'azure-standard',
          temperature, // 0=consistent, 1=creative
          rate: '1.0', // Speaking speed (0.5 slow to 1.5 fast)
        },
      },
      event_id: uuidv4(),
    };
  }

  /**
   * EXPLANATION: Process audio chunk from client
   * 
   * This is called when user sends audio via WebSocket.
   * 
   * Flow:
   * 1. Get session from memory
   * 2. Send audio to Azure (Azure processes in real-time)
   * 3. Start emotion detection (async, doesn't block)
   * 4. Start crisis detection (async, doesn't block)
   * 5. Return immediately so client doesn't wait
   * 
   * Everything runs in parallel using async/await:
   * - Azure is processing the audio
   * - Emotion detection is analyzing it
   * - Crisis detection is checking for keywords
   * All at the same time without blocking!
   */
  async processAudioChunk(
    sessionId: string,
    audioData: Buffer | Uint8Array
  ): Promise<void> {
    try {
      // Step 1: Get session
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Step 2: Send to Azure immediately (fire and forget)
      // EXPLANATION: This sends the audio chunk to Azure's WebSocket
      // Azure will process it and send responses back asynchronously
      session.voiceLiveClient.sendAudioChunk(audioData);

      // Step 3: Update last activity timestamp
      session.lastActivity = new Date();

      // Step 4: Emit event so Gateway can track this
      // EXPLANATION: In a real implementation, you'd emit to event listeners
      // This allows the Gateway to know audio was received
      logInfo(
        `[VoiceLiveService] Audio chunk processed for session: ${sessionId}`
      );

      // NOTE: Emotion and crisis detection happen asynchronously
      // when we receive the transcript from Azure, not here
      // (See processAzureResponse method)
    } catch (error) {
      logError('[VoiceLiveService] Error processing audio chunk', error);
      throw error;
    }
  }

  /**
   * EXPLANATION: Process response from Azure
   * 
   * When Azure sends us a response, this processes it and:
   * 1. Detects emotion in user's speech
   * 2. Detects crisis indicators
   * 3. Stores messages in database
   * 4. Prepares response to send back to client
   * 
   * This happens asynchronously - we process everything in parallel.
   */
  async processAzureResponse(
    sessionId: string,
    message: any
  ): Promise<{
    type: string;
    data: any;
    emotion?: any;
    crisis?: any;
  }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const messageType = message.type;

      // Process based on message type from Azure
      if (messageType === 'response.transcript') {
        // EXPLANATION: User's speech was transcribed
        // Now we can analyze it for emotion and crisis

        const transcript = message.transcript || '';
        const role = message.is_user ? 'user' : 'assistant';

        logInfo(
          `[VoiceLiveService] Transcript [${role}]: ${transcript.substring(0, 50)}`
        );

        // Store message in database
        const msg = await Message.create({
          sessionId,
          userId: session.userId,
          role,
          content: transcript,
          timestamp: new Date(),
        });

        // If this is user's message, analyze it
        if (role === 'user') {
          // EXPLANATION: Run these in parallel using Promise.all
          // They don't depend on each other, so we save time
          const [emotionData, crisisData] = await Promise.all([
            this.emotionService.analyzeEmotion(transcript),
            this.crisisService.detectCrisis(
              transcript,
              {} // conversion context
            ),
          ]);

          // Store emotion data in the message
          if (emotionData) {
            msg.emotionData = {
              primaryEmotion: emotionData.primary,
              confidence: emotionData.confidence,
              emotions: emotionData.emotions,
            };

            // Track top emotions for session summary
            session.topEmotions.set(
              emotionData.primary,
              (session.topEmotions.get(emotionData.primary) || 0) + 1
            );

            await msg.save();
          }

          // Store crisis data in the message
          if (crisisData.isCrisis) {
            msg.crisisIndicators = {
              severity: crisisData.severity,
              keywords: crisisData.keywords,
              confidence: crisisData.confidence,
              escalated: false,
            };

            session.crisisDetected = true;
            await msg.save();

            logInfo(
              `[VoiceLiveService] Crisis detected: ${crisisData.severity}`
            );
          }
        }

        // Increment message counter
        session.messageCount++;

        return {
          type: 'transcript',
          data: transcript,
          emotion: message.emotionData,
          crisis: message.crisisIndicators,
        };
      } else if (messageType === 'response.audio') {
        // EXPLANATION: Audio data from Azure (AI's voice response)
        // Just return it to be sent to client

        const audio = message.audio || '';
        return {
          type: 'audio',
          data: audio,
        };
      } else if (messageType === 'response.done') {
        // EXPLANATION: Azure finished responding
        // Update session record in database

        await ConversationSession.findOneAndUpdate(
          { sessionId },
          {
            totalMessages: session.messageCount,
            lastActivity: new Date(),
          },
          { new: true }
        );

        return {
          type: 'done',
          data: null,
        };
      }

      return {
        type: messageType,
        data: message,
      };
    } catch (error) {
      logError('[VoiceLiveService] Error processing Azure response', error);
      throw error;
    }
  }

  /**
   * EXPLANATION: End a conversation session
   * 
   * Called when user clicks "End Session" or session times out
   * 
   * Cleanup:
   * 1. Close Azure WebSocket connection
   * 2. Save final session summary to database
   * 3. Calculate conversation analytics (duration, emotions, etc.)
   * 4. Remove from active sessions
   */
  async endSession(sessionId: string): Promise<any> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      logInfo(`[VoiceLiveService] Ending session: ${sessionId}`);

      // Step 1: Disconnect from Azure
      session.voiceLiveClient.disconnect();

      // Step 2: Calculate session statistics
      const duration = new Date().getTime() - session.startedAt.getTime();
      const topEmotion = Array.from(session.topEmotions.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

      // Step 3: Update session in database
      const finalSession = await ConversationSession.findOneAndUpdate(
        { sessionId },
        {
          status: session.crisisDetected ? 'crisis_escalated' : 'ended',
          endedAt: new Date(),
          duration: Math.floor(duration / 1000), // Convert to seconds
          totalMessages: session.messageCount,
          averageEmotion: topEmotion,
          lastActivity: new Date(),
        },
        { new: true }
      );

      // Step 4: Remove from active sessions
      this.activeSessions.delete(sessionId);

      logInfo(
        `[VoiceLiveService] Session ended: ${sessionId}, duration: ${duration}ms`
      );

      return {
        sessionId,
        summary: {
          duration: Math.floor(duration / 1000),
          messageCount: session.messageCount,
          topEmotion,
          crisisDetected: session.crisisDetected,
        },
      };
    } catch (error) {
      logError('[VoiceLiveService] Error ending session', error);
      throw error;
    }
  }

  /**
   * EXPLANATION: Get active session details
   * 
   * Useful for checking session status, debugging, etc.
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId,
      userId: session.userId,
      status: session.status,
      messageCount: session.messageCount,
      crisisDetected: session.crisisDetected,
      topEmotions: Array.from(session.topEmotions.entries()),
      duration: new Date().getTime() - session.startedAt.getTime(),
    };
  }

  /**
   * EXPLANATION: Clean up idle sessions
   * 
   * Sessions that haven't had activity for 30 minutes are closed.
   * Call this periodically (e.g., every 5 minutes).
   */
  async cleanupIdleSessions(): Promise<number> {
    const now = new Date();
    const idleTimeout = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [sessionId, session] of this.activeSessions) {
      const idleTime = now.getTime() - session.lastActivity.getTime();
      if (idleTime > idleTimeout && session.status === 'active') {
        logInfo(`[VoiceLiveService] Closing idle session: ${sessionId}`);
        await this.endSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * EXPLANATION: Get all active sessions (for admin/monitoring)
   */
  getAllActiveSessions(): any[] {
    return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      userId: session.userId,
      status: session.status,
      messageCount: session.messageCount,
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
    }));
  }

  /**
   * EXPLANATION: Get VoiceLiveClient for a specific session
   * 
   * Returns the Azure connection handler for direct access.
   * Used by gateway to send messages and receive responses.
   * Based on Python script's connection object.
   */
  async getVoiceLiveClient(sessionId: string): Promise<VoiceLiveClient | null> {
    const session = this.activeSessions.get(sessionId);
    return session?.voiceLiveClient || null;
  }

  /**
   * EXPLANATION: Check if Azure client has messages queued
   * 
   * Polls the Azure client's message queue to see if anything is waiting.
   * Used by gateway listener to know when to retrieve messages.
   */
  async hasAzureMessages(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    return session.voiceLiveClient.hasMessages();
  }

  /**
   * EXPLANATION: Record user input for analysis
   * 
   * Called when user's speech is transcribed.
   * Triggers emotion detection and crisis detection in parallel.
   * Based on Python script's message processing loop.
   */
  async recordUserInput(sessionId: string, transcript: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      logInfo(`[VoiceLiveService] Recording user input for ${sessionId}: ${transcript.substring(0, 50)}`);

      // Update last activity timestamp
      session.lastActivity = new Date();
      session.messageCount++;

      // Save user message to database
      await Message.create({
        sessionId,
        userId: session.userId,
        role: 'user',
        content: transcript,
        timestamp: new Date(),
      });

      // Analyze emotion and crisis detection in parallel
      // EXPLANATION: Don't wait for these - they happen in background
      // This matches Python script's threading approach
      this.analyzeInputInBackground(sessionId, transcript).catch((error) => {
        logError('[VoiceLiveService] Error analyzing input', error);
      });
    } catch (error) {
      logError('[VoiceLiveService] Error recording user input', error);
    }
  }

  /**
   * EXPLANATION: Analyze user input for emotion and crisis (background task)
   * 
   * Runs emotion detection and crisis detection in parallel without blocking.
   * Results are emitted back to client via gateway.
   */
  private async analyzeInputInBackground(
    sessionId: string,
    transcript: string
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.status !== 'active') return;

      // Run emotion and crisis detection in parallel
      // EXPLANATION: Promise.all runs both simultaneously instead of one after the other
      // This saves processing time (e.g., 200ms each = 200ms total instead of 400ms)
      const [emotionResult, crisisResult] = await Promise.all([
        this.emotionService.analyzeEmotion(transcript),
        this.crisisService.detectCrisis(transcript, { userId: session.userId }),
      ]);

      // Track emotion
      if (emotionResult && emotionResult.primary) {
        const primaryEmotion = emotionResult.primary;
        const currentCount = session.topEmotions.get(primaryEmotion) || 0;
        session.topEmotions.set(primaryEmotion, currentCount + 1);

        logInfo(
          `[VoiceLiveService] Emotion detected: ${primaryEmotion} (${emotionResult.confidence.toFixed(2)})`
        );
      }

      // Handle crisis detection
      if (crisisResult && crisisResult.isCrisis) {
        session.crisisDetected = true;
        logInfo(
          `[VoiceLiveService] Crisis detected! Severity: ${crisisResult.severity}`
        );

        // TODO: Emit to client and/or escalate based on severity
      }
    } catch (error) {
      logError('[VoiceLiveService] Error in background analysis', error);
    }
  }

  /**
   * EXPLANATION: Perform crisis escalation for a session
   * 
   * When crisis is detected with high confidence, escalate to human intervention.
   * This involves:
   * 1. Marking session as crisis_escalated in database
   * 2. Recording crisis event with timestamp and severity
   * 3. Notifying crisis team (if integrated)
   * 4. Providing emergency resources to user
   * 
   * Based on Python script's crisis handling logic.
   */
  async escalateCrisis(sessionId: string, crisisData: any): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) return;

      logInfo(`[VoiceLiveService] Escalating crisis for session: ${sessionId}`);

      // Mark session as crisis escalated
      session.status = 'ended';
      session.crisisDetected = true;

      // Update database with crisis event
      await ConversationSession.findByIdAndUpdate(
        session.sessionId,
        {
          status: 'crisis_escalated',
          metadata: {
            crisisData,
            escalatedAt: new Date(),
            severity: crisisData.severity,
            keywords: crisisData.keywords,
          },
        },
        { new: true }
      );

      // Close the Azure connection
      session.voiceLiveClient.disconnect();

      // TODO: Send notification to crisis management team (email, SMS, dashboard)
      // TODO: Store crisis event in database for analytics and reporting
      // TODO: Log to audit trail for compliance
    } catch (error) {
      logError('[VoiceLiveService] Error escalating crisis', error);
    }
  }
}
