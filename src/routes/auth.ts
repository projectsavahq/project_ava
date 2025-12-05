import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes (no authentication required)
router.post('/signup', authController.signup.bind(authController));
router.post('/verify-email', authController.verifyEmail.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh-token', authController.refreshToken.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));
router.post('/logout', authController.logout.bind(authController));

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post('/set-password', authController.setPassword.bind(authController));
router.get('/me', authController.getProfile.bind(authController));
router.post('/send-otp', authController.sendOTP.bind(authController));
router.post('/verify-otp', authController.verifyOTP.bind(authController));

export { router as authRoutes };