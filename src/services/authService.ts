import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/schemas/User';

export interface SignupData {
  email: string;
  name?: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name?: string;
    emailVerified: boolean;
  };
  tokens: AuthTokens;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret';
  private readonly SALT_ROUNDS = 12;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Register a new user
   */
  async signup(signupData: SignupData): Promise<{ user: IUser; verificationToken: string }> {
    const { email, name, password } = signupData;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = new User({
      userId: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      loginAttempts: 0,
      passwordHistory: []
    });

    await user.save();

    return { user, verificationToken };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<IUser> {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return user;
  }

  /**
   * Login user
   */
  async login(loginData: LoginData): Promise<AuthResponse> {
    const { email, password } = loginData;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error('Please verify your email before logging in');
    }

    // Verify password
    if (!user.password) {
      throw new Error('Password not set for this account');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Increment login attempts
      await this.handleFailedLogin(user);
      throw new Error('Invalid credentials');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified
      },
      tokens
    };
  }

  /**
   * Set/Update user password
   */
  async setPassword(userId: string, newPassword: string, currentPassword?: string): Promise<void> {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    // If user already has a password, verify current password
    if (user.password && currentPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
    }

    // Check password history (last 5 passwords)
    if (user.passwordHistory.length > 0) {
      for (const oldPassword of user.passwordHistory) {
        const isSameAsOldPassword = await bcrypt.compare(newPassword, oldPassword.password);
        if (isSameAsOldPassword) {
          throw new Error('Cannot reuse recent passwords');
        }
      }
    }

    // Add current password to history if it exists
    if (user.password) {
      user.passwordHistory.push({
        password: user.password,
        createdAt: new Date()
      });

      // Keep only last 5 passwords
      if (user.passwordHistory.length > 5) {
        user.passwordHistory = user.passwordHistory.slice(-5);
      }
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();

    await user.save();
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, this.REFRESH_SECRET) as any;
      const user = await User.findOne({ userId: payload.userId });

      if (!user || !user.emailVerified) {
        throw new Error('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Forgot password - generate reset token
   */
  async forgotPassword(email: string): Promise<string> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not
      throw new Error('If this email exists, a password reset link has been sent');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    return resetToken;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Check against password history
    if (user.passwordHistory.length > 0) {
      for (const oldPassword of user.passwordHistory) {
        const isSameAsOldPassword = await bcrypt.compare(newPassword, oldPassword.password);
        if (isSameAsOldPassword) {
          throw new Error('Cannot reuse recent passwords');
        }
      }
    }

    // Add current password to history if it exists
    if (user.password) {
      user.passwordHistory.push({
        password: user.password,
        createdAt: new Date()
      });

      // Keep only last 5 passwords
      if (user.passwordHistory.length > 5) {
        user.passwordHistory = user.passwordHistory.slice(-5);
      }
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<IUser> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as any;
      const user = await User.findOne({ userId: payload.userId });

      if (!user || !user.emailVerified) {
        throw new Error('Invalid token');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: IUser): AuthTokens {
    const payload = {
      userId: user.userId,
      email: user.email
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: '15m' // 15 minutes
    });

    const refreshToken = jwt.sign(payload, this.REFRESH_SECRET, {
      expiresIn: '7d' // 7 days
    });

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Handle failed login attempts
   */
  private async handleFailedLogin(user: IUser): Promise<void> {
    user.loginAttempts += 1;

    // Lock account if max attempts reached
    if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + this.LOCK_TIME);
    }

    await user.save();
  }

  /**
   * Send OTP for additional security (placeholder for Clark integration)
   */
  async sendOTP(userId: string, phone?: string): Promise<{ otpId: string }> {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    // TODO: Integrate with Clark OTP service
    // This is a placeholder implementation
    const otpId = crypto.randomUUID();
    
    // In a real implementation, you would:
    // 1. Generate OTP code
    // 2. Send via Clark service
    // 3. Store OTP details with expiration
    
    console.log(`OTP service integration needed for user: ${userId}`);
    
    return { otpId };
  }

  /**
   * Verify OTP (placeholder for Clark integration)
   */
  async verifyOTP(otpId: string, code: string): Promise<boolean> {
    // TODO: Integrate with Clark OTP service
    // This is a placeholder implementation
    
    console.log(`OTP verification needed for otpId: ${otpId}, code: ${code}`);
    
    // In a real implementation, you would verify with Clark service
    return true; // Placeholder
  }
}

export const authService = new AuthService();