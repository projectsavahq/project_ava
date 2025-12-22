import { SpeechToTextService } from "./speechToText";
import { TextToSpeechService } from "./textToSpeech";
import { DialogueManagerService } from "./dialogueManager";

export class VoiceService {
  private sttService: SpeechToTextService;
  private ttsService: TextToSpeechService;
  private dialogueService: DialogueManagerService;

  constructor() {
    this.sttService = new SpeechToTextService();
    this.ttsService = new TextToSpeechService();
    this.dialogueService = new DialogueManagerService();
  }

  async processAudio(audioBuffer: Buffer, userId: string, sessionId: string) {
    const sttResult = await this.sttService.processAudio(audioBuffer);
    const context = {
      userId,
      sessionId,
      conversationHistory: [],
      currentEmotion: undefined,
    } as any;

    const { response, updatedContext } = await this.dialogueService.processUserInput(
      sttResult.text,
      context
    );

    const audioResponseBuffer = await this.ttsService.synthesizeSpeech(response);

    return {
      userText: sttResult.text,
      response,
      emotion: updatedContext.currentEmotion,
      audioResponse: audioResponseBuffer.toString("base64"),
      sessionId: updatedContext.sessionId,
    };
  }

  async convertTextToSpeech(text: string, options?: any) {
    const audioBuffer = await this.ttsService.synthesizeSpeech(text, options);
    return {
      audio: audioBuffer.toString("base64"),
      format: "mp3",
    };
  }

  async convertSpeechToText(audioBuffer: Buffer) {
    const sttResult = await this.sttService.processAudio(audioBuffer);
    return sttResult;
  }

  async getAvailableVoices() {
    const voices = await this.ttsService.getAvailableVoices();
    return { voices };
  }
}

export const voiceService = new VoiceService();