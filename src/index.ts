import express, { Request, Response, NextFunction } from "express";
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
import { specs, getSwaggerSpecs, swaggerUi } from "./config/swagger";

// Import database
import { dbConnection } from "./models/database";
import { mongoDb } from "./models/mongoDatabase";

// Import routes
import voiceRoutes from "./routes/voice";
import conversationRoutes from "./routes/conversation";
import crisisRoutes from "./routes/crisis";
import healthRoutes from "./routes/health";
import usersRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";

// Import Voice Live Gateway for WebSocket voice communication
import { VoiceLiveGateway } from "./gateways/voiceLive.gateway";

dotenv.config();


const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST","PUT","PATCH"],
    credentials: true
  },
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(morgan("combined", { stream: morganStream }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimiter);

// Swagger Documentation
app.use('/api-docs', (req: Request, res: Response, next: NextFunction) => {
  // Dynamically set the server URL based on the incoming request
  // Check for forwarded headers first (for deployed environments behind proxies)
  const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
  const host = req.get('X-Forwarded-Host') || req.get('Host') || `localhost:${PORT}`;
  
  // For deployed environments, ensure we use the correct protocol and host
  const serverUrl = `${protocol}://${host}`;
  
  // Set CORS headers for Swagger UI
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || "http://localhost:3000");
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  next();
}, swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  // Dynamically set the server URL based on the incoming request
  const protocol = req.get('X-Forwarded-Proto') || req.protocol || 'https';
  const host = req.get('X-Forwarded-Host') || req.get('Host') || `localhost:${PORT}`;
  const serverUrl = `${protocol}://${host}`;
  
  // Get dynamic specs with correct server URL
  const dynamicSpecs = getSwaggerSpecs(serverUrl);
  
  // Setup Swagger UI with dynamic specs
  swaggerUi.setup(dynamicSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "AVA Authentication API Documentation",
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      servers: dynamicSpecs.servers
    }
  })(req, res, next);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/crisis", crisisRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", usersRoutes);

// WebSocket connection for real-time communication
// EXPLANATION: Initialize Voice Live Gateway for voice conversations
const voiceLiveGateway = new VoiceLiveGateway();
// Initialize gateway with the main io server
voiceLiveGateway.afterInit(io);

// Create a dedicated namespace for voice at '/voice' and forward events to the gateway
const voiceNamespace = io.of('/voice');

voiceNamespace.on('connection', (socket) => {
  logInfo(`[Voice Namespace] Client connected: ${socket.id}`);

  // Forward lifecycle event to gateway
  try {
    // Call the gateway's connection handler (non-decorator usage)
    (voiceLiveGateway as any).handleConnection?.(socket);
  } catch (e) {
    logError('[Voice Namespace] Error in handleConnection', e);
  }

  // Wire voice-related events to the gateway methods
  socket.on('voice:connect', (payload: any) => {
    (voiceLiveGateway as any).handleVoiceConnect?.(socket, payload);
  });

  socket.on('voice:audio', (payload: any) => {
    (voiceLiveGateway as any).handleAudioChunk?.(socket, payload);
  });

  socket.on('voice:text-input', (payload: any) => {
    (voiceLiveGateway as any).handleTextInput?.(socket, payload);
  });

  socket.on('voice:disconnect', (payload: any) => {
    (voiceLiveGateway as any).handleVoiceDisconnect?.(socket, payload);
  });

  socket.on('voice:heartbeat', (payload: any) => {
    (voiceLiveGateway as any).handleHeartbeat?.(socket, payload);
  });

  socket.on('disconnect', (reason: any) => {
    logInfo(`[Voice Namespace] Client disconnected: ${socket.id} (${reason})`);
    try {
      (voiceLiveGateway as any).handleDisconnect?.(socket);
    } catch (e) {
      logError('[Voice Namespace] Error in handleDisconnect', e);
    }
  });
});

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
