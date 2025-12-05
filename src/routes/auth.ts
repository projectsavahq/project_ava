import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes (no authentication required)
router.post('/signup', authController.signup);
router.post('/verify-email', authController.verifyEmail);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);

// Protected routes (authentication required)
router.use(authMiddleware); // Apply auth middleware to all routes below

router.post('/set-password', authController.setPassword);
router.get('/me', authController.getProfile);
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);

export default router;