import mongoose from "mongoose";

/**
 * Database connection utility
 * Handles MongoDB connection and disconnection
 */
class DatabaseConnection {
  private isConnected = false;

  /**
   * Connect to MongoDB database
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log("📦 Database already connected");
        return;
      }

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

  /**
   * Disconnect from MongoDB database
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        console.log("📦 Database already disconnected");
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      console.log("🔌 MongoDB disconnected successfully");
    } catch (error) {
      console.error("❌ MongoDB disconnection error:", error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  get connectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get mongoose connection state
   * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
   */
  get mongooseState(): number {
    return mongoose.connection.readyState;
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<{ status: string; state: string }> {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    const currentState = this.mongooseState;
    
    return {
      status: currentState === 1 ? "healthy" : "unhealthy",
      state: states[currentState] || "unknown"
    };
  }
}

// Export singleton instance
export const dbConnection = new DatabaseConnection();
export default dbConnection;