import Joi from 'joi';

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const sessionsValidationSchemas = {
  listSessions: Joi.object({
    page: Joi.number().integer().min(1).default(1)
      .messages({
        'number.base': 'page must be a number',
        'number.min': 'page must be at least 1',
        'number.integer': 'page must be an integer'
      }),
    limit: Joi.number().integer().min(1).max(100).default(10)
      .messages({
        'number.base': 'limit must be a number',
        'number.min': 'limit must be at least 1',
        'number.max': 'limit must not exceed 100',
        'number.integer': 'limit must be an integer'
      }),
  }),

  sessionIdParams: Joi.object({
    sessionId: Joi.string().required()
      .messages({
        'string.empty': 'sessionId is required'
      })
  }),

  messagesCursor: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20)
      .messages({
        'number.base': 'limit must be a number',
        'number.min': 'limit must be at least 1',
        'number.max': 'limit must not exceed 100',
        'number.integer': 'limit must be an integer'
      }),
    cursor: Joi.string().pattern(objectIdRegex).optional()
      .messages({
        'string.pattern.base': 'cursor must be a valid message id'
      })
  })
};
