/**
 * Comprehensive Authentication Flow Integration Tests
 * 
 * Tests the complete authentication user journey including:
 * - Login/Signup form interactions
 * - Validation feedback
 * - Loading states and error handling
 * - Navigation integration
 * - Auth guard behavior
 * - State management integration
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { configureStore } from '@reduxjs/toolkit';

import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { RootNavigator } from '../navigation/RootNavigator';
import { AuthGuard, RequireAuth } from '../components/AuthGuard';
import { authService } from '../services/authService';
import guessingGameReducer from '../store/slices/guessingGameSlice';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { Text, View } from 'react-native';

// Mock the auth service
jest.mock('../services/authService', () => ({
  authService: {
    initialize: jest.fn(),
    getCurrentUser: jest.fn(),
    getAuthStatus: jest.fn(),
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
  },
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test store setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
      challengeCreation: challengeCreationReducer,
    },
  });
};

// Test wrapper component
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

// Mock protected component for testing auth guards
const ProtectedComponent: React.FC = () => (
  <View>
    <Text>Protected Content</Text>
  </View>
);

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.initialize.mockResolvedValue();
  });

  describe('Complete Login Flow', () => {
    it('should complete successful login flow with proper state transitions', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuthService.login.mockResolvedValue(mockUser);
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: mockUser,
        hasValidToken: true,
      });

      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Fill in valid credentials
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');

      // Submit form
      fireEvent.press(loginButton);

      // Verify loading state appears
      await waitFor(() => {
        expect(getByText('Signing In...')).toBeTruthy();
      });

      // Wait for login completion
      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });

      // Verify no error messages
      expect(queryByText('Invalid credentials')).toBeNull();
    });

    it('should handle login failure with proper error display', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Fill in credentials
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(getByText('Invalid email or password. Please try again.')).toBeTruthy();
      });

      expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    });

    it('should validate form fields before submission', async () => {
      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const loginButton = getByText('Sign In');
      fireEvent.press(loginButton);

      // Verify validation errors appear
      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
        expect(getByText('Password is required')).toBeTruthy();
      });

      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(mockOnLoginSuccess).not.toHaveBeenCalled();
    });

    it('should clear validation errors when user starts typing', async () => {
      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Trigger validation errors
      const loginButton = getByText('Sign In');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Email is required')).toBeTruthy();
      });

      // Start typing to clear error
      const emailInput = getByPlaceholderText('Enter your email');
      fireEvent.changeText(emailInput, 'test@example.com');

      await waitFor(() => {
        expect(queryByText('Email is required')).toBeNull();
      });
    });
  });

  describe('Complete Signup Flow', () => {
    it('should complete successful signup flow with validation', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuthService.signup.mockResolvedValue(mockUser);

      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Fill in valid form data
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');

      // Submit form
      fireEvent.press(signupButton);

      // Verify loading state
      await waitFor(() => {
        expect(getByText('Creating Account...')).toBeTruthy();
      });

      // Wait for signup completion
      await waitFor(() => {
        expect(mockAuthService.signup).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockOnSignupSuccess).toHaveBeenCalled();
      });
    });

    it('should handle email already exists error', async () => {
      mockAuthService.signup.mockRejectedValue(new Error('Email already exists'));

      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Fill in form
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      fireEvent.changeText(emailInput, 'existing@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'password123');
      fireEvent.press(signupButton);

      // Wait for error message
      await waitFor(() => {
        expect(getByText('An account with this email already exists. Please try logging in instead.')).toBeTruthy();
      });

      expect(mockOnSignupSuccess).not.toHaveBeenCalled();
    });

    it('should validate password confirmation', async () => {
      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Fill in mismatched passwords
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Create a password');
      const confirmPasswordInput = getByPlaceholderText('Confirm your password');
      const signupButton = getByText('Create Account');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.changeText(confirmPasswordInput, 'different123');
      fireEvent.press(signupButton);

      // Verify validation error
      await waitFor(() => {
        expect(getByText('Passwords do not match')).toBeTruthy();
      });

      expect(mockAuthService.signup).not.toHaveBeenCalled();
    });
  });

  describe('Auth Guard Integration', () => {
    it('should show login prompt for unauthenticated users accessing protected content', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <RequireAuth>
            <ProtectedComponent />
          </RequireAuth>
        </TestWrapper>
      );

      expect(queryByText('Protected Content')).toBeNull();
      expect(getByText('Authentication Required')).toBeTruthy();
      expect(getByText('Please sign in to access this feature')).toBeTruthy();
    });

    it('should allow access to protected content for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <RequireAuth>
            <ProtectedComponent />
          </RequireAuth>
        </TestWrapper>
      );

      expect(getByText('Protected Content')).toBeTruthy();
    });

    it('should show guest prompt when configured', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const mockOnAuthPrompt = jest.fn();

      const { getByText } = render(
        <TestWrapper>
          <AuthGuard showGuestPrompt={true} onAuthPrompt={mockOnAuthPrompt}>
            <ProtectedComponent />
          </AuthGuard>
        </TestWrapper>
      );

      expect(getByText('Protected Content')).toBeTruthy();
      expect(getByText('Sign in to save your progress and compete with friends')).toBeTruthy();

      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      expect(mockOnAuthPrompt).toHaveBeenCalled();
    });
  });

  describe('Navigation Integration', () => {
    it('should handle navigation between login and signup screens', () => {
      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const signupLink = getByText('Sign up');
      fireEvent.press(signupLink);

      expect(mockOnNavigateToSignup).toHaveBeenCalled();
    });

    it('should handle back navigation from auth screens', () => {
      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const backButton = getByText('← Back');
      fireEvent.press(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('Error Recovery Flow', () => {
    it('should allow retry after network error', async () => {
      // First attempt fails
      mockAuthService.login
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        });

      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      // Fill form and submit
      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Wait for error
      await waitFor(() => {
        expect(getByText('Network error occurred. Please try again.')).toBeTruthy();
      });

      // Retry
      fireEvent.press(loginButton);

      // Wait for success
      await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });

      expect(mockAuthService.login).toHaveBeenCalledTimes(2);
    });

    it('should clear errors when switching between login and signup', async () => {
      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const { getByPlaceholderText, getByText, queryByText, rerender } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Trigger error on login screen
      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Invalid email or password. Please try again.')).toBeTruthy();
      });

      // Switch to signup screen
      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();

      rerender(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      // Error should not persist on signup screen
      expect(queryByText('Invalid email or password. Please try again.')).toBeNull();
    });
  });

  describe('Loading States and User Feedback', () => {
    it('should show appropriate loading states during authentication', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise<any>(resolve => {
        resolveLogin = resolve;
      });
      mockAuthService.login.mockReturnValue(loginPromise);

      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const passwordInput = getByPlaceholderText('Enter your password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(emailInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Verify loading state
      expect(getByText('Signing In...')).toBeTruthy();
      expect(queryByText('Sign In')).toBeNull();

      // Resolve login
      act(() => {
        resolveLogin!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        });
      });

      await waitFor(() => {
        expect(mockOnLoginSuccess).toHaveBeenCalled();
      });
    });

    it('should disable form inputs during submission', async () => {
      let resolveSignup: (value: any) => void;
      const signupPromise = new Promise<any>(resolve => {
        resolveSignup = resolve;
      });
      mockAuthService.signup.mockReturnValue(signupPromise);

      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
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

      // Verify button is disabled during loading
      expect(signupButton.props.accessibilityState.disabled).toBe(true);

      // Resolve signup
      act(() => {
        resolveSignup!({
          id: 'user_123',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        });
      });

      await waitFor(() => {
        expect(mockOnSignupSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate email format in real-time', async () => {
      const mockOnLoginSuccess = jest.fn();
      const mockOnNavigateToSignup = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <LoginScreen
            onLoginSuccess={mockOnLoginSuccess}
            onNavigateToSignup={mockOnNavigateToSignup}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const emailInput = getByPlaceholderText('Enter your email');
      const loginButton = getByText('Sign In');

      // Enter invalid email
      fireEvent.changeText(emailInput, 'invalid-email');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(getByText('Please enter a valid email address')).toBeTruthy();
      });

      // Fix email
      fireEvent.changeText(emailInput, 'valid@example.com');

      await waitFor(() => {
        expect(queryByText('Please enter a valid email address')).toBeNull();
      });
    });

    it('should validate password strength requirements', async () => {
      const mockOnSignupSuccess = jest.fn();
      const mockOnNavigateToLogin = jest.fn();
      const mockOnBack = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SignupScreen
            onSignupSuccess={mockOnSignupSuccess}
            onNavigateToLogin={mockOnNavigateToLogin}
            onBack={mockOnBack}
          />
        </TestWrapper>
      );

      const passwordInput = getByPlaceholderText('Create a password');
      const signupButton = getByText('Create Account');

      // Test weak password
      fireEvent.changeText(passwordInput, 'weak');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText('Password must be at least 8 characters')).toBeTruthy();
      });

      // Test password without numbers
      fireEvent.changeText(passwordInput, 'onlyletters');
      fireEvent.press(signupButton);

      await waitFor(() => {
        expect(getByText('Password must contain at least one letter and one number')).toBeTruthy();
      });
    });
  });
});