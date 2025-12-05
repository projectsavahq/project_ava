import { User, ConversationSession, CrisisEvent, IUser, ICrisisEvent, IConversationSession } from "../models/schemas";

export interface UserProfileResponse {
  userId: string;
  email?: string;
  preferences: any;
  supportLevel: string;
  crisisHistory: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSessionResponse {
  sessionId: string;
  status: string;
  createdAt: Date;
  endedAt?: Date;
  totalMessages: number;
  averageEmotion?: any;
  duration?: number;
}

export interface CrisisEventResponse {
  id: string;
  severity: string;
  detectedAt: Date;
  status: string;
  keywords: string[];
  confidence: number;
  responseActions: any[];
}

export interface CrisisHistoryResponse {
  crisisHistory: any;
  events: CrisisEventResponse[];
}

export class UsersService {
  /**
   * Create a new user
   */
  async createUser(userData: {
    userId: string;
    email?: string;
    preferences?: any;
  }): Promise<IUser> {
    const user = new User({
      userId: userData.userId,
      email: userData.email,
      preferences: {
        voicePreference: "AVA-Default",
        language: "en-US",
        notificationSettings: {
          crisisAlerts: true,
          dailyCheckins: false,
          wellnessReminders: true,
        },
        ...userData.preferences,
      },
      crisisHistory: false,
      supportLevel: "basic",
      isActive: true,
    });

    return await user.save();
  }

  /**
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return null;
    }

    return {
      userId: user.userId,
      email: user.email,
      preferences: user.preferences,
      supportLevel: user.supportLevel,
      crisisHistory: user.crisisHistory,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email, isActive: true }).lean();
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: any): Promise<UserProfileResponse | null> {
    // Don't allow updating sensitive fields
    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates.userId;
    delete sanitizedUpdates._id;
    delete sanitizedUpdates.crisisHistory;
    delete sanitizedUpdates.createdAt;

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { ...sanitizedUpdates, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return null;
    }

    return {
      userId: updatedUser.userId,
      email: updatedUser.email,
      preferences: updatedUser.preferences,
      supportLevel: updatedUser.supportLevel,
      crisisHistory: updatedUser.crisisHistory,
      isActive: updatedUser.isActive,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Get user's conversation sessions
   */
  async getUserSessions(userId: string, limit: number, status?: string): Promise<UserSessionResponse[] | null> {
    // Check if user exists
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return null;
    }

    const sessions = await ConversationSession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return sessions.map((session: IConversationSession): UserSessionResponse => ({
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      totalMessages: session.totalMessages,
      averageEmotion: session.averageEmotion,
      duration: session.duration,
    }));
  }

  /**
   * Get user's wellness metrics
   */
  async getWellnessMetrics(userId: string, days: number): Promise<any | null> {
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return null;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [sessions, crisisEvents] = await Promise.all([
      ConversationSession.find({
        userId,
        createdAt: { $gte: startDate },
      }).lean(),
      CrisisEvent.find({
        userId,
        detectedAt: { $gte: startDate },
      }).lean(),
    ]);

    // Calculate metrics
    const totalSessions = sessions.length;
    const averageDuration =
      sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / totalSessions || 0;

    return {
      totalSessions,
      averageDuration,
      crisisEventCount: crisisEvents.length,
      engagementLevel:
        totalSessions >= 3 ? "high" : totalSessions >= 1 ? "medium" : "low",
    };
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<Pick<IUser, 'userId' | 'isActive'> | null> {
    const deactivatedUser = await User.findOneAndUpdate(
      { userId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!deactivatedUser) {
      return null;
    }

    return {
      userId: deactivatedUser.userId,
      isActive: deactivatedUser.isActive,
    };
  }

  /**
   * Get user's crisis history
   */
  async getCrisisHistory(userId: string, limit: number): Promise<CrisisHistoryResponse | null> {
    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return null;
    }

    const crisisEvents = await CrisisEvent.find({ userId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    return {
      crisisHistory: user.crisisHistory,
      events: crisisEvents.map((event: ICrisisEvent): CrisisEventResponse => ({
        id: event._id.toString(),
        severity: event.severity,
        detectedAt: event.detectedAt,
        status: event.status,
        keywords: event.keywords,
        confidence: event.confidence,
        responseActions: event.responseActions,
      })),
    };
  }

  /**
   * Clear all user data
   */
  async clearUserData(userId: string): Promise<void> {
    // Delete all related data and deactivate user
    await Promise.all([
      ConversationSession.deleteMany({ userId }),
      CrisisEvent.deleteMany({ userId }),
      User.findOneAndUpdate({ userId }, { isActive: false }),
    ]);
  }
}
