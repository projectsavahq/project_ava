import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISession extends Document {
  userId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  status: "active" | "ended" | "error";
  userPreferences?: any;
  metadata?: any;
  duration?: number; // in milliseconds
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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