/**
 * Tests for useReportAuth hook
 */

import { renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useReportAuth } from '../useReportAuth';
import { useAuth } from '../useAuth';
import { reportService } from '../../services/reportService';

// Mock dependencies
jest.mock('../useAuth');
jest.mock('../../services/reportService');
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockReportService = reportService as jest.Mocked<typeof reportService>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('useReportAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock for useAuth
    mockUseAuth.mockReturnValue({
      triggerAuthFlow: jest.fn(),
      isAuthenticated: true,
      isGuest: false,
      isLoading: false,
      hasValidToken: true,
      user: { id: 'user_123', name: 'Test User', createdAt: '2023-01-01' },
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      refreshAuth: jest.fn(),
      checkAuthStatus: jest.fn(),
      exitAuthFlow: jest.fn(),
    });
  });

  describe('checkReportAuth', () => {
    it('should return authentication status from report service', () => {
      // Mock report service response
      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        canReport: true,
      });

      const { result } = renderHook(() => useReportAuth());
      const authState = result.current.checkReportAuth();

      expect(authState).toEqual({
        canReport: true,
        isAuthenticated: true,
        isGuest: false,
      });
      expect(mockReportService.getAuthenticationStatus).toHaveBeenCalled();
    });

    it('should handle guest user scenario', () => {
      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: true,
        canReport: false,
        authMessage: 'Please sign in with a registered account to report content.',
      });

      const { result } = renderHook(() => useReportAuth());
      const authState = result.current.checkReportAuth();

      expect(authState).toEqual({
        canReport: false,
        isAuthenticated: true,
        isGuest: true,
        authMessage: 'Please sign in with a registered account to report content.',
      });
    });
  });

  describe('handleAuthRequired', () => {
    it('should call success callback if user can already report', () => {
      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        canReport: true,
      });

      const onAuthSuccess = jest.fn();
      const { result } = renderHook(() => useReportAuth());
      
      result.current.handleAuthRequired(onAuthSuccess);

      expect(onAuthSuccess).toHaveBeenCalled();
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it('should show alert for unauthenticated user', () => {
      mockUseAuth.mockReturnValue({
        triggerAuthFlow: jest.fn(),
        isAuthenticated: false,
        isGuest: false,
        isLoading: false,
        hasValidToken: false,
        user: null,
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
        checkAuthStatus: jest.fn(),
        exitAuthFlow: jest.fn(),
      });

      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: false,
        canReport: false,
        authMessage: 'Please sign in to report content.',
      });

      const { result } = renderHook(() => useReportAuth());
      
      result.current.handleAuthRequired();

      expect(mockAlert).toHaveBeenCalledWith(
        'Sign In Required',
        'Please sign in to report content.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Sign In' }),
        ])
      );
    });

    it('should show different alert title for guest users', () => {
      mockUseAuth.mockReturnValue({
        triggerAuthFlow: jest.fn(),
        isAuthenticated: true,
        isGuest: true,
        isLoading: false,
        hasValidToken: true,
        user: { id: 'guest_123', name: 'Guest User', createdAt: '2023-01-01' },
        login: jest.fn(),
        signup: jest.fn(),
        logout: jest.fn(),
        refreshAuth: jest.fn(),
        checkAuthStatus: jest.fn(),
        exitAuthFlow: jest.fn(),
      });

      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: true,
        canReport: false,
        authMessage: 'Please sign in with a registered account to report content.',
      });

      const { result } = renderHook(() => useReportAuth());
      
      result.current.handleAuthRequired();

      expect(mockAlert).toHaveBeenCalledWith(
        'Account Required',
        'Please sign in with a registered account to report content.',
        expect.any(Array)
      );
    });
  });

  describe('validateReportPermissions', () => {
    it('should return true when user can report', async () => {
      mockReportService.canUserReport.mockReturnValue({
        canReport: true,
      });

      const { result } = renderHook(() => useReportAuth());
      const canReport = await result.current.validateReportPermissions();

      expect(canReport).toBe(true);
      expect(mockReportService.canUserReport).toHaveBeenCalled();
    });

    it('should return false when user cannot report', async () => {
      mockReportService.canUserReport.mockReturnValue({
        canReport: false,
        reason: 'guest_user',
        userMessage: 'Guest users cannot report content.',
      });

      const { result } = renderHook(() => useReportAuth());
      const canReport = await result.current.validateReportPermissions();

      expect(canReport).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockReportService.canUserReport.mockImplementation(() => {
        throw new Error('Service error');
      });

      const { result } = renderHook(() => useReportAuth());
      const canReport = await result.current.validateReportPermissions();

      expect(canReport).toBe(false);
    });
  });

  describe('hook state', () => {
    it('should return current authentication state', () => {
      mockReportService.getAuthenticationStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        canReport: true,
      });

      const { result } = renderHook(() => useReportAuth());

      expect(result.current.canReport).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isGuest).toBe(false);
    });
  });
});