import { Feature, IFeature } from '../models/schemas/Feature';
import { SubscriptionPlan, ISubscriptionPlan } from '../models/schemas/SubscriptionPlan';
import { logInfo, logError, logWarn } from '../utils/logger';
import { Types } from 'mongoose';

export interface CreateFeatureData {
  name: string;
  description?: string;
}

export interface UpdateFeatureData {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateSubscriptionPlanData {
  name: string;
  monthlyPrice: number;
  features?: string[];
}

export interface UpdateSubscriptionPlanData {
  name?: string;
  monthlyPrice?: number;
  features?: string[];
  isActive?: boolean;
}

export class SubscriptionService {
  /**
   * Create a new feature
   */
  async createFeature(data: CreateFeatureData): Promise<IFeature> {
    logInfo(`SUBSCRIPTION: Creating feature: ${data.name}`);

    // Check if feature with same name exists
    const existingFeature = await Feature.findOne({ name: data.name });
    if (existingFeature) {
      logWarn(`SUBSCRIPTION: Feature already exists: ${data.name}`);
      throw new Error('Feature with this name already exists');
    }

    const feature = new Feature({
      name: data.name,
      description: data.description,
      isActive: true,
    });

    await feature.save();
    logInfo(`SUBSCRIPTION: Feature created successfully: ${data.name}`);

    return feature;
  }

  /**
   * Get all features
   */
  async getAllFeatures(includeInactive: boolean = false): Promise<IFeature[]> {
    logInfo(`SUBSCRIPTION: Fetching all features`);

    const filter = includeInactive ? {} : { isActive: true };
    const features = await Feature.find(filter).sort({ createdAt: -1 });

    logInfo(`SUBSCRIPTION: Found ${features.length} features`);
    return features;
  }

  /**
   * Get feature by ID
   */
  async getFeatureById(featureId: string): Promise<IFeature> {
    logInfo(`SUBSCRIPTION: Fetching feature: ${featureId}`);

    const feature = await Feature.findById(featureId);
    if (!feature) {
      logWarn(`SUBSCRIPTION: Feature not found: ${featureId}`);
      throw new Error('Feature not found');
    }

    return feature;
  }

  /**
   * Update feature
   */
  async updateFeature(featureId: string, data: UpdateFeatureData): Promise<IFeature> {
    logInfo(`SUBSCRIPTION: Updating feature: ${featureId}`);

    const feature = await Feature.findById(featureId);
    if (!feature) {
      logWarn(`SUBSCRIPTION: Feature not found: ${featureId}`);
      throw new Error('Feature not found');
    }

    // Check if name is being changed and if it conflicts with existing feature
    if (data.name && data.name !== feature.name) {
      const existingFeature = await Feature.findOne({ name: data.name });
      if (existingFeature) {
        logWarn(`SUBSCRIPTION: Feature name already exists: ${data.name}`);
        throw new Error('Feature with this name already exists');
      }
      feature.name = data.name;
    }

    if (data.description !== undefined) {
      feature.description = data.description;
    }

    if (data.isActive !== undefined) {
      feature.isActive = data.isActive;
    }

    await feature.save();
    logInfo(`SUBSCRIPTION: Feature updated successfully: ${featureId}`);

    return feature;
  }

  /**
   * Delete feature
   */
  async deleteFeature(featureId: string): Promise<void> {
    logInfo(`SUBSCRIPTION: Deleting feature: ${featureId}`);

    const feature = await Feature.findById(featureId);
    if (!feature) {
      logWarn(`SUBSCRIPTION: Feature not found: ${featureId}`);
      throw new Error('Feature not found');
    }

    // Check if feature is used in any subscription plans
    const plansUsingFeature = await SubscriptionPlan.countDocuments({
      features: new Types.ObjectId(featureId),
    });

    if (plansUsingFeature > 0) {
      logWarn(
        `SUBSCRIPTION: Cannot delete feature - used in ${plansUsingFeature} plan(s): ${featureId}`
      );
      throw new Error(
        `Cannot delete feature. It is currently used in ${plansUsingFeature} subscription plan(s). Please remove it from all plans first.`
      );
    }

    await Feature.findByIdAndDelete(featureId);
    logInfo(`SUBSCRIPTION: Feature deleted successfully: ${featureId}`);
  }

