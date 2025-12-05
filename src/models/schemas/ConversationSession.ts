import mongoose, { Schema, Document } from "mongoose";

export interface IConversationSession extends Document {
  sessionId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  status: "active" | "ended" | "crisis_escalated";
  summary?: string;
  totalMessages: number;
  averageEmotion?: string;
  duration?: number;
  metadata?: any;
}

const ConversationSessionSchema = new Schema<IConversationSession>(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    endedAt: { type: Date },
    status: {
      type: String,
      enum: ["active", "ended", "crisis_escalated"],
      default: "active",
    },
    summary: { type: String },
    totalMessages: { type: Number, default: 0 },
    averageEmotion: { type: String },
    duration: { type: Number },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "conversation_sessions",
  }
);

export const ConversationSession = mongoose.model<IConversationSession>(
  "ConversationSession",
  ConversationSessionSchema
);