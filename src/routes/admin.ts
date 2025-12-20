import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';
import { validate } from '../middleware/validate';
import { adminValidationSchemas } from '../validations/authValidation';

const router = Router();

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     tags: [Admin]
 *     summary: Register a new admin account
 *     description: Create a new admin account with email, name, and password. Email verification is required before login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminSignupRequest'
 *           example:
 *             email: "admin@ava-support.com"
 *             name: "Admin User"
 *             password: "SecurePassword123"
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin registered successfully. Please check your email for verification."
 *               data:
 *                 adminId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@ava-support.com"
 *                 name: "Admin User"
 *                 emailVerified: false
 *                 verificationToken: "abc123..." # Only in development
 *       400:
 *         description: Bad request - validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Admin with this email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Admin with this email already exists"
 */
router.post(
  '/register',
  validate(adminValidationSchemas.signup),
  (req, res) => adminController.register(req, res)
);

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     tags: [Admin]
 *     summary: Admin login
 *     description: |
 *       Authenticate admin with email and password. Returns access token and sets refresh token as httpOnly cookie.
 *       
 *       **Security Features:**
 *       - Account lockout after 5 failed attempts (2-hour lockout)
 *       - Email verification required
 *       - JWT-based authentication with 1-hour access token expiry
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *           example:
 *             email: "admin@ava-support.com"
 *             password: "SecurePassword123"
 *     responses:
 *       200:
 *         description: Admin login successful
 *         headers:
 *           Set-Cookie:
 *             description: Admin refresh token (httpOnly, secure, sameSite)
 *             schema:
 *               type: string
 *               example: "adminRefreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; HttpOnly; Secure; SameSite=Strict"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin login successful"
 *               data:
 *                 user:
 *                   id: "123e4567-e89b-12d3-a456-426614174000"
 *                   email: "admin@ava-support.com"
 *                   name: "Admin User"
 *                   emailVerified: true
 *                 accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid email or password"
 *       429:
 *         description: Account locked due to too many failed attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Admin account is locked. Please try again later."
 */
router.post(
  '/login',
  validate(adminValidationSchemas.login),
  (req, res) => adminController.login(req, res)
);

/**
 * @swagger
 * /api/admin/verify-email:
 *   post:
 *     tags: [Admin]
 *     summary: Verify admin email address
 *     description: Verify admin's email address using the verification token sent during signup. Email verification is required before admin can log in.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailVerificationRequest'
 *           example:
 *             token: "abc123def456ghi789jkl012"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin email verified successfully"
 *               data:
 *                 adminId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@ava-support.com"
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
router.post(
  '/verify-email',
  validate(adminValidationSchemas.verifyEmail),
  (req, res) => adminController.verifyEmail(req, res)
);

/**
 * @swagger
 * /api/admin/logout:
 *   post:
 *     tags: [Admin]
 *     summary: Admin logout
 *     description: Logout the authenticated admin and clear the refresh token cookie.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Admin logout successful
 *         headers:
 *           Set-Cookie:
 *             description: Clears the adminRefreshToken cookie
 *             schema:
 *               type: string
 *               example: "adminRefreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin logout successful"
 *       401:
 *         description: Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Authorization token is required"
 */
router.post(
  '/logout',
  adminAuthMiddleware,
  (req, res) => adminController.logout(req, res)
);

export default router;
