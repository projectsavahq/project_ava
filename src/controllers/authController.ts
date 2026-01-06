import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { User } from '../models/schemas/User';

export class AuthController {
  /**
   * POST /auth/signup
   * Register a new user
   */
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
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

      const { user } = await authService.signup({
        email,
        name,
        password
      });
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Signup failed'
      });
    }
  }

  /**
   * POST /auth/verify-email
   * Verify email with token
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

      const user = await authService.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          userId: user.userId,
          email: user.email,
          emailVerified: user.emailVerified
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
   * POST /auth/login
   * User login
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

      const authResponse = await authService.login({ email, password });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', authResponse.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: authResponse.user,
          accessToken: authResponse.tokens.accessToken
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed'
      });
    }
  }

  /**
   * POST /auth/set-password
   * Set or update user password
   */
  async setPassword(req: Request, res: Response): Promise<void> {
    try {
      const { newPassword, currentPassword } = req.body;
      const userId = req.user?.userId; // Assuming auth middleware sets req.user

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!newPassword) {
        res.status(400).json({
          success: false,
          message: 'New password is required'
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      await authService.setPassword(userId, newPassword, currentPassword);

      res.json({
        success: true,
        message: 'Password set successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password set failed'
      });
    }
  }

  /**
   * POST /auth/refresh-token
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token not found'
        });
        return;
      }

      const tokens = await authService.refreshToken(refreshToken);

      // Update refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Token refresh failed'
      });
    }
  }

  /**
   * POST /auth/forgot-password
   * Request password reset
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      await authService.forgotPassword(email);

      res.json({
        success: true,
        message: 'If this email exists, a password reset link has been sent.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password reset request failed'
      });
    }
  }

  /**
   * POST /auth/reset-password
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      await authService.resetPassword(token, newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password reset failed'
      });
    }
  }

  /**
   * POST /auth/logout
   * User logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  /**
   * POST /auth/send-otp
   * Send OTP for additional security
   */
  async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { otpId } = await authService.sendOTP(userId, phone);

      res.json({
        success: true,
        message: 'OTP sent successfully',
        data: { otpId }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'OTP send failed'
      });
    }
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP code
   */
  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { otpId, code } = req.body;

      if (!otpId || !code) {
        res.status(400).json({
          success: false,
          message: 'OTP ID and code are required'
        });
        return;
      }

      const isValid = await authService.verifyOTP(otpId, code);

      if (isValid) {
        res.json({
          success: true,
          message: 'OTP verified successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid OTP code'
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'OTP verification failed'
      });
    }
  }

  /**
   * GET /auth/me
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user; // Assuming auth middleware sets req.user

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve profile'
      });
    }
  }

  /**
   * GET /auth/introspect
   * Return authenticated user's profile without sensitive fields
   */
  async introspect(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
      }

      const user = await User.findOne({ userId })
        .select(
          'userId email name emailVerified lastLogin createdAt updatedAt preferences crisisHistory supportLevel isActive isSuspended suspensionReason suspendedAt'
        )
        .lean();

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.json({ success: true, message: 'Token introspection successful', data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to introspect token' });
    }
  }

  /**
   * PATCH /auth/update-profile
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { name, preferences } = req.body;

      const updatedUser = await authService.updateUserProfile(userId, {
        name,
        preferences
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          userId: updatedUser.userId,
          email: updatedUser.email,
          name: updatedUser.name,
          preferences: updatedUser.preferences
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Profile update failed'
      });
    }
  }

  /**
   * POST /auth/signup-otp
   * Register a new user with OTP verification
   */
  async signupWithOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
        return;
      }

      if (password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      const { user } = await authService.signupWithOTP({
        email,
        name,
        password
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for OTP verification.',
        data: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Signup with OTP failed'
      });
    }
  }

  /**
   * POST /auth/verify-otp-registration
   * Verify OTP for registration
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

      const user = await authService.verifyOTPForRegistration(email, otpCode);

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          userId: user.userId,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified
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
   * POST /auth/resend-verification-email
   * Resend email verification OTP
   */
  async resendVerificationEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      await authService.resendVerificationEmail(email);

      res.json({
        success: true,
        message: 'Verification OTP has been sent to your email.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to resend verification email'
      });
    }
  }

  /**
   * POST /auth/request-password-reset-otp
   * Request OTP for password reset
   */
  async requestPasswordResetOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      await authService.requestPasswordResetOTP(email);

      res.json({
        success: true,
        message: 'If this email exists, an OTP has been sent for password reset.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password reset OTP request failed'
      });
    }
  }

  /**
   * POST /auth/verify-otp-password-reset
   * Verify OTP for password reset (without setting password)
   */
  async verifyOTPPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email, otpCode } = req.body;

      if (!email || !otpCode) {
        res.status(400).json({
          success: false,
          message: 'Email and OTP code are required'
        });
        return;
      }

      const resetToken = await authService.verifyOTPForPasswordReset(email, otpCode);

      res.json({
        success: true,
        message: 'OTP verified successfully. You can now set your new password.',
        data: { resetToken }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'OTP verification failed'
      });
    }
  }

  /**
   * POST /auth/set-password
   * Set new password after OTP verification
   */
  async setPasswordWithToken(req: Request, res: Response): Promise<void> {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
        return;
      }

      await authService.setPasswordWithToken(resetToken, newPassword);

      res.json({
        success: true,
        message: 'Password set successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Password set failed'
      });
    }
  }
}

export const authController = new AuthController();