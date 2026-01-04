import * as nodemailer from 'nodemailer';
import { logInfo, logError } from '../utils/logger';

export interface EmailOptions {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface OTPData {
  email: string;
  otpCode: string;
  purpose: 'registration' | 'password_reset' | 'admin_registration';
  expiresIn: number;
}

export class EmailService {
  private transporter: nodemailer.Transporter;


  constructor() {
    // Try to load environment variables manually if dotenv didn't work
    require('dotenv').config();
    
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const isSecure = smtpPort === 465;
    
    // Debug logging for SMTP configuration
    console.log('SMTP Configuration:', {
      host: smtpHost,
      port: smtpPort,
      secure: isSecure,
      user: smtpUser ? smtpUser.substring(0, 3) + '***' : 'undefined',
      pass: smtpPass ? '***' : 'undefined'
    });
    
    // If credentials are missing, log a warning but don't throw error to allow development
    if (!smtpUser || !smtpPass) {
      console.error('SMTP credentials missing:', { user: !!smtpUser, pass: !!smtpPass });
      console.warn('⚠️  SMTP credentials not configured. Email functionality will be disabled.');
      
      // Create a dummy transporter that logs emails instead of sending them
      this.transporter = {
        sendMail: async (options: any) => {
          console.log('📧 [MOCK EMAIL] Would send email to:', options.to);
          console.log('📧 [MOCK EMAIL] Subject:', options.subject);
          console.log('📧 [MOCK EMAIL] Content preview:', options.html?.substring(0, 100) + '...');
          return { messageId: 'mock-' + Math.random().toString(36).substr(2, 9) };
        }
      } as any;
      return;
    }
    console.log("", smtpHost,)
    console.log("", smtpPass,)
    console.log('', smtpUser)
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // Add additional options for better error handling
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates in development
      }
    });
  }

  
  /**
   * Send OTP email for registration or password reset
   */
  async sendOTP(otpData: OTPData): Promise<void> {
    const { email, otpCode, purpose, expiresIn } = otpData;
    
    logInfo(`EMAIL: Sending ${purpose} OTP to ${email}`);

    const emailContent = this.generateOTPContent(otpCode, purpose, expiresIn);
    
    const mailOptions: EmailOptions = {
      from: process.env.SMTP_USER || 'no-reply@avaflow.ai',
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      logInfo(`EMAIL: OTP sent successfully to ${email}. Message ID: ${result.messageId}`);
    } catch (error) {
      logError(`EMAIL: Failed to send OTP to ${email}`, error);
      console.error('SMTP Error Details:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error ? (error as any).code : undefined,
        command: error instanceof Error ? (error as any).command : undefined,
        response: error instanceof Error ? (error as any).response : undefined
      });
      throw new Error(`Failed to send OTP email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send verification email for registration
   */
  async sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
    logInfo(`EMAIL: Sending verification email to ${email}`);

    const emailContent = this.generateVerificationContent(verificationToken);
    
    const mailOptions: EmailOptions = {
      from: process.env.SMTP_USER || 'no-reply@avaflow.ai',
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
       
      await this.transporter.sendMail(mailOptions);
      logInfo(`EMAIL: Verification email sent successfully to ${email}`);
    } catch (error) {
      logError(`EMAIL: Failed to send verification email to ${email}`, error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    logInfo(`EMAIL: Sending password reset email to ${email}`);

    const emailContent = this.generatePasswordResetContent(resetToken);
    
    const mailOptions: EmailOptions = {
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logInfo(`EMAIL: Password reset email sent successfully to ${email}`);
    } catch (error) {
      logError(`EMAIL: Failed to send password reset email to ${email}`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Generate OTP email content
   */
  private generateOTPContent(otpCode: string, purpose: string, expiresIn: number): {
    subject: string;
    html: string;
    text: string;
  } {
    const minutes = Math.ceil(expiresIn / 60000);
    const purposeText = purpose === 'registration' ? 'Registration' : 'Password Reset';
    const purposeAction = purpose === 'registration' ? 'complete your registration' : 'reset your password';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${purposeText} OTP</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: #ffffff;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            .otp-box {
                background-color: #e3f2fd;
                border: 2px solid #007bff;
                border-radius: 4px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
            }
            .otp-code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 5px;
                color: #007bff;
                margin: 10px 0;
            }
            .instructions {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 4px;
                border-left: 4px solid #007bff;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #6c757d;
                text-align: center;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 10px 0;
            }
            .security-note {
                font-size: 12px;
                color: #6c757d;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">AVA</div>
                <h1>${purposeText} Verification</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>We received a request to ${purposeAction}. Your verification code is:</p>
            
            <div class="otp-box">
                <div class="otp-code">${otpCode}</div>
                <p style="margin: 0; font-size: 14px; color: #6c757d;">Enter this code to continue</p>
            </div>
            
            <div class="instructions">
                <strong>Instructions:</strong>
                <ul style="margin: 10px 0 0 20px;">
                    <li>Enter the 6-digit code above in the application</li>
                    <li>This code will expire in ${minutes} minutes</li>
                    <li>Do not share this code with anyone</li>
                </ul>
            </div>
            
            <p class="security-note">
                For your security, this code was sent to your registered email address. 
                If you didn't request this, please ignore this email or contact our support team.
            </p>
            
            <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>© ${new Date().getFullYear()} AVA. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
AVA - ${purposeText} Verification

Hello,

We received a request to ${purposeAction}. Your verification code is:

${otpCode}

Instructions:
- Enter this 6-digit code in the application
- This code will expire in ${minutes} minutes
- Do not share this code with anyone

For your security, this code was sent to your registered email address.
If you didn't request this, please ignore this email or contact our support team.

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} AVA. All rights reserved.
    `;

    return {
      subject: `Your ${purposeText} Code: ${otpCode}`,
      html,
      text,
    };
  }

  /**
   * Generate verification email content
   */
  private generateVerificationContent(verificationToken: string): {
    subject: string;
    html: string;
    text: string;
  } {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: #ffffff;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            .verification-box {
                background-color: #e3f2fd;
                border: 2px solid #007bff;
                border-radius: 4px;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
            }
            .verification-code {
                font-size: 24px;
                font-weight: bold;
                letter-spacing: 2px;
                color: #007bff;
                margin: 10px 0;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #6c757d;
                text-align: center;
            }
            .security-note {
                font-size: 12px;
                color: #6c757d;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">AVA</div>
                <h1>Email Verification Required</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>Thank you for registering with AVA! To complete your registration, please verify your email address.</p>
            
            <div class="verification-box">
                <div class="verification-code">${verificationToken}</div>
                <p style="margin: 0; font-size: 14px; color: #6c757d;">Verification Code</p>
            </div>
            
            <p style="text-align: center;">
                <strong>Or click the button below:</strong>
            </p>
            
            <p style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/verify-email?token=${verificationToken}" class="btn">Verify Email Address</a>
            </p>
            
            <p class="security-note">
                This verification link will expire in 24 hours. If you didn't create an account with us, 
                please ignore this email or contact our support team.
            </p>
            
            <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>© ${new Date().getFullYear()} AVA. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
AVA - Email Verification Required

Hello,

Thank you for registering with AVA! To complete your registration, please verify your email address.

Verification Code: ${verificationToken}

Or visit this link to verify your email:
${process.env.CLIENT_URL}/verify-email?token=${verificationToken}

This verification link will expire in 24 hours. If you didn't create an account with us, 
please ignore this email or contact our support team.

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} AVA. All rights reserved.
    `;

    return {
      subject: 'Verify Your Email Address - AVA',
      html,
      text,
    };
  }

  /**
   * Generate password reset email content
   */
  private generatePasswordResetContent(resetToken: string): {
    subject: string;
    html: string;
    text: string;
  } {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: #ffffff;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border: 1px solid #e9ecef;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            .warning-box {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 4px;
                padding: 15px;
                margin: 20px 0;
                color: #856404;
            }
            .btn {
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #6c757d;
                text-align: center;
            }
            .security-note {
                font-size: 12px;
                color: #6c757d;
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">AVA</div>
                <h1>Password Reset Request</h1>
            </div>
            
            <p>Hello,</p>
            
            <p>We received a request to reset your password. If you made this request, click the button below to reset your password:</p>
            
            <p style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/reset-password?token=${resetToken}" class="btn">Reset Password</a>
            </p>
            
            <div class="warning-box">
                <strong>Security Notice:</strong>
                <ul style="margin: 10px 0 0 20px;">
                    <li>This link will expire in 1 hour</li>
                    <li>If you didn't request this reset, please ignore this email</li>
                    <li>Your password will remain unchanged if you don't click the link</li>
                </ul>
            </div>
            
            <p class="security-note">
                For your security, this email was sent to your registered email address. 
                If you didn't request this password reset, please contact our support team immediately.
            </p>
            
            <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>© ${new Date().getFullYear()} AVA. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
AVA - Password Reset Request

Hello,

We received a request to reset your password. If you made this request, visit the link below to reset your password:

${process.env.CLIENT_URL}/reset-password?token=${resetToken}

Security Notice:
- This link will expire in 1 hour
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged if you don't click the link

For your security, this email was sent to your registered email address.
If you didn't request this password reset, please contact our support team immediately.

This is an automated message, please do not reply to this email.
© ${new Date().getFullYear()} AVA. All rights reserved.
    `;

    return {
      subject: 'Reset Your Password - AVA',
      html,
      text,
    };
  }
}

export const emailService = new EmailService();