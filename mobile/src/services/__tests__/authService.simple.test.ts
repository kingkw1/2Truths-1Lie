/**
 * Simple tests for authentication service core functionality
 */
import { AuthService } from '../authService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch
global.fetch = jest.fn();

describe('AuthService Core Functionality', () => {
  let service: AuthService;

  beforeEach(() => {
    service = AuthService.getInstance();
    jest.clearAllMocks();
    
    // Reset service state
    (service as any).currentUser = null;
    (service as any).authToken = null;
  });

  it('should be a singleton', () => {
    const instance1 = AuthService.getInstance();
    const instance2 = AuthService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should start with no authenticated user', () => {
    expect(service.getCurrentUser()).toBeNull();
    expect(service.getAuthToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should create guest user when backend is available', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'guest_token_123',
        refresh_token: 'guest_refresh_123',
        permissions: ['media:read', 'media:upload'],
      }),
    });

    await service.initialize();

    expect(service.getCurrentUser()).toBeTruthy();
    expect(service.getCurrentUser()?.name).toBe('Guest User');
    expect(service.getAuthToken()).toBeTruthy();
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should handle login success', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'user_token_123',
        refresh_token: 'user_refresh_123',
        permissions: ['media:read', 'media:upload', 'media:delete'],
      }),
    });

    const user = await service.login('test@example.com', 'password123');

    expect(user.email).toBe('test@example.com');
    expect(service.getAuthToken()).toBe('user_token_123');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should handle login failure', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid credentials' }),
    });

    await expect(service.login('test@example.com', 'wrongpassword'))
      .rejects.toThrow('Invalid credentials');
  });

  it('should validate tokens', async () => {
    (service as any).authToken = 'test_token';

    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    const isValid = await service.validateToken();
    expect(isValid).toBe(true);

    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    const isInvalid = await service.validateToken();
    expect(isInvalid).toBe(false);
  });

  it('should get user permissions', async () => {
    (service as any).authToken = 'test_token';

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        permissions: ['media:read', 'media:upload'],
      }),
    });

    const permissions = await service.getUserPermissions();
    expect(permissions).toEqual(['media:read', 'media:upload']);
  });

  it('should check specific permissions', async () => {
    (service as any).authToken = 'test_token';

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

  it('should handle admin permissions', async () => {
    (service as any).authToken = 'admin_token';

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        permissions: ['admin'],
      }),
    });

    const hasAnyPermission = await service.hasPermission('media:delete');
    expect(hasAnyPermission).toBe(true);
  });

  it('should handle network errors gracefully', async () => {
    (service as any).authToken = 'test_token';

    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const permissions = await service.getUserPermissions();
    const hasPermission = await service.hasPermission('media:upload');

    expect(permissions).toEqual([]);
    expect(hasPermission).toBe(false);
  });
});