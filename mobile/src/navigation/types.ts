/**
 * Navigation type definitions for React Navigation
 * Enhanced with deep linking and navigation state support
 */

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: {
    // Optional parameters for deep linking and state restoration
    email?: string;
    returnTo?: keyof MainStackParamList;
    guestMigration?: boolean;
  } | undefined;
  Signup: {
    // Optional parameters for deep linking and pre-filled forms
    email?: string;
    returnTo?: keyof MainStackParamList;
    guestMigration?: boolean;
  } | undefined;
};

export type MainStackParamList = {
  Home: undefined;
  Game: {
    // Optional parameters for direct game access
    challengeId?: string;
    autoStart?: boolean;
  } | undefined;
  Create: {
    // Optional parameters for challenge creation flow
    template?: string;
    returnTo?: keyof MainStackParamList;
  } | undefined;
};

// Enhanced navigation state types for better type safety
export type NavigationState = {
  isAuthenticated: boolean;
  currentRoute: string;
  previousRoute?: string;
  authFlow?: 'login' | 'signup' | 'guest-migration';
  deepLinkPending?: {
    route: keyof MainStackParamList;
    params?: any;
  };
};

// Auth transition types for better UX handling
export type AuthTransition = {
  from: 'guest' | 'unauthenticated' | 'authenticated';
  to: 'guest' | 'unauthenticated' | 'authenticated';
  preserveState?: boolean;
  showWelcome?: boolean;
};