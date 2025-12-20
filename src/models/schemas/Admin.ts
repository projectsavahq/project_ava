import mongoose, { Schema, Document } from "mongoose";

export interface IAdmin extends Document {
  adminId: string;
  email: string;
  name: string;
  password: string;
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
  lastLogin?: Date;
  loginAttempts: number;
  lockUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isLocked?: boolean;
}

const AdminSchema = new Schema<IAdmin>(
  {
    adminId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
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
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "admins",
  }
);

// Virtual for checking if admin is locked
AdminSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);