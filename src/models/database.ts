import mongoose from "mongoose";
import { logInfo, logError } from "../utils/logger";

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
        logInfo("📦 Database already connected");
        return;
      }

      const mongoUri = process.env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error("MONGODB_URI environment variable is not set");
      }

      // Set connection timeout
      await Promise.race([
        mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("MongoDB connection timeout after 15 seconds")), 15000)
        )
      ]);
      
      this.isConnected = true;
      logInfo("✅ Connected to MongoDB successfully");
    } catch (error) {
      logError("❌ MongoDB connection error", error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB database
   */
  async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        logInfo("📦 Database already disconnected");
        return;
      }

      await mongoose.disconnect();
      this.isConnected = false;
      logInfo("🔌 MongoDB disconnected successfully");
    } catch (error) {
      logError("❌ MongoDB disconnection error", error);
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