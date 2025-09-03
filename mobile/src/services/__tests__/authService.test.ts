/**
 * Tests for enhanced authentication service
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService, authService } from '../authService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // Reset the singleton instance by clearing its state
    service = AuthService.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset AsyncStorage mocks
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    
    // Reset fetch mock
    (fetch as jest.Mock).mockClear();
    
    // Reset service state by logging out
    try {
      await service.logout();
    } catch (error) {
      // Ignore errors during cleanup
    }
    
    // Clear any stored state
    (service as any).currentUser = null;
    (service as any).authToken = null;
  });

  describe('Initialization', () => {
    it('should create guest user when no stored user exists', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'guest_token_123',
          refresh_token: 'refresh_token_123',
          permissions: ['media:read', 'media:upload'],
        }),
      });

      await service.initialize();

      expect(service.getCurrentUser()).toBeTruthy();
      expect(service.getCurrentUser()?.name).toBe('Guest User');
      expect(service.getAuthToken()).toBeTruthy();
    });

    it('should load stored user data on initialization', async () => {
      const storedUser = {
        id: 'user_123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      };

      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify(storedUser))
        .mockResolvedValueOnce('stored_token_123');

      await service.initialize();

      expect(service.getCurrentUser()?.id).toBe('user_123');
      expect(service.getAuthToken()).toBe('stored_token_123');
    });

    it('should fallback to local guest user when backend is unavailable', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await service.initialize();

      expect(service.getCurrentUser()).toBeTruthy();
      expect(service.getCurrentUser()?.name).toBe('Guest User');
      expect(service.getAuthToken()).toBeTruthy();
    });
  });

  describe('Authentication', () => {
    it('should login with valid credentials', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'auth_token_123',
          refresh_token: 'refresh_token_123',
          permissions: ['media:read', 'media:upload', 'media:delete'],
        }),
      });

      const user = await service.login('test@example.com', 'password123');

      expect(user.email).toBe('test@example.com');
      expect(service.getAuthToken()).toBe('auth_token_123');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('authToken', 'auth_token_123');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh_token_123');
    });

    it('should throw error for invalid credentials', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid credentials' }),
      });

      await expect(service.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle network errors during login', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(service.login('test@example.com', 'password123'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Token Management', () => {
    it('should refresh token successfully', async () => {
      // Setup initial state with login
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'initial_token',
          refresh_token: 'refresh_token_123',
        }),
      });
      await service.login('test@example.com', 'password123');
      
      // Setup refresh token call
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('refresh_token_123');
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new_auth_token_456',
          refresh_token: 'refresh_token_123',
        }),
      });

      const newToken = await service.refreshToken();

      expect(newToken).toBe('new_auth_token_456');
      expect(service.getAuthToken()).toBe('new_auth_token_456');
    });

    it('should create new guest session when refresh fails', async () => {
      // Setup initial state
      await service.login('test@example.com', 'password123');
      
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid_refresh_token');
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'guest_token_789',
            refresh_token: 'guest_refresh_789',
          }),
        });

      const newToken = await service.refreshToken();

      expect(newToken).toBeTruthy();
      expect(service.getCurrentUser()?.name).toBe('Guest User');
    });

    it('should validate token with backend', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const isValid = await service.validateToken();

      expect(isValid).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/validate'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
          }),
        })
      );
    });

    it('should return false for invalid token validation', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const isValid = await service.validateToken();

      expect(isValid).toBe(false);
    });
  });

  describe('Permissions', () => {
    it('should get user permissions from backend', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          permissions: ['media:read', 'media:upload', 'media:delete'],
        }),
      });

      const permissions = await service.getUserPermissions();

      expect(permissions).toEqual(['media:read', 'media:upload', 'media:delete']);
    });

    it('should check specific permission', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          permissions: ['media:read', 'media:upload'],
        }),
      });

      const hasUpload = await service.hasPermission('media:upload');
      const hasDelete = await service.hasPermission('media:delete');

      expect(hasUpload).toBe(true);
      expect(hasDelete).toBe(false);
    });

    it('should return true for admin permission', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          permissions: ['admin'],
        }),
      });

      const hasUpload = await service.hasPermission('media:upload');

      expect(hasUpload).toBe(true);
    });

    it('should handle permission check errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const permissions = await service.getUserPermissions();
      const hasPermission = await service.hasPermission('media:upload');

      expect(permissions).toEqual([]);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout and create new guest user', async () => {
      // Setup initial logged in state
      await service.login('test@example.com', 'password123');
      
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'guest_token_new',
          refresh_token: 'guest_refresh_new',
        }),
      });

      await service.logout();

      expect(service.getCurrentUser()?.name).toBe('Guest User');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('currentUser');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('User Management', () => {
    it('should update user profile', async () => {
      // Setup initial state
      await service.login('test@example.com', 'password123');

      const updates = { name: 'Updated Name' };
      const updatedUser = await service.updateProfile(updates);

      expect(updatedUser.name).toBe('Updated Name');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'currentUser',
        expect.stringContaining('Updated Name')
      );
    });

    it('should throw error when updating profile without user', async () => {
      await expect(service.updateProfile({ name: 'Test' }))
        .rejects.toThrow('No user logged in');
    });
  });

  describe('Authentication State', () => {
    it('should return correct authentication status', async () => {
      expect(service.isAuthenticated()).toBe(false);

      await service.login('test@example.com', 'password123');

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return current user', async () => {
      expect(service.getCurrentUser()).toBeNull();

      await service.login('test@example.com', 'password123');

      const user = service.getCurrentUser();
      expect(user).toBeTruthy();
      expect(user?.email).toBe('test@example.com');
    });

    it('should return auth token', async () => {
      expect(service.getAuthToken()).toBeNull();

      await service.login('test@example.com', 'password123');

      expect(service.getAuthToken()).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(service.login('test@example.com', 'password123'))
        .rejects.toThrow('Login failed');
    });

    it('should handle network timeouts', async () => {
      (fetch as jest.Mock).mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(service.login('test@example.com', 'password123'))
        .rejects.toThrow('Timeout');
    });
  });
});

describe('AuthService Singleton', () => {
  it('should return same instance', () => {
    const instance1 = AuthService.getInstance();
    const instance2 = AuthService.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should export singleton instance', () => {
    expect(authService).toBeInstanceOf(AuthService);
  });
});