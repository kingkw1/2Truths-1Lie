/**
 * Authentication middleware for Redux store
 * Handles auth state synchronization and side effects
 */

import { Middleware } from '@reduxjs/toolkit';
import { startGameSession, endGameSession } from '../slices/gameSessionSlice';
import { authService } from '../../services/authService';
import { videoUploadService } from '../../services/uploadService';
import { mobileMediaIntegration } from '../../services/mobileMediaIntegration';

/**
 * Auth middleware that handles authentication-related side effects
 * - Syncs game session with auth state changes
 * - Handles automatic token refresh
 * - Manages auth state persistence
 */
export const authMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);
  
  // Handle auth state changes after the action has been processed
  if (action.type?.startsWith('auth/')) {
    const state = store.getState();
    handleAuthStateChange(store, action, state);
  }

  return result;
};

/**
 * Handle authentication state changes and trigger appropriate side effects
 */
function handleAuthStateChange(store: any, action: any, state: any): void {
  const authState = state.auth;
  const gameSessionState = state.gameSession;

  switch (action.type) {
    case 'auth/login/fulfilled':
    case 'auth/signup/fulfilled':
      handleSuccessfulAuth(store, authState, gameSessionState);
      break;

    case 'auth/logout/fulfilled':
      handleLogout(store, gameSessionState);
      break;

    case 'auth/initialize/fulfilled':
      handleAuthInitialization(store, authState, gameSessionState);
      break;

    case 'auth/validateToken/rejected':
    case 'auth/refreshToken/rejected':
      handleTokenFailure(store, authState);
      break;

    default:
      break;
  }
}

/**
 * Handle successful authentication (login/signup)
 */
function handleSuccessfulAuth(store: any, authState: any, gameSessionState: any): void {
  console.log('🎉 Authentication successful, setting up user session...');

  // Start a new game session if one doesn't exist
  if (!gameSessionState.currentSession && authState.user) {
    store.dispatch(startGameSession({ playerId: authState.user.id }));
  }

  // Log successful authentication
  console.log('✅ User authenticated:', {
    userId: authState.user?.id,
    email: authState.user?.email,
    isGuest: authState.isGuest,
    permissions: authState.permissions.length,
  });
}

/**
 * Handle user logout
 */
function handleLogout(store: any, gameSessionState: any): void {
  console.log('👋 User logged out, cleaning up session...');

  // End current game session
  if (gameSessionState.currentSession) {
    store.dispatch(endGameSession());
  }

  console.log('✅ Logout cleanup completed');
}

/**
 * Handle auth initialization
 */
function handleAuthInitialization(store: any, authState: any, gameSessionState: any): void {
  console.log('🚀 Auth initialized, setting up session...');

  // Start game session for authenticated users
  if (authState.isAuthenticated && authState.user && !gameSessionState.currentSession) {
    store.dispatch(startGameSession({ playerId: authState.user.id }));
  }

  // Set auth token for upload service
  const authToken = authService.getAuthToken();
  if (authToken) {
    videoUploadService.setAuthToken(authToken);
    console.log('✅ Auth token set for upload service - UPLOADS ENABLED!');
  }

  // Initialize mobile media integration after auth is ready
  if (authState.isAuthenticated) {
    console.log('🔄 Starting media library sync...');
    mobileMediaIntegration.syncMediaLibrary()
      .then(() => {
        console.log('✅ Media library sync completed');
      })
      .catch((error) => {
        // Don't throw error here as auth was successful
        console.error('⚠️ Media sync failed:', error.message);
      });
  }

  console.log('✅ Auth initialization completed:', {
    isAuthenticated: authState.isAuthenticated,
    isGuest: authState.isGuest,
    hasSession: !!gameSessionState.currentSession,
  });
}

/**
 * Handle token validation/refresh failures
 */
function handleTokenFailure(store: any, authState: any): void {
  console.warn('⚠️ Token validation/refresh failed');

  // If user was authenticated but token failed, they're now in guest mode
  if (authState.isGuest && !authState.isAuthenticated) {
    console.log('🔄 User reverted to guest mode due to token failure');
    
    // Could dispatch additional cleanup actions here if needed
    // For example, clearing sensitive cached data
  }
}

/**
 * Utility function to check if auth action was successful
 */
export function isAuthActionSuccessful(action: any): boolean {
  return action.type?.endsWith('/fulfilled') && action.type?.startsWith('auth/');
}

/**
 * Utility function to check if auth action failed
 */
export function isAuthActionFailed(action: any): boolean {
  return action.type?.endsWith('/rejected') && action.type?.startsWith('auth/');
}

/**
 * Get current auth status from store
 */
export function getAuthStatusFromStore(state: any): {
  isAuthenticated: boolean;
  isGuest: boolean;
  userId: string | null;
  hasValidToken: boolean;
} {
  const authState = state.auth;
  
  return {
    isAuthenticated: authState.isAuthenticated,
    isGuest: authState.isGuest,
    userId: authState.user?.id || null,
    hasValidToken: authState.tokenValidated,
  };
}