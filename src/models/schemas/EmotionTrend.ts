import mongoose, { Schema, Document } from "mongoose";

export interface IEmotionTrend extends Document {
  userId: string;
  date: Date;
  primaryEmotions: string[];
  emotionScores: { [key: string]: number };
  sessionCount: number;
  crisisIndicatorsCount: number;
  wellnessScore?: number;
  metadata?: any;
}

const EmotionTrendSchema = new Schema<IEmotionTrend>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    primaryEmotions: [{ type: String }],
    emotionScores: { type: Map, of: Number },
    sessionCount: { type: Number, default: 0 },
    crisisIndicatorsCount: { type: Number, default: 0 },
    wellnessScore: { type: Number, min: 0, max: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "emotion_trends",
  }
);

// Create compound index for efficient querying
EmotionTrendSchema.index({ userId: 1, date: -1 });

export const EmotionTrend = mongoose.model<IEmotionTrend>(
  "EmotionTrend",
  EmotionTrendSchema
);