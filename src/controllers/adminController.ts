import { Request, Response } from 'express';
import { authService } from '../services/authService';

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

      const { admin, verificationToken } = await authService.adminSignup({
        email,
        name,
        password
      });

      res.status(201).json({
        success: true,
        message: 'Admin registered successfully. Please check your email for verification.',
        data: {
          adminId: admin.adminId,
          email: admin.email,
          name: admin.name,
          emailVerified: admin.emailVerified,
          // In production, send this via email instead of returning it
          verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
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
}

export const adminController = new AdminController();
