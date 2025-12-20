import Joi from 'joi';

// Password validation rules
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password must not exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  });

// Email validation
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .required()
  .messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
  });

// Name validation
const nameSchema = Joi.string()
  .min(2)
  .max(100)
  .trim()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name must not exceed 100 characters',
  });

// Phone validation
const phoneSchema = Joi.string()
  .pattern(/^\+?[1-9]\d{1,14}$/)
  .messages({
    'string.pattern.base': 'Invalid phone number format. Use E.164 format (e.g., +1234567890)',
  });

// Country code validation
const countryCodeSchema = Joi.string()
  .length(2)
  .uppercase()
  .pattern(/^[A-Z]{2}$/)
  .messages({
    'string.length': 'Country code must be exactly 2 characters',
    'string.pattern.base': 'Country code must contain only uppercase letters',
  });

// Token validation
const tokenSchema = Joi.string()
  .trim()
  .required()
  .messages({
    'string.empty': 'Token is required',
  });

// OTP code validation
const otpCodeSchema = Joi.string()
  .length(6)
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    'string.length': 'OTP code must be exactly 6 digits',
    'string.pattern.base': 'OTP code must contain only digits',
    'string.empty': 'OTP code is required',
  });

// Validation schemas for each endpoint
export const authValidationSchemas = {
  signup: Joi.object({
    email: emailSchema,
    password: passwordSchema.required().messages({
      'any.required': 'Password is required',
    }),
    name: nameSchema.optional(),
  }),

  login: Joi.object({
    email: emailSchema,
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  }),

  verifyEmail: Joi.object({
    token: tokenSchema,
  }),

  forgotPassword: Joi.object({
    email: emailSchema,
  }),

  resetPassword: Joi.object({
    token: tokenSchema,
    newPassword: passwordSchema.required().messages({
      'any.required': 'New password is required',
    }),
  }),

  setPassword: Joi.object({
    newPassword: passwordSchema.required().messages({
      'any.required': 'New password is required',
    }),
    currentPassword: Joi.string().optional().messages({
      'string.empty': 'Current password cannot be empty',
    }),
  }),

  sendOTP: Joi.object({
    phone: phoneSchema.optional(),
  }),

  verifyOTP: Joi.object({
    otpId: Joi.string().uuid().required().messages({
      'string.empty': 'OTP ID is required',
      'any.required': 'OTP ID is required',
      'string.guid': 'Invalid OTP ID format',
    }),
    code: otpCodeSchema,
  }),
};

// Admin validation schemas
export const adminValidationSchemas = {
  signup: Joi.object({
    email: emailSchema,
    name: nameSchema.required().messages({
      'any.required': 'Name is required',
    }),
    countryCode: countryCodeSchema.required().messages({
      'any.required': 'Country code is required',
    }),
    phoneNumber: phoneSchema.required().messages({
      'any.required': 'Phone number is required',
    }),
    password: passwordSchema.required().messages({
      'any.required': 'Password is required',
    }),
  }),

  login: Joi.object({
    email: emailSchema,
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  }),

  verifyEmail: Joi.object({
    token: tokenSchema,
  }),

  forgotPassword: Joi.object({
    email: emailSchema,
  }),

  resetPassword: Joi.object({
    token: tokenSchema,
    newPassword: passwordSchema.required().messages({
      'any.required': 'New password is required',
    }),
  }),
};

export type AuthValidationSchema = keyof typeof authValidationSchemas;
export type AdminValidationSchema = keyof typeof adminValidationSchemas;
