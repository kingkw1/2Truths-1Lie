/**
 * Auth Middleware Tests
 * Tests for authentication middleware functionality
 */

import { configureStore } from '@reduxjs/toolkit';
import { authMiddleware, isAuthActionSuccessful, isAuthActionFailed, getAuthStatusFromStore } from '../authMiddleware';
import authReducer, { loginUser, signupUser, logoutUser, initializeAuth } from '../../slices/authSlice';
import gameSessionReducer from '../../slices/gameSessionSlice';
import { authService } from '../../../services/authService';
import type { RootState, AppDispatch } from '../../index';

// Mock the auth service
jest.mock('../../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Helper to get typed state
const getTypedState = (store: any) => store.getState() as {
  auth: ReturnType<typeof authReducer>;
  gameSession: ReturnType<typeof gameSessionReducer>;
};

describe('authMiddleware', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth service methods
    mockAuthService.login.mockResolvedValue({
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
    });
    mockAuthService.signup.mockResolvedValue({
      id: 'new-user',
      name: 'New User',
      email: 'new@example.com',
      createdAt: new Date(),
    });
    mockAuthService.logout.mockResolvedValue();
    mockAuthService.getCurrentUser.mockReturnValue(null);
    mockAuthService.getAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isGuest: true,
      user: null,
      hasValidToken: false,
    });
    mockAuthService.getUserPermissions.mockResolvedValue(['read']);

    store = configureStore({
      reducer: {
        auth: authReducer,
        gameSession: gameSessionReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(authMiddleware),
    });
  });

  describe('auth action handling', () => {
    it('should handle successful login', async () => {
      await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);

      // Check if game session was started
      const gameSessionState = getTypedState(store).gameSession;
      expect(gameSessionState.currentSession).toBeTruthy();
      expect(gameSessionState.currentSession?.playerId).toBe('test-user');
      expect(gameSessionState.isActive).toBe(true);
    });

    it('should handle successful signup', async () => {
      await store.dispatch(signupUser({ email: 'new@example.com', password: 'password' }) as any);

      // Check if game session was started
      const gameSessionState = getTypedState(store).gameSession;
      expect(gameSessionState.currentSession).toBeTruthy();
      expect(gameSessionState.currentSession?.playerId).toBe('new-user');
    });

    it('should handle logout', async () => {
      // First login to create a session
      await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);
      
      // Verify session is active
      expect(getTypedState(store).gameSession.currentSession).toBeTruthy();

      // Mock logout behavior
      const guestUser = {
        id: 'guest-123',
        name: 'Guest User',
        createdAt: new Date(),
      };
      
      mockAuthService.getCurrentUser.mockReturnValue(guestUser);
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: guestUser,
        hasValidToken: false,
      });

      // Now logout
      await store.dispatch(logoutUser() as any);

      // Check if game session was ended
      const gameSessionState = getTypedState(store).gameSession;
      expect(gameSessionState.currentSession).toBeNull();
      expect(gameSessionState.isActive).toBe(false);
    });

    it('should not start session for guest users during initialization', () => {
      const guestUser = {
        id: 'guest-123',
        name: 'Guest User',
        createdAt: new Date(),
      };

      const initAction = {
        type: 'auth/initializeAuth/fulfilled',
        payload: {
          user: guestUser,
          isAuthenticated: false,
          isGuest: true,
          permissions: ['read'],
        },
      };

      store.dispatch(initAction);

      // Should not start session for guest users
      const gameSessionState = getTypedState(store).gameSession;
      expect(gameSessionState.currentSession).toBeNull();
    });

    it('should handle token validation failure', () => {
      const tokenFailAction = {
        type: 'auth/validateToken/rejected',
        payload: 'Token expired',
      };

      // This should not crash and should be handled gracefully
      expect(() => {
        store.dispatch(tokenFailAction);
      }).not.toThrow();
    });

    it('should handle token refresh failure', () => {
      const refreshFailAction = {
        type: 'auth/refreshAuthToken/rejected',
        payload: 'Refresh failed',
      };

      // This should not crash and should be handled gracefully
      expect(() => {
        store.dispatch(refreshFailAction);
      }).not.toThrow();
    });
  });

  describe('non-auth actions', () => {
    it('should pass through non-auth actions unchanged', () => {
      const nonAuthAction = {
        type: 'someOtherSlice/someAction',
        payload: 'test',
      };

      const result = store.dispatch(nonAuthAction);
      expect(result).toEqual(nonAuthAction);
    });
  });

  describe('utility functions', () => {
    describe('isAuthActionSuccessful', () => {
      it('should identify successful auth actions', () => {
        expect(isAuthActionSuccessful({ type: 'auth/loginUser/fulfilled' })).toBe(true);
        expect(isAuthActionSuccessful({ type: 'auth/signupUser/fulfilled' })).toBe(true);
        expect(isAuthActionSuccessful({ type: 'auth/logoutUser/fulfilled' })).toBe(true);
        expect(isAuthActionSuccessful({ type: 'auth/initializeAuth/fulfilled' })).toBe(true);
      });

      it('should not identify non-auth or failed actions as successful', () => {
        expect(isAuthActionSuccessful({ type: 'auth/loginUser/rejected' })).toBe(false);
        expect(isAuthActionSuccessful({ type: 'auth/loginUser/pending' })).toBe(false);
        expect(isAuthActionSuccessful({ type: 'otherSlice/action/fulfilled' })).toBe(false);
        expect(isAuthActionSuccessful({ type: 'someAction' })).toBe(false);
      });
    });

    describe('isAuthActionFailed', () => {
      it('should identify failed auth actions', () => {
        expect(isAuthActionFailed({ type: 'auth/loginUser/rejected' })).toBe(true);
        expect(isAuthActionFailed({ type: 'auth/signupUser/rejected' })).toBe(true);
        expect(isAuthActionFailed({ type: 'auth/validateToken/rejected' })).toBe(true);
      });

      it('should not identify non-auth or successful actions as failed', () => {
        expect(isAuthActionFailed({ type: 'auth/loginUser/fulfilled' })).toBe(false);
        expect(isAuthActionFailed({ type: 'auth/loginUser/pending' })).toBe(false);
        expect(isAuthActionFailed({ type: 'otherSlice/action/rejected' })).toBe(false);
        expect(isAuthActionFailed({ type: 'someAction' })).toBe(false);
      });
    });

    describe('getAuthStatusFromStore', () => {
      it('should extract auth status from store state', async () => {
        await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);

        const state = getTypedState(store);
        const authStatus = getAuthStatusFromStore(state);

        expect(authStatus).toEqual({
          isAuthenticated: true,
          isGuest: false,
          userId: 'test-user',
          hasValidToken: true,
        });
      });

      it('should handle guest user state', () => {
        const state = getTypedState(store);
        const authStatus = getAuthStatusFromStore(state);

        expect(authStatus).toEqual({
          isAuthenticated: false,
          isGuest: false,
          userId: null,
          hasValidToken: false,
        });
      });
    });
  });

  describe('session management integration', () => {
    it('should not start duplicate sessions', () => {
      const mockUser = {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      // First login - should start session
      store.dispatch({
        type: 'auth/loginUser/fulfilled',
        payload: { user: mockUser, permissions: [] },
      });

      const firstSessionId = getTypedState(store).gameSession.currentSession?.sessionId;

      // Second auth action - should not start new session
      store.dispatch({
        type: 'auth/validateToken/fulfilled',
        payload: { isValid: true, permissions: [] },
      });

      const secondSessionId = getTypedState(store).gameSession.currentSession?.sessionId;
      expect(firstSessionId).toBe(secondSessionId);
    });
  });
});