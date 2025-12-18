import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Validation middleware factory
 * @param schema - Joi validation schema
 * @param property - Request property to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export const validate = (
  schema: Joi.ObjectSchema,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown properties
      convert: true, // Convert values to the correct type
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Validation failed', {
        endpoint: req.path,
        errors,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

/**
 * Validate multiple request properties
 * @param schemas - Object mapping request properties to their validation schemas
 * @returns Express middleware function
 */
export const validateMultiple = (schemas: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allErrors: Array<{ field: string; message: string }> = [];

    // Validate each specified property
    for (const [property, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(
        req[property as 'body' | 'query' | 'params'],
        {
          abortEarly: false,
          stripUnknown: true,
          convert: true,
        }
      );

      if (error) {
        const errors = error.details.map((detail) => ({
          field: `${property}.${detail.path.join('.')}`,
          message: detail.message,
        }));
        allErrors.push(...errors);
      } else {
        // Replace with validated value
        req[property as 'body' | 'query' | 'params'] = value;
      }
    }

    if (allErrors.length > 0) {
      logger.warn('Validation failed', {
        endpoint: req.path,
        errors: allErrors,
        ip: req.ip,
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: allErrors,
      });
      return;
    }

    next();
  };
};
