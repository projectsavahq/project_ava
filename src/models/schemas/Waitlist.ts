import mongoose, { Document, Schema } from 'mongoose';

export interface WaitlistDocument extends Document {
  email: string;
  createdAt: Date;
}

const WaitlistSchema = new Schema<WaitlistDocument>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Invalid email format']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<WaitlistDocument>('Waitlist', WaitlistSchema);
