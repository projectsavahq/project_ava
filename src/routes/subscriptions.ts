import { Router } from 'express';
import { subscriptionController } from '../controllers/subscriptionController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';
import { validate } from '../middleware/validate';
import { subscriptionValidationSchemas } from '../validations/subscriptionValidation';

const router = Router();

// All subscription management routes require admin authentication
router.use(adminAuthMiddleware);

/**
 * @swagger
 * /api/admin/features:
 *   post:
 *     tags: [Admin - Subscription Management]
 *     summary: Create a new feature
 *     description: Create a new feature that can be added to subscription plans.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Feature name (must be unique)
 *                 example: "Unlimited voice sessions"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional feature description
 *                 example: "Access to unlimited AI voice therapy sessions"
 *     responses:
 *       201:
 *         description: Feature created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Feature created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     featureId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - admin auth required
 *       409:
 *         description: Conflict - feature name already exists
 */
router.post(
  '/features',
  validate(subscriptionValidationSchemas.createFeature),
  subscriptionController.createFeature
);

/**
 * @swagger
 * /api/admin/features:
 *   get:
 *     tags: [Admin - Subscription Management]
 *     summary: Get all features
 *     description: Retrieve all features available for subscription plans.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive features in results
 *     responses:
 *       200:
 *         description: Features retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Features retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       featureId:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized - admin auth required
 *       500:
 *         description: Internal server error
 */
router.get('/features', subscriptionController.getAllFeatures);

/**
 * @swagger
 * /api/admin/features/{featureId}:
 *   get:
 *     tags: [Admin - Subscription Management]
 *     summary: Get feature by ID
 *     description: Retrieve a specific feature by its ID.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feature ID
 *     responses:
 *       200:
 *         description: Feature retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Feature retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     featureId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Feature not found
 *       500:
 *         description: Internal server error
 */
router.get('/features/:id', subscriptionController.getFeatureById);

/**
 * @swagger
 * /api/admin/features/{featureId}:
 *   patch:
 *     tags: [Admin - Subscription Management]
 *     summary: Update feature
 *     description: Update an existing feature's name, description, or active status.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feature ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Priority Support"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "24/7 priority customer support"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Feature updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Feature updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     featureId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Feature not found
 *       409:
 *         description: Conflict - feature name already exists
 */
router.patch(
  '/features/:id',
  validate(subscriptionValidationSchemas.updateFeature),
  subscriptionController.updateFeature
);

/**
 * @swagger
 * /api/admin/features/{featureId}:
 *   delete:
 *     tags: [Admin - Subscription Management]
 *     summary: Delete feature
 *     description: Delete a feature. Cannot delete if feature is currently used in any subscription plan.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: featureId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Feature ID
 *     responses:
 *       200:
 *         description: Feature deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Feature deleted successfully"
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Feature not found
 *       409:
 *         description: Conflict - feature is used in subscription plans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Cannot delete feature. It is currently used in 2 subscription plan(s). Please remove it from all plans first."
 *       500:
 *         description: Internal server error
 */
router.delete('/features/:id', subscriptionController.deleteFeature);

/**
 * @swagger
 * /api/admin/subscription-plans:
 *   post:
 *     tags: [Admin - Subscription Management]
 *     summary: Create subscription plan
 *     description: Create a new subscription plan with optional features.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - monthlyPrice
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Plan name (must be unique)
 *                 example: "Premium Plan"
 *               monthlyPrice:
 *                 type: number
 *                 minimum: 0
 *                 description: Monthly subscription price in dollars
 *                 example: 99.99
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of feature IDs to include in this plan
 *                 example: ["123e4567-e89b-12d3-a456-426614174000"]
 *     responses:
 *       201:
 *         description: Subscription plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subscription plan created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     monthlyPrice:
 *                       type: number
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error or invalid features
 *       401:
 *         description: Unauthorized - admin auth required
 *       409:
 *         description: Conflict - plan name already exists
 */
