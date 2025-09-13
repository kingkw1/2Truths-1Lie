/**
 * Authentication Hook
 * Provides auth state management and utilities for components
 * Now integrates with Redux store for centralized state management
 */

import { useState, useEffect, useCallback } from 'react';
import { authService, AuthUser } from '../services/authService';
import { useAuthRedux } from './useAuthRedux';

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  hasValidToken: boolean;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  checkAuthStatus: () => AuthState;
}

export const useAuth = (): AuthState & AuthActions => {
  // Use Redux-integrated auth hook for state management
  const reduxAuth = useAuthRedux();
  
  // Maintain backward compatibility with existing interface
  const authState: AuthState = {
    user: reduxAuth.user,
    isAuthenticated: reduxAuth.isAuthenticated,
    isGuest: reduxAuth.isGuest,
    isLoading: reduxAuth.isLoading,
    hasValidToken: reduxAuth.tokenValidated,
  };

  // Wrap Redux actions to match existing interface
  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    await reduxAuth.login(email, password);
    
    // Return the user from Redux state
    if (reduxAuth.user) {
      return reduxAuth.user;
    }
    
    throw new Error('Login succeeded but user data not available');
  }, [reduxAuth]);

  const signup = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    await reduxAuth.signup(email, password);
    
    // Return the user from Redux state
    if (reduxAuth.user) {
      return reduxAuth.user;
    }
    
    throw new Error('Signup succeeded but user data not available');
  }, [reduxAuth]);

  const logout = useCallback(async (): Promise<void> => {
    await reduxAuth.logout();
  }, [reduxAuth]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    await reduxAuth.initialize();
  }, [reduxAuth]);

  const checkAuthStatus = useCallback((): AuthState => {
    // Sync with auth service and return current state
    reduxAuth.syncState();
    return authState;
  }, [reduxAuth, authState]);

  return {
    ...authState,
    login,
    signup,
    logout,
    refreshAuth,
    checkAuthStatus,
  };
};

export default useAuth;