import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  monthlyPrice: number;
  features: Types.ObjectId[]; // Array of Feature ObjectIds
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true, unique: true },
    monthlyPrice: { type: Number, required: true, min: 0 },
    features: [{ type: Schema.Types.ObjectId, ref: 'Feature' }],
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'subscription_plans',
  }
);

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>(
  'SubscriptionPlan',
  SubscriptionPlanSchema
);
