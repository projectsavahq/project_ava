import { User, IUser } from "../models/schemas";

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
//   async getCrisisHistory(userId: string, limit: number): Promise<CrisisHistoryResponse | null> {
//     const user = await User.findOne({ userId }).lean();
//     if (!user) {
//       return null;
//     }

   
//     return {
//       crisisHistory: user.crisisHistory,
//       events: crisisEvents.map((event: ICrisisEvent): CrisisEventResponse => ({
//         id: event._id.toString(),
//         severity: event.severity,
//         detectedAt: event.detectedAt,
//         status: event.status,
//         keywords: event.keywords,
//         confidence: event.confidence,
//         responseActions: event.responseActions,
//       })),
//     };
//   }

  /**
   * Clear all user data
   */
}
