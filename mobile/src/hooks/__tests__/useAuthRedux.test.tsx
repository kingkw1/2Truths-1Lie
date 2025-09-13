/**
 * useAuthRedux Hook Tests
 * Tests for Redux-integrated authentication hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import authReducer, { 
  loginUser, 
  signupUser, 
  logoutUser,
  initializeAuth,
  validateToken,
  refreshAuthToken,
} from '../../store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { authService } from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Simple hook to test Redux integration
const useTestAuth = () => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.auth);
  
  return {
    ...authState,
    dispatch,
  };
};

// Create a wrapper component for testing
const createWrapper = (initialState = {}) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: null,
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        error: null,
        lastAuthAction: null,
        tokenValidated: false,
        permissions: [],
        ...initialState,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  
  return Wrapper;
};

describe('useAuthRedux integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Redux state integration', () => {
    it('should return initial auth state from Redux', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isGuest).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.permissions).toEqual([]);
      expect(result.current.tokenValidated).toBe(false);
    });
  });

  describe('Redux actions', () => {
    it('should dispatch login action', async () => {
      const mockUser = {
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      mockAuthService.login.mockResolvedValue(mockUser);
      mockAuthService.getUserPermissions.mockResolvedValue(['read']);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      await act(async () => {
        await result.current.dispatch(loginUser({ email: 'test@example.com', password: 'password' }));
      });

      expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should dispatch signup action', async () => {
      const mockUser = {
        id: 'new-user',
        name: 'New User',
        email: 'new@example.com',
        createdAt: new Date(),
      };

      mockAuthService.signup.mockResolvedValue(mockUser);
      mockAuthService.getUserPermissions.mockResolvedValue(['read']);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      await act(async () => {
        await result.current.dispatch(signupUser({ email: 'new@example.com', password: 'password' }));
      });

      expect(mockAuthService.signup).toHaveBeenCalledWith('new@example.com', 'password');
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should dispatch logout action', async () => {
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
      mockAuthService.getUserPermissions.mockResolvedValue([]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      await act(async () => {
        await result.current.dispatch(logoutUser());
      });

      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isGuest).toBe(true);
    });
  });

  describe('state management', () => {
    it('should handle permissions state', () => {
      const wrapper = createWrapper({
        permissions: ['read', 'write'],
      });
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      expect(result.current.permissions).toEqual(['read', 'write']);
    });

    it('should handle error state', () => {
      const wrapper = createWrapper({
        error: 'Test error',
      });
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      expect(result.current.error).toBe('Test error');
    });

    it('should handle loading state', () => {
      const wrapper = createWrapper({
        isLoading: true,
      });
      const { result } = renderHook(() => useTestAuth(), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });
  });
});