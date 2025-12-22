import { TextToSpeechOptions } from "../types";

export class TextToSpeechService {
  private apiKey: string;

  constructor() {
    this.apiKey =
      process.env.GOOGLE_CLOUD_API_KEY || process.env.ELEVENLABS_API_KEY || "";
  }

  async synthesizeSpeech(
    text: string,
    options: TextToSpeechOptions = {}
  ): Promise<Buffer> {
    try {
      // EXPLANATION: In Voice Live architecture, TTS is handled by Azure
      // We don't need separate text-to-speech processing.
      // 
      // Azure Voice Live handles this:
      // 1. Takes user's speech-to-text input
      // 2. Sends to LLM (GPT-4o) for response
      // 3. Automatically synthesizes response as audio
      // 4. Streams audio back in real-time
      
      // This function is kept for backward compatibility but not used
      // in the Voice Live flow
      
      console.log('[TextToSpeechService] Note: Azure Voice Live handles TTS internally');
      
      // Return placeholder
      return Buffer.from("Use Azure Voice Live audio responses instead");
    } catch (error) {
      console.error("Error in text-to-speech synthesis:", error);
      throw new Error("Failed to synthesize speech");
    }
  }

  async getAvailableVoices(): Promise<any[]> {
    // EXPLANATION: Return available Azure voices for session configuration
    // These are the voices available in Azure Voice Live API
    // User can select preferred voice at session start
    
    return [
      {
        id: 'en-US-Ava:DragonHDLatestNeural',
        name: 'AVA (Recommended)',
        language: 'en-US',
        gender: 'female',
        description: 'Professional, empathetic voice - best for therapy',
      },
      {
        id: 'en-US-AriaNeural',
        name: 'Aria',
        language: 'en-US',
        gender: 'female',
        description: 'Clear and friendly',
      },
      {
        id: 'en-US-GuyNeural',
        name: 'Guy',
        language: 'en-US',
        gender: 'male',
        description: 'Calm and supportive',
      },
      {
        id: 'en-US-AmberNeural',
        name: 'Amber',
        language: 'en-US',
        gender: 'female',
        description: 'Warm and engaging',
      },
      {
        id: 'en-US-AshleyNeural',
        name: 'Ashley',
        language: 'en-US',
        gender: 'female',
        description: 'Cheerful and encouraging',
      },
    ];
  }
}
