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
 *     description: Create a new admin account with email, name, and password. An OTP will be sent to the email for verification before login.
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
 *         description: Admin registered successfully. OTP sent to email.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin registered successfully. Please check your email for OTP verification."
 *               data:
 *                 adminId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@ava-support.com"
 *                 name: "Admin User"
 *                 emailVerified: false
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
 * /api/admin/verify-otp-registration:
 *   post:
 *     tags: [Admin]
 *     summary: Verify admin OTP for registration
 *     description: Verify admin's email address using the OTP code sent during signup.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otpCode
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otpCode:
 *                 type: string
 *                 pattern: '^\d{5}$'
 *           example:
 *             email: "admin@ava-support.com"
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
 *                 adminId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "admin@ava-support.com"
 *                 name: "Admin User"
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
router.post(
  '/verify-otp-registration',
  (req, res) => adminController.verifyOTPForRegistration(req, res)
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

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users (paginated)
 *     description: Retrieve a paginated list of all users with optional search and filtering. Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Number of users per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or name
 *       - in: query
 *         name: suspended
 *         schema:
 *           type: boolean
 *         description: Filter by suspension status (true/false)
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Users retrieved successfully"
 *               data:
 *                 users:
 *                   - userId: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "user@example.com"
 *                     name: "John Doe"
 *                     emailVerified: true
 *                     isSuspended: false
 *                     supportLevel: "basic"
 *                     createdAt: "2025-12-20T10:00:00Z"
 *                 total: 150
 *                 page: 1
 *                 limit: 10
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/users',
  adminAuthMiddleware,
  (req, res) => adminController.getUsers(req, res)
);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user details
 *     description: Retrieve detailed information about a specific user including admin notes. Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User retrieved successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 emailVerified: true
 *                 isSuspended: false
 *                 supportLevel: "intermediate"
 *                 adminNotes:
 *                   - note: "User reported crisis event on 2025-12-20"
 *                     adminId: "admin-123"
 *                     adminEmail: "admin@ava.com"
 *                     createdAt: "2025-12-20T10:30:00Z"
 *                 createdAt: "2025-12-15T08:00:00Z"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/users/:userId',
  adminAuthMiddleware,
  (req, res) => adminController.getUserById(req, res)
);

/**
 * @swagger
 * /api/admin/users/{userId}/notes:
 *   post:
 *     tags: [Admin]
 *     summary: Add admin note to user
 *     description: Add a note to a user's record. Notes are tracked with admin ID and timestamp. Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ['note']
 *             properties:
 *               note:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Admin note (max 1000 characters)
 *           example:
 *             note: "User completed crisis support session. Showing improvement."
 *     responses:
 *       200:
 *         description: Admin note added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Admin note added successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 noteAdded:
 *                   note: "User completed crisis support session."
 *                   adminId: "admin-123"
 *                   adminEmail: "admin@ava.com"
 *                   createdAt: "2025-12-20T12:00:00Z"
 *                 totalNotes: 5
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/users/:userId/notes',
  adminAuthMiddleware,
  (req, res) => adminController.addAdminNote(req, res)
);

/**
 * @swagger
 * /api/admin/users/{userId}/suspend:
 *   post:
 *     tags: [Admin]
 *     summary: Suspend user account
 *     description: Suspend a user account with a reason. Suspended users cannot log in or access the platform. Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: ['reason']
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension
 *           example:
 *             reason: "Violation of terms of service - inappropriate content"
 *     responses:
 *       200:
 *         description: User suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User suspended successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 isSuspended: true
 *                 suspensionReason: "Violation of terms of service - inappropriate content"
 *                 suspendedAt: "2025-12-20T12:30:00Z"
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User is already suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/users/:userId/suspend',
  adminAuthMiddleware,
  (req, res) => adminController.suspendUser(req, res)
);

/**
 * @swagger
 * /api/admin/users/{userId}/unsuspend:
 *   post:
 *     tags: [Admin]
 *     summary: Unsuspend user account
 *     description: Unsuspend a previously suspended user account. The user can then log in normally. Requires admin authentication.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User unsuspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User unsuspended successfully"
 *               data:
 *                 userId: "123e4567-e89b-12d3-a456-426614174000"
 *                 email: "user@example.com"
 *                 isSuspended: false
 *                 isActive: true
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User is not suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/users/:userId/unsuspend',
  adminAuthMiddleware,
  (req, res) => adminController.unsuspendUser(req, res)
);

export default router;
