import { Router, Request, Response } from "express";
import { DialogueManagerService } from "@services/dialogueManager";
import { EmotionDetectionService } from "@services/emotionDetection";

const router = Router();
const dialogueService = new DialogueManagerService();
const emotionService = new EmotionDetectionService();

// Start a new conversation session
router.post("/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const sessionId = `session_${userId}_${Date.now()}`;
    const context = {
      userId,
      sessionId,
      conversationHistory: [],
      currentEmotion: undefined,
    };

    res.json({
      sessionId,
      message:
        "Hello! I'm AVA, your AI companion. I'm here to listen and support you. How are you feeling today?",
      context,
    });
  } catch (error) {
    console.error("Error starting conversation:", error);
    res.status(500).json({ error: "Failed to start conversation" });
  }
});

// Process text input
router.post("/message", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, userId, sessionId, context } = req.body;

    if (!text || !userId || !sessionId) {
      res
        .status(400)
        .json({ error: "text, userId, and sessionId are required" });
      return;
    }

    const conversationContext = context || {
      userId,
      sessionId,
      conversationHistory: [],
      currentEmotion: undefined,
    };

    const { response, updatedContext } = await dialogueService.processUserInput(
      text,
      conversationContext
    );

    res.json({
      response,
      context: updatedContext,
      emotion: updatedContext.currentEmotion,
    });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

// Get conversation history
router.get("/history/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // TODO: Implement database retrieval
    // For now, return empty history
    res.json({
      sessionId,
      history: [],
      message: "Conversation history retrieval not implemented yet",
    });
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Failed to fetch conversation history" });
  }
});

// Analyze emotion from text
router.post(
  "/analyze-emotion",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body;

      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }

      const emotion = await emotionService.analyzeEmotion(text);

      res.json({ emotion });
    } catch (error) {
      console.error("Error analyzing emotion:", error);
      res.status(500).json({ error: "Failed to analyze emotion" });
    }
  }
);

// Get coaching prompt based on current emotion
router.post(
  "/coaching-prompt",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { emotion, context } = req.body;

      if (!emotion) {
        res.status(400).json({ error: "emotion is required" });
        return;
      }

      const conversationContext = context || {
        userId: "anonymous",
        sessionId: "temp",
        conversationHistory: [],
        currentEmotion: undefined,
      };

      const prompt = await dialogueService.generateCoachingPrompt(
        emotion,
        conversationContext
      );

      res.json({ prompt });
    } catch (error) {
      console.error("Error generating coaching prompt:", error);
      res.status(500).json({ error: "Failed to generate coaching prompt" });
    }
  }
);

export default router;
