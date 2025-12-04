import {
  User,
  ConversationSession,
  ConversationMessage,
  CrisisEvent,
  EmotionTrend,
} from "./types";

// Mock database implementation for development
// In production, replace with actual database operations

class MockDatabase {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, ConversationSession> = new Map();
  private messages: Map<string, ConversationMessage> = new Map();
  private crisisEvents: Map<string, CrisisEvent> = new Map();

  // User operations
  async createUser(userData: Partial<User>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date(),
      updated_at: new Date(),
      preferences: {
        voice_preference: "AVA-Default",
        language: "en-US",
      },
      crisis_history: false,
      support_level: "basic",
      ...userData,
    };

    this.users.set(user.id, user);
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updates,
      updated_at: new Date(),
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Session operations
  async createSession(userId: string): Promise<ConversationSession> {
    const session: ConversationSession = {
      id: `session_${userId}_${Date.now()}`,
      user_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
      status: "active",
      total_messages: 0,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getSessionById(sessionId: string): Promise<ConversationSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async endSession(sessionId: string): Promise<ConversationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      status: "ended" as const,
      ended_at: new Date(),
      updated_at: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  // Message operations
  async addMessage(
    messageData: Omit<ConversationMessage, "id" | "timestamp">
  ): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...messageData,
    };

    this.messages.set(message.id, message);

    // Update session message count
    const session = this.sessions.get(message.session_id);
    if (session) {
      session.total_messages += 1;
      session.updated_at = new Date();
      this.sessions.set(session.id, session);
    }

    return message;
  }

  async getMessagesBySessionId(
    sessionId: string
  ): Promise<ConversationMessage[]> {
    return Array.from(this.messages.values())
      .filter((msg) => msg.session_id === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Crisis operations
  async createCrisisEvent(
    eventData: Omit<CrisisEvent, "id" | "detected_at">
  ): Promise<CrisisEvent> {
    const crisisEvent: CrisisEvent = {
      id: `crisis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      detected_at: new Date(),
      ...eventData,
    };

    this.crisisEvents.set(crisisEvent.id, crisisEvent);
    return crisisEvent;
  }

  async getCrisisEventsByUserId(userId: string): Promise<CrisisEvent[]> {
    return Array.from(this.crisisEvents.values())
      .filter((event) => event.user_id === userId)
      .sort((a, b) => b.detected_at.getTime() - a.detected_at.getTime());
  }

  // Analytics operations
  async getEmotionTrends(
    userId: string,
    days: number = 7
  ): Promise<EmotionTrend[]> {
    // Mock implementation
    return [];
  }

  // Utility methods
  async clearUserData(userId: string): Promise<void> {
    // Remove user and all associated data
    this.users.delete(userId);

    const userSessions = Array.from(this.sessions.values()).filter(
      (session) => session.user_id === userId
    );

    userSessions.forEach((session) => {
      this.sessions.delete(session.id);

      const sessionMessages = Array.from(this.messages.values()).filter(
        (msg) => msg.session_id === session.id
      );

      sessionMessages.forEach((msg) => this.messages.delete(msg.id));
    });

    const userCrisisEvents = Array.from(this.crisisEvents.values()).filter(
      (event) => event.user_id === userId
    );

    userCrisisEvents.forEach((event) => this.crisisEvents.delete(event.id));
  }

  async getStats(): Promise<any> {
    return {
      total_users: this.users.size,
      total_sessions: this.sessions.size,
      total_messages: this.messages.size,
      total_crisis_events: this.crisisEvents.size,
      active_sessions: Array.from(this.sessions.values()).filter(
        (s) => s.status === "active"
      ).length,
    };
  }
}

// Export singleton instance
export const mockDb = new MockDatabase();
export default mockDb;
