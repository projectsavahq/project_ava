import { Request, Response } from "express";
import { VoiceService } from "../services";

export class VoiceController {
  private voiceService: VoiceService;

  constructor() {
    this.voiceService = new VoiceService();
  }

  /**
   * Process audio input and return text + AI response
   */
  processAudio = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const { userId, sessionId } = req.body;
      if (!userId || !sessionId) {
        res.status(400).json({ error: "userId and sessionId are required" });
        return;
      }

      const result = await this.voiceService.processAudio(
        req.file.buffer,
        userId,
        sessionId
      );

      res.json(result);
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  };

  /**
   * Convert text to speech
   */
  textToSpeech = async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, voice, speed, pitch } = req.body;

      if (!text) {
        res.status(400).json({ error: "Text is required" });
        return;
      }

      const result = await this.voiceService.convertTextToSpeech(text, {
        voice,
        speed,
        pitch,
      });

      res.json(result);
    } catch (error) {
      console.error("Error in text-to-speech:", error);
      res.status(500).json({ error: "Failed to convert text to speech" });
    }
  };

  /**
   * Convert speech to text
   */
  speechToText = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const result = await this.voiceService.convertSpeechToText(req.file.buffer);
      res.json(result);
    } catch (error) {
      console.error("Error in speech-to-text:", error);
      res.status(500).json({ error: "Failed to convert speech to text" });
    }
  };

  /**
   * Get available voices
   */
  getVoices = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.voiceService.getAvailableVoices();
      res.json(result);
    } catch (error) {
      console.error("Error fetching voices:", error);
      res.status(500).json({ error: "Failed to fetch available voices" });
    }
  };
}