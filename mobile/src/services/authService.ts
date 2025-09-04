/**
 * Authentication Service for Mobile App
 * Handles user authentication and token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
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
      // Clear any existing auth data for fresh start
      await AsyncStorage.multiRemove(['currentUser', 'authToken', 'refreshToken']);
      
      // Always create a fresh guest user for testing
      await this.createGuestUser();
    } catch (error) {
      console.error('Auth initialization error:', error);
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
        createdAt: new Date(),
      };

      this.currentUser = guestUser;
      this.authToken = data.access_token;

      // Store in AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify(guestUser));
      await AsyncStorage.setItem('authToken', data.access_token);
      await AsyncStorage.setItem('refreshToken', data.refresh_token);

      console.log('✅ Created guest user with backend token:', guestUser.id);
    } catch (error) {
      console.error('❌ Failed to create guest session with backend:', error);
      
      // Fallback to local guest user
      const guestUser: AuthUser = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Guest User',
        createdAt: new Date(),
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
    return this.authToken;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.currentUser !== null && this.authToken !== null;
  }

  /**
   * Login with credentials
   */
  public async login(email: string, password: string): Promise<AuthUser> {
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          device_info: {
            platform: 'mobile',
            // Add more device info as needed
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      const user: AuthUser = {
        id: email.split('@')[0] || 'User',
        name: email.split('@')[0] || 'User',
        email,
        createdAt: new Date(),
      };

      this.currentUser = user;
      this.authToken = data.access_token;

      // Store in AsyncStorage
      await AsyncStorage.setItem('currentUser', JSON.stringify(user));
      await AsyncStorage.setItem('authToken', data.access_token);
      await AsyncStorage.setItem('refreshToken', data.refresh_token);

      return user;
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout current user
   */
  public async logout(): Promise<void> {
    this.currentUser = null;
    this.authToken = null;

    // Clear from AsyncStorage
    await AsyncStorage.removeItem('currentUser');
    await AsyncStorage.removeItem('authToken');

    // Create a new guest user
    await this.createGuestUser();
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
    // Force development URL for now
    console.log('🌐 AUTH: Using development URL');
    return 'http://192.168.50.111:8001';
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
}

// Export singleton instance
export const authService = AuthService.getInstance();