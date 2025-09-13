/**
 * Enhanced Navigation Patterns Tests
 * Tests for improved auth screen transitions and navigation flows
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Alert } from 'react-native';
import { RootNavigator } from '../RootNavigator';
import { AuthNavigator } from '../AuthNavigator';
import { MainNavigator } from '../MainNavigator';
import { navigationManager, NavigationManager } from '../navigationUtils';
import { useAuth } from '../../hooks/useAuth';

// Mock dependencies
jest.mock('../../hooks/useAuth');
jest.mock('../../screens/LoginScreen', () => ({
  LoginScreen: ({ onLoginSuccess, onNavigateToSignup, initialEmail, guestMigration }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="login-screen">
        <Text testID="login-title">Login Screen</Text>
        {initialEmail && <Text testID="initial-email">{initialEmail}</Text>}
        {guestMigration && <Text testID="guest-migration">Guest Migration</Text>}
        <TouchableOpacity testID="login-button" onPress={onLoginSuccess}>
          <Text>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="signup-link" onPress={onNavigateToSignup}>
          <Text>Go to Signup</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../screens/SignupScreen', () => ({
  SignupScreen: ({ onSignupSuccess, onNavigateToLogin, onBack, initialEmail, guestMigration }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="signup-screen">
        <Text testID="signup-title">Signup Screen</Text>
        {initialEmail && <Text testID="initial-email">{initialEmail}</Text>}
        {guestMigration && <Text testID="guest-migration">Guest Migration</Text>}
        <TouchableOpacity testID="signup-button" onPress={onSignupSuccess}>
          <Text>Signup</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="login-link" onPress={onNavigateToLogin}>
          <Text>Go to Login</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../screens/GameScreen', () => ({
  GameScreen: ({ onBack }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="game-screen">
        <Text>Game Screen</Text>
        <TouchableOpacity testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../screens/ChallengeCreationScreen', () => ({
  ChallengeCreationScreen: ({ onComplete, onCancel }: any) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    return (
      <View testID="create-screen">
        <Text>Create Screen</Text>
        <TouchableOpacity testID="complete-button" onPress={onComplete}>
          <Text>Complete</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cancel-button" onPress={onCancel}>
          <Text>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../components/AuthGuard', () => ({
  AuthGuard: ({ children, showGuestPrompt, onAuthPrompt }: any) => {
    const { View, TouchableOpacity, Text } = require('react-native');
    return (
      <View testID="auth-guard">
        {showGuestPrompt && (
          <TouchableOpacity testID="auth-prompt" onPress={onAuthPrompt}>
            <Text>Sign In Required</Text>
          </TouchableOpacity>
        )}
        {children}
      </View>
    );
  },
  ConditionalAuthContent: ({ guest, authenticated }: any) => {
    const mockAuth = require('../../hooks/useAuth').useAuth();
    return mockAuth.isAuthenticated ? authenticated : guest;
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Helper function to create complete auth mock
const createAuthMock = (overrides: any = {}) => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  isGuest: false,
  hasValidToken: false,
  login: jest.fn(),
  signup: jest.fn(),
  logout: jest.fn(),
  refreshAuth: jest.fn(),
  checkAuthStatus: jest.fn(),
  ...overrides,
});

describe('Enhanced Navigation Patterns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset navigation manager state
    navigationManager.resetNavigationState();
  });

  describe('RootNavigator', () => {
    it('should show loading state with user context', () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        isLoading: true,
        user: { id: '1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
      }));

      const { getByText } = render(<RootNavigator />);
      
      expect(getByText('Signing you in...')).toBeTruthy();
      expect(getByText('Welcome back, Test User!')).toBeTruthy();
    });

    it('should show auth navigator when not authenticated', () => {
      mockUseAuth.mockReturnValue(createAuthMock());

      const { getByTestId } = render(<RootNavigator />);
      
      expect(getByTestId('login-screen')).toBeTruthy();
    });

    it('should show main navigator when authenticated', () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        isAuthenticated: true,
        user: { id: '1', name: 'Test User', email: 'test@example.com', createdAt: new Date().toISOString() },
        hasValidToken: true,
      }));

      const { getByText } = render(<RootNavigator />);
      
      expect(getByText('2 Truths & 1 Lie')).toBeTruthy();
      expect(getByText('Welcome, Test User!')).toBeTruthy();
    });
  });

  describe('AuthNavigator', () => {
    const renderAuthNavigator = () => {
      mockUseAuth.mockReturnValue(createAuthMock());

      return render(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      );
    };

    it('should start with login screen', () => {
      const { getByTestId } = renderAuthNavigator();
      expect(getByTestId('login-screen')).toBeTruthy();
    });

    it('should navigate to signup screen', async () => {
      const { getByTestId } = renderAuthNavigator();
      
      fireEvent.press(getByTestId('signup-link'));
      
      await waitFor(() => {
        expect(getByTestId('signup-screen')).toBeTruthy();
      });
    });

    it('should navigate back to login from signup', async () => {
      const { getByTestId } = renderAuthNavigator();
      
      // Navigate to signup
      fireEvent.press(getByTestId('signup-link'));
      await waitFor(() => expect(getByTestId('signup-screen')).toBeTruthy());
      
      // Navigate back to login
      fireEvent.press(getByTestId('login-link'));
      await waitFor(() => {
        expect(getByTestId('login-screen')).toBeTruthy();
      });
    });

    it('should handle guest migration flow', () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        user: { id: '1', name: 'Guest User', email: undefined, createdAt: new Date().toISOString() },
        isGuest: true,
      }));

      const { getByTestId } = render(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      );
      
      expect(getByTestId('guest-migration')).toBeTruthy();
    });
  });

  describe('MainNavigator', () => {
    const mockLogout = jest.fn();

    const renderMainNavigator = (isGuest = false) => {
      mockUseAuth.mockReturnValue(createAuthMock({
        isAuthenticated: true,
        user: { 
          id: '1', 
          name: isGuest ? 'Guest' : 'Test User', 
          email: isGuest ? undefined : 'test@example.com',
          createdAt: new Date().toISOString()
        },
        isGuest,
        hasValidToken: !isGuest,
        logout: mockLogout,
      }));

      return render(
        <NavigationContainer>
          <MainNavigator onLogout={mockLogout} />
        </NavigationContainer>
      );
    };

    it('should show home screen with user info', () => {
      const { getByText } = renderMainNavigator();
      
      expect(getByText('2 Truths & 1 Lie')).toBeTruthy();
      expect(getByText('Welcome, Test User!')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('should show guest user prompts', () => {
      const { getByText, getByTestId } = renderMainNavigator(true);
      
      expect(getByText('Welcome, Guest!')).toBeTruthy();
      expect(getByTestId('auth-prompt')).toBeTruthy();
    });

    it('should handle auth prompt for guest users', () => {
      const { getByTestId } = renderMainNavigator(true);
      
      fireEvent.press(getByTestId('auth-prompt'));
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign In Required',
        expect.stringContaining('Sign in to save your progress'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Sign In' })
        ])
      );
    });

    it('should handle logout confirmation', () => {
      const { getByText } = renderMainNavigator();
      
      fireEvent.press(getByText('Sign Out'));
      
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign Out',
        expect.stringContaining('Are you sure you want to sign out?'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Sign Out' })
        ])
      );
    });

    it('should navigate to game screen', async () => {
      const { getByText, getByTestId } = renderMainNavigator();
      
      fireEvent.press(getByText('Guess Challenges'));
      
      await waitFor(() => {
        expect(getByTestId('game-screen')).toBeTruthy();
      });
    });

    it('should navigate to create screen', async () => {
      const { getByText, getByTestId } = renderMainNavigator();
      
      fireEvent.press(getByText('Create Challenge'));
      
      await waitFor(() => {
        expect(getByTestId('create-screen')).toBeTruthy();
      });
    });
  });

  describe('NavigationManager', () => {
    let manager: NavigationManager;

    beforeEach(() => {
      manager = NavigationManager.getInstance();
      manager.resetNavigationState();
    });

    it('should update navigation state', () => {
      manager.updateNavigationState({
        isAuthenticated: true,
        currentRoute: 'Main',
      });

      const state = manager.getNavigationState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.currentRoute).toBe('Main');
    });

    it('should handle deep links with auth check', () => {
      // Test unauthenticated deep link
      manager.handleDeepLink('Game', { challengeId: '123' });
      
      const state = manager.getNavigationState();
      expect(state.deepLinkPending).toEqual({
        route: 'Game',
        params: { challengeId: '123' }
      });
    });

    it('should handle auth transitions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      manager.handleAuthTransition({
        from: 'unauthenticated',
        to: 'authenticated',
        preserveState: true,
        showWelcome: true,
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Auth transition:', expect.any(Object));
      expect(consoleSpy).toHaveBeenCalledWith('👋 Welcome message should be shown');
      
      consoleSpy.mockRestore();
    });

    it('should reset navigation state', () => {
      manager.updateNavigationState({
        isAuthenticated: true,
        currentRoute: 'Main',
        deepLinkPending: { route: 'Game', params: {} }
      });

      manager.resetNavigationState();
      
      const state = manager.getNavigationState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.currentRoute).toBe('Auth');
      expect(state.deepLinkPending).toBeUndefined();
    });
  });

  describe('Enhanced Auth Screen Props', () => {
    it('should pass enhanced props to login screen', () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        isGuest: true,
      }));

      const { getByTestId } = render(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      );
      
      expect(getByTestId('guest-migration')).toBeTruthy();
    });

    it('should pass enhanced props to signup screen', async () => {
      mockUseAuth.mockReturnValue(createAuthMock({
        isGuest: true,
      }));

      const { getByTestId } = render(
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      );
      
      fireEvent.press(getByTestId('signup-link'));
      
      await waitFor(() => {
        expect(getByTestId('signup-screen')).toBeTruthy();
        expect(getByTestId('guest-migration')).toBeTruthy();
      });
    });
  });

  describe('Navigation Error Handling', () => {
    it('should handle navigation errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Test with invalid navigation ref
      const manager = NavigationManager.getInstance();
      manager.setNavigationRef({ current: null });
      manager.navigateToAuth('Login');
      
      // Should not throw error
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});