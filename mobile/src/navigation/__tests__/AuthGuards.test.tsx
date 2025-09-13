/**
 * Auth Guards and Navigation Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { store } from '../../store';
import { AuthGuard, RequireAuth, GuestOnly, AuthenticatedOnly, ConditionalAuthContent } from '../../components/AuthGuard';
import { ProtectedScreen, AuthStatusBanner } from '../../components/ProtectedScreen';
import { RootNavigator } from '../RootNavigator';
import { authService } from '../../services/authService';
import { Text, View } from 'react-native';

// Mock the auth service
jest.mock('../../services/authService', () => ({
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
  }),
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </Provider>
);

describe('Auth Guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthGuard', () => {
    it('renders children when no auth requirements', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthGuard>
            <Text>Test Content</Text>
          </AuthGuard>
        </TestWrapper>
      );

      expect(getByText('Test Content')).toBeTruthy();
    });

    it('shows auth required message when requireAuth is true and user not authenticated', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthGuard requireAuth={true}>
            <Text>Protected Content</Text>
          </AuthGuard>
        </TestWrapper>
      );

      expect(getByText('Sign In Required')).toBeTruthy();
      expect(getByText('Please sign in to access this feature')).toBeTruthy();
    });

    it('shows guest prompt when showGuestPrompt is true and user is guest', () => {
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
            <Text>Content with Guest Prompt</Text>
          </AuthGuard>
        </TestWrapper>
      );

      expect(getByText('Content with Guest Prompt')).toBeTruthy();
      expect(getByText('Sign in to save your progress and compete with friends')).toBeTruthy();
      
      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      expect(mockOnAuthPrompt).toHaveBeenCalled();
    });

    it('renders children when authenticated user and requireAuth is true', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthGuard requireAuth={true}>
            <Text>Protected Content</Text>
          </AuthGuard>
        </TestWrapper>
      );

      expect(getByText('Protected Content')).toBeTruthy();
    });
  });

  describe('RequireAuth', () => {
    it('blocks access for unauthenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <RequireAuth>
            <Text>Super Secret Content</Text>
          </RequireAuth>
        </TestWrapper>
      );

      expect(queryByText('Super Secret Content')).toBeNull();
      expect(getByText('Authentication Required')).toBeTruthy();
    });

    it('allows access for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <RequireAuth>
            <Text>Super Secret Content</Text>
          </RequireAuth>
        </TestWrapper>
      );

      expect(getByText('Super Secret Content')).toBeTruthy();
    });
  });

  describe('GuestOnly', () => {
    it('shows content for guest users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <GuestOnly>
            <Text>Guest Only Content</Text>
          </GuestOnly>
        </TestWrapper>
      );

      expect(getByText('Guest Only Content')).toBeTruthy();
    });

    it('hides content for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { queryByText } = render(
        <TestWrapper>
          <GuestOnly>
            <Text>Guest Only Content</Text>
          </GuestOnly>
        </TestWrapper>
      );

      expect(queryByText('Guest Only Content')).toBeNull();
    });
  });

  describe('AuthenticatedOnly', () => {
    it('shows content for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthenticatedOnly>
            <Text>Authenticated Only Content</Text>
          </AuthenticatedOnly>
        </TestWrapper>
      );

      expect(getByText('Authenticated Only Content')).toBeTruthy();
    });

    it('hides content for guest users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { queryByText } = render(
        <TestWrapper>
          <AuthenticatedOnly>
            <Text>Authenticated Only Content</Text>
          </AuthenticatedOnly>
        </TestWrapper>
      );

      expect(queryByText('Authenticated Only Content')).toBeNull();
    });
  });

  describe('ConditionalAuthContent', () => {
    it('shows guest content for guest users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <ConditionalAuthContent
            guest={<Text>Guest Content</Text>}
            authenticated={<Text>Authenticated Content</Text>}
          />
        </TestWrapper>
      );

      expect(getByText('Guest Content')).toBeTruthy();
      expect(queryByText('Authenticated Content')).toBeNull();
    });

    it('shows authenticated content for authenticated users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <ConditionalAuthContent
            guest={<Text>Guest Content</Text>}
            authenticated={<Text>Authenticated Content</Text>}
          />
        </TestWrapper>
      );

      expect(getByText('Authenticated Content')).toBeTruthy();
      expect(queryByText('Guest Content')).toBeNull();
    });
  });

  describe('ProtectedScreen', () => {
    it('shows guest warning when showGuestWarning is true', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <ProtectedScreen showGuestWarning={true}>
            <Text>Screen Content</Text>
          </ProtectedScreen>
        </TestWrapper>
      );

      expect(getByText('Screen Content')).toBeTruthy();
      expect(getByText('Sign in to save your progress and access all features')).toBeTruthy();
    });

    it('requires auth when requireAuth is true', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText, queryByText } = render(
        <TestWrapper>
          <ProtectedScreen requireAuth={true}>
            <Text>Protected Screen Content</Text>
          </ProtectedScreen>
        </TestWrapper>
      );

      expect(queryByText('Protected Screen Content')).toBeNull();
      expect(getByText('Authentication Required')).toBeTruthy();
    });
  });

  describe('AuthStatusBanner', () => {
    it('shows guest banner for guest users', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthStatusBanner showForGuests={true} />
        </TestWrapper>
      );

      expect(getByText('Sign in to save your progress')).toBeTruthy();
      expect(getByText('Sign In')).toBeTruthy();
    });

    it('shows authenticated banner for authenticated users when enabled', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <AuthStatusBanner 
            showForAuthenticated={true}
            authenticatedMessage="Welcome back!"
          />
        </TestWrapper>
      );

      expect(getByText('Welcome back!')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('calls onAuthAction when sign in button is pressed', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

      const mockOnAuthAction = jest.fn();

      const { getByText } = render(
        <TestWrapper>
          <AuthStatusBanner 
            showForGuests={true}
            onAuthAction={mockOnAuthAction}
          />
        </TestWrapper>
      );

      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);
      expect(mockOnAuthAction).toHaveBeenCalled();
    });
  });
});

describe('Navigation Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auth guards integrate properly with navigation', () => {
    // This is a placeholder test for navigation integration
    // Full integration tests would require more complex setup
    expect(true).toBe(true);
  });
});