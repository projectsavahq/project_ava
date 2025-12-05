import { DialogueManagerService } from "./dialogueManager";
import { EmotionDetectionService } from "./emotionDetection";
import { User, ConversationSession, Message, IUser, IConversationSession, IMessage } from "../models/schemas";

export interface ConversationStartResponse {
  sessionId: string;
  message: string;
  user: {
    id: string;
    preferences: any;
  } | null;
}

export interface MessageResponse {
  response: string;
  context: any;
  emotion: any;
}

export interface ConversationHistoryResponse {
  session: {
    sessionId: string;
    userId: string;
    status: string;
    createdAt: Date;
    totalMessages: number;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: Date;
    emotion: any;
  }>;
}

export interface EmotionAnalysisResponse {
  emotion: any;
}

export interface CoachingPromptResponse {
  prompt: string;
}

export class ConversationService {
  private dialogueService: DialogueManagerService;
  private emotionService: EmotionDetectionService;

  constructor() {
    this.dialogueService = new DialogueManagerService();
    this.emotionService = new EmotionDetectionService();
  }

  /**
   * Start a new conversation session
   */
  async startConversation(userId: string, email?: string): Promise<ConversationStartResponse> {
    // Create or get user
    let user = await User.findOne({ userId }).lean();
    if (!user && email) {
      user = await new User({
        userId,
        email,
        preferences: {
          voicePreference: "AVA-Default",
          language: "en-US",
          notificationSettings: {
            crisisAlerts: true,
            dailyCheckins: false,
            wellnessReminders: true,
          },
        },
        crisisHistory: false,
        supportLevel: "basic",
        isActive: true,
      }).save();
    }

    // Create new session
    const session = await new ConversationSession({
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      status: "active",
      totalMessages: 0,
      metadata: {},
    }).save();

    return {
      sessionId: session.sessionId,
      message: "Hello! I'm AVA, your AI companion. I'm here to listen and support you. How are you feeling today?",
      user: user ? { id: user.userId, preferences: user.preferences } : null,
    };
  }

  /**
   * Process a message from the user
   */
  async processMessage(
    text: string,
    userId: string,
    sessionId: string,
    context?: any
  ): Promise<MessageResponse> {
    const conversationContext = context || {
      userId,
      sessionId,
      conversationHistory: [],
      currentEmotion: undefined,
    };

    const { response, updatedContext } = await this.dialogueService.processUserInput(
      text,
      conversationContext
    );

    return {
      response,
      context: updatedContext,
      emotion: updatedContext.currentEmotion,
    };
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(
    sessionId: string,
    limit?: number
  ): Promise<ConversationHistoryResponse | null> {
    // Get session details
    const session = await ConversationSession.findOne({ sessionId }).lean();
    if (!session) {
      return null;
    }

    // Get messages for this session
    const query = Message.find({ sessionId }).sort({ timestamp: 1 });
    if (limit) query.limit(limit);
    const messages = await query.lean();

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        status: session.status,
        createdAt: session.createdAt,
        totalMessages: session.totalMessages,
      },
      messages: messages.map((msg: IMessage) => ({
        id: msg._id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        emotion: msg.emotionData,
      })),
    };
  }

  /**
   * Analyze emotion from text
   */
  async analyzeEmotion(text: string): Promise<EmotionAnalysisResponse> {
    const emotion = await this.emotionService.analyzeEmotion(text);
    return { emotion };
  }

  /**
   * Generate coaching prompt based on emotion
   */
  async generateCoachingPrompt(
    emotion: any,
    context?: any
  ): Promise<CoachingPromptResponse> {
    const conversationContext = context || {
      userId: "anonymous",
      sessionId: "temp",
      conversationHistory: [],
      currentEmotion: undefined,
    };

    const prompt = await this.dialogueService.generateCoachingPrompt(
      emotion,
      conversationContext
    );

    return { prompt };
  }
}