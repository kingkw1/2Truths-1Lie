/**
 * Navigation Utilities
 * Enhanced navigation patterns and helpers for auth transitions
 */

import { NavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList, AuthStackParamList, MainStackParamList, NavigationState, AuthTransition } from './types';

export class NavigationManager {
  private static instance: NavigationManager;
  private navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>> | null = null;
  private navigationState: NavigationState = {
    isAuthenticated: false,
    currentRoute: 'Auth',
  };

  static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }

  setNavigationRef(ref: React.RefObject<NavigationContainerRef<RootStackParamList>>) {
    this.navigationRef = ref;
  }

  updateNavigationState(updates: Partial<NavigationState>) {
    this.navigationState = { ...this.navigationState, ...updates };
    console.log('📱 Navigation state updated:', this.navigationState);
  }

  /**
   * Enhanced auth transition with state preservation
   */
  handleAuthTransition(transition: AuthTransition) {
    console.log('🔄 Auth transition:', transition);
    
    if (transition.preserveState && this.navigationState.deepLinkPending) {
      // Restore pending deep link after auth
      const { route, params } = this.navigationState.deepLinkPending;
      setTimeout(() => {
        this.navigateToMainScreen(route, params);
        this.updateNavigationState({ deepLinkPending: undefined });
      }, 500);
    }

    if (transition.showWelcome) {
      // Could trigger welcome modal or toast here
      console.log('👋 Welcome message should be shown');
    }
  }

  /**
   * Navigate to auth screen with context
   */
  navigateToAuth(screen: keyof AuthStackParamList = 'Login', params?: any) {
    if (!this.navigationRef?.current) return;

    console.log('📱 Navigating to auth:', screen, params);
    
    try {
      this.navigationRef.current.navigate('Auth');
      // Note: We can't directly navigate to nested screens in this setup
      // The AuthNavigator will handle the specific screen based on params
    } catch (error) {
      console.error('❌ Navigation to auth failed:', error);
    }
  }

  /**
   * Navigate to main app screen with context
   */
  navigateToMainScreen(screen: keyof MainStackParamList, params?: any) {
    if (!this.navigationRef?.current) return;

    console.log('📱 Navigating to main screen:', screen, params);
    
    try {
      this.navigationRef.current.navigate('Main');
      // Note: We can't directly navigate to nested screens in this setup
      // The MainNavigator will handle the specific screen based on params
    } catch (error) {
      console.error('❌ Navigation to main screen failed:', error);
    }
  }

  /**
   * Handle deep link with auth check
   */
  handleDeepLink(route: keyof MainStackParamList, params?: any) {
    console.log('🔗 Handling deep link:', route, params);
    
    if (!this.navigationState.isAuthenticated) {
      // Store deep link for after auth
      this.updateNavigationState({
        deepLinkPending: { route, params }
      });
      this.navigateToAuth('Login', { returnTo: route });
    } else {
      this.navigateToMainScreen(route, params);
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState(): NavigationState {
    return { ...this.navigationState };
  }

  /**
   * Reset navigation state (useful for logout)
   */
  resetNavigationState() {
    this.navigationState = {
      isAuthenticated: false,
      currentRoute: 'Auth',
    };
    console.log('🔄 Navigation state reset');
  }
}

/**
 * Navigation helper functions
 */
export const navigationUtils = {
  /**
   * Create smooth transition config for auth flows
   */
  getAuthTransitionConfig: () => ({
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    cardOverlayEnabled: true,
    animationEnabled: true,
  }),

  /**
   * Create transition config for main app flows
   */
  getMainTransitionConfig: () => ({
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    cardOverlayEnabled: false,
    animationEnabled: true,
  }),

  /**
   * Validate navigation parameters
   */
  validateNavigationParams: (route: string, params: any): boolean => {
    // Add validation logic here if needed
    return true;
  },

  /**
   * Log navigation events for debugging
   */
  logNavigationEvent: (event: string, data?: any) => {
    console.log(`📱 Navigation Event: ${event}`, data);
  },
};

// Export singleton instance
export const navigationManager = NavigationManager.getInstance();