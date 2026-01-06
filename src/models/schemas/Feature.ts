import mongoose, { Schema, Document } from 'mongoose';

export interface IFeature extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureSchema = new Schema<IFeature>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'features',
  }
);

export const Feature = mongoose.model<IFeature>('Feature', FeatureSchema);
