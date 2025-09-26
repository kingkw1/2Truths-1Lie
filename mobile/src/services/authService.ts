/**
 * Authentication Service for Mobile App
 * Handles user authentication and token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendBaseUrl } from '../config/apiConfig';
import { revenueCatUserSync } from './revenueCatUserSync';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user?: {
    id: string;
    email: string;
    name?: string;
    created_at: string;
  };
}

export interface AuthError {
  message: string;
  code: string;
  field?: string;
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;
  private authToken: string | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize auth service and load stored user data
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing AuthService...');
      
      // Try to restore existing authentication state
      const restored = await this.restoreAuthState();
      
      if (restored) {
        console.log('✅ Authentication state restored from storage');
      } else {
        console.log('✅ New guest session created');
      }
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      await this.createGuestUser();
    }
  }

  /**
   * Create a guest user for anonymous usage
   */
  private async createGuestUser(): Promise<void> {
    try {
      console.log('🚀 Creating guest session with backend...');
      
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Guest session response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Guest session error response:', errorText);
        throw new Error(`Failed to create guest session: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Got guest session data:', {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        tokenType: data.token_type
      });
      
      const guestUser: AuthUser = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Guest User',
        createdAt: new Date().toISOString(),
      };

      this.currentUser = guestUser;
      this.authToken = data.access_token;

      // Store in AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify(guestUser));
      await AsyncStorage.setItem('authToken', data.access_token);
      await AsyncStorage.setItem('refreshToken', data.refresh_token);

      console.log('✅ Created guest user with backend token:', guestUser.id);
      console.log('✅ Auth token stored:', data.access_token ? `${data.access_token.substring(0, 30)}...` : 'null');
    } catch (error) {
      console.error('❌ Failed to create guest session with backend:', error);
      
      // Fallback to local guest user
      const guestUser: AuthUser = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Guest User',
        createdAt: new Date().toISOString(),
      };

      const guestToken = `local_guest_token_${guestUser.id}`;

      this.currentUser = guestUser;
      this.authToken = guestToken;

      await AsyncStorage.setItem('currentUser', JSON.stringify(guestUser));
      await AsyncStorage.setItem('authToken', guestToken);

      console.log('⚠️ Created local guest user:', guestUser.id);
    }
  }

  /**
   * Get current authenticated user
   */
  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get current auth token
   */
  public getAuthToken(): string | null {
    // Reduced logging frequency - only log if no token exists
    if (!this.authToken) {
      console.log('🔐 AUTH SERVICE: No token available');
    }
    return this.authToken;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  /**
   * Sign up with credentials
   */
  public async signup(email: string, password: string, name?: string): Promise<AuthUser> {
    try {
      // Validate input parameters
      this.validateEmailPassword(email, password);

      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name?.trim() || undefined,
          device_info: {
            platform: 'mobile',
            app_version: '1.0.0',
            // Add more device info as needed
          },
        }),
      });

      if (!response.ok) {
        throw await this.handleAuthError(response);
      }

      const data: AuthResponse = await response.json();
      
      // Create user from backend response or fallback to email-based user
      const user: AuthUser = this.createUserFromResponse(data, email);

      // Store current guest user data for potential migration
      const guestUser = this.currentUser;
      
      // Update current user and token
      this.currentUser = user;
      this.authToken = data.access_token;

      // Store in AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      await AsyncStorage.setItem('authToken', data.access_token);
      await AsyncStorage.setItem('refreshToken', data.refresh_token);

      console.log('✅ Signup successful for user:', user.email);

      // Migrate guest user data if applicable
      if (guestUser && this.isGuestUser(guestUser)) {
        await this.migrateGuestUserData(guestUser, user);
      }

      // Sync with RevenueCat after successful signup
      try {
        if (user.email) {
          await revenueCatUserSync.syncAuthenticatedUser(user.email);
          console.log('✅ RevenueCat user sync completed');
        }
      } catch (error) {
        console.warn('⚠️ RevenueCat sync failed, but signup was successful:', error);
      }

      return user;
    } catch (error: any) {
      console.error('❌ Signup failed:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Login with credentials
   */
  public async login(email: string, password: string): Promise<AuthUser> {
    try {
      // Validate input parameters
      this.validateEmailPassword(email, password);

      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          device_info: {
            platform: 'mobile',
            app_version: '1.0.0',
            // Add more device info as needed
          },
        }),
      });

      if (!response.ok) {
        throw await this.handleAuthError(response);
      }

      const data: AuthResponse = await response.json();
      
      // Create user from backend response or fallback to email-based user
      const user: AuthUser = this.createUserFromResponse(data, email);

      // Store current guest user data for potential migration
      const guestUser = this.currentUser;
      
      // Update current user and token
      this.currentUser = user;
      this.authToken = data.access_token;

      // Store in AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      await AsyncStorage.setItem('authToken', data.access_token);
      await AsyncStorage.setItem('refreshToken', data.refresh_token);

      console.log('✅ Login successful for user:', user.email);

      // Migrate guest user data if applicable
      if (guestUser && this.isGuestUser(guestUser)) {
        await this.migrateGuestUserData(guestUser, user);
      }

      // Sync with RevenueCat after successful login
      try {
        if (user.email) {
          await revenueCatUserSync.syncAuthenticatedUser(user.email);
          console.log('✅ RevenueCat user sync completed');
        }
      } catch (error) {
        console.warn('⚠️ RevenueCat sync failed, but login was successful:', error);
      }

      return user;
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      throw this.normalizeAuthError(error);
    }
  }

  /**
   * Logout current user
   */
  public async logout(): Promise<void> {
    console.log('🚪 Logging out user...');
    
    // Logout from RevenueCat first
    try {
      await revenueCatUserSync.logoutFromRevenueCat();
      console.log('✅ RevenueCat logout completed');
    } catch (error) {
      console.warn('⚠️ RevenueCat logout failed:', error);
    }
    
    // Clear all authentication data
    await this.clearAuthData();
    
    console.log('✅ Logout completed. User session cleared.');
  }

  /**
   * Update user profile
   */
  public async updateProfile(updates: Partial<AuthUser>): Promise<AuthUser> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    this.currentUser = {
      ...this.currentUser,
      ...updates,
    };

    await AsyncStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    return this.currentUser;
  }

  /**
   * Refresh auth token using backend API
   */
  public async refreshToken(): Promise<string> {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.authToken = data.access_token;

      if (!this.authToken) {
        throw new Error('No access token received from server');
      }

      await AsyncStorage.setItem('authToken', this.authToken);
      return this.authToken;
    } catch (error) {
      console.warn('Token refresh failed, creating new guest session:', error);
      // Fallback to creating new guest session
      await this.createGuestUser();
      
      if (!this.authToken) {
        throw new Error('Failed to create authentication token');
      }
      
      return this.authToken;
    }
  }

  /**
   * Get API base URL based on environment
   */
  private getApiBaseUrl(): string {
    // Use the centralized API configuration
    const baseUrl = getBackendBaseUrl();
    const environment = __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION';
    console.log(`🌐 AUTH: Using ${environment} URL: ${baseUrl}`);
    return baseUrl;
  }

  /**
   * Validate token with backend
   */
  public async validateToken(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.warn('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Get user permissions from token
   */
  public async getUserPermissions(): Promise<string[]> {
    if (!this.authToken) {
      return [];
    }

    try {
      // If this is a guest token (local fallback), return guest permissions
      if (this.authToken.startsWith('guest_token_')) {
        return ['media:read', 'media:upload'];
      }

      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        // If we can't get permissions from backend, assume guest permissions
        console.warn('Failed to get user permissions from backend, using guest permissions');
        return ['media:read', 'media:upload'];
      }

      const data = await response.json();
      return data.permissions || ['media:read', 'media:upload'];
    } catch (error) {
      console.warn('Failed to get user permissions:', error);
      // Fallback to guest permissions for any error
      return ['media:read', 'media:upload'];
    }
  }

  /**
   * Check if user has specific permission
   */
  public async hasPermission(permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes('admin');
  }

  public async fetchSelf(): Promise<AuthUser> {
    if (!this.authToken) {
      throw new Error('No auth token available to fetch user profile.');
    }
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.status}`);
      }
      const userData = await response.json();
      // The backend /me endpoint returns the user object directly
      // It needs to be mapped to our AuthUser interface
      const user: AuthUser = {
        id: userData.id,
        name: userData.name || userData.email.split('@')[0],
        email: userData.email,
        createdAt: userData.created_at,
        avatar: userData.avatar,
      };
      return user;
    } catch (error) {
      console.error('Error fetching self:', error);
      throw error;
    }
  }

  /**
   * Validate email and password format
   */
  private validateEmailPassword(email: string, password: string): void {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    if (!this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    if (password.length > 72) {
      throw new Error('Password must be no more than 72 characters long');
    }
  }

  /**
   * Validate email format
   */
  public isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate password strength
   */
  public isValidPassword(password: string): boolean {
    // Password must be at least 8 characters and contain at least one letter and one number
    // Also enforce maximum length to prevent bcrypt issues
    if (!password || password.length > 72) return false;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
  }

  /**
   * Check if user is a guest user
   */
  private isGuestUser(user: AuthUser): boolean {
    return user.id.startsWith('guest_') && !user.email;
  }

  /**
   * Create user object from backend response
   */
  private createUserFromResponse(data: AuthResponse, email: string): AuthUser {
    if (data.user) {
      return {
        id: data.user.id,
        name: data.user.name || data.user.email.split('@')[0] || 'User',
        email: data.user.email,
        createdAt: data.user.created_at,
      };
    }

    // Fallback to email-based user creation
    return {
      id: email.split('@')[0] || 'User',
      name: email.split('@')[0] || 'User',
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Handle authentication errors from backend
   */
  private async handleAuthError(response: Response): Promise<Error> {
    let errorData: any = {};
    
    try {
      errorData = await response.json();
    } catch {
      // If response is not JSON, use status-based error
    }

    switch (response.status) {
      case 400:
        return new Error(errorData.detail || 'Invalid request. Please check your input.');
      case 401:
        return new Error('Invalid email or password. Please check your credentials.');
      case 409:
        return new Error('An account with this email already exists.');
      case 422:
        return new Error(errorData.detail || 'Validation error. Please check your input.');
      case 429:
        return new Error('Too many attempts. Please try again later.');
      case 500:
        return new Error('Server error. Please try again later.');
      default:
        return new Error(errorData.detail || `Authentication failed (${response.status})`);
    }
  }

  /**
   * Normalize authentication errors for consistent handling
   */
  private normalizeAuthError(error: any): Error {
    // Check for network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new Error('Network connection failed. Please check your internet connection and try again.');
    }

    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'string') {
      return new Error(error);
    }

    if (error?.message) {
      return new Error(error.message);
    }

    return new Error('Authentication failed. Please try again.');
  }

  /**
   * Migrate guest user data to authenticated user
   */
  private async migrateGuestUserData(guestUser: AuthUser, authenticatedUser: AuthUser): Promise<void> {
    try {
      console.log('🔄 Migrating guest user data to authenticated user...');
      
      // Here you can implement logic to migrate:
      // - Challenge history
      // - Game progress
      // - User preferences
      // - Any other guest user data
      
      // For now, we'll just log the migration
      console.log('✅ Guest user data migration completed');
      console.log(`   From: ${guestUser.id} (guest)`);
      console.log(`   To: ${authenticatedUser.email} (authenticated)`);
      
      // You can extend this method to call backend APIs for data migration
      // Example:
      // await this.migrateUserDataOnBackend(guestUser.id, authenticatedUser.id);
      
    } catch (error) {
      console.warn('⚠️ Guest user data migration failed:', error);
      // Don't throw error here as authentication was successful
    }
  }

  /**
   * Get user authentication status with detailed information
   */
  public getAuthStatus(): {
    isAuthenticated: boolean;
    isGuest: boolean;
    user: AuthUser | null;
    hasValidToken: boolean;
  } {
    const isAuthenticated = this.isAuthenticated();
    const isGuest = this.currentUser ? this.isGuestUser(this.currentUser) : false;
    const hasValidToken = !!this.authToken;

    // Reduced logging - auth status check (enable for debugging if needed)
    // console.log('🔍 [AUTH STATUS DEBUG]:', { isAuthenticated, isGuest, hasValidToken });

    return {
      isAuthenticated,
      isGuest,
      user: this.currentUser,
      hasValidToken,
    };
  }

  /**
   * Clear all authentication data (for logout or reset)
   */
  public async clearAuthData(): Promise<void> {
    this.currentUser = null;
    this.authToken = null;

    await AsyncStorage.multiRemove([
      'currentUser',
      'authToken',
      'refreshToken',
    ]);

    console.log('🧹 Authentication data cleared');
  }

  /**
   * Restore authentication state from storage
   */
  public async restoreAuthState(): Promise<boolean> {
    try {
      const [storedUser, storedToken] = await AsyncStorage.multiGet([
        'currentUser',
        'authToken',
      ]);

      const userData = storedUser[1];
      const tokenData = storedToken[1];

      if (userData && tokenData) {
        this.currentUser = JSON.parse(userData);
        this.authToken = tokenData;

        console.log('🔍 [AUTH DEBUG] Restored user data:', {
          id: this.currentUser?.id,
          email: this.currentUser?.email,
          isGuestCheck: this.currentUser ? this.isGuestUser(this.currentUser) : 'no user'
        });

        // Always validate token with backend, even guest tokens
        const isValid = await this.validateToken();
        if (!isValid) {
          console.warn('⚠️ Stored token is invalid, creating new guest session');
          await this.clearAuthData();
          await this.createGuestUser();
          return false;
        }

        console.log('✅ Authentication state restored');
        
        // Sync with RevenueCat if we have a real user (not guest)
        if (this.currentUser && this.currentUser.email && !this.isGuestUser(this.currentUser)) {
          try {
            console.log('🔄 Syncing restored user with RevenueCat...');
            await revenueCatUserSync.syncAuthenticatedUser(this.currentUser.email);
            console.log('✅ RevenueCat sync completed during auth restoration');
          } catch (error) {
            console.warn('⚠️ RevenueCat sync failed during auth restoration:', error);
          }
        } else {
          console.log('⚠️ [AUTH DEBUG] Skipping RevenueCat sync - user is guest or missing email');
        }
        
        return true;
      }

      // No stored auth data, create guest user
      await this.createGuestUser();
      return false;
    } catch (error) {
      console.error('❌ Failed to restore auth state:', error);
      await this.createGuestUser();
      return false;
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();