import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AVA API Documentation',
      version: '1.0.0',
      description: 'AVA - Voice-driven AI companion for emotional support and resilience coaching.',
      contact: {
        name: 'AVA Development Team',
        email: 'dev@ava-support.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '{protocol}://{host}',
        description: 'Current server',
        variables: {
          protocol: {
            default: 'https',
            enum: ['http', 'https']
          },
          host: {
            default: 'localhost:3001'
          }
        }
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            name: {
              type: 'string',
              description: 'User display name'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether email has been verified'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        AuthTokens: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token (expires in 15 minutes)'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token (expires in 7 days, sent as httpOnly cookie)'
            }
          }
        },
        SignupRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'User password (minimum 8 characters)'
            },
            name: {
              type: 'string',
              description: 'User display name'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              description: 'User password'
            }
          }
        },
        PasswordSetRequest: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: {
              type: 'string',
              minLength: 8,
              description: 'New password (minimum 8 characters)'
            },
            currentPassword: {
              type: 'string',
              description: 'Current password (required when updating existing password)'
            }
          }
        },
        EmailVerificationRequest: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description: 'Email verification token'
            }
          }
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            }
          }
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: {
              type: 'string',
              description: 'Password reset token'
            },
            newPassword: {
              type: 'string',
              minLength: 8,
              description: 'New password (minimum 8 characters)'
            }
          }
        },
        OTPRequest: {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              description: 'Phone number for OTP delivery'
            }
          }
        },
        OTPVerificationRequest: {
          type: 'object',
          required: ['otpId', 'code'],
          properties: {
            otpId: {
              type: 'string',
              description: 'OTP identifier'
            },
            code: {
              type: 'string',
              description: 'OTP verification code'
            }
          }
        },
        AdminSignupRequest: {
          type: 'object',
          required: ['email', 'name', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email address'
            },
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              description: 'Admin full name'
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'Admin password (minimum 8 characters, must include uppercase, lowercase, and digit)'
            }
          }
        },
        AdminLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email address'
            },
            password: {
              type: 'string',
              description: 'Admin password'
            }
          }
        },
        Admin: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique admin identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Admin email address'
            },
            name: {
              type: 'string',
              description: 'Admin full name'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether email has been verified'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        WaitlistRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to add to the waitlist'
            }
          }
        },
        WaitlistEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Waitlist entry identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address stored on the waitlist'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the entry was created'
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and account management'
      },
      {
        name: 'Admin',
        description: 'Admin authentication and management'
      },
      {
        name: 'Waitlist',
        description: 'Manage the application waitlist'
      }
    ]
  },
  apis: ['./src/routes/auth.ts', './src/routes/admin.ts', './src/routes/waitlist.ts'], // Path to the API docs
  };
  
  const specs = swaggerJsdoc(options) as any;
  
  // Function to get specs with dynamic server URL
  export const getSwaggerSpecs = (serverUrl: string) => {
    const dynamicSpecs = { ...specs };
    dynamicSpecs.servers = [{
      url: serverUrl,
      description: 'Current server'
    }];
    return dynamicSpecs;
  };
  
  export { specs, swaggerUi };