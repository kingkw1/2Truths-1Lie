/**
 * Report Service Tests
 * Tests for content reporting API functionality
 */

import { reportService, ReportService } from '../reportService';
import { ReportError, ReportErrorType } from '../reportErrors';
import { ModerationReason } from '../../components/ReportModal';
import { authService } from '../authService';

// Mock the authService
jest.mock('../authService', () => ({
  authService: {
    getAuthToken: jest.fn(),
  },
}));

// Mock the API config
jest.mock('../../config/apiConfig', () => ({
  getApiBaseUrl: () => 'https://test-api.com/api/v1',
}));

// Mock fetch
global.fetch = jest.fn();

describe('ReportService', () => {
  const mockChallengeId = 'test-challenge-123';
  const mockToken = 'mock-jwt-token';
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
  const mockAuthService = authService as jest.Mocked<typeof authService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.getAuthToken.mockReturnValue(mockToken);
  });

  describe('reportChallenge', () => {
    it('should successfully report a challenge with structured request', async () => {
      const mockResponse = {
        report_id: 123,
        message: 'Challenge reported successfully',
        challenge_id: mockChallengeId,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await reportService.reportChallenge(mockChallengeId, {
        reason: ModerationReason.INAPPROPRIATE_LANGUAGE,
        details: 'Test details',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/v1/challenges/test-challenge-123/report',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
            'User-Agent': 'TwoTruthsLie-Mobile/1.0',
          },
          body: JSON.stringify({
            reason: ModerationReason.INAPPROPRIATE_LANGUAGE,
            details: 'Test details',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should successfully report a challenge with individual parameters', async () => {
      const mockResponse = {
        report_id: 124,
        message: 'Challenge reported successfully',
        challenge_id: mockChallengeId,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await reportService.reportChallenge(
        mockChallengeId,
        ModerationReason.SPAM,
        'Spam content'
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com/api/v1/challenges/test-challenge-123/report',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-jwt-token',
            'User-Agent': 'TwoTruthsLie-Mobile/1.0',
          },
          body: JSON.stringify({
            reason: ModerationReason.SPAM,
            details: 'Spam content',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle authentication required error', async () => {
      mockAuthService.getAuthToken.mockReturnValue(null);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Please log in to report content. Your session may have expired.',
      });
    });

    it('should handle 404 challenge not found error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Challenge not found' }),
      } as Response);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NOT_FOUND,
        userMessage: 'This challenge is no longer available or has been removed.',
      });
    });

    it('should handle 409 already reported error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ detail: 'Challenge already reported by this user' }),
      } as Response);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.DUPLICATE_REPORT,
        userMessage: 'You have already reported this challenge. Thank you for helping keep our community safe.',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      });
    });

    it('should handle validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Invalid report data provided' }),
      } as Response);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.VALIDATION_ERROR,
        userMessage: 'Please check your report details and try again.',
      });
    });

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ detail: 'Too many reports submitted' }),
      } as Response);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.RATE_LIMIT,
        userMessage: 'You have submitted too many reports recently. Please wait a few minutes before trying again.',
      });
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      } as Response);

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.SERVER_ERROR,
        userMessage: 'Our servers are experiencing issues. Please try again in a few minutes.',
      });
    });

    it('should handle timeout errors', async () => {
      // Mock a timeout by making fetch hang and then abort
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('The operation was aborted.', 'AbortError')), 100);
        })
      );

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.NETWORK_ERROR,
        userMessage: 'The request took too long to complete. Please check your connection and try again.',
      });
    });

    it('should handle invalid challenge ID', async () => {
      await expect(
        reportService.reportChallenge('', ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.VALIDATION_ERROR,
        userMessage: 'Unable to report this challenge. Please try again.',
      });
    });

    it('should handle auth service errors', async () => {
      mockAuthService.getAuthToken.mockImplementationOnce(() => {
        throw new Error('Auth service unavailable');
      });

      await expect(
        reportService.reportChallenge(mockChallengeId, ModerationReason.SPAM)
      ).rejects.toMatchObject({
        type: ReportErrorType.AUTHENTICATION_ERROR,
        userMessage: 'Unable to authenticate your request. Please log in again.',
      });
    });
  });

  describe('error utility methods', () => {
    it('should return user-friendly error messages', () => {
      const networkError = new ReportError(
        ReportErrorType.NETWORK_ERROR,
        'Network request failed',
        'Unable to connect to the server. Please check your internet connection and try again.'
      );

      expect(ReportService.getUserFriendlyErrorMessage(networkError))
        .toBe('Unable to connect to the server. Please check your internet connection and try again.');
    });

    it('should handle non-ReportError instances', () => {
      const genericError = new Error('Network request failed');
      
      expect(ReportService.getUserFriendlyErrorMessage(genericError))
        .toBe('Unable to connect to the server. Please check your internet connection and try again.');
    });

    it('should identify recoverable errors', () => {
      const networkError = new ReportError(
        ReportErrorType.NETWORK_ERROR,
        'Network request failed',
        'Connection error'
      );
      
      const duplicateError = new ReportError(
        ReportErrorType.DUPLICATE_REPORT,
        'Already reported',
        'Already reported'
      );

      expect(ReportService.isRecoverableError(networkError)).toBe(true);
      expect(ReportService.isRecoverableError(duplicateError)).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = reportService;
      const instance2 = reportService;
      expect(instance1).toBe(instance2);
    });
  });
});