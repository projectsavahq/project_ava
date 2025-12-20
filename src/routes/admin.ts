import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';
import { validate } from '../middleware/validate';
import { adminValidationSchemas } from '../validations/authValidation';

const router = Router();

/**
 * POST /api/admin/register
 * Register a new admin
 * Body: { email, name, countryCode, phoneNumber, password }
 */
router.post(
  '/register',
  validate(adminValidationSchemas.signup),
  (req, res) => adminController.register(req, res)
);

/**
 * POST /api/admin/login
 * Admin login
 * Body: { email, password }
 */
router.post(
  '/login',
  validate(adminValidationSchemas.login),
  (req, res) => adminController.login(req, res)
);

/**
 * POST /api/admin/verify-email
 * Verify admin email with token
 * Body: { token }
 */
router.post(
  '/verify-email',
  validate(adminValidationSchemas.verifyEmail),
  (req, res) => adminController.verifyEmail(req, res)
);

/**
 * POST /api/admin/logout
 * Admin logout (requires authentication)
 */
router.post(
  '/logout',
  adminAuthMiddleware,
  (req, res) => adminController.logout(req, res)
);

export default router;
