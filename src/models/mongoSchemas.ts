import mongoose, { Schema, Document, Types } from "mongoose";

// User Schema
export interface IUser extends Document {
  userId: string; // Use custom string ID
  email?: string;
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    voicePreference?: string;
    language?: string;
    crisisKeywords?: string[];
    emergencyContacts?: Array<{
      name: string;
      phone: string;
      relationship: string;
      consentGiven: boolean;
    }>;
    notificationSettings?: {
      crisisAlerts: boolean;
      dailyCheckins: boolean;
      wellnessReminders: boolean;
    };
  };
  crisisHistory: boolean;
  supportLevel: "basic" | "intermediate" | "intensive";
  isActive: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, unique: true, sparse: true },
    preferences: {
      voicePreference: { type: String, default: "AVA-Default" },
      language: { type: String, default: "en-US" },
      crisisKeywords: [{ type: String }],
      emergencyContacts: [
        {
          name: { type: String, required: true },
          phone: { type: String, required: true },
          relationship: { type: String, required: true },
          consentGiven: { type: Boolean, default: false },
        },
      ],
      notificationSettings: {
        crisisAlerts: { type: Boolean, default: true },
        dailyCheckins: { type: Boolean, default: false },
        wellnessReminders: { type: Boolean, default: true },
      },
    },
    crisisHistory: { type: Boolean, default: false },
    supportLevel: {
      type: String,
      enum: ["basic", "intermediate", "intensive"],
      default: "basic",
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Conversation Session Schema
export interface IConversationSession extends Document {
  _id: Types.ObjectId;
  userId: string;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  status: "active" | "ended" | "crisis_escalated";
  summary?: string;
  totalMessages: number;
  averageEmotion?: string;
  duration?: number; // in seconds
  metadata: {
    platform?: string;
    deviceType?: string;
    location?: string;
  };
}

const ConversationSessionSchema = new Schema<IConversationSession>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true },
    endedAt: { type: Date },
    status: {
      type: String,
      enum: ["active", "ended", "crisis_escalated"],
      default: "active",
      index: true,
    },
    summary: { type: String },
    totalMessages: { type: Number, default: 0 },
    averageEmotion: { type: String },
    duration: { type: Number },
    metadata: {
      platform: { type: String },
      deviceType: { type: String },
      location: { type: String },
    },
  },
  {
    timestamps: true,
    collection: "conversation_sessions",
  }
);

// Message Schema
export interface IMessage extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  emotionData?: {
    primaryEmotion: string;
    confidence: number;
    emotions: { [key: string]: number };
    analysisVersion: string;
  };
  crisisIndicators?: {
    severity: "low" | "medium" | "high" | "critical";
    keywords: string[];
    confidence: number;
    actionTaken: string;
    escalated: boolean;
    escalationTime?: Date;
  };
  audioMetadata?: {
    duration?: number;
    format?: string;
    fileUrl?: string;
    transcriptionConfidence?: number;
  };
  processingMetadata?: {
    sttModel?: string;
    ttsModel?: string;
    emotionModel?: string;
    responseTime?: number;
  };
}

const MessageSchema = new Schema<IMessage>(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    emotionData: {
      primaryEmotion: { type: String },
      confidence: { type: Number },
      emotions: { type: Map, of: Number },
      analysisVersion: { type: String },
    },
    crisisIndicators: {
      severity: { type: String, enum: ["low", "medium", "high", "critical"] },
      keywords: [{ type: String }],
      confidence: { type: Number },
      actionTaken: { type: String },
      escalated: { type: Boolean, default: false },
      escalationTime: { type: Date },
    },
    audioMetadata: {
      duration: { type: Number },
      format: { type: String },
      fileUrl: { type: String },
      transcriptionConfidence: { type: Number },
    },
    processingMetadata: {
      sttModel: { type: String },
      ttsModel: { type: String },
      emotionModel: { type: String },
      responseTime: { type: Number },
    },
  },
  {
    collection: "messages",
  }
);

// Crisis Event Schema
export interface ICrisisEvent extends Document {
  _id: Types.ObjectId;
  userId: string;
  sessionId: string;
  messageId: string;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: Date;
  resolvedAt?: Date;
  status: "active" | "resolved" | "escalated";
  keywords: string[];
  confidence: number;
  responseActions: string[];
  escalationLog: Array<{
    timestamp: Date;
    action: string;
    details: string;
    automated: boolean;
    success: boolean;
  }>;
  followUpRequired: boolean;
  assignedCounselor?: string;
}

const CrisisEventSchema = new Schema<ICrisisEvent>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true },
    messageId: { type: String, required: true },
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
    confidence: { type: Number, required: true },
    responseActions: [{ type: String }],
    escalationLog: [
      {
        timestamp: { type: Date, default: Date.now },
        action: { type: String, required: true },
        details: { type: String },
        automated: { type: Boolean, default: true },
        success: { type: Boolean, default: true },
      },
    ],
    followUpRequired: { type: Boolean, default: false },
    assignedCounselor: { type: String },
  },
  {
    collection: "crisis_events",
  }
);

// Emotion Trend Schema (for analytics)
export interface IEmotionTrend extends Document {
  _id: Types.ObjectId;
  userId: string;
  date: Date;
  primaryEmotions: string[];
  emotionScores: { [key: string]: number };
  sessionCount: number;
  crisisIndicatorsCount: number;
  averageResponseTime: number;
  wellnessScore: number; // calculated metric
}

const EmotionTrendSchema = new Schema<IEmotionTrend>(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    primaryEmotions: [{ type: String }],
    emotionScores: { type: Map, of: Number },
    sessionCount: { type: Number, default: 0 },
    crisisIndicatorsCount: { type: Number, default: 0 },
    averageResponseTime: { type: Number },
    wellnessScore: { type: Number }, // 0-100 scale
  },
  {
    collection: "emotion_trends",
  }
);

// Create compound indexes for better performance
UserSchema.index({ email: 1, isActive: 1 });
ConversationSessionSchema.index({ userId: 1, createdAt: -1 });
ConversationSessionSchema.index({ status: 1, updatedAt: -1 });
MessageSchema.index({ sessionId: 1, timestamp: 1 });
MessageSchema.index({ userId: 1, timestamp: -1 });
MessageSchema.index({ "crisisIndicators.severity": 1, timestamp: -1 });
CrisisEventSchema.index({ userId: 1, detectedAt: -1 });
CrisisEventSchema.index({ severity: 1, status: 1, detectedAt: -1 });
EmotionTrendSchema.index({ userId: 1, date: -1 });

// Export models
export const User = mongoose.model<IUser>("User", UserSchema);
export const ConversationSession = mongoose.model<IConversationSession>(
  "ConversationSession",
  ConversationSessionSchema
);
export const Message = mongoose.model<IMessage>("Message", MessageSchema);
export const CrisisEvent = mongoose.model<ICrisisEvent>(
  "CrisisEvent",
  CrisisEventSchema
);
export const EmotionTrend = mongoose.model<IEmotionTrend>(
  "EmotionTrend",
  EmotionTrendSchema
);
