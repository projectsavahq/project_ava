import { Request, Response } from "express";
import { CrisisService } from "../services/crisisService";

export class CrisisController {
  private crisisService: CrisisService;

  constructor() {
    this.crisisService = new CrisisService();
  }

  /**
   * Analyze text for crisis indicators
   */
  analyzeCrisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, userId, context } = req.body;

      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }

      const result = await this.crisisService.analyzeCrisisIndicators(text, userId, context);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing crisis indicators:", error);
      res.status(500).json({ error: "Failed to analyze crisis indicators" });
    }
  };

  /**
   * Get emergency resources
   */
  getEmergencyResources = async (req: Request, res: Response): Promise<void> => {
    try {
      const resources = this.crisisService.getEmergencyResources();
      res.json(resources);
    } catch (error) {
      console.error("Error fetching emergency resources:", error);
      res.status(500).json({ error: "Failed to fetch emergency resources" });
    }
  };

  /**
   * Emergency escalation endpoint
   */
  escalateCrisis = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, severity, details } = req.body;

      if (!userId || !severity) {
        res.status(400).json({ error: "userId and severity are required" });
        return;
      }

      const result = await this.crisisService.escalateCrisis(userId, severity, details);
      res.json(result);
    } catch (error) {
      console.error("Error escalating crisis:", error);
      res.status(500).json({ error: "Failed to escalate crisis" });
    }
  };

  /**
   * Check if user is in crisis mode
   */
  getCrisisStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const status = await this.crisisService.getCrisisStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error checking crisis status:", error);
      res.status(500).json({ error: "Failed to check crisis status" });
    }
  };
}