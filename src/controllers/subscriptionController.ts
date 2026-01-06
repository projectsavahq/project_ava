import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscriptionService';

export class SubscriptionController {
  /**
   * POST /api/admin/features
   * Create a new feature
   */
  async createFeature(req: Request, res: Response): Promise<void> {
    try {
      const { name, description } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Feature name is required',
        });
        return;
      }

      const feature = await subscriptionService.createFeature({
        name,
        description,
      });

      res.status(201).json({
        success: true,
        message: 'Feature created successfully',
        data: {
          id: feature._id.toString(),
          name: feature.name,
          description: feature.description,
          isActive: feature.isActive,
          createdAt: feature.createdAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create feature';

      if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message,
        });
      } else {
        res.status(400).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * GET /api/admin/features
   * Get all features
   */
  async getAllFeatures(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const features = await subscriptionService.getAllFeatures(includeInactive);

      res.json({
        success: true,
        message: 'Features retrieved successfully',
        data: features.map((f) => ({
          id: f._id.toString(),
          name: f.name,
          description: f.description,
          isActive: f.isActive,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch features',
      });
    }
  }

  /**
   * GET /api/admin/features/:id
   * Get feature by ID
   */
  async getFeatureById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Feature ID is required',
        });
        return;
      }

      const feature = await subscriptionService.getFeatureById(id);

      res.json({
        success: true,
        message: 'Feature retrieved successfully',
        data: {
          id: feature._id.toString(),
          name: feature.name,
          description: feature.description,
          isActive: feature.isActive,
          createdAt: feature.createdAt,
          updatedAt: feature.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch feature';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else {
        res.status(500).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * PATCH /api/admin/features/:id
   * Update feature
   */
  async updateFeature(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Feature ID is required',
        });
        return;
      }

      const feature = await subscriptionService.updateFeature(id, {
        name,
        description,
        isActive,
      });

      res.json({
        success: true,
        message: 'Feature updated successfully',
        data: {
          id: feature._id.toString(),
          name: feature.name,
          description: feature.description,
          isActive: feature.isActive,
          updatedAt: feature.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update feature';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message,
        });
      } else {
        res.status(400).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * DELETE /api/admin/features/:id
   * Delete feature
   */
  async deleteFeature(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Feature ID is required',
        });
        return;
      }

      await subscriptionService.deleteFeature(id);

      res.json({
        success: true,
        message: 'Feature deleted successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete feature';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else if (message.includes('Cannot delete')) {
        res.status(409).json({
          success: false,
          message,
        });
      } else {
        res.status(500).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * POST /api/admin/subscription-plans
   * Create subscription plan
   */
  async createSubscriptionPlan(req: Request, res: Response): Promise<void> {
    try {
      const { name, monthlyPrice, features } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Plan name is required',
        });
        return;
      }

      if (monthlyPrice === undefined || monthlyPrice === null) {
        res.status(400).json({
          success: false,
          message: 'Monthly price is required',
        });
        return;
      }

      if (monthlyPrice < 0) {
        res.status(400).json({
          success: false,
          message: 'Monthly price cannot be negative',
        });
        return;
      }

      const plan = await subscriptionService.createSubscriptionPlan({
        name,
        monthlyPrice,
        features,
      });

      res.status(201).json({
        success: true,
        message: 'Subscription plan created successfully',
        data: {
          id: plan._id.toString(),
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          features: plan.features,
          isActive: plan.isActive,
          createdAt: plan.createdAt,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create subscription plan';

      if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message,
        });
      } else if (message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          message,
        });
      } else {
        res.status(400).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * GET /api/admin/subscription-plans
   * Get all subscription plans with features
   */
  async getAllSubscriptionPlans(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const plans = await subscriptionService.getAllSubscriptionPlans(includeInactive);

      res.json({
        success: true,
        message: 'Subscription plans retrieved successfully',
        data: plans,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to fetch subscription plans',
      });
    }
  }

  /**
   * GET /api/admin/subscription-plans/:id
   * Get subscription plan by ID with features
   */
  async getSubscriptionPlanById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Plan ID is required',
        });
        return;
      }

      const plan = await subscriptionService.getSubscriptionPlanById(id);

      res.json({
        success: true,
        message: 'Subscription plan retrieved successfully',
        data: plan,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch subscription plan';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else {
        res.status(500).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * PATCH /api/admin/subscription-plans/:id
   * Update subscription plan
   */
  async updateSubscriptionPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, monthlyPrice, features, isActive } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Plan ID is required',
        });
        return;
      }

      if (monthlyPrice !== undefined && monthlyPrice < 0) {
        res.status(400).json({
          success: false,
          message: 'Monthly price cannot be negative',
        });
        return;
      }

      const plan = await subscriptionService.updateSubscriptionPlan(id, {
        name,
        monthlyPrice,
        features,
        isActive,
      });

      res.json({
        success: true,
        message: 'Subscription plan updated successfully',
        data: {
          id: plan._id.toString(),
          name: plan.name,
          monthlyPrice: plan.monthlyPrice,
          features: plan.features,
          isActive: plan.isActive,
          updatedAt: plan.updatedAt,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update subscription plan';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message,
        });
      } else if (message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          message,
        });
      } else {
        res.status(400).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * POST /api/admin/subscription-plans/:id/features
   * Add features to subscription plan
   */
  async addFeaturesToPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { featureIds } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Plan ID is required',
        });
        return;
      }

      if (!featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Feature IDs array is required',
        });
        return;
      }

      const plan = await subscriptionService.addFeaturesToPlan(id, featureIds);

      res.json({
        success: true,
        message: 'Features added to subscription plan successfully',
        data: {
          id: plan._id.toString(),
          name: plan.name,
          features: plan.features,
          updatedAt: plan.updatedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add features';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else if (message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          message,
        });
      } else {
        res.status(400).json({
          success: false,
          message,
        });
      }
    }
  }

  /**
   * DELETE /api/admin/subscription-plans/:id
   * Delete subscription plan
   */
  async deleteSubscriptionPlan(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Plan ID is required',
        });
        return;
      }

      await subscriptionService.deleteSubscriptionPlan(id);

      res.json({
        success: true,
        message: 'Subscription plan deleted successfully',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete subscription plan';

      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message,
        });
      } else {
        res.status(500).json({
          success: false,
          message,
        });
      }
    }
  }
}

export const subscriptionController = new SubscriptionController();
