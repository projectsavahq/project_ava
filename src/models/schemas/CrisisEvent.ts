import mongoose, { Schema, Document } from "mongoose";

export interface ICrisisEvent extends Document {
  userId: string;
  sessionId: string;
  messageId?: string;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: Date;
  resolvedAt?: Date;
  status: "active" | "resolved" | "escalated";
  keywords: string[];
  confidence: number;
  responseActions: string[];
  escalationLog?: Array<{
    timestamp: Date;
    action: string;
    details: string;
    automated: boolean;
    success: boolean;
  }>;
  metadata?: any;
}

const CrisisEventSchema = new Schema<ICrisisEvent>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    messageId: { type: String },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      index: true,
    },
    detectedAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    status: {
      type: String,
      enum: ["active", "resolved", "escalated"],
      default: "active",
      index: true,
    },
    keywords: [{ type: String }],
    confidence: { type: Number, min: 0, max: 1, required: true },
    responseActions: [{ type: String }],
    escalationLog: [
      {
        timestamp: { type: Date, default: Date.now },
        action: { type: String, required: true },
        details: { type: String },
        automated: { type: Boolean, default: true },
        success: { type: Boolean, default: false },
      },
    ],
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "crisis_events",
  }
);

export const CrisisEvent = mongoose.model<ICrisisEvent>(
  "CrisisEvent",
  CrisisEventSchema
);