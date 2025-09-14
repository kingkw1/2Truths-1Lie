/**
 * ReportService Tests
 * Comprehensive test suite for content reporting API integration
 */

import { reportService, ReportService } from '../reportService';
import { authService } from '../authService';
import { getApiBaseUrl } from '../../config/apiConfig';
import { ModerationReason, ReportRequest, ReportResponse } from '../../types/reporting';
import { ReportError, ReportErrorType } from '../reportErrors';

// Mock dependencies
jest.mock('../authService');
jest.mock('../../config/apiConfig');

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AbortController
global.AbortController = jest.fn().mockImplementation(() => ({
  abort: jest.fn(),
  signal: { aborted: false },
}));

// Mock setTimeout and clearTimeout
const mockSetTimeout = jest.fn().mockImplementation((callback) => {
  callback();
  return 123;
});
const mockClearTimeout = jest.fn();

global.setTimeout = mockSetTimeout as any;
global.clearTimeout = mockClearTimeout;

describe('ReportService', () => {
  const mockAuthService = authService as jest.Mocked<typeof authService>;
  const mockGetApiBaseUrl = getApiBaseUrl as jest.MockedFunction<typeof getApiBaseUrl>;

  const testChallengeId = 'test-challenge-123';
  const testApiBaseUrl = 'https://api.example.com/api/v1';
  const testAuthToken = 'test-auth-token-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset console mocks
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Default mock implementations
    mockGetApiBaseUrl.mockReturnValue(testApiBaseUrl);
    mockAuthService.getAuthToken.mockReturnValue(testAuthToken);
    mockAuthService.getAuthStatus.mockReturnValue({
      isAuthenticated: true,
      isGuest: false,
      user: { id: 'user-123', name: 'Test User', createdAt: '2023-01-01' },
      hasValidToken: true,
    });

    // Reset fetch mock
    mockFetch.mockReset();
    
    // Reset the singleton instance to pick up new mocked values
    (ReportService as any).instance = undefined;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('returns the same instance when called multiple times', () => {
      const instance1 = ReportService.getInstance();
      const instance2 = ReportService.getInstance();
      
      expect(instance1).toBe(instance2);
      // Note: reportService is imported before mocks are set up, so it may have different baseUrl
      expect(instance1).toBeInstanceOf(ReportService);
    });

    it('creates instance without errors', () => {
      expect(() => {
        ReportService.getInstance();
      }).not.toThrow();
    });
  });

  describe('canUserReport', () => {
    it('returns true for authenticated non-guest user', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user-123', name: 'Test User', createdAt: '2023-01-01' },
        hasValidToken: true,
      });

      const result = reportService.canUserReport();

      expect(result.canReport).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.userMessage).toBeUndefined();
    });

    it('returns false for unauthenticated user', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: null,
        hasValidToken: false,
      });

      const result = reportService.canUserReport();

      expect(result.canReport).toBe(false);
      expect(result.reason).toBe('not_authenticated');
      expect(result.userMessage).toBe('Please sign in to report content.');
    });

    it('returns false for guest user', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: true,
        user: { id: 'guest-123', name: 'Guest User', createdAt: '2023-01-01' },
        hasValidToken: true,
      });

      const result = reportService.canUserReport();

      expect(result.canReport).toBe(false);
      expect(result.reason).toBe('guest_user');
      expect(result.userMessage).toBe('Please sign in with a registered account to report content. Guest users cannot report content.');
    });

    it('returns false for user with invalid token', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user-123', name: 'Test User', createdAt: '2023-01-01' },
        hasValidToken: false,
      });

      const result = reportService.canUserReport();

      expect(result.canReport).toBe(false);
      expect(result.reason).toBe('invalid_token');
      expect(result.userMessage).toBe('Your session has expired. Please sign in again to report content.');
    });

    it('handles auth service errors gracefully', () => {
      mockAuthService.getAuthStatus.mockImplementation(() => {
        throw new Error('Auth service error');
      });

      const result = reportService.canUserReport();

      expect(result.canReport).toBe(false);
      expect(result.reason).toBe('auth_error');
      expect(result.userMessage).toBe('Unable to verify your authentication. Please try signing in again.');
    });
  });

  describe('getAuthenticationStatus', () => {
    it('returns correct status for authenticated user', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: false,
        user: { id: 'user-123', name: 'Test User', createdAt: '2023-01-01' },
        hasValidToken: true,
      });

      const status = reportService.getAuthenticationStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.isGuest).toBe(false);
      expect(status.canReport).toBe(true);
      expect(status.authMessage).toBeUndefined();
    });

    it('returns correct status for guest user', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: true,
        isGuest: true,
        user: { id: 'guest-123', name: 'Guest User', createdAt: '2023-01-01' },
        hasValidToken: true,
      });

      const status = reportService.getAuthenticationStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.isGuest).toBe(true);
      expect(status.canReport).toBe(false);
      expect(status.authMessage).toBe('Please sign in with a registered account to report content. Guest users cannot report content.');
    });
  });

  describe('reportChallenge - Success Cases', () => {
    const mockSuccessResponse: ReportResponse = {
      report_id: 12345,
      message: 'Challenge reported successfully',
      challenge_id: testChallengeId,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockSuccessResponse),
      } as any);
    });

    it('successfully reports challenge with ReportRequest object', async () => {
      const request: ReportRequest = {
        reason: ModerationReason.INAPPROPRIATE_LANGUAGE,
        details: 'Test details',
      };

      const testService = ReportService.getInstance();
      const result = await testService.reportChallenge(testChallengeId, request);

      expect(result).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testApiBaseUrl}/challenges/${testChallengeId}/report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testAuthToken}`,
            'User-Agent': 'TwoTruthsLie-Mobile/1.0',
          },
          body: JSON.stringify(request),
          signal: expect.any(Object),
        }
      );
    });

    it('successfully reports challenge with individual parameters', async () => {
      const reason = ModerationReason.SPAM;
      const details = 'This is spam content';

      const testService = ReportService.getInstance();
      const result = await testService.reportChallenge(testChallengeId, reason, details);

      expect(result).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testApiBaseUrl}/challenges/${testChallengeId}/report`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ reason, details }),
        })
      );
    });

    it('successfully reports challenge without details', async () => {
      const reason = ModerationReason.VIOLENCE;

      const testService = ReportService.getInstance();
      const result = await testService.reportChallenge(testChallengeId, reason);

      expect(result).toEqual(mockSuccessResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testApiBaseUrl}/challenges/${testChallengeId}/report`,
        expect.objectContaining({
          body: JSON.stringify({ reason, details: undefined }),
        })
      );
    });

    it('handles all moderation reasons correctly', async () => {
      const reasons = Object.values(ModerationReason);
      const testService = ReportService.getInstance();

      for (const reason of reasons) {
        await testService.reportChallenge(testChallengeId, reason);
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ reason, details: undefined }),
          })
        );
      }

      expect(mockFetch).toHaveBeenCalledTimes(reasons.length);
    });
  });

  describe('reportChallenge - Validation Errors', () => {
    it('throws validation error for empty challenge ID', async () => {
      await expect(
        reportService.reportChallenge('', ModerationReason.SPAM)
      ).rejects.toThrow(ReportError);

      await expect(
        reportService.reportChallenge('', ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.VALIDATION_ERROR,
        userMessage: 'Unable to report this challenge. Please try again.',
      });
    });

    it('throws validation error for whitespace-only challenge ID', async () => {
      await expect(
        reportService.reportChallenge('   ', ModerationReason.SPAM)
      ).rejects.toThrow(ReportError);
    });

    it('throws authentication error when user cannot report', () => {
      mockAuthService.getAuthStatus.mockReturnValue({
        isAuthenticated: false,
        isGuest: true,
        user: null,
        hasValidToken: false,
      });

      return expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Please sign in to report content.',
      });
    });

    it('throws authentication error when no auth token available', () => {
      mockAuthService.getAuthToken.mockReturnValue(null);

      return expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Your session has expired. Please sign in again to report content.',
      });
    });

    it('throws authentication error when auth token is empty', () => {
      mockAuthService.getAuthToken.mockReturnValue('');

      return expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Your session has expired. Please sign in again to report content.',
      });
    });

    it('throws authentication error when auth token is whitespace', () => {
      mockAuthService.getAuthToken.mockReturnValue('   ');

      return expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Your session has expired. Please sign in again to report content.',
      });
    });
  });

  describe('reportChallenge - HTTP Error Responses', () => {
    it('handles 401 Unauthorized error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ detail: 'Authentication required' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        statusCode: 401,
        userMessage: 'Please log in to report content. Your session may have expired.',
      });
    });

    it('handles 404 Not Found error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({ detail: 'Challenge not found' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NOT_FOUND,
        statusCode: 404,
        userMessage: 'This challenge is no longer available or has been removed.',
      });
    });

    it('handles 409 Conflict (duplicate report) error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValue({ detail: 'Challenge already reported by this user' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.DUPLICATE_REPORT,
        statusCode: 409,
        userMessage: 'You have already reported this challenge. Thank you for helping keep our community safe.',
      });
    });

    it('handles 422 Validation error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: jest.fn().mockResolvedValue({ detail: 'Invalid report data' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.VALIDATION_ERROR,
        statusCode: 422,
        userMessage: 'Please check your report details and try again.',
      });
    });

    it('handles 429 Rate Limit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({ detail: 'Too many requests' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.RATE_LIMIT,
        statusCode: 429,
        userMessage: 'You have submitted too many reports recently. Please wait a few minutes before trying again.',
      });
    });

    it('handles 500 Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ detail: 'Internal server error' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.SERVER_ERROR,
        statusCode: 500,
        userMessage: 'Our servers are experiencing issues. Please try again in a few minutes.',
      });
    });

    it('handles other server errors (502, 503, 504)', async () => {
      const serverErrorCodes = [502, 503, 504];

      for (const statusCode of serverErrorCodes) {
        mockFetch.mockResolvedValue({
          ok: false,
          status: statusCode,
          json: jest.fn().mockResolvedValue({ detail: `Server error ${statusCode}` }),
        } as any);

        await expect(
          reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
        ).rejects.toMatchObject({
          type: ReportErrorType.SERVER_ERROR,
          statusCode,
          userMessage: 'Our servers are experiencing issues. Please try again in a few minutes.',
        });
      }
    });

    it('handles unknown HTTP error codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 418, // I'm a teapot
        json: jest.fn().mockResolvedValue({ detail: 'Unknown error' }),
      } as any);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.UNKNOWN_ERROR,
        statusCode: 418,
        userMessage: 'An unexpected error occurred. Please try again.',
      });
    });

    it('handles response with invalid JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      // When JSON parsing fails, it falls back to default error handling based on status code
      // Status 400 falls through to the default case, which creates an UNKNOWN_ERROR
      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.UNKNOWN_ERROR,
        statusCode: 400,
        userMessage: 'An unexpected error occurred. Please try again.',
      });
    });
  });

  describe('reportChallenge - Network Errors', () => {
    it('handles network request failed error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network request failed'));

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      });
    });

    it('handles fetch failed error', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      });
    });

    it('handles timeout/abort error', async () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'The request took too long to complete. Please check your connection and try again.',
      });
    });

    it('handles generic timeout error', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout occurred'));

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'The request took too long to complete. Please check your connection and try again.',
      });
    });

    it('handles authentication errors from auth service', async () => {
      mockAuthService.getAuthToken.mockImplementation(() => {
        throw new Error('Authentication service unavailable');
      });

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Unable to authenticate your request. Please log in again.',
      });
    });

    it('handles unknown errors', async () => {
      mockFetch.mockRejectedValue(new Error('Unknown error occurred'));

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.UNKNOWN_ERROR,
        userMessage: 'An unexpected error occurred while submitting your report. Please try again.',
      });
    });

    it('handles non-Error objects', async () => {
      mockFetch.mockRejectedValue('String error');

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toThrow();
    });

    it('handles null/undefined errors', async () => {
      mockFetch.mockRejectedValue(null);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toThrow();
    });
  });

  describe('Static Utility Methods', () => {
    describe('getUserFriendlyErrorMessage', () => {
      it('returns user message from ReportError', () => {
        const error = new ReportError(
          ReportErrorType.NETWORK_ERROR,
          'Network failed',
          'Please check your connection'
        );

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('Please check your connection');
      });

      it('handles network request failed error', () => {
        const error = new Error('Network request failed');

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('Unable to connect to the server. Please check your internet connection and try again.');
      });

      it('handles fetch failed error', () => {
        const error = new Error('Failed to fetch');

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('Unable to connect to the server. Please check your internet connection and try again.');
      });

      it('handles timeout error', () => {
        const error = new Error('Request timeout');

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('The request took too long to complete. Please check your connection and try again.');
      });

      it('handles authentication error', () => {
        const error = new Error('Authentication failed');

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('Please log in to report content. Your session may have expired.');
      });

      it('handles unknown error', () => {
        const error = new Error('Some unknown error');

        const message = ReportService.getUserFriendlyErrorMessage(error);
        expect(message).toBe('An unexpected error occurred while submitting your report. Please try again.');
      });

      it('handles non-Error objects', () => {
        const message = ReportService.getUserFriendlyErrorMessage('String error');
        expect(message).toBe('An unexpected error occurred while submitting your report. Please try again.');
      });

      it('handles null/undefined', () => {
        const message1 = ReportService.getUserFriendlyErrorMessage(null);
        const message2 = ReportService.getUserFriendlyErrorMessage(undefined);
        
        expect(message1).toBe('An unexpected error occurred while submitting your report. Please try again.');
        expect(message2).toBe('An unexpected error occurred while submitting your report. Please try again.');
      });
    });

    describe('isRecoverableError', () => {
      it('returns false for duplicate report error', () => {
        const error = new ReportError(
          ReportErrorType.DUPLICATE_REPORT,
          'Already reported',
          'Already reported'
        );

        expect(ReportService.isRecoverableError(error)).toBe(false);
      });

      it('returns false for not found error', () => {
        const error = new ReportError(
          ReportErrorType.NOT_FOUND,
          'Not found',
          'Not found'
        );

        expect(ReportService.isRecoverableError(error)).toBe(false);
      });

      it('returns true for network error', () => {
        const error = new ReportError(
          ReportErrorType.NETWORK_ERROR,
          'Network error',
          'Network error'
        );

        expect(ReportService.isRecoverableError(error)).toBe(true);
      });

      it('returns true for authentication error', () => {
        const error = new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          'Auth error',
          'Auth error'
        );

        expect(ReportService.isRecoverableError(error)).toBe(true);
      });

      it('returns true for server error', () => {
        const error = new ReportError(
          ReportErrorType.SERVER_ERROR,
          'Server error',
          'Server error'
        );

        expect(ReportService.isRecoverableError(error)).toBe(true);
      });

      it('returns true for non-ReportError objects', () => {
        const error = new Error('Generic error');
        expect(ReportService.isRecoverableError(error)).toBe(true);
      });

      it('returns true for null/undefined', () => {
        expect(ReportService.isRecoverableError(null)).toBe(true);
        expect(ReportService.isRecoverableError(undefined)).toBe(true);
      });
    });
  });

  describe('Edge Cases and Integration', () => {
    it('handles very long challenge IDs', async () => {
      const longChallengeId = 'a'.repeat(1000);
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: longChallengeId,
        }),
      } as any);

      const testService = ReportService.getInstance();
      const result = await testService.reportChallenge(longChallengeId, ModerationReason.SPAM);
      
      expect(result.challenge_id).toBe(longChallengeId);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testApiBaseUrl}/challenges/${longChallengeId}/report`,
        expect.any(Object)
      );
    });

    it('handles special characters in challenge ID', async () => {
      const specialChallengeId = 'challenge-123!@#$%^&*()';
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: specialChallengeId,
        }),
      } as any);

      const testService = ReportService.getInstance();
      await testService.reportChallenge(specialChallengeId, ModerationReason.SPAM);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${testApiBaseUrl}/challenges/${specialChallengeId}/report`,
        expect.any(Object)
      );
    });

    it('handles very long report details', async () => {
      const longDetails = 'This is a very long report detail. '.repeat(100);
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      await reportService.reportChallenge(testChallengeId, ModerationReason.SPAM, longDetails);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ reason: ModerationReason.SPAM, details: longDetails }),
        })
      );
    });

    it('handles concurrent report requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      const promises = [
        reportService.reportChallenge('challenge-1', ModerationReason.SPAM),
        reportService.reportChallenge('challenge-2', ModerationReason.VIOLENCE),
        reportService.reportChallenge('challenge-3', ModerationReason.HATE_SPEECH),
      ];

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('preserves ReportError instances through error mapping', async () => {
      const originalError = new ReportError(
        ReportErrorType.NETWORK_ERROR,
        'Original error',
        'Original user message'
      );

      mockFetch.mockRejectedValue(originalError);

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toBe(originalError);
    });

    it('handles API base URL changes', async () => {
      const newApiUrl = 'https://new-api.example.com/api/v1';
      mockGetApiBaseUrl.mockReturnValue(newApiUrl);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      // Create a new instance to pick up the new API URL
      const testService = ReportService.getInstance();
      await testService.reportChallenge(testChallengeId, ModerationReason.SPAM);
      
      expect(mockFetch).toHaveBeenCalledWith(
        `${newApiUrl}/challenges/${testChallengeId}/report`,
        expect.any(Object)
      );
    });

    it('handles auth token changes between calls', async () => {
      const newToken = 'new-auth-token-67890';
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      // First call with original token
      await reportService.reportChallenge(testChallengeId, ModerationReason.SPAM);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testAuthToken}`,
          }),
        })
      );

      // Change token
      mockAuthService.getAuthToken.mockReturnValue(newToken);

      // Second call with new token
      await reportService.reportChallenge(testChallengeId, ModerationReason.VIOLENCE);
      
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${newToken}`,
          }),
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('sets up AbortController for timeout', async () => {
      const mockAbortController = {
        abort: jest.fn(),
        signal: { aborted: false },
      };
      
      (global.AbortController as jest.Mock).mockImplementation(() => mockAbortController);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      await reportService.reportChallenge(testChallengeId, ModerationReason.SPAM);

      expect(global.AbortController).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: mockAbortController.signal,
        })
      );
    });

    it('clears timeout on successful response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          report_id: 123,
          message: 'Success',
          challenge_id: testChallengeId,
        }),
      } as any);

      await reportService.reportChallenge(testChallengeId, ModerationReason.SPAM);

      expect(global.clearTimeout).toHaveBeenCalled();
    });

    it('clears timeout on error response', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        reportService.reportChallenge(testChallengeId, ModerationReason.SPAM)
      ).rejects.toThrow();

      expect(global.clearTimeout).toHaveBeenCalled();
    });
  });
});