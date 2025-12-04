import { Router, Request, Response } from "express";
import multer from "multer";
import { SpeechToTextService } from "@services/speechToText";
import { TextToSpeechService } from "@services/textToSpeech";
import { DialogueManagerService } from "@services/dialogueManager";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const sttService = new SpeechToTextService();
const ttsService = new TextToSpeechService();
const dialogueService = new DialogueManagerService();

// Process audio input and return text + AI response
router.post(
  "/process-audio",
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
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

      // Convert audio to text
      const sttResult = await sttService.processAudio(req.file.buffer);

      // Process through dialogue manager
      const context = {
        userId,
        sessionId,
        conversationHistory: [], // In production, load from database
        currentEmotion: undefined,
      };

      const { response, updatedContext } =
        await dialogueService.processUserInput(sttResult.text, context);

      // Convert response to audio
      const audioBuffer = await ttsService.synthesizeSpeech(response);

      res.json({
        userText: sttResult.text,
        response,
        emotion: updatedContext.currentEmotion,
        audioResponse: audioBuffer.toString("base64"),
        sessionId: updatedContext.sessionId,
      });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).json({ error: "Failed to process audio" });
    }
  }
);

// Convert text to speech
router.post(
  "/text-to-speech",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, voice, speed, pitch } = req.body;

      if (!text) {
        res.status(400).json({ error: "Text is required" });
        return;
      }

      const audioBuffer = await ttsService.synthesizeSpeech(text, {
        voice,
        speed,
        pitch,
      });

      res.json({
        audio: audioBuffer.toString("base64"),
        format: "mp3",
      });
    } catch (error) {
      console.error("Error in text-to-speech:", error);
      res.status(500).json({ error: "Failed to convert text to speech" });
    }
  }
);

// Convert speech to text
router.post(
  "/speech-to-text",
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const sttResult = await sttService.processAudio(req.file.buffer);

      res.json(sttResult);
    } catch (error) {
      console.error("Error in speech-to-text:", error);
      res.status(500).json({ error: "Failed to convert speech to text" });
    }
  }
);

// Get available voices
router.get("/voices", async (req: Request, res: Response) => {
  try {
    const voices = await ttsService.getAvailableVoices();
    res.json({ voices });
  } catch (error) {
    console.error("Error fetching voices:", error);
    res.status(500).json({ error: "Failed to fetch available voices" });
  }
});

export default router;