router.post(
  '/subscription-plans',
  validate(subscriptionValidationSchemas.createSubscriptionPlan),
  subscriptionController.createSubscriptionPlan
);

/**
 * @swagger
 * /api/admin/subscription-plans:
 *   get:
 *     tags: [Admin - Subscription Management]
 *     summary: Get all subscription plans
 *     description: Retrieve all subscription plans with their features populated.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive plans in results
 *     responses:
 *       200:
 *         description: Subscription plans retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subscription plans retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       planId:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: "Premium Plan"
 *                       monthlyPrice:
 *                         type: number
 *                         example: 99.99
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       features:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             featureId:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                             isActive:
 *                               type: boolean
 *       401:
 *         description: Unauthorized - admin auth required
 *       500:
 *         description: Internal server error
 */
router.get('/subscription-plans', subscriptionController.getAllSubscriptionPlans);

/**
 * @swagger
 * /api/admin/subscription-plans/{planId}:
 *   get:
 *     tags: [Admin - Subscription Management]
 *     summary: Get subscription plan by ID
 *     description: Retrieve a specific subscription plan with all its features populated.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription plan retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subscription plan retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     monthlyPrice:
 *                       type: number
 *                     isActive:
 *                       type: boolean
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           featureId:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Subscription plan not found
 *       500:
 *         description: Internal server error
 */
router.get('/subscription-plans/:id', subscriptionController.getSubscriptionPlanById);

/**
 * @swagger
 * /api/admin/subscription-plans/{planId}:
 *   patch:
 *     tags: [Admin - Subscription Management]
 *     summary: Update subscription plan
 *     description: |
 *       Update a subscription plan's name, price, features, or active status.
 *       To remove features, pass the updated features array without the features you want to remove.
 *       To add features, use the add features endpoint or include all features (old + new) in the features array.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Premium Plus Plan"
 *               monthlyPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 149.99
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Complete array of feature IDs (removes features not in this array)
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "987f6543-e21b-43c1-a234-556789012345"]
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Subscription plan updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subscription plan updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     monthlyPrice:
 *                       type: number
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isActive:
 *                       type: boolean
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error or invalid features
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Subscription plan not found
 *       409:
 *         description: Conflict - plan name already exists
 */
router.patch(
  '/subscription-plans/:id',
  validate(subscriptionValidationSchemas.updateSubscriptionPlan),
  subscriptionController.updateSubscriptionPlan
);

/**
 * @swagger
 * /api/admin/subscription-plans/{planId}/features:
 *   post:
 *     tags: [Admin - Subscription Management]
 *     summary: Add features to subscription plan
 *     description: Add one or more features to an existing subscription plan. Duplicates are automatically ignored.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - featureIds
 *             properties:
 *               featureIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of feature IDs to add to the plan
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "987f6543-e21b-43c1-a234-556789012345"]
 *     responses:
 *       200:
 *         description: Features added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Features added to subscription plan successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     features:
 *                       type: array
 *                       items:
 *                         type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Bad request - validation error or invalid features
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Subscription plan not found
 */
router.post(
  '/subscription-plans/:id/features',
  validate(subscriptionValidationSchemas.addFeaturesToPlan),
  subscriptionController.addFeaturesToPlan
);

/**
 * @swagger
 * /api/admin/subscription-plans/{planId}:
 *   delete:
 *     tags: [Admin - Subscription Management]
 *     summary: Delete subscription plan
 *     description: Delete a subscription plan.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Plan ID
 *     responses:
 *       200:
 *         description: Subscription plan deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Subscription plan deleted successfully"
 *       401:
 *         description: Unauthorized - admin auth required
 *       404:
 *         description: Subscription plan not found
 *       500:
 *         description: Internal server error
 */
router.delete('/subscription-plans/:id', subscriptionController.deleteSubscriptionPlan);

export default router;
