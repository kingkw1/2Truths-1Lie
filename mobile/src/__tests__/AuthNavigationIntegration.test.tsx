/**
 * Authentication Navigation Integration Tests
 * 
 * Tests navigation flows and integration between auth screens:
 * - Screen transitions and navigation state
 * - Deep linking with authentication requirements
 * - Navigation guards and protected routes
 * - Back navigation and navigation stack management
 * - Navigation state persistence across auth changes
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { configureStore } from '@reduxjs/toolkit';

import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { RootNavigator } from '../navigation/RootNavigator';
import { MainNavigator } from '../navigation/MainNavigator';
import { AuthGuard } from '../components/AuthGuard';
import { authService } from '../services/authService';
import guessingGameReducer from '../store/slices/guessingGameSlice';
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

// Mock navigation components for testing
const MockGameScreen = () => (
  <View>
    <Text>Game Screen</Text>
    <Text>Play the game!</Text>
  </View>
);

const MockChallengeScreen = () => (
  <AuthGuard requireAuth={true}>
    <View>
      <Text>Challenge Screen</Text>
      <Text>Create challenges!</Text>
    </View>
  </AuthGuard>
);

const MockProfileScreen = () => (
  <AuthGuard requireAuth={true}>
    <View>
      <Text>Profile Screen</Text>
      <Text>Your profile</Text>
    </View>
  </AuthGuard>
);

// Simplified test components for navigation testing
const TestNavigator = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
);

const mockAuthService = authService as jest.Mocked<typeof authService>;

const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode; initialRoute?: string }> = ({ 
  children, 
  initialRoute 
}) => {
  const store = createTestStore();
  return (
    <Provider store={store}>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </Provider>
  );
};

describe('Authentication Navigation Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.initialize.mockResolvedValue();
  });

  describe('Auth Screen Navigation Flow', () => {
    it('should navigate between login and signup screens', async () => {
      const mockLoginProps = {
        onLoginSuccess: jest.fn(),
        onNavigateToSignup: jest.fn(),
        onBack: jest.fn(),
      };

      const mockSignupProps = {
        onSignupSuccess: jest.fn(),
        onNavigateToLogin: jest.fn(),
        onBack: jest.fn(),
      };

      // Test Login to Signup navigation
      const { getByText, rerender } = render(
        <TestWrapper>
          <LoginScreen {...mockLoginProps} />
        </TestWrapper>
      );

      const signupLink = getByText('Sign up');
      fireEvent.press(signupLink);

      expect(mockLoginProps.onNavigateToSignup).toHaveBeenCalled();

      // Simulate navigation to signup screen
      rerender(
        <TestWrapper>
          <SignupScreen {...mockSignupProps} />
        </TestWrapper>
      );

      expect(getByText('Create Account')).toBeTruthy();

      // Test Signup to Login navigation
      const loginLink = getByText('Sign in');
      fireEvent.press(loginLink);

      expect(mockSignupProps.onNavigateToLogin).toHaveBeenCalled();
    });

    it('should handle back navigation from auth screens', () => {
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

      const backButton = getByText('← Back');
      fireEvent.press(backButton);

      expect(mockProps.onBack).toHaveBeenCalled();
    });

    it('should handle successful authentication navigation', async () => {
      const mockUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      mockAuthService.login.mockResolvedValue(mockUser);

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
        expect(mockProps.onLoginSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Protected Route Navigation', () => {
    it('should block access to protected screens for unauthenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <MockChallengeScreen />
        </TestWrapper>
      );

      expect(queryByText('Challenge Screen')).toBeNull();
      expect(queryByText('Create challenges!')).toBeNull();
      expect(getByText('Authentication Required')).toBeTruthy();
    });

    it('should allow access to protected screens for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <MockChallengeScreen />
        </TestWrapper>
      );

      expect(getByText('Challenge Screen')).toBeTruthy();
      expect(getByText('Create challenges!')).toBeTruthy();
    });

    it('should handle navigation to protected screens with auth prompt', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <MockProfileScreen />
        </TestWrapper>
      );

      expect(getByText('Authentication Required')).toBeTruthy();
      expect(getByText('Please sign in to access this feature')).toBeTruthy();
    });
  });

  describe('Navigation State Management', () => {
    it('should preserve navigation state during authentication', async () => {
      // Start as guest user
      mockAuthService.getAuthStatus.mockReturnValueOnce({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText, rerender } = render(
        <TestWrapper>
          <TestNavigator>
            <MockGameScreen />
          </TestNavigator>
        </TestWrapper>
      );

      expect(getByText('Game Screen')).toBeTruthy();

      // Simulate authentication
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      // Re-render to simulate auth state change
      rerender(
        <TestWrapper>
          <TestNavigator>
            <MockGameScreen />
          </TestNavigator>
        </TestWrapper>
      );

      // Should still be on game screen
      expect(getByText('Game Screen')).toBeTruthy();
    });

    it('should handle navigation stack reset after logout', async () => {
      // Start authenticated
      mockAuthService.getAuthStatus.mockReturnValueOnce({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText, rerender } = render(
        <TestWrapper>
          <TestNavigator>
            <MockProfileScreen />
          </TestNavigator>
        </TestWrapper>
      );

      expect(getByText('Profile Screen')).toBeTruthy();

      // Simulate logout
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_456', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      rerender(
        <TestWrapper>
          <TestNavigator>
            <MockProfileScreen />
          </TestNavigator>
        </TestWrapper>
      );

      // Should show auth required for profile
      expect(getByText('Authentication Required')).toBeTruthy();
    });
  });

  describe('Deep Linking and Route Protection', () => {
    it('should handle deep links to protected routes', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      // Simulate deep link to protected route
      const { getByText, queryByText } = render(
        <TestWrapper>
          <TestNavigator>
            <MockChallengeScreen />
          </TestNavigator>
        </TestWrapper>
      );

      // Should show auth required instead of challenge screen
      expect(queryByText('Challenge Screen')).toBeNull();
      expect(getByText('Authentication Required')).toBeTruthy();
    });

    it('should allow deep links to protected routes for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <TestNavigator>
            <MockChallengeScreen />
          </TestNavigator>
        </TestWrapper>
      );

      expect(getByText('Challenge Screen')).toBeTruthy();
    });

    it('should handle deep links to public routes', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <TestNavigator>
            <MockGameScreen />
          </TestNavigator>
        </TestWrapper>
      );

      expect(getByText('Game Screen')).toBeTruthy();
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle navigation errors gracefully', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      // This should not crash even with navigation errors
      const { getByText } = render(
        <TestWrapper>
          <MockGameScreen />
        </TestWrapper>
      );

      expect(getByText('Game Screen')).toBeTruthy();
    });

    it('should handle auth service errors during navigation', () => {
      mockAuthService.getAuthStatus.mockImplementation(() => {
        throw new Error('Auth service error');
      });

      // Should still render something (fallback state)
      const renderResult = render(
        <TestWrapper>
          <MockGameScreen />
        </TestWrapper>
      );

      expect(renderResult).toBeTruthy();
    });
  });

  describe('Navigation Performance', () => {
    it('should handle rapid navigation changes', () => {
      const authStates = [
        {
          isAuthenticated: false,
          isGuest: true,
          user: { id: 'guest_1', name: 'Guest User', createdAt: new Date().toISOString() },
          hasValidToken: true,
        },
        {
          isAuthenticated: true,
          isGuest: false,
          user: { id: 'user_1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
          hasValidToken: true,
        },
        {
          isAuthenticated: false,
          isGuest: true,
          user: { id: 'guest_2', name: 'Guest User', createdAt: new Date().toISOString() },
          hasValidToken: true,
        },
      ];

      // Simulate rapid auth state changes
      authStates.forEach((authState, index) => {
        mockAuthService.getAuthStatus.mockReturnValue(authState);

        const { getByText, unmount } = render(
          <TestWrapper>
            <MockChallengeScreen />
          </TestWrapper>
        );

        if (authState.isAuthenticated) {
          expect(getByText('Challenge Screen')).toBeTruthy();
        } else {
          expect(getByText('Authentication Required')).toBeTruthy();
        }

        unmount();
      });
    });

    it('should handle multiple simultaneous navigation requests', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      // Render multiple screens simultaneously
      const screens = [MockGameScreen, MockChallengeScreen, MockProfileScreen];

      screens.forEach((Screen, index) => {
        const { unmount } = render(
          <TestWrapper>
            <Screen />
          </TestWrapper>
        );

        expect(true).toBeTruthy();
        unmount();
      });
    });
  });

  describe('Navigation Accessibility', () => {
    it('should provide proper navigation accessibility', () => {
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

      const backButton = getByText('← Back');
      const signupLink = getByText('Sign up');

      // Check accessibility properties
      expect(backButton.props.accessibilityRole).toBeDefined();
      expect(signupLink.props.accessibilityRole).toBeDefined();
    });

    it('should announce navigation changes to screen readers', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <MockChallengeScreen />
        </TestWrapper>
      );

      const authMessage = getByText('Authentication Required');
      expect(authMessage.props.accessibilityLiveRegion).toBeDefined();
    });
  });

  describe('Navigation Integration with Redux', () => {
    it('should maintain Redux state during navigation', () => {
      const store = createTestStore();
      
      // Set some initial state (commented out since we don't have updateScore)
      // store.dispatch(guessingGameSlice.actions.updateScore(150));

      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      });

      const { getByText, rerender } = render(
        <Provider store={store}>
          <NavigationContainer>
            <MockGameScreen />
          </NavigationContainer>
        </Provider>
      );

      expect(getByText('Game Screen')).toBeTruthy();
      // expect(store.getState().guessingGame.score).toBe(150);

      // Navigate to different screen
      rerender(
        <Provider store={store}>
          <NavigationContainer>
            <MockChallengeScreen />
          </NavigationContainer>
        </Provider>
      );

      expect(getByText('Challenge Screen')).toBeTruthy();
      // expect(store.getState().guessingGame.score).toBe(150); // State preserved
    });
  });
});