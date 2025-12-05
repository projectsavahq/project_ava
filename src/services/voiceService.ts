import { SpeechToTextService } from "./speechToText";
import { TextToSpeechService } from "./textToSpeech";
import { DialogueManagerService } from "./dialogueManager";

export interface AudioProcessingResponse {
  userText: string;
  response: string;
  emotion: any;
  audioResponse: string;
  sessionId: string;
}

export interface TextToSpeechResponse {
  audio: string;
  format: string;
}

export interface SpeechToTextResponse {
  text: string;
  confidence?: number;
}

export interface VoicesResponse {
  voices: any[];
}

export class VoiceService {
  private sttService: SpeechToTextService;
  private ttsService: TextToSpeechService;
  private dialogueService: DialogueManagerService;

  constructor() {
    this.sttService = new SpeechToTextService();
    this.ttsService = new TextToSpeechService();
    this.dialogueService = new DialogueManagerService();
  }

  /**
   * Process audio input and return text + AI response
   */
  async processAudio(
    audioBuffer: Buffer,
    userId: string,
    sessionId: string
  ): Promise<AudioProcessingResponse> {
    // Convert audio to text
    const sttResult = await this.sttService.processAudio(audioBuffer);

    // Process through dialogue manager
    const context = {
      userId,
      sessionId,
      conversationHistory: [], // In production, load from database
      currentEmotion: undefined,
    };

    const { response, updatedContext } = await this.dialogueService.processUserInput(
      sttResult.text,
      context
    );

    // Convert response to audio
    const audioResponseBuffer = await this.ttsService.synthesizeSpeech(response);

    return {
      userText: sttResult.text,
      response,
      emotion: updatedContext.currentEmotion,
      audioResponse: audioResponseBuffer.toString("base64"),
      sessionId: updatedContext.sessionId,
    };
  }

  /**
   * Convert text to speech
   */
  async convertTextToSpeech(
    text: string,
    options?: {
      voice?: string;
      speed?: number;
      pitch?: number;
    }
  ): Promise<TextToSpeechResponse> {
    const audioBuffer = await this.ttsService.synthesizeSpeech(text, options);

    return {
      audio: audioBuffer.toString("base64"),
      format: "mp3",
    };
  }

  /**
   * Convert speech to text
   */
  async convertSpeechToText(audioBuffer: Buffer): Promise<SpeechToTextResponse> {
    const sttResult = await this.sttService.processAudio(audioBuffer);
    return sttResult;
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<VoicesResponse> {
    const voices = await this.ttsService.getAvailableVoices();
    return { voices };
  }
}