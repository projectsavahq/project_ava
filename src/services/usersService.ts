import { mongoDb } from "../models/mongoDatabase";
import { IUser, ICrisisEvent, IConversationSession } from "../models/mongoSchemas";

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
   * Get user profile by userId
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse | null> {
    const user = await mongoDb.getUserById(userId);
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
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: any): Promise<UserProfileResponse | null> {
    // Don't allow updating sensitive fields
    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates.userId;
    delete sanitizedUpdates._id;
    delete sanitizedUpdates.crisisHistory;
    delete sanitizedUpdates.createdAt;

    const updatedUser = await mongoDb.updateUser(userId, sanitizedUpdates);
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
    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return null;
    }

    const sessions = await mongoDb.getSessionsByUserId(userId, limit);
    
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
    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return null;
    }

    const metrics = await mongoDb.getUserWellnessMetrics(userId, days);
    return metrics;
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<Pick<IUser, 'userId' | 'isActive'> | null> {
    const deactivatedUser = await mongoDb.deactivateUser(userId);
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
    const user = await mongoDb.getUserById(userId);
    if (!user) {
      return null;
    }

    const crisisEvents = await mongoDb.getCrisisEventsByUserId(userId, limit);

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
}