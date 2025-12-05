import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

// Import database
import { dbConnection } from "./models/database";
import { mongoDb } from "./models/mongoDatabase";

// Import routes
import voiceRoutes from "./routes/voice";
import conversationRoutes from "./routes/conversation";
import crisisRoutes from "./routes/crisis";
import healthRoutes from "./routes/health";
import usersRoutes from "./routes/users";

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
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Routes
app.use("/api/voice", voiceRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/crisis", crisisRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/users", usersRoutes);

// WebSocket connection for real-time communication
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("voice_input", (data) => {
    // Handle real-time voice input
    console.log("Received voice input from:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
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
    // Connect to MongoDB
    await dbConnection.connect();

    server.listen(PORT, () => {
      console.log(`🎙️  AVA Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`Database: Connected to MongoDB`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await dbConnection.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await dbConnection.disconnect();
  process.exit(0);
});

startServer();
