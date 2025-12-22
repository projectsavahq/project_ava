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
  // EXPLANATION: WebSocket connection tracking
  // webSocketConnectionId: Tracks the active Socket.IO client connection ID
  // This lets us identify which client to send real-time updates to
  webSocketConnectionId?: string;
  // lastActivity: Tracks when user last interacted
  // Used to detect idle sessions and auto-close inactive conversations
  lastActivity?: Date;
  // audioMetadata: Stores audio configuration for this session
  // sampleRate (24000Hz), channels (mono), helps with audio processing consistency
  audioMetadata?: {
    sampleRate: number;
    channels: number;
    duration?: number;
  };
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
    // NEW: WebSocket connection tracking for real-time updates
    webSocketConnectionId: { type: String },
    // NEW: Last interaction timestamp for session timeout detection
    lastActivity: { type: Date, default: Date.now },
    // NEW: Audio configuration for this session
    audioMetadata: {
      sampleRate: { type: Number, default: 24000 },
      channels: { type: Number, default: 1 },
      duration: { type: Number },
    },
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