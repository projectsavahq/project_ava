import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/schemas/User';
import { Admin, IAdmin } from '../models/schemas/Admin';
import { logAuth, logError, logInfo, logWarn } from '../utils/logger';
import { emailService } from './emailService';

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
  async signup(signupData: SignupData): Promise<{ user: IUser }> {
    const { email, name, password } = signupData;
    
    logInfo(`AUTH: Starting signup process for ${email}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      logAuth.signup(email, false);
      logWarn(`AUTH: Signup failed - user already exists: ${email}`);
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate email verification token (5-digit number)
    const verificationToken = Math.floor(10000 + Math.random() * 90000).toString();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with password history
    const user = new User({
      userId: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires,
      loginAttempts: 0,
      passwordHistory: [{
        password: hashedPassword,
        createdAt: new Date()
      }]
    });

    await user.save();
    
    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      logError(`AUTH: Failed to send verification email to ${email}`, error);
      // Don't throw error here, user is still created, they can request resend
    }
    
    logAuth.signup(email, true);
    logInfo(`AUTH: User created successfully: ${email}`);

    return { user };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<IUser> {
    logInfo(`AUTH: Email verification attempt with token`);
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.emailVerification('unknown', false);
      logWarn(`AUTH: Email verification failed - invalid or expired token`);
      throw new Error('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    logAuth.emailVerification(user.email, true);
    logInfo(`AUTH: Email verified successfully: ${user.email}`);

    return user;
  }

  /**
   * Login user
   */
  async login(loginData: LoginData): Promise<AuthResponse> {
    const { email, password } = loginData;
    
    logInfo(`AUTH: Login attempt for ${email}`);

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      logAuth.login(email, false, 'User not found');
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      logAuth.login(email, false, 'Account locked');
      logWarn(`AUTH: Login blocked - account locked: ${email}`);
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      logAuth.login(email, false, 'Email not verified');
      logWarn(`AUTH: Login blocked - email not verified: ${email}`);
      throw new Error('Please verify your email before logging in');
    }

    // Verify password
    if (!user.password) {
      logAuth.login(email, false, 'No password set');
      logError(`AUTH: Login failed - no password set for account: ${email}`);
      throw new Error('Password not set for this account');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logAuth.login(email, false, 'Invalid password');
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
    
    logAuth.login(email, true);
    logInfo(`AUTH: Login successful: ${email}`);

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
    logInfo(`AUTH: Password change attempt for user: ${userId}`);
    
    const user = await User.findOne({ userId });
    if (!user) {
      logError(`AUTH: Password change failed - user not found: ${userId}`);
      throw new Error('User not found');
    }

    // If user already has a password, verify current password
    if (user.password && currentPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        logAuth.passwordChange(user.email, false);
        logWarn(`AUTH: Password change failed - incorrect current password: ${user.email}`);
        throw new Error('Current password is incorrect');
      }
    }

    // Check password history (last 4 passwords)
    if (user.passwordHistory.length > 0) {
      const recentPasswords = user.passwordHistory.slice(-4);
      for (const oldPassword of recentPasswords) {
        const isSameAsOldPassword = await bcrypt.compare(newPassword, oldPassword.password);
        if (isSameAsOldPassword) {
          logAuth.passwordChange(user.email, false);
          logWarn(`AUTH: Password change failed - reusing recent password: ${user.email}`);
          throw new Error('Cannot reuse recent passwords');
        }
      }
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    
    // Add new password to history
    user.passwordHistory.push({
      password: hashedPassword,
      createdAt: new Date()
    });

    // Keep only last 4 passwords in history
    if (user.passwordHistory.length > 4) {
      user.passwordHistory = user.passwordHistory.slice(-4);
    }

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();

    await user.save();
    
    logAuth.passwordChange(user.email, true);
    logInfo(`AUTH: Password changed successfully: ${user.email}`);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    logInfo(`AUTH: Token refresh attempt`);
    
    try {
      const payload = jwt.verify(refreshToken, this.REFRESH_SECRET) as any;
      const user = await User.findOne({ userId: payload.userId });

      if (!user || !user.emailVerified) {
        logAuth.tokenRefresh('unknown', false);
        logWarn(`AUTH: Token refresh failed - invalid token or unverified user`);
        throw new Error('Invalid refresh token');
      }
      
      logAuth.tokenRefresh(user.email, true);
      logInfo(`AUTH: Token refreshed successfully: ${user.email}`);

      return this.generateTokens(user);
    } catch (error) {
      logAuth.tokenRefresh('unknown', false);
      logError(`AUTH: Token refresh failed`, error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Forgot password - generate reset token
   */
  async forgotPassword(email: string): Promise<void> {
    logInfo(`AUTH: Password reset request for ${email}`);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not
      logAuth.passwordReset(email, 'REQUEST', false);
      logWarn(`AUTH: Password reset request for non-existent email: ${email}`);
      // Still return success to not reveal if email exists
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();
    
    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
      logAuth.passwordReset(email, 'REQUEST', true);
      logInfo(`AUTH: Password reset email sent to ${email}`);
    } catch (error) {
      logError(`AUTH: Failed to send password reset email to ${email}`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    logInfo(`AUTH: Password reset attempt with token`);
    
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.passwordReset('unknown', 'RESET', false);
      logWarn(`AUTH: Password reset failed - invalid or expired token`);
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
    
    logAuth.passwordReset(user.email, 'RESET', true);
    logInfo(`AUTH: Password reset completed successfully: ${user.email}`);
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<IUser> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as any;
      const user = await User.findOne({ userId: payload.userId });

      if (!user || !user.emailVerified) {
        logWarn(`AUTH: Token validation failed - invalid token or unverified user`);
        throw new Error('Invalid token');
      }

      return user;
    } catch (error) {
      logError(`AUTH: Token validation failed`, error);
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
    const previousAttempts = user.loginAttempts;
    user.loginAttempts += 1;

    // Lock account if max attempts reached
    if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + this.LOCK_TIME);
      logAuth.accountLock(user.email, user.loginAttempts);
      logWarn(`AUTH: Account locked after ${user.loginAttempts} failed attempts: ${user.email}`);
    } else {
      logWarn(`AUTH: Failed login attempt ${user.loginAttempts}/${this.MAX_LOGIN_ATTEMPTS} for ${user.email}`);
    }

    await user.save();
  }

  /**
   * Send OTP for additional security
   */
  async sendOTP(userId: string, phone?: string): Promise<{ otpId: string }> {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error('User not found');
    }

    // Generate 5-digit OTP code
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const otpId = crypto.randomUUID();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP details in user
    user.otpId = otpId;
    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // TODO: Integrate with Clark OTP service to send via SMS
    // For now, log the code (in production, send via SMS)
    console.log(`OTP for user ${userId}: ${otpCode} (expires at ${otpExpires})`);

    return { otpId };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(otpId: string, code: string): Promise<boolean> {
    const user = await User.findOne({ otpId });
    if (!user || !user.otpCode || !user.otpExpires) {
      return false;
    }

    // Check if expired
    if (user.otpExpires < new Date()) {
      // Clear expired OTP
      user.otpId = undefined;
      user.otpCode = undefined;
      user.otpExpires = undefined;
      await user.save();
      return false;
    }

    // Check code
    if (user.otpCode !== code) {
      return false;
    }

    // Clear OTP on successful verification
    user.otpId = undefined;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    return true;
  }

  /**
   * Register user with OTP verification
   */
  async signupWithOTP(signupData: SignupData): Promise<{ user: IUser }> {
    const { email, name, password } = signupData;
    
    logInfo(`AUTH: Starting OTP signup process for ${email}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      logAuth.signup(email, false);
      logWarn(`AUTH: OTP signup failed - user already exists: ${email}`);
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate OTP code (5-digit number)
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create user with OTP and password history
    const user = new User({
      userId: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      emailVerified: false,
      otpCode: otpCode,
      otpExpires: otpExpires,
      loginAttempts: 0,
      passwordHistory: [{
        password: hashedPassword,
        createdAt: new Date()
      }]
    });

    await user.save();
    
    // Send OTP email
    try {
      await emailService.sendOTP({
        email,
        otpCode,
        purpose: 'registration',
        expiresIn: 5 * 60 * 1000
      });
    } catch (error) {
      logError(`AUTH: Failed to send OTP email to ${email}`, error);
      // Clean up user if email fails
      await User.deleteOne({ _id: user._id });
      throw new Error('Failed to send verification email');
    }
    
    logAuth.signup(email, true);
    logInfo(`AUTH: OTP signup successful, OTP sent to ${email}`);

    return { user };
  }

  /**
   * Verify OTP for registration
   */
  async verifyOTPForRegistration(email: string, otpCode: string): Promise<IUser> {
    logInfo(`AUTH: OTP verification attempt for registration: ${email}`);
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      otpCode,
      otpExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.otpVerification(email, false, 'Invalid or expired OTP');
      logWarn(`AUTH: OTP verification failed - invalid or expired OTP: ${email}`);
      throw new Error('Invalid or expired OTP');
    }

    // Mark email as verified and clear OTP
    user.emailVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    logAuth.otpVerification(email, true, 'Registration');
    logInfo(`AUTH: OTP verification successful for registration: ${email}`);

    return user;
  }

  /**
   * Request OTP for password reset
   */
  async requestPasswordResetOTP(email: string): Promise<void> {
    logInfo(`AUTH: OTP password reset request for ${email}`);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not
      logAuth.passwordReset(email, 'OTP_REQUEST', false);
      logWarn(`AUTH: OTP password reset request for non-existent email: ${email}`);
      return;
    }

    // Generate OTP code (5-digit number)
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();
    
    // Send OTP email
    try {
      await emailService.sendOTP({
        email,
        otpCode,
        purpose: 'password_reset',
        expiresIn: 5 * 60 * 1000
      });
      logAuth.passwordReset(email, 'OTP_REQUEST', true);
      logInfo(`AUTH: OTP password reset sent to ${email}`);
    } catch (error) {
      logError(`AUTH: Failed to send OTP password reset email to ${email}`, error);
      throw new Error('Failed to send OTP email');
    }
  }

  /**
   * Verify OTP for password reset (without setting password)
   */
  async verifyOTPForPasswordReset(email: string, otpCode: string): Promise<string> {
    logInfo(`AUTH: OTP verification for password reset: ${email}`);
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      otpCode,
      otpExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.otpVerification(email, false, 'Password Reset');
      logWarn(`AUTH: OTP verification failed - invalid or expired OTP: ${email}`);
      throw new Error('Invalid or expired OTP');
    }

    // Generate a temporary reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    // Clear OTP
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();
    
    logAuth.otpVerification(email, true, 'Password Reset');
    logInfo(`AUTH: OTP verified successfully for password reset: ${email}`);

    return resetToken;
  }

  /**
   * Create password with reset token (after OTP verification)
   */
  async createPasswordWithToken(resetToken: string, newPassword: string): Promise<void> {
    logInfo(`AUTH: Creating password with reset token`);
    
    const user = await User.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.passwordReset('unknown', 'RESET', false);
      logWarn(`AUTH: Password creation failed - invalid or expired token`);
      throw new Error('Invalid or expired reset token');
    }

    // Check against password history (last 4 passwords)
    if (user.passwordHistory.length > 0) {
      const recentPasswords = user.passwordHistory.slice(-4);
      for (const oldPassword of recentPasswords) {
        const isSameAsOldPassword = await bcrypt.compare(newPassword, oldPassword.password);
        if (isSameAsOldPassword) {
          throw new Error('Cannot reuse recent passwords');
        }
      }
    }

    // Hash and set new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    
    // Add new password to history
    user.passwordHistory.push({
      password: hashedPassword,
      createdAt: new Date()
    });

    // Keep only last 4 passwords in history
    if (user.passwordHistory.length > 4) {
      user.passwordHistory = user.passwordHistory.slice(-4);
    }

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();
    
    logAuth.passwordReset(user.email, 'RESET', true);
    logInfo(`AUTH: Password created successfully: ${user.email}`);
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateData: { name?: string; preferences?: any }): Promise<IUser> {
    logInfo(`AUTH: Updating profile for user: ${userId}`);
    
    const user = await User.findOne({ userId });
    if (!user) {
      logError(`AUTH: Profile update failed - user not found: ${userId}`);
      throw new Error('User not found');
    }

    if (updateData.name !== undefined) {
      user.name = updateData.name;
    }

    if (updateData.preferences !== undefined) {
      user.preferences = { ...user.preferences, ...updateData.preferences };
    }

    user.updatedAt = new Date();
    await user.save();
    
    logInfo(`AUTH: Profile updated successfully: ${user.email}`);

    return user;
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    logInfo(`AUTH: Resending verification email for ${email}`);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      logWarn(`AUTH: Resend verification failed - user not found: ${email}`);
      throw new Error('User not found');
    }

    if (user.emailVerified) {
      logWarn(`AUTH: Resend verification failed - email already verified: ${email}`);
      throw new Error('Email is already verified');
    }

    // Generate new OTP code (5-digit number)
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();
    
    // Send OTP email
    try {
      await emailService.sendOTP({
        email,
        otpCode,
        purpose: 'registration',
        expiresIn: 5 * 60 * 1000
      });
      logInfo(`AUTH: Verification email resent successfully to ${email}`);
    } catch (error) {
      logError(`AUTH: Failed to resend verification email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Verify OTP for password reset and set new password (DEPRECATED - use verifyOTPForPasswordReset + createPasswordWithToken)
   */
  async verifyOTPPasswordReset(email: string, otpCode: string, newPassword: string): Promise<void> {
    logInfo(`AUTH: OTP password reset verification for ${email}`);
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      otpCode,
      otpExpires: { $gt: new Date() }
    });

    if (!user) {
      logAuth.passwordReset(email, 'OTP_RESET', false);
      logWarn(`AUTH: OTP password reset failed - invalid or expired OTP: ${email}`);
      throw new Error('Invalid or expired OTP');
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
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    await user.save();
    
    logAuth.passwordReset(email, 'OTP_RESET', true);
    logInfo(`AUTH: OTP password reset completed successfully: ${email}`);
  }

  /**
   * Admin signup with OTP verification
   */
  async adminSignupWithOTP(signupData: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ admin: IAdmin }> {
    const { email, name, password } = signupData;
    
    logInfo(`AUTH: Starting admin OTP signup process for ${email}`);

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      logAuth.signup(email, false);
      logWarn(`AUTH: Admin OTP signup failed - admin already exists: ${email}`);
      throw new Error('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Generate OTP code (5-digit number)
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create admin with OTP
    const admin = new Admin({
      adminId: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      emailVerified: false,
      otpCode: otpCode,
      otpExpires: otpExpires,
      loginAttempts: 0,
      passwordHistory: []
    });

    await admin.save();
    
    // Send OTP email
    try {
      await emailService.sendOTP({
        email,
        otpCode,
        purpose: 'admin_registration',
        expiresIn: 5 * 60 * 1000
      });
    } catch (error) {
      logError(`AUTH: Failed to send OTP email to ${email}`, error);
      // Clean up admin if email fails
      await Admin.deleteOne({ _id: admin._id });
      throw new Error('Failed to send verification email');
    }
    
    logAuth.signup(email, true);
    logInfo(`AUTH: Admin OTP signup successful, OTP sent to ${email}`);

    return { admin };
  }

  /**
   * Admin login
   */
  async adminLogin(loginData: LoginData): Promise<AuthResponse> {
    const { email, password } = loginData;
    
    logInfo(`AUTH: Admin login attempt for ${email}`);

    // Find admin
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      logAuth.login(email, false, 'Admin not found');
      throw new Error('Invalid email or password');
    }

    // Check if admin is locked
    if (admin.isLocked) {
      logAuth.securityEvent(email, 'Login attempt while locked');
      throw new Error('Admin account is locked. Please try again later.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      admin.loginAttempts = (admin.loginAttempts || 0) + 1;
      
      if (admin.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        admin.lockUntil = new Date(Date.now() + this.LOCK_TIME);
        logAuth.accountLock(email, admin.loginAttempts);
      }
      
      await admin.save();
      logAuth.login(email, false, 'Invalid password');
      throw new Error('Invalid email or password');
    }

    // Reset login attempts on successful login
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLogin = new Date();
    await admin.save();

    // Generate tokens
    const accessToken = jwt.sign(
      { adminId: admin.adminId, email: admin.email, role: 'admin' },
      this.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const refreshToken = jwt.sign(
      { adminId: admin.adminId, email: admin.email, role: 'admin' },
      this.REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    logAuth.login(email, true);

    return {
      user: {
        id: admin.adminId,
        email: admin.email,
        name: admin.name,
        emailVerified: admin.emailVerified
      },
      tokens: { accessToken, refreshToken }
    };
  }

  /**
   * Verify admin email with token
   */
  async adminVerifyEmail(token: string): Promise<IAdmin> {
    logInfo(`AUTH: Admin email verification attempt with token`);
    
    const admin = await Admin.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });

    if (!admin) {
      logAuth.emailVerification('unknown', false);
      logWarn(`AUTH: Admin email verification failed - invalid or expired token`);
      throw new Error('Invalid or expired verification token');
    }

    // Clear verification token and mark as verified
    admin.emailVerified = true;
    admin.emailVerificationToken = undefined;
    admin.emailVerificationExpires = undefined;
    await admin.save();

    logAuth.emailVerification(admin.email, true);
    logInfo(`AUTH: Admin email verified successfully: ${admin.email}`);

    return admin;
  }

  /**
   * Verify OTP for admin registration
   */
  async verifyAdminOTPForRegistration(email: string, otpCode: string): Promise<IAdmin> {
    logInfo(`AUTH: Admin OTP verification attempt for registration: ${email}`);
    
    const admin = await Admin.findOne({
      email: email.toLowerCase(),
      otpCode,
      otpExpires: { $gt: new Date() }
    });

    if (!admin) {
      logAuth.otpVerification(email, false, 'Invalid or expired OTP');
      logWarn(`AUTH: Admin OTP verification failed - invalid or expired OTP: ${email}`);
      throw new Error('Invalid or expired OTP');
    }

    // Mark email as verified and clear OTP
    admin.emailVerified = true;
    admin.otpCode = undefined;
    admin.otpExpires = undefined;
    await admin.save();
    
    logAuth.otpVerification(email, true, 'Admin Registration');
    logInfo(`AUTH: Admin OTP verification successful for registration: ${email}`);

    return admin;
  }
}

export const authService = new AuthService();