  /**
   * Create subscription plan
   */
  async createSubscriptionPlan(data: CreateSubscriptionPlanData): Promise<ISubscriptionPlan> {
    logInfo(`SUBSCRIPTION: Creating subscription plan: ${data.name}`);

    // Check if plan with same name exists
    const existingPlan = await SubscriptionPlan.findOne({ name: data.name });
    if (existingPlan) {
      logWarn(`SUBSCRIPTION: Subscription plan already exists: ${data.name}`);
      throw new Error('Subscription plan with this name already exists');
    }

    // Validate features exist
    if (data.features && data.features.length > 0) {
      const featureObjectIds = data.features.map(id => new Types.ObjectId(id));
      const features = await Feature.find({
        _id: { $in: featureObjectIds },
        isActive: true,
      });

      if (features.length !== data.features.length) {
        const foundIds = features.map((f) => f._id.toString());
        const notFoundIds = data.features.filter((id) => !foundIds.includes(id));
        logWarn(`SUBSCRIPTION: Invalid features: ${notFoundIds.join(', ')}`);
        throw new Error(`Invalid or inactive features: ${notFoundIds.join(', ')}`);
      }
    }

    const plan = new SubscriptionPlan({
      name: data.name,
      monthlyPrice: data.monthlyPrice,
      features: data.features ? data.features.map(id => new Types.ObjectId(id)) : [],
      isActive: true,
    });

    await plan.save();
    logInfo(`SUBSCRIPTION: Subscription plan created successfully: ${data.name}`);

    return plan;
  }

  /**
   * Get all subscription plans with features
   */
  async getAllSubscriptionPlans(includeInactive: boolean = false): Promise<any[]> {
    logInfo(`SUBSCRIPTION: Fetching all subscription plans`);

    const filter = includeInactive ? {} : { isActive: true };
    const plans = await SubscriptionPlan.find(filter)
      .populate('features')
      .sort({ monthlyPrice: 1 });

    // Map to clean response format
    const plansWithFeatures = plans.map((plan) => ({
      id: plan._id.toString(),
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      features: (plan.features as any[]).map((f: any) => ({
        id: f._id?.toString(),
        name: f.name,
        description: f.description,
        isActive: f.isActive,
      })),
    }));

    logInfo(`SUBSCRIPTION: Found ${plansWithFeatures.length} subscription plans`);
    return plansWithFeatures;
  }

  /**
   * Get subscription plan by ID with features
   */
  async getSubscriptionPlanById(planId: string): Promise<any> {
    logInfo(`SUBSCRIPTION: Fetching subscription plan: ${planId}`);

    const plan = await SubscriptionPlan.findById(planId).populate('features');
    if (!plan) {
      logWarn(`SUBSCRIPTION: Subscription plan not found: ${planId}`);
      throw new Error('Subscription plan not found');
    }

    return {
      id: plan._id.toString(),
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      features: (plan.features as any[]).map((f: any) => ({
        id: f._id?.toString(),
        name: f.name,
        description: f.description,
        isActive: f.isActive,
      })),
    };
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(
    planId: string,
    data: UpdateSubscriptionPlanData
  ): Promise<ISubscriptionPlan> {
    logInfo(`SUBSCRIPTION: Updating subscription plan: ${planId}`);

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      logWarn(`SUBSCRIPTION: Subscription plan not found: ${planId}`);
      throw new Error('Subscription plan not found');
    }

    // Check if name is being changed and if it conflicts
    if (data.name && data.name !== plan.name) {
      const existingPlan = await SubscriptionPlan.findOne({ name: data.name });
      if (existingPlan) {
        logWarn(`SUBSCRIPTION: Plan name already exists: ${data.name}`);
        throw new Error('Subscription plan with this name already exists');
      }
      plan.name = data.name;
    }

    if (data.monthlyPrice !== undefined) {
      if (data.monthlyPrice < 0) {
        throw new Error('Monthly price cannot be negative');
      }
      plan.monthlyPrice = data.monthlyPrice;
    }

    if (data.features !== undefined) {
      // Validate all features exist and are active
      if (data.features.length > 0) {
        const featureObjectIds = data.features.map(id => new Types.ObjectId(id));
        const features = await Feature.find({
          _id: { $in: featureObjectIds },
          isActive: true,
        });

        if (features.length !== data.features.length) {
          const foundIds = features.map((f) => f._id.toString());
          const notFoundIds = data.features.filter((id) => !foundIds.includes(id));
          logWarn(`SUBSCRIPTION: Invalid features: ${notFoundIds.join(', ')}`);
          throw new Error(`Invalid or inactive features: ${notFoundIds.join(', ')}`);
        }
      }
      plan.features = data.features.map(id => new Types.ObjectId(id));
    }

    if (data.isActive !== undefined) {
      plan.isActive = data.isActive;
    }

    await plan.save();
    logInfo(`SUBSCRIPTION: Subscription plan updated successfully: ${planId}`);

    return plan;
  }

