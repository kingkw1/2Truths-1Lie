import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRequired,
  validateLoginForm,
  validateSignupForm,
  hasFormErrors,
  clearFormError,
  clearAllFormErrors,
} from '../validation';

describe('validation utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        if (result.isValid) {
          console.log(`Email "${email}" unexpectedly passed validation`);
        }
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should handle empty or whitespace-only emails', () => {
      const result1 = validateEmail('');
      expect(result1.isValid).toBe(false);
      expect(result1.error).toBe('Email is required');

      const result2 = validateEmail('   ');
      expect(result2.isValid).toBe(false);
      expect(result2.error).toBe('Email is required');
    });
  });

  describe('validatePassword', () => {
    it('should validate passwords with default requirements', () => {
      const validPasswords = [
        'password123',
        'Test1234',
        'myPassword1',
        'SecurePass99',
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject passwords that are too short', () => {
      const result = validatePassword('short1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should reject passwords without letters when required', () => {
      const result = validatePassword('12345678');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one letter');
    });

    it('should reject passwords without numbers when required', () => {
      const result = validatePassword('password');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one number');
    });

    it('should validate with custom requirements', () => {
      const result = validatePassword('short', {
        minLength: 4,
        requireLetter: false,
        requireNumber: false,
      });
      expect(result.isValid).toBe(true);
    });

    it('should validate special character requirements', () => {
      const result = validatePassword('password123', {
        requireSpecialChar: true,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least one special character (@$!%*#?&)');

      const validResult = validatePassword('password123!', {
        requireSpecialChar: true,
      });
      expect(validResult.isValid).toBe(true);
    });

    it('should handle empty passwords', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });
  });

  describe('validateConfirmPassword', () => {
    it('should validate matching passwords', () => {
      const result = validateConfirmPassword('password123', 'password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-matching passwords', () => {
      const result = validateConfirmPassword('password123', 'different123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });

    it('should handle empty confirm password', () => {
      const result = validateConfirmPassword('password123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please confirm your password');
    });
  });

  describe('validateRequired', () => {
    it('should validate non-empty values', () => {
      const result = validateRequired('some value', 'Field');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty values', () => {
      const result = validateRequired('', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });

    it('should reject whitespace-only values', () => {
      const result = validateRequired('   ', 'Field');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Field is required');
    });
  });

  describe('validateLoginForm', () => {
    it('should validate correct login form', () => {
      const formData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const errors = validateLoginForm(formData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return errors for invalid login form', () => {
      const formData = {
        email: 'invalid-email',
        password: 'short',
      };

      const errors = validateLoginForm(formData);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
    });
  });

  describe('validateSignupForm', () => {
    it('should validate correct signup form', () => {
      const formData = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      };

      const errors = validateSignupForm(formData);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return errors for invalid signup form', () => {
      const formData = {
        email: 'invalid-email',
        password: 'short',
        confirmPassword: 'different',
      };

      const errors = validateSignupForm(formData);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
      expect(errors.confirmPassword).toBeDefined();
    });
  });

  describe('hasFormErrors', () => {
    it('should return true when errors exist', () => {
      const errors = { email: 'Invalid email', password: 'Too short' };
      expect(hasFormErrors(errors)).toBe(true);
    });

    it('should return false when no errors exist', () => {
      const errors = {};
      expect(hasFormErrors(errors)).toBe(false);
    });

    it('should return false when errors are undefined', () => {
      const errors = { email: undefined, password: undefined };
      expect(hasFormErrors(errors)).toBe(false);
    });
  });

  describe('clearFormError', () => {
    it('should clear specific error', () => {
      const errors = { email: 'Invalid email', password: 'Too short' };
      const result = clearFormError(errors, 'email');
      
      expect(result.email).toBeUndefined();
      expect(result.password).toBe('Too short');
    });
  });

  describe('clearAllFormErrors', () => {
    it('should return empty errors object', () => {
      const result = clearAllFormErrors();
      expect(result).toEqual({});
    });
  });
});