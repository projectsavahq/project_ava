import { Router, Request, Response } from "express";
import { CrisisDetectionService } from "@services/crisisDetection";

const router = Router();
const crisisService = new CrisisDetectionService();

// Analyze text for crisis indicators
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { text, userId, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const crisisResult = await crisisService.detectCrisis(text, context);

    // If crisis detected, also escalate
    if (crisisResult.isCrisis && userId) {
      await crisisService.escalateCrisis(userId, crisisResult);
    }

    res.json(crisisResult);
  } catch (error) {
    console.error("Error analyzing crisis indicators:", error);
    res.status(500).json({ error: "Failed to analyze crisis indicators" });
  }
});

// Get emergency resources
router.get("/resources", async (req: Request, res: Response) => {
  try {
    const resources = crisisService.getEmergencyResources();
    res.json(resources);
  } catch (error) {
    console.error("Error fetching emergency resources:", error);
    res.status(500).json({ error: "Failed to fetch emergency resources" });
  }
});

// Emergency escalation endpoint
router.post("/escalate", async (req: Request, res: Response) => {
  try {
    const { userId, severity, details } = req.body;

    if (!userId || !severity) {
      return res
        .status(400)
        .json({ error: "userId and severity are required" });
    }

    const crisisResult = {
      isCrisis: true,
      severity: severity as "low" | "medium" | "high" | "critical",
      keywords: [],
      confidence: 1.0,
      recommendedAction: "MANUAL_ESCALATION",
    };

    await crisisService.escalateCrisis(userId, crisisResult);

    res.json({
      message: "Crisis escalation initiated",
      resources: crisisService.getEmergencyResources(),
      escalated: true,
    });
  } catch (error) {
    console.error("Error escalating crisis:", error);
    res.status(500).json({ error: "Failed to escalate crisis" });
  }
});

// Check if user is in crisis mode
router.get("/status/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // TODO: Implement database check for user crisis status
    // For now, return default status
    res.json({
      userId,
      inCrisis: false,
      lastCrisisCheck: new Date(),
      message: "Crisis status check not fully implemented yet",
    });
  } catch (error) {
    console.error("Error checking crisis status:", error);
    res.status(500).json({ error: "Failed to check crisis status" });
  }
});

export default router;