  /**
   * Add features to subscription plan
   */
  async addFeaturesToPlan(planId: string, featureIds: string[]): Promise<ISubscriptionPlan> {
    logInfo(`SUBSCRIPTION: Adding features to plan: ${planId}`);

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      logWarn(`SUBSCRIPTION: Subscription plan not found: ${planId}`);
      throw new Error('Subscription plan not found');
    }

    // Validate all features exist and are active
    const featureObjectIds = featureIds.map(id => new Types.ObjectId(id));
    const features = await Feature.find({
      _id: { $in: featureObjectIds },
      isActive: true,
    });

    if (features.length !== featureIds.length) {
      const foundIds = features.map((f) => f._id.toString());
      const notFoundIds = featureIds.filter((id) => !foundIds.includes(id));
      logWarn(`SUBSCRIPTION: Invalid features: ${notFoundIds.join(', ')}`);
      throw new Error(`Invalid or inactive features: ${notFoundIds.join(', ')}`);
    }

    // Add only new features (avoid duplicates)
    const existingFeatureIds = plan.features.map(f => f.toString());
    const newFeatureObjectIds = featureIds
      .filter((id) => !existingFeatureIds.includes(id))
      .map(id => new Types.ObjectId(id));
    plan.features.push(...newFeatureObjectIds);

    await plan.save();
    logInfo(
      `SUBSCRIPTION: Added ${newFeatureObjectIds.length} features to plan: ${planId}`
    );

    return plan;
  }

  /**
   * Remove features from subscription plan
   */
  async removeFeaturesFromPlan(
    planId: string,
    featureIds: string[]
  ): Promise<ISubscriptionPlan> {
    logInfo(`SUBSCRIPTION: Removing features from plan: ${planId}`);

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      logWarn(`SUBSCRIPTION: Subscription plan not found: ${planId}`);
      throw new Error('Subscription plan not found');
    }

    // Remove features
    plan.features = plan.features.filter((id) => !featureIds.includes(id.toString()));

    await plan.save();
    logInfo(`SUBSCRIPTION: Removed features from plan: ${planId}`);

    return plan;
  }

  /**
   * Delete subscription plan
   */
  async deleteSubscriptionPlan(planId: string): Promise<void> {
    logInfo(`SUBSCRIPTION: Deleting subscription plan: ${planId}`);

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      logWarn(`SUBSCRIPTION: Subscription plan not found: ${planId}`);
      throw new Error('Subscription plan not found');
    }

    // TODO: Check if plan is used by any active subscriptions
    // For now, we'll allow deletion

    await SubscriptionPlan.findByIdAndDelete(planId);
    logInfo(`SUBSCRIPTION: Subscription plan deleted successfully: ${planId}`);
  }
}

export const subscriptionService = new SubscriptionService();
