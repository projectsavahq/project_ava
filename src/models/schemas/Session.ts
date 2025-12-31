import mongoose, { Schema, Document } from "mongoose";

export interface ISession extends Document {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: "active" | "ended" | "error";
  userPreferences?: any;
  metadata?: any;
  duration?: number; // in milliseconds
}

const SessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    startTime: { type: Date, default: Date.now, index: true },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ["active", "ended", "error"],
      default: "active",
    },
    userPreferences: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    duration: { type: Number },
  },
  {
    collection: "sessions",
  }
);

// Index for efficient queries
SessionSchema.index({ userId: 1, startTime: -1 });
SessionSchema.index({ status: 1, startTime: -1 });

export const Session = mongoose.model<ISession>("Session", SessionSchema);