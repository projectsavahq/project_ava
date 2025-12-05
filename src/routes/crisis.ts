import { Router } from "express";
import { CrisisController } from "../controllers";

const router = Router();
const crisisController = new CrisisController();

// Analyze text for crisis indicators
router.post("/analyze", crisisController.analyzeCrisis);

// Get emergency resources
router.get("/resources", crisisController.getEmergencyResources);

// Emergency escalation endpoint
router.post("/escalate", crisisController.escalateCrisis);

// Check if user is in crisis mode
router.get("/status/:userId", crisisController.getCrisisStatus);

export default router;
