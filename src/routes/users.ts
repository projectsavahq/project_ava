import { Router, Request, Response } from "express";
import { mongoDb } from "../models/mongoDatabase";

const router = Router();

// Get user profile by userId
router.get("/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await mongoDb.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      userId: user.userId,
      email: user.email,
      preferences: user.preferences,
      supportLevel: user.supportLevel,
      crisisHistory: user.crisisHistory,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user preferences
router.patch("/:userId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Don't allow updating sensitive fields
    delete updates.userId;
    delete updates._id;
    delete updates.crisisHistory;
    delete updates.createdAt;

    const updatedUser = await mongoDb.updateUser(userId, updates);
    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      message: "User updated successfully",
      user: {
        userId: updatedUser.userId,
        email: updatedUser.email,
        preferences: updatedUser.preferences,
        supportLevel: updatedUser.supportLevel,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Get user's conversation sessions
router.get(
  "/:userId/sessions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { limit = "10", status } = req.query;

      // Check if user exists
      const user = await mongoDb.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Get user's sessions (we need to add this method)
      const sessions = await mongoDb.getSessionsByUserId(
        userId,
        parseInt(limit as string)
      );

      res.json({
        userId,
        sessions: sessions.map((session) => ({
          sessionId: session.sessionId,
          status: session.status,
          createdAt: session.createdAt,
          endedAt: session.endedAt,
          totalMessages: session.totalMessages,
          averageEmotion: session.averageEmotion,
          duration: session.duration,
        })),
      });
    } catch (error) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ error: "Failed to fetch user sessions" });
    }
  }
);

// Get user's wellness metrics
router.get(
  "/:userId/wellness",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { days = "7" } = req.query;

      const user = await mongoDb.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const metrics = await mongoDb.getUserWellnessMetrics(
        userId,
        parseInt(days as string)
      );

      res.json({
        userId,
        timeframe: `${days} days`,
        metrics,
      });
    } catch (error) {
      console.error("Error fetching wellness metrics:", error);
      res.status(500).json({ error: "Failed to fetch wellness metrics" });
    }
  }
);

// Deactivate user (soft delete)
router.delete(
  "/:userId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const deactivatedUser = await mongoDb.deactivateUser(userId);
      if (!deactivatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        message: "User deactivated successfully",
        userId: deactivatedUser.userId,
        isActive: deactivatedUser.isActive,
      });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: "Failed to deactivate user" });
    }
  }
);

// Get user's crisis history
router.get(
  "/:userId/crisis-events",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { limit = "20" } = req.query;

      const user = await mongoDb.getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const crisisEvents = await mongoDb.getCrisisEventsByUserId(
        userId,
        parseInt(limit as string)
      );

      res.json({
        userId,
        crisisHistory: user.crisisHistory,
        events: crisisEvents.map((event) => ({
          id: event._id,
          severity: event.severity,
          detectedAt: event.detectedAt,
          status: event.status,
          keywords: event.keywords,
          confidence: event.confidence,
          responseActions: event.responseActions,
        })),
      });
    } catch (error) {
      console.error("Error fetching crisis events:", error);
      res.status(500).json({ error: "Failed to fetch crisis events" });
    }
  }
);

export default router;
