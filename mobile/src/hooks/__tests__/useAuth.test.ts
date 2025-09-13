/**
 * useAuth Hook Tests
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../useAuth';
import { authService } from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  authService: {
    initialize: jest.fn(),
    getAuthStatus: jest.fn(),
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with loading state', () => {
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.getAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isGuest: true,
      user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
      hasValidToken: true,
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
  });

  it('provides auth state after initialization', async () => {
    const mockUser = { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() };
    
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.getAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isGuest: false,
      user: mockUser,
      hasValidToken: true,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it('handles login correctly', async () => {
    const mockUser = { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() };
    
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.login.mockResolvedValue(mockUser);
    mockAuthService.getAuthStatus
      .mockReturnValueOnce({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      })
      .mockReturnValueOnce({
        isAuthenticated: true,
        isGuest: false,
        user: mockUser,
        hasValidToken: true,
      });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const user = await result.current.login('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('handles signup correctly', async () => {
    const mockUser = { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() };
    
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.signup.mockResolvedValue(mockUser);
    mockAuthService.getAuthStatus
      .mockReturnValueOnce({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      })
      .mockReturnValueOnce({
        isAuthenticated: true,
        isGuest: false,
        user: mockUser,
        hasValidToken: true,
      });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const user = await result.current.signup('test@example.com', 'password');
      expect(user).toEqual(mockUser);
    });

    expect(mockAuthService.signup).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('handles logout correctly', async () => {
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.logout.mockResolvedValue();
    mockAuthService.getAuthStatus
      .mockReturnValueOnce({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user_123', name: 'Test User', email: 'test@example.com', createdAt: new Date() },
        hasValidToken: true,
      })
      .mockReturnValueOnce({
        isAuthenticated: false,
        isGuest: true,
        user: { id: 'guest_456', name: 'Guest User', createdAt: new Date() },
        hasValidToken: true,
      });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('handles auth errors gracefully', async () => {
    mockAuthService.initialize.mockResolvedValue();
    mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));
    mockAuthService.getAuthStatus.mockReturnValue({
      isAuthenticated: false,
      isGuest: true,
      user: { id: 'guest_123', name: 'Guest User', createdAt: new Date() },
      hasValidToken: true,
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('test@example.com', 'wrongpassword');
      } catch (error) {
        expect(error).toEqual(new Error('Invalid credentials'));
      }
    });

    expect(result.current.isLoading).toBe(false);
  });
});