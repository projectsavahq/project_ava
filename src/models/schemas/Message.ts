import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  emotionData?: {
    primaryEmotion: string;
    confidence: number;
    emotions: { [key: string]: number };
    analysisVersion?: string;
  };
  crisisIndicators?: {
    severity: "low" | "medium" | "high" | "critical";
    keywords: string[];
    confidence: number;
    actionTaken?: string;
    escalated: boolean;
    escalationTime?: Date;
  };
  audioUrl?: string;
  metadata?: any;
}

const MessageSchema = new Schema<IMessage>(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    emotionData: {
      primaryEmotion: { type: String },
      confidence: { type: Number, min: 0, max: 1 },
      emotions: { type: Map, of: Number },
      analysisVersion: { type: String },
    },
    crisisIndicators: {
      severity: {
        type: String,
        enum: ["low", "medium", "high", "critical"],
      },
      keywords: [{ type: String }],
      confidence: { type: Number, min: 0, max: 1 },
      actionTaken: { type: String },
      escalated: { type: Boolean, default: false },
      escalationTime: { type: Date },
    },
    audioUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "messages",
  }
);

export const Message = mongoose.model<IMessage>("Message", MessageSchema);