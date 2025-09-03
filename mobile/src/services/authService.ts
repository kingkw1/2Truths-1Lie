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
      const storedUser = await AsyncStorage.getItem('currentUser');
      const storedToken = await AsyncStorage.getItem('authToken');

      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
      }

      if (storedToken) {
        this.authToken = storedToken;
      }

      // If no user exists, create a guest user
      if (!this.currentUser) {
        await this.createGuestUser();
      }
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      await this.createGuestUser();
    }
  }

  /**
   * Create a guest user for anonymous usage
   */
  private async createGuestUser(): Promise<void> {
    try {
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create guest session');
      }

      const data = await response.json();
      
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

      console.log('Created guest user:', guestUser.id);
    } catch (error) {
      console.warn('Failed to create guest session with backend, using local fallback:', error);
      
      // Fallback to local guest user
      const guestUser: AuthUser = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: 'Guest User',
        createdAt: new Date(),
      };

      const guestToken = `guest_token_${guestUser.id}`;

      this.currentUser = guestUser;
      this.authToken = guestToken;

      await AsyncStorage.setItem('currentUser', JSON.stringify(guestUser));
      await AsyncStorage.setItem('authToken', guestToken);

      console.log('Created local guest user:', guestUser.id);
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

      await AsyncStorage.setItem('authToken', this.authToken);
      return this.authToken;
    } catch (error) {
      console.warn('Token refresh failed, creating new guest session:', error);
      // Fallback to creating new guest session
      await this.createGuestUser();
      return this.authToken!;
    }
  }

  /**
   * Get API base URL based on environment
   */
  private getApiBaseUrl(): string {
    // In production, this would come from your app config
    return __DEV__ 
      ? 'http://localhost:8000' 
      : 'https://your-production-api.com';
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
      const response = await fetch(`${this.getApiBaseUrl()}/api/v1/auth/permissions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.permissions || [];
    } catch (error) {
      console.warn('Failed to get user permissions:', error);
      return [];
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