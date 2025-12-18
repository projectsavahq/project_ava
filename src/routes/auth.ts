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
router.post('/signup', validate(authValidationSchemas.signup), authController.signup);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify user email address
 *     description: Verify user's email address using the verification token sent during signup.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailVerificationRequest'
 *           example:
 *             token: "abc123def456ghi789"
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
 *                 emailVerified: true
 *       400:
 *         description: Invalid or expired verification token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid or expired verification token"
 */
router.post('/verify-email', validate(authValidationSchemas.verifyEmail), authController.verifyEmail);

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
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: |
 *       Get a new access token using the refresh token stored in httpOnly cookie.
 *       Access tokens expire in 15 minutes, refresh tokens expire in 7 days.
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         headers:
 *           Set-Cookie:
 *             description: New refresh token (httpOnly)
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Token refreshed successfully"
 *               data:
 *                 accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               no_token:
 *                 summary: Refresh token not found
 *                 value:
 *                   success: false
 *                   message: "Refresh token not found"
 *               invalid_token:
 *                 summary: Invalid refresh token
 *                 value:
 *                   success: false
 *                   message: "Invalid refresh token"
 */
router.post('/refresh-token', authController.refreshToken);
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     description: |
 *       Send a password reset token to the user's email address.
 *       For security, the response is the same whether the email exists or not.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *           example:
 *             email: "user@example.com"
 *     responses:
 *       200:
 *         description: Password reset request processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "If this email exists, a password reset link has been sent."
 *               data:
 *                 resetToken: "abc123def456ghi789" # Only in development
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
router.post('/forgot-password', validate(authValidationSchemas.forgotPassword), authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with token
 *     description: |
 *       Reset user's password using the reset token sent via email.
 *       Token expires in 1 hour. Password cannot be one of the last 5 used passwords.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *           example:
 *             token: "abc123def456ghi789"
 *             newPassword: "newSecurePassword123"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Password reset successfully"
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
router.post('/reset-password', validate(authValidationSchemas.resetPassword), authController.resetPassword);

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
 * /api/auth/set-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Set or update user password
 *     description: |
 *       Set a new password or update existing password.
 *       When updating, current password must be provided.
 *       New password cannot be one of the last 5 used passwords.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordSetRequest'
 *           examples:
 *             new_password:
 *               summary: Setting password for the first time
 *               value:
 *                 newPassword: "securePassword123"
 *             update_password:
 *               summary: Updating existing password
 *               value:
 *                 newPassword: "newSecurePassword123"
 *                 currentPassword: "oldSecurePassword123"
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Password set successfully"
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_password:
 *                 summary: Missing new password
 *                 value:
 *                   success: false
 *                   message: "New password is required"
 *               weak_password:
 *                 summary: Password too short
 *                 value:
 *                   success: false
 *                   message: "Password must be at least 8 characters long"
 *               wrong_current:
 *                 summary: Current password incorrect
 *                 value:
 *                   success: false
 *                   message: "Current password is incorrect"
 *               password_reuse:
 *                 summary: Password recently used
 *                 value:
 *                   success: false
 *                   message: "Cannot reuse recent passwords"
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
router.post('/set-password', authMiddleware, validate(authValidationSchemas.setPassword), authController.setPassword);

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
 * /api/auth/send-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Send OTP for additional security
 *     description: |
 *       Send a one-time password (OTP) via SMS for additional security verification.
 *       Integrates with Clark OTP service.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPRequest'
 *           example:
 *             phone: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "OTP sent successfully"
 *               data:
 *                 otpId: "123e4567-e89b-12d3-a456-426614174000"
 *       400:
 *         description: Bad request - OTP send failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "OTP send failed"
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
router.post('/send-otp', authMiddleware, validate(authValidationSchemas.sendOTP), authController.sendOTP);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify OTP code
 *     description: |
 *       Verify the one-time password (OTP) code sent via SMS.
 *       Used for additional security verification.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPVerificationRequest'
 *           example:
 *             otpId: "123e4567-e89b-12d3-a456-426614174000"
 *             code: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "OTP verified successfully"
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
 *                   message: "OTP ID and code are required"
 *               invalid_code:
 *                 summary: Invalid OTP code
 *                 value:
 *                   success: false
 *                   message: "Invalid OTP code"
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
router.post('/verify-otp', authMiddleware, validate(authValidationSchemas.verifyOTP), authController.verifyOTP);

export default router;