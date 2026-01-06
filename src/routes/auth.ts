import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { authValidationSchemas } from '../validations/authValidation';

const router = Router();

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account with email and password. Email verification is required before login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "securePassword123"
 *             name: "John Doe"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User registered successfully. Please check your email for verification."
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 emailVerified: false
 *                 verificationToken: "abc123..." # Only in development
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   message: "Email and password are required"
 *               invalid_email:
 *                 summary: Invalid email format
 *                 value:
 *                   success: false
 *                   message: "Invalid email format"
 *               weak_password:
 *                 summary: Password too short
 *                 value:
 *                   success: false
 *                   message: "Password must be at least 8 characters long"
 *               user_exists:
 *                 summary: User already exists
 *                 value:
 *                   success: false
 *                   message: "User with this email already exists"
 */
router.post('/signup', validate(authValidationSchemas.signup), authController.signupWithOTP);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: |
 *       Authenticate user with email and password. Returns access token and sets refresh token as httpOnly cookie.
 *       
 *       **Security Features:**
 *       - Account lockout after 5 failed attempts (2-hour lockout)
 *       - Email verification required
 *       - Password strength validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "securePassword123"
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: Refresh token (httpOnly)
 *             schema:
 *               type: string
 *               example: "refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               data:
 *                 user:
 *                   id: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "user@example.com"
 *                   name: "John Doe"
 *                   emailVerified: true
 *                 accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Bad request - missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Email and password are required"
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalid_credentials:
 *                 summary: Invalid email or password
 *                 value:
 *                   success: false
 *                   message: "Invalid credentials"
 *               account_locked:
 *                 summary: Account temporarily locked
 *                 value:
 *                   success: false
 *                   message: "Account is temporarily locked due to too many failed login attempts"
 *               email_not_verified:
 *                 summary: Email not verified
 *                 value:
 *                   success: false
 *                   message: "Please verify your email before logging in"
 */
