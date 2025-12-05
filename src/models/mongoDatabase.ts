import mongoose from "mongoose";

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

      return {
        status: dbState === 1 ? "healthy" : "unhealthy",
        details: {
          connection: states[dbState],
          readyState: dbState,
        },
      };
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
