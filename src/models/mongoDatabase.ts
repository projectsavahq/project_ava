import mongoose from "mongoose";
import {
  User,
  ConversationSession,
  Message,
  CrisisEvent,
  EmotionTrend,
  IUser,
  IConversationSession,
  IMessage,
  ICrisisEvent,
  IEmotionTrend,
} from "./mongoSchemas";

class MongoDatabase {
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      if (this.isConnected) return;

      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      await mongoose.connect(mongoUri);
      this.isConnected = true;
      console.log("✅ Connected to MongoDB successfully");
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log("MongoDB disconnected");
    }
  }

  // User operations
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    const user = new User({
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
      ...userData,
    });

    return await user.save();
  }

  async getUserById(userId: string): Promise<IUser | null> {
    return await User.findOne({ userId }).lean();
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email, isActive: true }).lean();
  }

  async updateUser(
    userId: string,
    updates: Partial<IUser>
  ): Promise<IUser | null> {
    return await User.findOneAndUpdate(
      { userId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  async deactivateUser(userId: string): Promise<IUser | null> {
    return await User.findOneAndUpdate(
      { userId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    ).lean();
  }

  // Session operations
  async createSession(
    userId: string,
    sessionData?: Partial<IConversationSession>
  ): Promise<IConversationSession> {
    const session = new ConversationSession({
      userId,
      sessionId: `session_${userId}_${Date.now()}`,
      status: "active",
      totalMessages: 0,
      metadata: {},
      ...sessionData,
    });

    return await session.save();
  }

  async getSessionById(
    sessionId: string
  ): Promise<IConversationSession | null> {
    return await ConversationSession.findOne({ sessionId }).lean();
  }

  async getActiveSessionsByUserId(
    userId: string
  ): Promise<IConversationSession[]> {
    return await ConversationSession.find({
      userId,
      status: "active",
    })
      .sort({ updatedAt: -1 })
      .lean();
  }

  async endSession(
    sessionId: string,
    summary?: string
  ): Promise<IConversationSession | null> {
    const session = await ConversationSession.findOne({ sessionId });
    if (!session) return null;

    // Calculate session duration
    const duration = Math.floor(
      (Date.now() - session.createdAt.getTime()) / 1000
    );

    // Get emotion data for average calculation
    const messages = await Message.find({
      sessionId,
      "emotionData.primaryEmotion": { $exists: true },
    });

    let averageEmotion = "calm";
    if (messages.length > 0) {
      const emotionCounts: { [key: string]: number } = {};
      messages.forEach((msg) => {
        const emotion = msg.emotionData?.primaryEmotion;
        if (emotion) {
          emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        }
      });

      averageEmotion = Object.keys(emotionCounts).reduce((a, b) =>
        emotionCounts[a] > emotionCounts[b] ? a : b
      );
    }

    return await ConversationSession.findOneAndUpdate(
      { sessionId },
      {
        status: "ended",
        endedAt: new Date(),
        updatedAt: new Date(),
        duration,
        averageEmotion,
        ...(summary && { summary }),
      },
      { new: true }
    ).lean();
  }

  // Message operations
  async addMessage(messageData: Omit<IMessage, "_id">): Promise<IMessage> {
    const message = new Message(messageData);
    const savedMessage = await message.save();

    // Update session message count
    await ConversationSession.findOneAndUpdate(
      { sessionId: messageData.sessionId },
      {
        $inc: { totalMessages: 1 },
        updatedAt: new Date(),
      }
    );

    return savedMessage;
  }

  async getMessagesBySessionId(
    sessionId: string,
    limit?: number
  ): Promise<IMessage[]> {
    const query = Message.find({ sessionId }).sort({ timestamp: 1 });
    if (limit) query.limit(limit);
    return await query.lean();
  }

  async getRecentMessagesByUserId(
    userId: string,
    limit = 50
  ): Promise<IMessage[]> {
    return await Message.find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  // Crisis operations
  async createCrisisEvent(
    eventData: Omit<ICrisisEvent, "_id">
  ): Promise<ICrisisEvent> {
    const crisisEvent = new CrisisEvent(eventData);
    const savedEvent = await crisisEvent.save();

    // Update user crisis history
    await User.findOneAndUpdate(
      { userId: eventData.userId },
      {
        crisisHistory: true,
        updatedAt: new Date(),
      }
    );

    return savedEvent;
  }

  async getCrisisEventsByUserId(
    userId: string,
    limit = 20
  ): Promise<ICrisisEvent[]> {
    return await CrisisEvent.find({ userId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getActiveCrisisEvents(): Promise<ICrisisEvent[]> {
    return await CrisisEvent.find({
      status: "active",
      severity: { $in: ["high", "critical"] },
    })
      .sort({ detectedAt: -1 })
      .lean();
  }

  async resolveCrisisEvent(
    crisisId: string,
    resolution: string
  ): Promise<ICrisisEvent | null> {
    return await CrisisEvent.findByIdAndUpdate(
      crisisId,
      {
        status: "resolved",
        resolvedAt: new Date(),
        $push: {
          escalationLog: {
            timestamp: new Date(),
            action: "resolved",
            details: resolution,
            automated: false,
            success: true,
          },
        },
      },
      { new: true }
    ).lean();
  }

  // Analytics operations
  async createEmotionTrend(
    trendData: Omit<IEmotionTrend, "_id">
  ): Promise<IEmotionTrend> {
    const trend = new EmotionTrend(trendData);
    return await trend.save();
  }

  async getEmotionTrends(userId: string, days = 7): Promise<IEmotionTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await EmotionTrend.find({
      userId,
      date: { $gte: startDate },
    })
      .sort({ date: -1 })
      .lean();
  }

  async getUserWellnessMetrics(userId: string, days = 7): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [sessions, messages, crisisEvents] = await Promise.all([
      ConversationSession.find({
        userId,
        createdAt: { $gte: startDate },
      }).lean(),
      Message.find({
        userId,
        timestamp: { $gte: startDate },
        "emotionData.primaryEmotion": { $exists: true },
      }).lean(),
      CrisisEvent.find({
        userId,
        detectedAt: { $gte: startDate },
      }).lean(),
    ]);

    // Calculate metrics
    const totalSessions = sessions.length;
    const averageDuration =
      sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / totalSessions ||
      0;
    const emotionDistribution: { [key: string]: number } = {};

    messages.forEach((msg) => {
      const emotion = msg.emotionData?.primaryEmotion;
      if (emotion) {
        emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
      }
    });

    return {
      totalSessions,
      averageDuration,
      emotionDistribution,
      crisisEventCount: crisisEvents.length,
      engagementLevel:
        totalSessions >= 3 ? "high" : totalSessions >= 1 ? "medium" : "low",
    };
  }

  // Utility methods
  async getStats(): Promise<any> {
    const [userCount, sessionCount, messageCount, crisisCount] =
      await Promise.all([
        User.countDocuments({ isActive: true }),
        ConversationSession.countDocuments(),
        Message.countDocuments(),
        CrisisEvent.countDocuments(),
      ]);

    const activeSessions = await ConversationSession.countDocuments({
      status: "active",
    });

    return {
      totalUsers: userCount,
      totalSessions: sessionCount,
      totalMessages: messageCount,
      totalCrisisEvents: crisisCount,
      activeSessions,
    };
  }

  async clearUserData(userId: string): Promise<void> {
    // Get all sessions for the user
    const sessions = await ConversationSession.find({ userId }).lean();
    const sessionIds = sessions.map((s) => s.sessionId);

    // Delete all related data
    await Promise.all([
      Message.deleteMany({ userId }),
      CrisisEvent.deleteMany({ userId }),
      EmotionTrend.deleteMany({ userId }),
      ConversationSession.deleteMany({ userId }),
      User.findOneAndUpdate({ userId }, { isActive: false }),
    ]);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const dbState = mongoose.connection.readyState;
      const states = [
        "disconnected",
        "connected",
        "connecting",
        "disconnecting",
      ];

      if (dbState === 1) {
        const stats = await this.getStats();
        return {
          status: "healthy",
          details: {
            connection: states[dbState],
            ...stats,
          },
        };
      } else {
        return {
          status: "unhealthy",
          details: { connection: states[dbState] },
        };
      }
    } catch (error) {
      return {
        status: "error",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}

// Export singleton instance
export const mongoDb = new MongoDatabase();
export default mongoDb;
