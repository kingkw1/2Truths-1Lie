/**
 * Auth Slice Tests
 * Tests for authentication Redux slice functionality
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  initializeAuth,
  loginUser,
  signupUser,
  logoutUser,
  validateToken,
  refreshAuthToken,
  updateUserProfile,
  clearAuthError,
  syncAuthState,
  setPermissions,
  AuthState,
} from '../authSlice';
import { authService } from '../../../services/authService';
import type { RootState, AppDispatch } from '../../index';

// Mock the auth service
jest.mock('../../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Helper to get typed state
const getTypedState = (store: any) => store.getState() as {
  auth: ReturnType<typeof authReducer>;
};

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
    });
    
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = getTypedState(store).auth;
      
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        error: null,
        lastAuthAction: null,
        tokenValidated: false,
        permissions: [],
      });
    });
  });

  describe('synchronous actions', () => {
    it('should clear auth error', () => {
      // Set initial error state
      store.dispatch({ type: 'auth/loginUser/rejected', payload: 'Test error' });
      
      // Clear error
      store.dispatch(clearAuthError());
      
      const state = getTypedState(store).auth;
      expect(state.error).toBeNull();
    });

    it('should sync auth state', () => {
      const mockUser = {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: mockUser,
        hasValidToken: true,
      });

      store.dispatch(syncAuthState());
      
      const state = getTypedState(store).auth;
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isGuest).toBe(false);
    });

    it('should set permissions', () => {
      const permissions = ['read', 'write', 'admin'];
      
      store.dispatch(setPermissions(permissions));
      
      const state = getTypedState(store).auth;
      expect(state.permissions).toEqual(permissions);
    });
  });

  describe('async actions', () => {
    describe('initializeAuth', () => {
      it('should handle successful initialization', async () => {
        const mockUser = {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        };

        mockAuthService.initialize.mockResolvedValue();
        mockAuthService.getCurrentUser.mockReturnValue(mockUser);
        mockAuthService.getAuthStatus.mockReturnValue({
          isAuthenticated: true,
          isGuest: false,
          user: mockUser,
          hasValidToken: true,
        });
        mockAuthService.getUserPermissions.mockResolvedValue(['read', 'write']);

        await store.dispatch(initializeAuth() as any);
        
        const state = getTypedState(store).auth;
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isGuest).toBe(false);
        expect(state.permissions).toEqual(['read', 'write']);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.lastAuthAction).toBe('init');
      });

      it('should handle initialization failure', async () => {
        mockAuthService.initialize.mockRejectedValue(new Error('Init failed'));

        await store.dispatch(initializeAuth() as any);
        
        const state = getTypedState(store).auth;
        expect(state.error).toBe('Init failed');
        expect(state.isLoading).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.isGuest).toBe(true);
      });
    });

    describe('loginUser', () => {
      it('should handle successful login', async () => {
        const mockUser = {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        };

        mockAuthService.login.mockResolvedValue(mockUser);
        mockAuthService.getUserPermissions.mockResolvedValue(['read', 'write']);

        await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);
        
        const state = getTypedState(store).auth;
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isGuest).toBe(false);
        expect(state.permissions).toEqual(['read', 'write']);
        expect(state.tokenValidated).toBe(true);
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.lastAuthAction).toBe('login');
      });

      it('should handle login failure', async () => {
        mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

        await store.dispatch(loginUser({ email: 'test@example.com', password: 'wrong' }) as any);
        
        const state = getTypedState(store).auth;
        expect(state.error).toBe('Invalid credentials');
        expect(state.isLoading).toBe(false);
        expect(state.isAuthenticated).toBe(false);
      });
    });

    describe('signupUser', () => {
      it('should handle successful signup', async () => {
        const mockUser = {
          id: 'new-user',
          name: 'New User',
          email: 'new@example.com',
          createdAt: new Date(),
        };

        mockAuthService.signup.mockResolvedValue(mockUser);
        mockAuthService.getUserPermissions.mockResolvedValue(['read']);

        await store.dispatch(signupUser({ email: 'new@example.com', password: 'password' }) as any);
        
        const state = getTypedState(store).auth;
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.isGuest).toBe(false);
        expect(state.permissions).toEqual(['read']);
        expect(state.tokenValidated).toBe(true);
        expect(state.lastAuthAction).toBe('signup');
      });

      it('should handle signup failure', async () => {
        mockAuthService.signup.mockRejectedValue(new Error('Email already exists'));

        await store.dispatch(signupUser({ email: 'existing@example.com', password: 'password' }) as any);
        
        const state = getTypedState(store).auth;
        expect(state.error).toBe('Email already exists');
        expect(state.isLoading).toBe(false);
      });
    });

    describe('logoutUser', () => {
      it('should handle successful logout', async () => {
        const guestUser = {
          id: 'guest-123',
          name: 'Guest User',
          createdAt: new Date(),
        };

        mockAuthService.logout.mockResolvedValue();
        mockAuthService.getCurrentUser.mockReturnValue(guestUser);
        mockAuthService.getAuthStatus.mockReturnValue({
          isAuthenticated: false,
          isGuest: true,
          user: guestUser,
          hasValidToken: false,
        });
        mockAuthService.getUserPermissions.mockResolvedValue(['read']);

        await store.dispatch(logoutUser() as any);
        
        const state = getTypedState(store).auth;
        expect(state.user).toEqual(guestUser);
        expect(state.isAuthenticated).toBe(false);
        expect(state.isGuest).toBe(true);
        expect(state.tokenValidated).toBe(false);
        expect(state.lastAuthAction).toBe('logout');
      });
    });

    describe('validateToken', () => {
      it('should handle successful token validation', async () => {
        mockAuthService.validateToken.mockResolvedValue(true);
        mockAuthService.getUserPermissions.mockResolvedValue(['read', 'write']);

        await store.dispatch(validateToken() as any);
        
        const state = getTypedState(store).auth;
        expect(state.tokenValidated).toBe(true);
        expect(state.permissions).toEqual(['read', 'write']);
        expect(state.isLoading).toBe(false);
      });

      it('should handle invalid token', async () => {
        mockAuthService.validateToken.mockResolvedValue(false);
        mockAuthService.getUserPermissions.mockResolvedValue(['read']);

        await store.dispatch(validateToken() as any);
        
        const state = getTypedState(store).auth;
        expect(state.tokenValidated).toBe(false);
        expect(state.isAuthenticated).toBe(false);
        expect(state.isGuest).toBe(true);
      });
    });

    describe('updateUserProfile', () => {
      it('should handle successful profile update', async () => {
        const initialUser = {
          id: 'test-user',
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date(),
        };

        const updatedUser = {
          ...initialUser,
          name: 'Updated User',
        };

        // Set initial state
        store.dispatch({ 
          type: 'auth/loginUser/fulfilled', 
          payload: { user: initialUser, permissions: [] } 
        });

        mockAuthService.updateProfile.mockResolvedValue(updatedUser);

        await store.dispatch(updateUserProfile({ name: 'Updated User' }) as any);
        
        const state = getTypedState(store).auth;
        expect(state.user).toEqual(updatedUser);
        expect(state.error).toBeNull();
      });
    });
  });

  describe('loading states', () => {
    it('should set loading to true during async operations', async () => {
      mockAuthService.login.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          id: 'test',
          name: 'Test',
          email: 'test@example.com',
          createdAt: new Date(),
        }), 100))
      );
      mockAuthService.getUserPermissions.mockResolvedValue([]);

      // Start the async operation but don't await it
      const loginPromise = store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);
      
      // Check loading state immediately
      const state = getTypedState(store).auth;
      expect(state.isLoading).toBe(true);
      expect(state.lastAuthAction).toBe('login');

      // Clean up by awaiting the promise
      await loginPromise;
    });

    it('should set loading to false after async operations complete', async () => {
      mockAuthService.login.mockResolvedValue({
        id: 'test',
        name: 'Test',
        email: 'test@example.com',
        createdAt: new Date(),
      });
      mockAuthService.getUserPermissions.mockResolvedValue([]);

      await store.dispatch(loginUser({ email: 'test@example.com', password: 'password' }) as any);
      
      const state = getTypedState(store).auth;
      expect(state.isLoading).toBe(false);
    });
  });
});