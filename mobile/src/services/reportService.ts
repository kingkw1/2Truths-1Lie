/**
 * Report Service for Mobile App
 * Handles content reporting API calls
 */

import { getApiBaseUrl } from '../config/apiConfig';
import { authService } from './authService';
import { ModerationReason, ReportRequest, ReportResponse } from '../types/reporting';
import { ReportError, ReportErrorType } from './reportErrors';

// Re-export types for backward compatibility
export type { ReportRequest, ReportResponse } from '../types/reporting';

// Re-export for convenience
export { ReportError, ReportErrorType } from './reportErrors';



export class ReportService {
  private static instance: ReportService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const token = authService.getAuthToken();
      const authStatus = authService.getAuthStatus();
      
      // Check if user is authenticated and not a guest
      if (!authStatus.isAuthenticated || authStatus.isGuest) {
        throw new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          'User not authenticated or is guest user',
          'Please sign in with a registered account to report content.',
        );
      }
      
      if (!token || token.trim() === '') {
        throw new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          'No authentication token available',
          'Your session has expired. Please sign in again to report content.',
        );
      }
      
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'TwoTruthsLie-Mobile/1.0',
      };
    } catch (error) {
      console.error('🚩 REPORT: Error getting auth token:', error);
      
      // If it's already a ReportError, re-throw it
      if (error instanceof ReportError) {
        throw error;
      }
      
      // Otherwise, wrap it in a ReportError
      throw new ReportError(
        ReportErrorType.AUTHENTICATION_ERROR,
        'Failed to get authentication token',
        'Unable to authenticate your request. Please log in again.',
      );
    }
  }

  /**
   * Check if user can report content (authenticated and not guest)
   */
  public canUserReport(): { canReport: boolean; reason?: string; userMessage?: string } {
    try {
      const authStatus = authService.getAuthStatus();
      
      if (!authStatus.isAuthenticated) {
        return {
          canReport: false,
          reason: 'not_authenticated',
          userMessage: 'Please sign in to report content.',
        };
      }
      
      if (authStatus.isGuest) {
        return {
          canReport: false,
          reason: 'guest_user',
          userMessage: 'Please sign in with a registered account to report content. Guest users cannot report content.',
        };
      }
      
      if (!authStatus.hasValidToken) {
        return {
          canReport: false,
          reason: 'invalid_token',
          userMessage: 'Your session has expired. Please sign in again to report content.',
        };
      }
      
      return { canReport: true };
    } catch (error) {
      console.error('🚩 REPORT: Error checking user report permissions:', error);
      return {
        canReport: false,
        reason: 'auth_error',
        userMessage: 'Unable to verify your authentication. Please try signing in again.',
      };
    }
  }

  /**
   * Report a challenge for inappropriate content (structured request)
   */
  async reportChallenge(challengeId: string, request: ReportRequest): Promise<ReportResponse>;
  
  /**
   * Report a challenge for inappropriate content (individual parameters)
   */
  async reportChallenge(challengeId: string, reason: ModerationReason, details?: string): Promise<ReportResponse>;
  
  /**
   * Report a challenge for inappropriate content
   */
  async reportChallenge(
    challengeId: string, 
    requestOrReason: ReportRequest | ModerationReason, 
    details?: string
  ): Promise<ReportResponse> {
    // Handle both method signatures
    const request: ReportRequest = typeof requestOrReason === 'string' 
      ? { reason: requestOrReason, details }
      : requestOrReason;
    
    try {
      console.log('🚩 REPORT: Submitting report for challenge:', challengeId);
      console.log('🚩 REPORT: Reason:', request.reason);
      console.log('🚩 REPORT: Has details:', !!request.details);

      // Validate challenge ID
      if (!challengeId || challengeId.trim() === '') {
        throw new ReportError(
          ReportErrorType.VALIDATION_ERROR,
          'Invalid challenge ID',
          'Unable to report this challenge. Please try again.',
        );
      }

      // Check if user can report content
      const authCheck = this.canUserReport();
      if (!authCheck.canReport) {
        throw new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          authCheck.reason || 'Authentication required',
          authCheck.userMessage || 'Please sign in to report content.',
        );
      }

      // Get authentication headers with better error handling
      const headers = await this.getAuthHeaders();
      
      if (!headers.Authorization || headers.Authorization === 'Bearer ' || headers.Authorization === '') {
        throw new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          'No authentication token available',
          'Please log in to report content. Your session may have expired.',
        );
      }

      const url = `${this.baseUrl}/challenges/${challengeId}/report`;
      console.log('🚩 REPORT: API URL:', url);

      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('🚩 REPORT: Response status:', response.status);

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data: ReportResponse = await response.json();
        console.log('🚩 REPORT: Success - Report ID:', data.report_id);
        
        return data;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('🚩 REPORT: Error submitting report:', error);
      throw this.mapError(error);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: 'Server error occurred' };
    }

    const serverMessage = errorData.detail || errorData.message || 'Failed to submit report';
    
    switch (response.status) {
      case 401:
        throw new ReportError(
          ReportErrorType.AUTHENTICATION_ERROR,
          'Authentication required to report content',
          'Please log in to report content. Your session may have expired.',
          401
        );
      case 404:
        throw new ReportError(
          ReportErrorType.NOT_FOUND,
          'Challenge not found',
          'This challenge is no longer available or has been removed.',
          404
        );
      case 409:
        throw new ReportError(
          ReportErrorType.DUPLICATE_REPORT,
          'Challenge already reported by this user',
          'You have already reported this challenge. Thank you for helping keep our community safe.',
          409
        );
      case 422:
        throw new ReportError(
          ReportErrorType.VALIDATION_ERROR,
          'Invalid report data provided',
          'Please check your report details and try again.',
          422
        );
      case 429:
        throw new ReportError(
          ReportErrorType.RATE_LIMIT,
          'Too many reports submitted',
          'You have submitted too many reports recently. Please wait a few minutes before trying again.',
          429
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ReportError(
          ReportErrorType.SERVER_ERROR,
          `Server error: ${response.status}`,
          'Our servers are experiencing issues. Please try again in a few minutes.',
          response.status
        );
      default:
        throw new ReportError(
          ReportErrorType.UNKNOWN_ERROR,
          serverMessage,
          'An unexpected error occurred. Please try again.',
          response.status
        );
    }
  }

  private mapError(error: any): ReportError {
    // If it's already a ReportError, return it as-is
    if (error instanceof ReportError) {
      return error;
    }

    // Handle network-related errors
    if (error instanceof TypeError) {
      if (error.message.includes('Network request failed') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('network error')) {
        return new ReportError(
          ReportErrorType.NETWORK_ERROR,
          error.message,
          'Unable to connect to the server. Please check your internet connection and try again.',
        );
      }
    }

    // Handle timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new ReportError(
        ReportErrorType.NETWORK_ERROR,
        error.message || 'Request timeout',
        'The request took too long to complete. Please check your connection and try again.',
      );
    }

    // Handle authentication errors that weren't caught earlier
    if (error.message && error.message.includes('Authentication')) {
      return new ReportError(
        ReportErrorType.AUTHENTICATION_ERROR,
        error.message,
        'Please log in to report content. Your session may have expired.',
      );
    }

    // Handle any other Error objects
    if (error instanceof Error) {
      return new ReportError(
        ReportErrorType.UNKNOWN_ERROR,
        error.message,
        'An unexpected error occurred while submitting your report. Please try again.',
      );
    }

    // Handle non-Error objects
    const message = error?.message || error?.toString() || 'Unknown error';
    return new ReportError(
      ReportErrorType.UNKNOWN_ERROR,
      message,
      'An unexpected error occurred while submitting your report. Please try again.',
    );
  }

  /**
   * Get a user-friendly error message from a ReportError
   */
  public static getUserFriendlyErrorMessage(error: any): string {
    if (error instanceof ReportError) {
      return error.userMessage;
    }

    // Fallback for non-ReportError instances
    if (error?.message) {
      // Handle common network error messages
      if (error.message.includes('Network request failed') || 
          error.message.includes('Failed to fetch')) {
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      }
      
      if (error.message.includes('timeout')) {
        return 'The request took too long to complete. Please check your connection and try again.';
      }
      
      if (error.message.includes('Authentication')) {
        return 'Please log in to report content. Your session may have expired.';
      }
    }

    return 'An unexpected error occurred while submitting your report. Please try again.';
  }

  /**
   * Check if an error is recoverable (user can retry)
   */
  public static isRecoverableError(error: any): boolean {
    if (error instanceof ReportError) {
      return error.type !== ReportErrorType.DUPLICATE_REPORT && 
             error.type !== ReportErrorType.NOT_FOUND;
    }
    return true; // Assume other errors are recoverable
  }

  /**
   * Get authentication status for UI components
   */
  public getAuthenticationStatus(): {
    isAuthenticated: boolean;
    isGuest: boolean;
    canReport: boolean;
    authMessage?: string;
  } {
    const authStatus = authService.getAuthStatus();
    const reportCheck = this.canUserReport();
    
    return {
      isAuthenticated: authStatus.isAuthenticated,
      isGuest: authStatus.isGuest,
      canReport: reportCheck.canReport,
      authMessage: reportCheck.userMessage,
    };
  }
}

// Export singleton instance
export const reportService = ReportService.getInstance();