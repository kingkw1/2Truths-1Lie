/**
 * Comprehensive Authentication Form Validation Tests
 * 
 * Tests all validation scenarios for login and signup forms:
 * - Real-time validation feedback
 * - Edge cases and boundary conditions
 * - Accessibility compliance
 * - Error message clarity and consistency
 * - Form state management during validation
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { configureStore } from '@reduxjs/toolkit';

import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { authService } from '../services/authService';
import guessingGameReducer from '../store/slices/guessingGameSlice';

// Mock the auth service
jest.mock('../services/authService', () => ({
  authService: {
    login: jest.fn(),
    signup: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = createTestStore();
  return (
    <Provider store={store}>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </Provider>
  );
};

describe('Comprehensive Authentication Form Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Validation Edge Cases', () => {
    const testEmailValidation = async (email: string, expectedError: string | null) => {
      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, email);
      fireEvent.press(loginButton);

      if (expectedError) {
        await waitFor(() => {
          expect(getByText(expectedError)).toBeTruthy();
        });
      } else {
        // Should not have email validation error
        await waitFor(() => {
          expect(queryByText('Please enter a valid email address')).toBeNull();
          expect(queryByText('Email is required')).toBeNull();
        });
      }
    };

    it('should validate various email formats correctly', async () => {
      const testCases = [
        // Valid emails
        { email: 'test@example.com', error: null },
        { email: 'user.name@domain.co.uk', error: null },
        { email: 'user+tag@example.org', error: null },
        { email: 'user123@test-domain.com', error: null },
        { email: 'a@b.co', error: null },
        
        // Invalid emails
        { email: 'invalid-email', error: 'Please enter a valid email address' },
        { email: '@example.com', error: 'Please enter a valid email address' },
        { email: 'user@', error: 'Please enter a valid email address' },
        { email: 'user@.com', error: 'Please enter a valid email address' },
        { email: 'user..name@example.com', error: 'Please enter a valid email address' },
        { email: 'user@example', error: 'Please enter a valid email address' },
        
        // Edge cases
        { email: '', error: 'Email is required' },
        { email: '   ', error: 'Email is required' },
        { email: 'user@example..com', error: 'Please enter a valid email address' },
      ];

      for (const testCase of testCases) {
        await testEmailValidation(testCase.email, testCase.error);
      }
    });

    it('should handle very long email addresses', async () => {
      const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com';
      await testEmailValidation(longEmail, null); // Should be valid

      const tooLongEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      // Depending on implementation, might have length limits
      await testEmailValidation(tooLongEmail, null);
    });

    it('should handle special characters in email', async () => {
      const specialCharEmails = [
        'user+tag@example.com',
        'user.name@example.com',
        'user_name@example.com',
        'user-name@example.com',
      ];

      for (const email of specialCharEmails) {
        await testEmailValidation(email, null);
      }
    });
  });

  describe('Password Validation Comprehensive Tests', () => {
    const testPasswordValidation = async (password: string, expectedError: string | null) => {
      const mockProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <SignupScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const signupButton = getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, password);
      fireEvent.press(signupButton);

      if (expectedError) {
        await waitFor(() => {
          expect(getByText(expectedError)).toBeTruthy();
        });
      } else {
        // Should not have password validation error
        await waitFor(() => {
          expect(queryByText('Password must be at least 8 characters')).toBeNull();
          expect(queryByText('Password must contain at least one letter and one number')).toBeNull();
          expect(queryByText('Password is required')).toBeNull();
        });
      }
    };

    it('should validate password length requirements', async () => {
      const testCases = [
        { password: '', error: 'Password is required' },
        { password: '1', error: 'Password must be at least 8 characters' },
        { password: '12', error: 'Password must be at least 8 characters' },
        { password: '1234567', error: 'Password must be at least 8 characters' },
        { password: '12345678', error: 'Password must contain at least one letter and one number' },
        { password: 'password', error: 'Password must contain at least one letter and one number' },
        { password: 'password1', error: null },
        { password: 'Password123', error: null },
      ];

      for (const testCase of testCases) {
        await testPasswordValidation(testCase.password, testCase.error);
      }
    });

    it('should validate password complexity requirements', async () => {
      const testCases = [
        // Only letters
        { password: 'onlyletters', error: 'Password must contain at least one letter and one number' },
        { password: 'ONLYLETTERS', error: 'Password must contain at least one letter and one number' },
        
        // Only numbers
        { password: '12345678', error: 'Password must contain at least one letter and one number' },
        
        // Valid combinations
        { password: 'password1', error: null },
        { password: 'Password1', error: null },
        { password: '1password', error: null },
        { password: 'pass1word', error: null },
        { password: 'MyPassword123', error: null },
      ];

      for (const testCase of testCases) {
        await testPasswordValidation(testCase.password, testCase.error);
      }
    });

    it('should handle special characters in passwords', async () => {
      const specialCharPasswords = [
        'password1!',
        'password1@',
        'password1#',
        'password1$',
        'password1%',
        'password1^',
        'password1&',
        'password1*',
        'My$ecureP@ss1',
      ];

      for (const password of specialCharPasswords) {
        await testPasswordValidation(password, null);
      }
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(50) + '1';
      await testPasswordValidation(longPassword, null);

      const veryLongPassword = 'a'.repeat(200) + '1';
      await testPasswordValidation(veryLongPassword, null);
    });
  });

  describe('Password Confirmation Validation', () => {
    it('should validate password confirmation matches', async () => {
      const mockProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      const testCases = [
        {
          password: 'password123',
          confirmPassword: 'password123',
          shouldMatch: true,
        },
        {
          password: 'password123',
          confirmPassword: 'different123',
          shouldMatch: false,
        },
        {
          password: 'password123',
          confirmPassword: '',
          shouldMatch: false,
        },
        {
          password: '',
          confirmPassword: 'password123',
          shouldMatch: false,
        },
      ];

      for (const testCase of testCases) {
        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, testCase.password);
        fireEvent.changeText(confirmPasswordInput, testCase.confirmPassword);
        fireEvent.press(signupButton);

        if (testCase.shouldMatch && testCase.password && testCase.confirmPassword) {
          await waitFor(() => {
            expect(mockAuthService.signup).toHaveBeenCalledWith('test@example.com', testCase.password);
          });
        } else {
          if (!testCase.confirmPassword) {
            await waitFor(() => {
              expect(getByText('Please confirm your password')).toBeTruthy();
            });
          } else if (!testCase.shouldMatch) {
            await waitFor(() => {
              expect(getByText('Passwords do not match')).toBeTruthy();
            });
          }
        }

        // Reset for next test
        jest.clearAllMocks();
      }
    });

    it('should handle case-sensitive password confirmation', async () => {
      const mockProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'Password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText('Passwords do not match')).toBeTruthy();
      });
    });
  });

  describe('Real-time Validation Feedback', () => {
    it('should clear errors when user starts typing valid input', async () => {
      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      // Trigger validation errors
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
        expect(getByText('Password is required')).toBeTruthy();
      });

      // Start typing valid email
      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        expect(queryByText('Email is required')).toBeNull();
        expect(queryByText('Please enter a valid email address')).toBeNull();
      });

      // Password error should still be there
      expect(getByText('Password is required')).toBeTruthy();

      // Start typing password
      fireEvent.changeText(passwordInput, 'password123');

      await waitFor(() => {
        expect(queryByText('Password is required')).toBeNull();
      });
    });

    it('should show validation errors immediately for invalid input', async () => {
      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const loginButton = getByText('Sign In');

      // Type invalid email and submit
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Please enter a valid email address')).toBeTruthy();
      });

      // Fix email
      fireEvent.changeText(emailInput, 'valid@example.com');

      await waitFor(() => {
        expect(getByText('Password is required')).toBeTruthy();
      });
    });
  });

  describe('Form State Management During Validation', () => {
    it('should maintain form values during validation errors', async () => {
      const mockProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      // Fill form with mismatched passwords
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'different123');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText('Passwords do not match')).toBeTruthy();
      });

      // Values should be preserved
      expect(emailInput.props.value).toBe('test@example.com');
      expect(passwordInput.props.value).toBe('password123');
      expect(confirmPasswordInput.props.value).toBe('different123');
    });

    it('should reset form state when requested', async () => {
      const mockProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');

      // Fill form
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Navigate away and back (simulating form reset)
      fireEvent.press(getByText('Sign in'));
      expect(mockProps.onNavigateToLogin).toHaveBeenCalled();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper accessibility labels for form fields', () => {
      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');

      // Check accessibility properties
      expect(emailInput.props.accessibilityLabel).toBeDefined();
      expect(passwordInput.props.accessibilityLabel).toBeDefined();
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });

    it('should provide clear error messages for screen readers', async () => {
      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const loginButton = getByText('Sign In');
      fireEvent.press(loginButton);

      await waitFor(() => {
        const emailError = getByText('Email is required');
        const passwordError = getByText('Password is required');

        expect(emailError.props.accessibilityRole).toBeDefined();
        expect(passwordError.props.accessibilityRole).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle rapid form submissions', async () => {
      mockAuthService.login.mockResolvedValue({
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      });

      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Rapid submissions
      fireEvent.press(loginButton);
      fireEvent.press(loginButton);
      fireEvent.press(loginButton);

      // Should only call login once due to loading state
      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle form submission during network delays', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise<any>(resolve => {
        resolveLogin = resolve;
      });
      mockAuthService.login.mockReturnValue(loginPromise);

      const mockProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <LoginScreen {...mockProps} />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Should show loading state
      expect(getByText('Signing In...')).toBeTruthy();

      // Form should be disabled during loading
      expect(loginButton.props.accessibilityState.disabled).toBe(true);

      // Resolve the promise
      resolveLogin!({
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      });

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });
  });
});