import { Request, Response } from "express";
import { ConversationService } from "../services/conversationService";

export class ConversationController {
  private conversationService: ConversationService;

  constructor() {
    this.conversationService = new ConversationService();
  }

  /**
   * Start a new conversation session
   */
  startConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, email } = req.body;

      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      const result = await this.conversationService.startConversation(userId, email);
      res.json(result);
    } catch (error) {
      console.error("Error starting conversation:", error);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  };

  /**
   * Process text input
   */
  processMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, userId, sessionId, context } = req.body;

      if (!text || !userId || !sessionId) {
        res.status(400).json({ error: "text, userId, and sessionId are required" });
        return;
      }

      const result = await this.conversationService.processMessage(
        text,
        userId,
        sessionId,
        context
      );

      res.json(result);
    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  };

  /**
   * Get conversation history
   */
  getConversationHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { limit } = req.query;

      const history = await this.conversationService.getConversationHistory(
        sessionId,
        limit ? parseInt(limit as string) : undefined
      );

      if (!history) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      res.json(history);
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      res.status(500).json({ error: "Failed to fetch conversation history" });
    }
  };

  /**
   * Analyze emotion from text
   */
  analyzeEmotion = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text } = req.body;

      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }

      const result = await this.conversationService.analyzeEmotion(text);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing emotion:", error);
      res.status(500).json({ error: "Failed to analyze emotion" });
    }
  };

  /**
   * Get coaching prompt based on current emotion
   */
  generateCoachingPrompt = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emotion, context } = req.body;

      if (!emotion) {
        res.status(400).json({ error: "emotion is required" });
        return;
      }

      const result = await this.conversationService.generateCoachingPrompt(emotion, context);
      res.json(result);
    } catch (error) {
      console.error("Error generating coaching prompt:", error);
      res.status(500).json({ error: "Failed to generate coaching prompt" });
    }
  };
}