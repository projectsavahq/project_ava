import Joi from 'joi';

// Feature validation schemas
export const subscriptionValidationSchemas = {
  createFeature: Joi.object({
    name: Joi.string().min(2).max(100).trim().required().messages({
      'string.min': 'Feature name must be at least 2 characters long',
      'string.max': 'Feature name must not exceed 100 characters',
      'string.empty': 'Feature name is required',
      'any.required': 'Feature name is required',
    }),
    description: Joi.string().max(500).trim().optional().allow('').messages({
      'string.max': 'Description must not exceed 500 characters',
    }),
  }),

  updateFeature: Joi.object({
    name: Joi.string().min(2).max(100).trim().optional().messages({
      'string.min': 'Feature name must be at least 2 characters long',
      'string.max': 'Feature name must not exceed 100 characters',
    }),
    description: Joi.string().max(500).trim().optional().allow('').messages({
      'string.max': 'Description must not exceed 500 characters',
    }),
    isActive: Joi.boolean().optional(),
  }),

  createSubscriptionPlan: Joi.object({
    name: Joi.string().min(2).max(100).trim().required().messages({
      'string.min': 'Plan name must be at least 2 characters long',
      'string.max': 'Plan name must not exceed 100 characters',
      'string.empty': 'Plan name is required',
      'any.required': 'Plan name is required',
    }),
    monthlyPrice: Joi.number().min(0).required().messages({
      'number.min': 'Monthly price cannot be negative',
      'number.base': 'Monthly price must be a number',
      'any.required': 'Monthly price is required',
    }),
    features: Joi.array().items(Joi.string().uuid()).optional().messages({
      'array.base': 'Features must be an array',
      'string.guid': 'Invalid feature ID format',
    }),
  }),

  updateSubscriptionPlan: Joi.object({
    name: Joi.string().min(2).max(100).trim().optional().messages({
      'string.min': 'Plan name must be at least 2 characters long',
      'string.max': 'Plan name must not exceed 100 characters',
    }),
    monthlyPrice: Joi.number().min(0).optional().messages({
      'number.min': 'Monthly price cannot be negative',
      'number.base': 'Monthly price must be a number',
    }),
    features: Joi.array().items(Joi.string().uuid()).optional().messages({
      'array.base': 'Features must be an array',
      'string.guid': 'Invalid feature ID format',
    }),
    isActive: Joi.boolean().optional(),
  }),

  addFeaturesToPlan: Joi.object({
    featureIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .required()
      .messages({
        'array.base': 'Feature IDs must be an array',
        'array.min': 'At least one feature ID is required',
        'string.guid': 'Invalid feature ID format',
        'any.required': 'Feature IDs are required',
      }),
  }),
};

export type SubscriptionValidationSchema = keyof typeof subscriptionValidationSchemas;
