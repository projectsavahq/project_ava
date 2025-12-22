import { EmotionResult } from "../types";

export class EmotionDetectionService {
  private sentimentAnalyzer: any;

  constructor() {
    // Initialize sentiment analysis tools
  }

  async analyzeEmotion(
    text: string,
    audioFeatures?: any
  ): Promise<EmotionResult> {
    try {
      // For MVP, we'll use a simple rule-based approach
      // In production, integrate with Hugging Face transformers or custom models

      const emotions = this.analyzeTextEmotions(text);
      const primary = this.getPrimaryEmotion(emotions);

      return {
        primary,
        confidence: emotions[primary] || 0,
        emotions,
      };
    } catch (error) {
      console.error("Error in emotion analysis:", error);
      throw new Error("Failed to analyze emotions");
    }
  }

  private analyzeTextEmotions(text: string): { [key: string]: number } {
    const emotions = {
      sad: 0,
      anxious: 0,
      angry: 0,
      happy: 0,
      calm: 0,
      stressed: 0,
      hopeful: 0,
      frustrated: 0,
    };

    const sadKeywords = [
      "sad",
      "depressed",
      "down",
      "unhappy",
      "miserable",
      "heartbroken",
    ];
    const anxiousKeywords = [
      "anxious",
      "worried",
      "nervous",
      "panic",
      "fear",
      "scared",
    ];
    const angryKeywords = [
      "angry",
      "mad",
      "furious",
      "rage",
      "hate",
      "annoyed",
    ];
    const happyKeywords = [
      "happy",
      "joy",
      "excited",
      "pleased",
      "content",
      "good",
    ];
    const calmKeywords = ["calm", "peaceful", "relaxed", "serene", "tranquil"];
    const stressedKeywords = [
      "stressed",
      "overwhelmed",
      "pressure",
      "burden",
      "exhausted",
    ];
    const hopefulKeywords = [
      "hope",
      "optimistic",
      "positive",
      "better",
      "improve",
    ];
    const frustratedKeywords = [
      "frustrated",
      "stuck",
      "blocked",
      "difficult",
      "struggle",
    ];

    const textLower = text.toLowerCase();

    // Simple keyword matching with weights
    sadKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.sad += 0.3;
    });

    anxiousKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.anxious += 0.3;
    });

    angryKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.angry += 0.3;
    });

    happyKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.happy += 0.3;
    });

    calmKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.calm += 0.3;
    });

    stressedKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.stressed += 0.3;
    });

    hopefulKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.hopeful += 0.3;
    });

    frustratedKeywords.forEach((keyword) => {
      if (textLower.includes(keyword)) emotions.frustrated += 0.3;
    });

    return emotions;
  }

  private getPrimaryEmotion(emotions: { [key: string]: number }): string {
    let maxEmotion = "calm";
    let maxScore = 0;

    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion;
      }
    }

    return maxEmotion;
  }

  async analyzeVoiceEmotion(audioFeatures: any): Promise<EmotionResult> {
    // EXPLANATION: Implement voice-based emotion detection using audio features
    // This analyzes: pitch, tone, speaking rate, voice quality
    // Based on Python script's audio analysis approach
    
    try {
      // Extract audio features if provided
      if (!audioFeatures) {
        return {
          primary: 'neutral',
          confidence: 0.5,
          emotions: {
            neutral: 0.5,
            calm: 0.3,
            engaged: 0.2,
          },
        };
      }

      // EXPLANATION: Analyze acoustic features
      // These indicate emotional state through voice characteristics
      const {
        pitch = 0,
        intensity = 0,
        speakingRate = 0,
        jitter = 0,
        shimmer = 0,
      } = audioFeatures;

      // Initialize emotion scores
      const emotionScores: { [key: string]: number } = {
        happy: 0,
        sad: 0,
        anxious: 0,
        angry: 0,
        calm: 0,
        neutral: 0,
      };

      // EXPLANATION: Use acoustic patterns to infer emotion
      // High pitch + fast rate = anxious/excited
      // Low pitch + slow rate = sad/depressed
      // High intensity + fast rate = angry
      // Low intensity + slow rate = calm
      
      if (pitch > 150 && speakingRate > 1.2) {
        emotionScores.anxious += 0.4;
        emotionScores.happy += 0.3;
      } else if (pitch < 100 && speakingRate < 0.8) {
        emotionScores.sad += 0.4;
        emotionScores.calm += 0.2;
      } else if (intensity > 0.7 && speakingRate > 1.3) {
        emotionScores.angry += 0.4;
        emotionScores.anxious += 0.2;
      } else if (intensity < 0.4 && speakingRate < 0.9) {
        emotionScores.calm += 0.5;
        emotionScores.sad += 0.2;
      } else {
        emotionScores.neutral = 0.6;
        emotionScores.calm = 0.4;
      }

      // Add voice quality indicators (jitter, shimmer)
      // High jitter/shimmer often indicates stress or instability
      if (jitter > 0.05 || shimmer > 0.05) {
        emotionScores.anxious += 0.2;
        emotionScores.angry += 0.1;
        emotionScores.calm -= 0.2;
      }

      // Normalize scores to sum to 1
      const total = Object.values(emotionScores).reduce((a, b) => a + b, 0);
      for (const emotion in emotionScores) {
        emotionScores[emotion] = emotionScores[emotion] / Math.max(total, 0.1);
      }

      // Find primary emotion with highest score
      let primaryEmotion = 'neutral';
      let maxScore = 0;
      for (const [emotion, score] of Object.entries(emotionScores)) {
        if (score > maxScore) {
          maxScore = score;
          primaryEmotion = emotion;
        }
      }

      return {
        primary: primaryEmotion,
        confidence: Math.min(maxScore, 0.99),
        emotions: emotionScores,
      };
    } catch (error) {
      console.error('Error analyzing voice emotion:', error);
      return {
        primary: 'neutral',
        confidence: 0.5,
        emotions: { neutral: 1 },
      };
    }
  }
}
