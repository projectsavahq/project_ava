import { Router } from "express";
import { ConversationController } from "../controllers";

const router = Router();
const conversationController = new ConversationController();

// Start a new conversation session
router.post("/start", conversationController.startConversation);

// Process text input
router.post("/message", conversationController.processMessage);

// Get conversation history
router.get("/history/:sessionId", conversationController.getConversationHistory);

// Analyze emotion from text
router.post("/analyze-emotion", conversationController.analyzeEmotion);

// Get coaching prompt based on current emotion
router.post("/coaching-prompt", conversationController.generateCoachingPrompt);

export default router;