router.post('/login', validate(authValidationSchemas.login), authController.login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: User logout
 *     description: Clear the refresh token cookie to log out the user.
 *     responses:
 *       200:
 *         description: Logout successful
 *         headers:
 *           Set-Cookie:
 *             description: Clear refresh token cookie
 *             schema:
 *               type: string
 *               example: "refreshToken=; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Logout successful"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Logout failed"
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     description: Retrieve the profile information of the currently authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Profile retrieved successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 emailVerified: true
 *                 lastLogin: "2023-12-01T10:00:00.000Z"
 *                 createdAt: "2023-11-01T10:00:00.000Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               no_token:
 *                 summary: No token provided
 *                 value:
 *                   success: false
 *                   message: "Access token is required"
 *               invalid_token:
 *                 summary: Invalid token
 *                 value:
 *                   success: false
 *                   message: "Invalid token"
 *               token_expired:
 *                 summary: Token expired
 *                 value:
 *                   success: false
 *                   message: "Token expired"
 */
router.get('/me', authMiddleware, authController.getProfile);

/**
 * @swagger
 * /api/auth/introspect:
 *   get:
 *     tags: [Authentication]
 *     summary: Introspect token and return user profile
 *     description: Returns the authenticated user's profile with sensitive fields removed.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token introspected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Token introspection successful"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 emailVerified: true
 *                 lastLogin: "2026-01-05T10:00:00.000Z"
 *                 createdAt: "2026-01-01T10:00:00.000Z"
 *                 updatedAt: "2026-01-05T10:30:00.000Z"
 *                 preferences:
 *                   voicePreference: "AVA-Default"
 *                   language: "en-US"
 *                 crisisHistory: false
 *                 supportLevel: "basic"
 *                 isActive: true
 *                 isSuspended: false
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Authentication required"
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "User not found"
 */
router.get('/introspect', authMiddleware, authController.introspect);

/**
 * @swagger
 * /api/auth/update-profile:
 *   patch:
 *     tags: [Authentication]
 *     summary: Update user profile
 *     description: Update the authenticated user's profile information (name, preferences, etc.).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           example:
 *             name: "John Doe Updated"
 *             preferences:
 *               voicePreference: "AVA-Female"
 *               language: "en-GB"
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Profile updated successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe Updated"
 *                 preferences:
 *                   voicePreference: "AVA-Female"
 *                   language: "en-GB"
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid profile data"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Authentication required"
 */
router.patch('/update-profile', authMiddleware, validate(authValidationSchemas.updateProfile), authController.updateProfile);

/**
 * @swagger
 * /api/auth/verify-otp-registration:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify OTP for registration
 *     description: Verify user's email address using the OTP sent during signup.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPRegistrationVerificationRequest'
 *           example:
 *             email: "user@example.com"
 *             otpCode: "12345"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Email verified successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 emailVerified: true
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid or expired OTP"
 */
router.post('/verify-otp-registration', validate(authValidationSchemas.verifyOTPRegistration), authController.verifyOTPForRegistration);

/**
 * @swagger
 * /api/auth/resend-verification-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend email verification OTP
 *     description: Resend the OTP code to the user's email for verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResendVerificationRequest'
 *           example:
 *             email: "user@example.com"
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Verification OTP has been sent to your email."
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_email:
 *                 summary: Missing email
 *                 value:
 *                   success: false
 *                   message: "Email is required"
 *               already_verified:
 *                 summary: Email already verified
 *                 value:
 *                   success: false
 *                   message: "Email is already verified"
 *               user_not_found:
 *                 summary: User not found
 *                 value:
 *                   success: false
 *                   message: "User not found"
 */
router.post('/resend-verification-email', validate(authValidationSchemas.resendVerification), authController.resendVerificationEmail);

/**
 * @swagger
 * /api/auth/request-password-reset-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Request OTP for password reset
 *     description: Send an OTP to the user's email for password reset verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordResetOTPRequest'
 *           example:
 *             email: "user@example.com"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "If this email exists, an OTP has been sent for password reset."
 *       400:
 *         description: Bad request - missing email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Email is required"
 */
router.post('/request-password-reset-otp', validate(authValidationSchemas.requestPasswordResetOTP), authController.requestPasswordResetOTP);

/**
 * @swagger
 * /api/auth/verify-otp-password-reset:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify OTP for password reset
 *     description: |
 *       Verify the OTP code for password reset. After verification, use the create-password endpoint to set a new password.
 *       OTP expires in 5 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPPasswordResetVerificationRequest'
 *           example:
 *             email: "user@example.com"
 *             otpCode: "12345"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "OTP verified successfully. You can now set your new password."
 *               data:
 *                 resetToken: "temp-token-for-password-reset"
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   message: "Email and OTP code are required"
 *               invalid_otp:
 *                 summary: Invalid or expired OTP
 *                 value:
 *                   success: false
 *                   message: "Invalid or expired OTP"
 */
router.post('/verify-otp-password-reset', validate(authValidationSchemas.verifyOTPPasswordReset), authController.verifyOTPPasswordReset);

/**
 * @swagger
 * /api/auth/create-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Create new password after OTP verification
 *     description: |
 *       Set a new password after OTP verification. Requires the reset token from OTP verification.
 *       Password cannot be one of the last 4 used passwords.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePasswordRequest'
 *           example:
 *             resetToken: "temp-token-for-password-reset"
 *             newPassword: "newSecurePassword123"
 *     responses:
 *       200:
 *         description: Password created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Password created successfully"
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_fields:
 *                 summary: Missing required fields
 *                 value:
 *                   success: false
 *                   message: "Reset token and new password are required"
 *               weak_password:
 *                 summary: Password too short
 *                 value:
 *                   success: false
 *                   message: "Password must be at least 8 characters long"
 *               invalid_token:
 *                 summary: Invalid or expired token
 *                 value:
 *                   success: false
 *                   message: "Invalid or expired reset token"
 *               password_reuse:
 *                 summary: Password recently used
 *                 value:
 *                   success: false
 *                   message: "Cannot reuse recent passwords"
 */
router.post('/create-password', validate(authValidationSchemas.createPassword), authController.createPassword);

export default router;