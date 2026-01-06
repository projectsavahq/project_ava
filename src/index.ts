import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

// Import logging
import { logger, morganStream, logInfo, logError } from "./utils/logger";

// Import swagger
import { specs, swaggerUi } from "./config/swagger";

// Import database
import { dbConnection } from "./models/database";
import { mongoDb } from "./models/mongoDatabase";

// Import routes
import healthRoutes from "./routes/health";
import usersRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import sessionsRoutes from "./routes/sessions";
import waitlistRoutes from "./routes/waitlist";
import subscriptionRoutes from "./routes/subscriptions";

// Import Voice Live Gateway for WebSocket voice communication
import { VoiceLiveGateway } from "./gateways/voiceLive.gateway";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";

dotenv.config();


const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined", { stream: morganStream }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimiter);

// Static files
app.use(express.static('public'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "AVA Authentication API Documentation"
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", subscriptionRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/waitlist", waitlistRoutes);

// WebSocket connection for real-time communication
// EXPLANATION: Initialize Voice Live Gateway for voice conversations
const voiceGateway = new VoiceLiveGateway(io);


// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Try to connect to MongoDB, but don't block if it fails
    try {
      await dbConnection.connect();
    } catch (dbError) {
      logError("⚠️  Could not connect to MongoDB on startup", dbError);
      logInfo("⚠️  Continuing without database connection. Some features may not work.");
    }

    // Promisify server.listen to keep the process alive
    return new Promise<void>((resolve, reject) => {
      server.listen(PORT, () => {
        logInfo(`🎙️  AVA Server running on port ${PORT}`);
        logInfo(`Environment: ${process.env.NODE_ENV || "development"}`);
        logInfo(`Database: ${dbConnection.connectionStatus ? "Connected" : "Not Connected"}`);
        logInfo(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
        resolve();
      });

      server.on('error', (error) => {
        logError("Server error", error);
        reject(error);
      });
    });
  } catch (error) {
    logError("Failed to start server", error);
    process.exit(1);
  }
};

startServer().catch((error) => {
  logError("Fatal error in server startup", error);
  process.exit(1);
});
process.on("SIGTERM", async () => {
  logInfo("SIGTERM received, shutting down gracefully");
  await dbConnection.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logInfo("SIGINT received, shutting down gracefully");
  await dbConnection.disconnect();
  process.exit(0);
});

// Export app for testing
export { app };
