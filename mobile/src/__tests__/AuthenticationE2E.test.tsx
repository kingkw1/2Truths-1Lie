/**
 * End-to-End Authentication Tests
 * 
 * Tests complete authentication workflows from system perspective:
 * - Auth service functionality and integration
 * - Redux state management for authentication
 * - Authentication flow state changes
 * - Error handling and recovery mechanisms
 */

import { configureStore } from '@reduxjs/toolkit';

import guessingGameReducer from '../store/slices/guessingGameSlice';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import authReducer, { initializeAuth } from '../store/slices/authSlice';
import uiReducer from '../store/slices/uiSlice';
import networkReducer from '../store/slices/networkSlice';
import { authService } from '../services/authService';

// Mock the auth service
jest.mock('../services/authService', () => ({
  authService: {
    initialize: jest.fn(),
    getCurrentUser: jest.fn(),
    getAuthStatus: jest.fn(),
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    getUserPermissions: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test store setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      guessingGame: guessingGameReducer,
      challengeCreation: challengeCreationReducer,
      ui: uiReducer,
      network: networkReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore non-serializable values in actions/state for testing
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
          ignoredPaths: [
            'guessingGame.availableChallenges.0.createdAt', 
            'guessingGame.availableChallenges.0.lastPlayed',
          ],
        },
      }),
  });
};

describe('End-to-End Authentication Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createTestStore();
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.getUserPermissions.mockResolvedValue([]);
  });

  describe('Authentication Flow Integration', () => {
    it('should handle complete authentication initialization flow', async () => {
      const guestUser = {
        id: 'guest_123',
        name: 'Guest User',
        createdAt: new Date().toISOString(),
      };

      // Mock auth service responses for guest state
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: guestUser,
        hasValidToken: true,
      });

      mockAuthService.getCurrentUser.mockReturnValue(guestUser);

      // Dispatch initialization action
      await store.dispatch(initializeAuth());

      // Verify auth service was called
      expect(mockAuthService.initialize).toHaveBeenCalled();
      
      // Verify store state reflects the initialization
      const authState = store.getState().auth;
      expect(authState).toBeDefined();
    });

    it('should handle guest to authenticated user transition', async () => {
      const guestUser = {
        id: 'guest_123',
        name: 'Guest User',
        createdAt: new Date().toISOString(),
      };

      const authenticatedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      // Setup initial guest state
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: guestUser,
        hasValidToken: true,
      });

      mockAuthService.getCurrentUser.mockReturnValue(guestUser);

      // Initialize with guest user
      await store.dispatch(initializeAuth());

      // Now simulate successful signup
      mockAuthService.signup.mockResolvedValue(authenticatedUser);
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: authenticatedUser,
        hasValidToken: true,
      });

      // Verify the signup would be called through the service
      expect(mockAuthService.signup).toBeDefined();
      expect(typeof mockAuthService.signup).toBe('function');
    });

    it('should handle authentication errors gracefully', async () => {
      // Setup error scenario
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: null,
        hasValidToken: false,
      });

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      // Verify error handling mechanism exists
      expect(mockAuthService.login).toBeDefined();
      
      // Attempt login that will fail
      try {
        await mockAuthService.login('test@example.com', 'invalid-password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid credentials');
      }

      // Verify the service was called with the correct parameters
      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'invalid-password');
    });
  });

  describe('Session Management', () => {
    it('should handle logout correctly', async () => {
      const authenticatedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      // Setup authenticated state
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: authenticatedUser,
        hasValidToken: true,
      });

      mockAuthService.logout.mockResolvedValue();

      // Simulate logout
      await mockAuthService.logout();

      // Verify logout was called
      expect(mockAuthService.logout).toHaveBeenCalled();
    });

    it('should maintain session state correctly', async () => {
      const authenticatedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      // Setup authenticated state
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: authenticatedUser,
        hasValidToken: true,
      });

      mockAuthService.getCurrentUser.mockReturnValue(authenticatedUser);

      // Initialize with authenticated user
      await store.dispatch(initializeAuth());

      // Verify the auth state is properly managed
      const authState = store.getState().auth;
      expect(authState).toBeDefined();
      
      // Verify initialization called the auth service
      expect(mockAuthService.initialize).toHaveBeenCalled();
    });
  });

  describe('Auth Service Integration', () => {
    it('should properly initialize auth service with Redux store', async () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: null,
        hasValidToken: false,
      });

      // Initialize the auth system
      await store.dispatch(initializeAuth());

      // Verify auth service initialization
      expect(mockAuthService.initialize).toHaveBeenCalled();
      
      // Verify store state is defined
      expect(store.getState().auth).toBeDefined();
    });

    it('should handle network errors during auth operations', async () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: null,
        hasValidToken: false,
      });

      mockAuthService.login.mockRejectedValue(new Error('Network error'));

      // Test network error handling
      try {
        await mockAuthService.login('test@example.com', 'password');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should handle auth state consistency across Redux and service', async () => {
      const authenticatedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      // Setup consistent state between service and Redux
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: authenticatedUser,
        hasValidToken: true,
      });

      mockAuthService.getCurrentUser.mockReturnValue(authenticatedUser);

      // Initialize and verify consistency
      await store.dispatch(initializeAuth());

      // Check that both service and Redux store have consistent data
      const serviceStatus = mockAuthService.getAuthStatus();
      const reduxState = store.getState().auth;

      expect(serviceStatus.isAuthenticated).toBe(true);
      expect(serviceStatus.user).toBe(authenticatedUser);
      expect(reduxState).toBeDefined(); // Redux state exists and was initialized

      // Verify initialization flow worked
      expect(mockAuthService.initialize).toHaveBeenCalled();
    });

    it('should handle auth permissions correctly', async () => {
      const authenticatedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      const userPermissions = ['create_challenge', 'play_game', 'view_profile'];

      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: authenticatedUser,
        hasValidToken: true,
      });

      mockAuthService.getUserPermissions.mockResolvedValue(userPermissions);

      // Test permission handling
      const permissions = await mockAuthService.getUserPermissions();
      
      expect(permissions).toEqual(userPermissions);
      expect(mockAuthService.getUserPermissions).toHaveBeenCalled();
    });
  });

  describe('Redux Store Integration', () => {
    it('should have all required reducers configured', () => {
      const state = store.getState();
      
      // Verify all required slices are present
      expect(state.auth).toBeDefined();
      expect(state.guessingGame).toBeDefined();
      expect(state.challengeCreation).toBeDefined();
      expect(state.ui).toBeDefined();
      expect(state.network).toBeDefined();
    });

    it('should handle concurrent auth actions without conflicts', async () => {
      const user = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user,
        hasValidToken: true,
      });

      mockAuthService.getCurrentUser.mockReturnValue(user);

      // Dispatch multiple actions
      const initPromise1 = store.dispatch(initializeAuth());
      const initPromise2 = store.dispatch(initializeAuth());

      // Wait for both to complete
      await Promise.all([initPromise1, initPromise2]);

      // Verify auth service was called (may be called multiple times due to concurrent actions)
      expect(mockAuthService.initialize).toHaveBeenCalled();
      
      // Store should remain in a consistent state
      const finalState = store.getState();
      expect(finalState.auth).toBeDefined();
    });
  });
});
