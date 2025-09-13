/**
 * Authentication Loading States and Error Handling Tests
 * 
 * Tests comprehensive loading states and error scenarios:
 * - Loading indicators and user feedback
 * - Network error handling and recovery
 * - Timeout scenarios and retry mechanisms
 * - Form state during loading and errors
 * - User experience during various error conditions
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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

describe('Authentication Loading States and Error Handling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should show loading indicator during login', async () => {
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

      const { getByPlaceholderText, getByText, queryByText } = render(
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
      expect(queryByText('Sign In')).toBeNull();

      // Button should be disabled
      expect(loginButton.props.accessibilityState.disabled).toBe(true);

      // Resolve login
      act(() => {
        resolveLogin!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });

    it('should show loading indicator during signup', async () => {
      let resolveSignup: (value: any) => void;
      const signupPromise = new Promise<any>(resolve => {
        resolveSignup = resolve;
      });
      mockAuthService.signup.mockReturnValue(signupPromise);

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
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(signupButton);

      // Should show loading state
      expect(getByText('Creating Account...')).toBeTruthy();

      // Form should be disabled
      expect(signupButton.props.accessibilityState.disabled).toBe(true);

      // Resolve signup
      act(() => {
        resolveSignup!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(mockProps.onSignupSuccess).toHaveBeenCalled();
      });
    });

    it('should prevent multiple submissions during loading', async () => {
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

      // Multiple rapid presses
      fireEvent.press(loginButton);
      fireEvent.press(loginButton);
      fireEvent.press(loginButton);

      // Should only call login once
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);

      // Resolve login
      act(() => {
        resolveLogin!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });

    it('should disable form inputs during loading', async () => {
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

      // Inputs should be disabled during loading
      expect(emailInput.props.editable).toBe(false);
      expect(passwordInput.props.editable).toBe(false);
      expect(loginButton.props.accessibilityState.disabled).toBe(true);

      // Resolve login
      act(() => {
        resolveLogin!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network connection errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Network request failed'));

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

      await waitFor(() => {
        expect(getByText('Network error occurred. Please try again.')).toBeTruthy();
      });

      expect(mockProps.onLoginSuccess).not.toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Request timeout'));

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

      await waitFor(() => {
        expect(getByText('Request timed out. Please try again.')).toBeTruthy();
      });
    });

    it('should handle server errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Internal server error'));

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

      await waitFor(() => {
        expect(getByText('Server error occurred. Please try again later.')).toBeTruthy();
      });
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle invalid credentials error', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

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
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Invalid email or password. Please try again.')).toBeTruthy();
      });
    });

    it('should handle email already exists error during signup', async () => {
      mockAuthService.signup.mockRejectedValue(new Error('Email already exists'));

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

      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText('An account with this email already exists. Please try logging in instead.')).toBeTruthy();
      });
    });

    it('should handle account locked error', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Account locked'));

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

      fireEvent.changeText(emailInput, 'locked@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Account temporarily locked. Please try again later.')).toBeTruthy();
      });
    });
  });

  describe('Error Recovery and Retry', () => {
    it('should allow retry after network error', async () => {
      // First attempt fails
      mockAuthService.login
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({
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

      // First attempt
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Network error occurred. Please try again.')).toBeTruthy();
      });

      // Retry
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });

      expect(mockAuthService.login).toHaveBeenCalledTimes(2);
    });

    it('should clear errors when user modifies form', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

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

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Invalid email or password. Please try again.')).toBeTruthy();
      });

      // Modify password
      fireEvent.changeText(passwordInput, 'newpassword');

      await waitFor(() => {
        expect(queryByText('Invalid email or password. Please try again.')).toBeNull();
      });
    });

    it('should provide retry button for certain errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Network request failed'));

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

      await waitFor(() => {
        expect(getByText('Network error occurred. Please try again.')).toBeTruthy();
      });

      // Should be able to retry by pressing the button again
      expect(loginButton).toBeTruthy();
      expect(loginButton.props.accessibilityState.disabled).toBe(false);
    });
  });

  describe('Form State During Errors', () => {
    it('should preserve form values after error', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

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
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Invalid email or password. Please try again.')).toBeTruthy();
      });

      // Form values should be preserved
      expect(emailInput.props.value).toBe('test@example.com');
      expect(passwordInput.props.value).toBe('wrongpassword');
    });

    it('should re-enable form after error', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Network request failed'));

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

      await waitFor(() => {
        expect(getByText('Network error occurred. Please try again.')).toBeTruthy();
      });

      // Form should be re-enabled after error
      expect(emailInput.props.editable).toBe(true);
      expect(passwordInput.props.editable).toBe(true);
      expect(loginButton.props.accessibilityState.disabled).toBe(false);
    });
  });

  describe('Error Message Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

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
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        const errorMessage = getByText('Invalid email or password. Please try again.');
        expect(errorMessage.props.accessibilityLiveRegion).toBe('polite');
        expect(errorMessage.props.accessibilityRole).toBe('alert');
      });
    });

    it('should provide clear error descriptions', async () => {
      const errorScenarios = [
        { error: 'Network request failed', expectedMessage: 'Network error occurred. Please try again.' },
        { error: 'Invalid credentials', expectedMessage: 'Invalid email or password. Please try again.' },
        { error: 'Email already exists', expectedMessage: 'An account with this email already exists. Please try logging in instead.' },
        { error: 'Request timeout', expectedMessage: 'Request timed out. Please try again.' },
      ];

      for (const scenario of errorScenarios) {
        mockAuthService.login.mockRejectedValue(new Error(scenario.error));

        const mockProps = {
          onLoginSuccess: jest.fn(),
          onNavigateToSignup: jest.fn(),
          onBack: jest.fn(),
        };

        const { getByPlaceholderText, getByText, unmount } = render(
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

        await waitFor(() => {
          expect(getByText(scenario.expectedMessage)).toBeTruthy();
        });

        unmount();
        jest.clearAllMocks();
      }
    });
  });

  describe('Loading State Performance', () => {
    it('should handle long-running operations gracefully', async () => {
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

      // Should maintain loading state for extended period
      expect(getByText('Signing In...')).toBeTruthy();

      // Simulate long delay
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(getByText('Signing In...')).toBeTruthy();

      // Resolve after delay
      act(() => {
        resolveLogin!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(() => {
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });
  });
});