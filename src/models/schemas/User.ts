import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  userId: string;
  email: string;
  name?: string;
  password?: string;
  passwordChangedAt?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordHistory: Array<{
    password: string;
    createdAt: Date;
  }>;
  otpId?: string;
  otpCode?: string;
  otpExpires?: Date;
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
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
  isSuspended: boolean;
  suspensionReason?: string;
  suspendedAt?: Date;
  adminNotes: Array<{
    note: string;
    adminId: string;
    adminEmail: string;
    createdAt: Date;
  }>;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String },
    password: { type: String },
    passwordChangedAt: { type: Date },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    passwordHistory: [
      {
        password: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    otpId: { type: String },
    otpCode: { type: String },
    otpExpires: { type: Date },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
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
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String },
    suspendedAt: { type: Date },
    adminNotes: [
      {
        note: { type: String, required: true },
        adminId: { type: String, required: true },
        adminEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Virtual for checking if user is locked
UserSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

export const User = mongoose.model<IUser>("User", UserSchema);