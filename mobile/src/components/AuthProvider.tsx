/**
 * Authentication Provider Component
 * Initializes auth state and provides auth context to the app
 */

import React, { useEffect, ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { initializeAuth, selectAuth } from '../store/slices/authSlice';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider component that initializes authentication state
 * Should be placed high in the component tree to ensure auth is available throughout the app
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector(selectAuth);

  useEffect(() => {
    // Initialize auth state when the app starts
    if (!authState.user && !authState.isLoading) {
      console.log('🚀 AuthProvider: Initializing authentication...');
      
      dispatch(initializeAuth())
        .unwrap()
        .then(() => {
          console.log('✅ AuthProvider: Authentication initialized successfully');
        })
        .catch((error) => {
          console.warn('⚠️ AuthProvider: Authentication initialization failed:', error);
          // Don't throw error here as the app should still work in guest mode
        });
    }
  }, [dispatch, authState.user, authState.isLoading]);

  // Log auth state changes in development
  useEffect(() => {
    if (__DEV__) {
      console.log('🔐 AuthProvider: Auth state changed:', {
        isAuthenticated: authState.isAuthenticated,
        isGuest: authState.isGuest,
        hasUser: !!authState.user,
        isLoading: authState.isLoading,
        hasError: !!authState.error,
      });
    }
  }, [authState]);

  return <>{children}</>;
};

export default AuthProvider;