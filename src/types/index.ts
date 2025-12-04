import { Request, Response } from "express";

export interface EmotionResult {
  primary: string;
  confidence: number;
  emotions: {
    [key: string]: number;
  };
}

export interface SpeechToTextResult {
  text: string;
  confidence: number;
  language?: string;
}

export interface TextToSpeechOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  language?: string;
}

export interface ConversationContext {
  userId: string;
  sessionId: string;
  currentEmotion?: EmotionResult;
  conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    emotion?: EmotionResult;
  }>;
  userProfile?: {
    preferences: any;
    crisisHistory: boolean;
    supportLevel: "basic" | "intermediate" | "intensive";
  };
}

export interface CrisisDetectionResult {
  isCrisis: boolean;
  severity: "low" | "medium" | "high" | "critical";
  keywords: string[];
  confidence: number;
  recommendedAction: string;
}
