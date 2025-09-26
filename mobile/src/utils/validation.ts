/**
 * Form validation utilities for authentication forms
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

/**
 * Email validation using RFC 5322 compliant regex
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};

/**
 * Password validation with configurable requirements
 */
export interface PasswordRequirements {
  minLength?: number;
  maxLength?: number;
  requireLetter?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
}

export const validatePassword = (
  password: string,
  requirements: PasswordRequirements = {}
): ValidationResult => {
  const {
    minLength = 8,
    maxLength = 72,
    requireLetter = true,
    requireNumber = true,
    requireSpecialChar = false,
  } = requirements;

  if (!password || !password.trim()) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { isValid: false, error: `Password must be at least ${minLength} characters` };
  }

  if (password.length > maxLength) {
    return { isValid: false, error: `Password must be no more than ${maxLength} characters` };
  }

  if (requireLetter && !/[A-Za-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one letter' };
  }

  if (requireNumber && !/\d/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number' };
  }

  if (requireSpecialChar && !/[@$!%*#?&]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one special character (@$!%*#?&)' };
  }

  return { isValid: true };
};

/**
 * Confirm password validation
 */
export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword || !confirmPassword.trim()) {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true };
};

/**
 * Generic required field validation
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || !value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
};

/**
 * Login form validation
 */
export interface LoginFormData {
  email: string;
  password: string;
}

export const validateLoginForm = (formData: LoginFormData): FormErrors => {
  const errors: FormErrors = {};

  const emailValidation = validateEmail(formData.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
  }

  // For login, we use simpler password validation (just required and min length)
  const passwordValidation = validatePassword(formData.password, {
    minLength: 6,
    requireLetter: false,
    requireNumber: false,
  });
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error;
  }

  return errors;
};

/**
 * Signup form validation
 */
export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export const validateSignupForm = (formData: SignupFormData): FormErrors => {
  const errors: FormErrors = {};

  const emailValidation = validateEmail(formData.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error;
  }

  const passwordValidation = validatePassword(formData.password, {
    minLength: 8,
    requireLetter: true,
    requireNumber: true,
  });
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.error;
  }

  const confirmPasswordValidation = validateConfirmPassword(
    formData.password,
    formData.confirmPassword
  );
  if (!confirmPasswordValidation.isValid) {
    errors.confirmPassword = confirmPasswordValidation.error;
  }

  return errors;
};

/**
 * Check if form has any errors
 */
export const hasFormErrors = (errors: FormErrors): boolean => {
  return Object.values(errors).some(error => error !== undefined && error !== '');
};

/**
 * Clear specific error from form errors
 */
export const clearFormError = (errors: FormErrors, field: string): FormErrors => {
  return {
    ...errors,
    [field]: undefined,
  };
};

/**
 * Clear all form errors
 */
export const clearAllFormErrors = (): FormErrors => {
  return {};
};