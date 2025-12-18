import { authValidationSchemas } from '../validations/authValidation';

/**
 * Example test cases for auth validation
 * Run with: npm test -- tests/validations/authValidation.examples.ts
 */

describe('Auth Validation Examples', () => {
  describe('Signup Validation', () => {
    it('should accept valid signup data', () => {
      const validData = {
        email: 'user@example.com',
        password: 'SecurePass123',
        name: 'John Doe',
      };

      const { error } = authValidationSchemas.signup.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'SecurePass123',
      };

      const { error } = authValidationSchemas.signup.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('email');
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'weak',
      };

      const { error } = authValidationSchemas.signup.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('8 characters');
    });

    it('should reject password without uppercase', () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'nouppercase123',
      };

      const { error } = authValidationSchemas.signup.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('uppercase');
    });

    it('should sanitize email by trimming and lowercasing', () => {
      const data = {
        email: '  USER@EXAMPLE.COM  ',
        password: 'SecurePass123',
      };

      const { value, error } = authValidationSchemas.signup.validate(data);
      expect(error).toBeUndefined();
      expect(value.email).toBe('user@example.com');
    });
  });

  describe('Login Validation', () => {
    it('should accept valid login credentials', () => {
      const validData = {
        email: 'user@example.com',
        password: 'anyPassword',
      };

      const { error } = authValidationSchemas.login.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should require both email and password', () => {
      const invalidData = {
        email: 'user@example.com',
      };

      const { error } = authValidationSchemas.login.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('required');
    });
  });

  describe('Password Reset Validation', () => {
    it('should accept valid reset password data', () => {
      const validData = {
        token: 'abc123def456',
        newPassword: 'NewSecure123',
      };

      const { error } = authValidationSchemas.resetPassword.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should require token', () => {
      const invalidData = {
        newPassword: 'NewSecure123',
      };

      const { error } = authValidationSchemas.resetPassword.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('Token');
    });
  });

  describe('OTP Validation', () => {
    it('should accept valid OTP verification data', () => {
      const validData = {
        otpId: '123e4567-e89b-12d3-a456-426614174000',
        code: '123456',
      };

      const { error } = authValidationSchemas.verifyOTP.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid OTP code length', () => {
      const invalidData = {
        otpId: '123e4567-e89b-12d3-a456-426614174000',
        code: '123',
      };

      const { error } = authValidationSchemas.verifyOTP.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('6 digits');
    });

    it('should reject non-numeric OTP code', () => {
      const invalidData = {
        otpId: '123e4567-e89b-12d3-a456-426614174000',
        code: 'abc123',
      };

      const { error } = authValidationSchemas.verifyOTP.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('digits');
    });

    it('should reject invalid UUID for otpId', () => {
      const invalidData = {
        otpId: 'not-a-uuid',
        code: '123456',
      };

      const { error } = authValidationSchemas.verifyOTP.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('Invalid OTP ID');
    });
  });

  describe('Phone Validation (Send OTP)', () => {
    it('should accept valid E.164 phone number', () => {
      const validData = {
        phone: '+1234567890',
      };

      const { error } = authValidationSchemas.sendOTP.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should accept empty object (phone is optional)', () => {
      const validData = {};

      const { error } = authValidationSchemas.sendOTP.validate(validData);
      expect(error).toBeUndefined();
    });

    it('should reject invalid phone format', () => {
      const invalidData = {
        phone: '123',
      };

      const { error } = authValidationSchemas.sendOTP.validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.details[0].message).toContain('E.164');
    });
  });

  describe('Strip Unknown Properties', () => {
    it('should remove unknown properties from signup', () => {
      const dataWithExtras = {
        email: 'user@example.com',
        password: 'SecurePass123',
        name: 'John Doe',
        maliciousField: 'hacker',
        anotherBadField: 'injection',
      };

      const { value, error } = authValidationSchemas.signup.validate(
        dataWithExtras,
        { stripUnknown: true }
      );

      expect(error).toBeUndefined();
      expect(value).toEqual({
        email: 'user@example.com',
        password: 'SecurePass123',
        name: 'John Doe',
      });
      expect(value).not.toHaveProperty('maliciousField');
      expect(value).not.toHaveProperty('anotherBadField');
    });
  });
});
