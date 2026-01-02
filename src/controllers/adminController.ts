import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { adminUserService } from '../services/adminUserService';

export class AdminController {
  /**
   * POST /api/admin/register
   * Register a new admin
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, password } = req.body;

      // Validate required fields
      if (!email || !name || !password) {
        res.status(400).json({
          success: false,
          message: 'Email, name, and password are required'
        });
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
        return;
      }

      // Password strength validation
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      const { admin } = await authService.adminSignupWithOTP({
        email,
        name,
        password
      });

      res.status(201).json({
        success: true,
        message: 'Admin registered successfully. Please check your email for OTP verification.',
        data: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
          emailVerified: admin.emailVerified
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      
      if (message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message
        });
      } else {
        res.status(400).json({
          success: false,
          message
        });
      }
    }
  }

  /**
   * POST /api/admin/login
   * Admin login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const authResponse = await authService.adminLogin({ email, password });

      // Set refresh token as httpOnly cookie
      res.cookie('adminRefreshToken', authResponse.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          user: authResponse.user,
          accessToken: authResponse.tokens.accessToken
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      
      if (message.includes('locked')) {
        res.status(429).json({
          success: false,
          message
        });
      } else {
        res.status(401).json({
          success: false,
          message
        });
      }
    }
  }

  /**
   * POST /api/admin/verify-email
   * Verify admin email with token
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Verification token is required'
        });
        return;
      }

      const admin = await authService.adminVerifyEmail(token);

      res.json({
        success: true,
        message: 'Admin email verified successfully',
        data: {
          adminId: admin.adminId,
          email: admin.email,
          emailVerified: admin.emailVerified
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Email verification failed'
      });
    }
  }

  /**
   * POST /api/admin/verify-otp-registration
   * Verify OTP for admin registration
   */
  async verifyOTPForRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { email, otpCode } = req.body;

      if (!email || !otpCode) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
        return;
      }

      const admin = await authService.verifyAdminOTPForRegistration(email, otpCode);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
          emailVerified: admin.emailVerified
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'OTP verification failed'
      });
    }
  }

  /**
   * POST /api/admin/logout
   * Admin logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear the refresh token cookie
      res.clearCookie('adminRefreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      res.json({
        success: true,
        message: 'Admin logout successful'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  /**
   * GET /api/admin/users
   * Get all users with pagination and filtering
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const search = req.query.search as string | undefined;
      const filterSuspended = req.query.suspended ? req.query.suspended === 'true' : undefined;

      // Validate pagination
      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters'
        });
        return;
      }

      const result = await adminUserService.getUsers({
        page,
        limit,
        search,
        filterSuspended
      });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch users'
      });
    }
  }

  /**
   * GET /api/admin/users/:userId
   * Get a specific user by ID
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const user = await adminUserService.getUserById(userId);

      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: user
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';
      
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message
        });
      } else {
        res.status(500).json({
          success: false,
          message
        });
      }
    }
  }

  /**
   * POST /api/admin/users/:userId/notes
   * Add admin note to user
   */
  async addAdminNote(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { note } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      if (!note) {
        res.status(400).json({
          success: false,
          message: 'Note is required'
        });
        return;
      }

      if (!req.admin) {
        res.status(401).json({
          success: false,
          message: 'Admin authentication required'
        });
        return;
      }

      const user = await adminUserService.addAdminNote({
        userId,
        note,
        adminId: req.admin.adminId,
        adminEmail: req.admin.email
      });

      res.json({
        success: true,
        message: 'Admin note added successfully',
        data: {
          userId: user.userId,
          noteAdded: user.adminNotes[user.adminNotes.length - 1],
          totalNotes: user.adminNotes.length
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add note';
      
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message
        });
      } else if (message.includes('cannot') || message.includes('exceed')) {
        res.status(400).json({
          success: false,
          message
        });
      } else {
        res.status(500).json({
          success: false,
          message
        });
      }
    }
  }

  /**
   * POST /api/admin/users/:userId/suspend
   * Suspend user account
   */
  async suspendUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          message: 'Suspension reason is required'
        });
        return;
      }

      const user = await adminUserService.suspendUser({
        userId,
        reason
      });

      res.json({
        success: true,
        message: 'User suspended successfully',
        data: {
          userId: user.userId,
          email: user.email,
          isSuspended: user.isSuspended,
          suspensionReason: user.suspensionReason,
          suspendedAt: user.suspendedAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to suspend user';
      
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message
        });
      } else if (message.includes('already suspended')) {
        res.status(409).json({
          success: false,
          message
        });
      } else if (message.includes('required')) {
        res.status(400).json({
          success: false,
          message
        });
      } else {
        res.status(500).json({
          success: false,
          message
        });
      }
    }
  }

  /**
   * POST /api/admin/users/:userId/unsuspend
   * Unsuspend user account
   */
  async unsuspendUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
        return;
      }

      const user = await adminUserService.unsuspendUser(userId);

      res.json({
        success: true,
        message: 'User unsuspended successfully',
        data: {
          userId: user.userId,
          email: user.email,
          isSuspended: user.isSuspended,
          isActive: user.isActive
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unsuspend user';
      
      if (message.includes('not found')) {
        res.status(404).json({
          success: false,
          message
        });
      } else if (message.includes('not suspended')) {
        res.status(409).json({
          success: false,
          message
        });
      } else {
        res.status(500).json({
          success: false,
          message
        });
      }
    }
  }
}

export const adminController = new AdminController();
