/**
 * Redux-integrated authentication hook
 * Provides unified interface between auth service and Redux store
 */

import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  initializeAuth,
  loginUser,
  signupUser,
  logoutUser,
  validateToken,
  refreshAuthToken,
  updateUserProfile,
  clearAuthError,
  syncAuthState,
  triggerAuthFlow,
  exitAuthFlow,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsGuest,
  selectAuthLoading,
  selectAuthError,
  selectUserPermissions,
  selectTokenValidated,
} from '../store/slices/authSlice';
import { AuthUser } from '../services/authService';

export interface UseAuthReduxReturn {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  permissions: string[];
  tokenValidated: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<void>;
  validateAuthToken: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  syncState: () => void;
  triggerAuthFlow: () => void;
  exitAuthFlow: () => void;
  
  // Utility functions
  hasPermission: (permission: string) => boolean;
  isEmailValid: (email: string) => boolean;
  isPasswordValid: (password: string) => boolean;
}

/**
 * Custom hook that integrates Redux auth state with auth service
 * Provides a unified interface for authentication operations
 */
export const useAuthRedux = (): UseAuthReduxReturn => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const authState = useAppSelector(selectAuth);
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isGuest = useAppSelector(selectIsGuest);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const permissions = useAppSelector(selectUserPermissions);
  const tokenValidated = useAppSelector(selectTokenValidated);

  // Action creators
  const initialize = useCallback(async () => {
    await dispatch(initializeAuth()).unwrap();
  }, [dispatch]);

  const login = useCallback(async (email: string, password: string) => {
    await dispatch(loginUser({ email, password })).unwrap();
  }, [dispatch]);

  const signup = useCallback(async (email: string, password: string) => {
    await dispatch(signupUser({ email, password })).unwrap();
  }, [dispatch]);

  const logout = useCallback(async () => {
    await dispatch(logoutUser()).unwrap();
  }, [dispatch]);

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {
    await dispatch(updateUserProfile(updates)).unwrap();
  }, [dispatch]);

  const validateAuthToken = useCallback(async () => {
    await dispatch(validateToken()).unwrap();
  }, [dispatch]);

  const refreshToken = useCallback(async () => {
    await dispatch(refreshAuthToken()).unwrap();
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  const syncState = useCallback(() => {
    dispatch(syncAuthState());
  }, [dispatch]);

  const triggerAuthFlowAction = useCallback(() => {
    dispatch(triggerAuthFlow());
  }, [dispatch]);

  const exitAuthFlowAction = useCallback(() => {
    dispatch(exitAuthFlow());
  }, [dispatch]);

  // Utility functions
  const hasPermission = useCallback((permission: string): boolean => {
    return permissions.includes(permission) || permissions.includes('admin');
  }, [permissions]);

  const isEmailValid = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }, []);

  const isPasswordValid = useCallback((password: string): boolean => {
    // Password must be at least 8 characters and contain at least one letter and one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  }, []);

  // Auto-initialize on mount if not already initialized - Removed to prevent duplicate initialization
  // The initialization should be handled by AuthProvider or StoreProvider, not here
  // useEffect(() => {
  //   if (!user && !isLoading && !error) {
  //     initialize().catch((err) => {
  //       console.warn('Auto-initialization failed:', err);
  //     });
  //   }
  // }, [user, isLoading, error, initialize]);

  return {
    // State
    user,
    isAuthenticated,
    isGuest,
    isLoading,
    error,
    permissions,
    tokenValidated,
    
    // Actions
    initialize,
    login,
    signup,
    logout,
    updateProfile,
    validateAuthToken,
    refreshToken,
    clearError,
    syncState,
    triggerAuthFlow: triggerAuthFlowAction,
    exitAuthFlow: exitAuthFlowAction,
    
    // Utility functions
    hasPermission,
    isEmailValid,
    isPasswordValid,
  };
};

export default useAuthRedux;