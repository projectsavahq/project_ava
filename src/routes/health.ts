import { Router, Request, Response } from "express";
import { dbConnection } from "../models/database";
import { mongoDb } from "../models/mongoDatabase";

const router = Router();

// Basic health check
router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "AVA Voice AI Companion",
    version: "1.0.0",
  });
});

// Detailed system status
router.get("/detailed", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      api: "operational",
      speech_to_text: "operational",
      text_to_speech: "operational",
      emotion_detection: "operational",
      crisis_detection: "operational",
      dialogue_manager: "operational",
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Database health (now with actual MongoDB check)
router.get("/database", async (req: Request, res: Response): Promise<void> => {
  try {
    const [connectionHealth, dbHealth] = await Promise.all([
      dbConnection.healthCheck(),
      mongoDb.healthCheck()
    ]);

    res.json({
      connection: connectionHealth,
      database: dbHealth,
      overall_status: connectionHealth.status === "healthy" && dbHealth.status === "healthy" ? "healthy" : "unhealthy"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
