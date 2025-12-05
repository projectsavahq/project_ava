import { Router } from "express";
import multer from "multer";
import { VoiceController } from "../controllers";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const voiceController = new VoiceController();

// Process audio input and return text + AI response
router.post(
  "/process-audio",
  upload.single("audio"),
  voiceController.processAudio
);

// Convert text to speech
router.post("/text-to-speech", voiceController.textToSpeech);

// Convert speech to text
router.post(
  "/speech-to-text",
  upload.single("audio"),
  voiceController.speechToText
);

// Get available voices
router.get("/voices", voiceController.getVoices);

export default router;
