/**
 * Tests for reporting Redux slice
 */

import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import reportingReducer, {
  submitReport,
  clearReportError,
  clearReportSuccess,
  resetReportingState,
  markChallengeReported,
  clearReportedChallenges,
  selectIsReporting,
  selectReportError,
  selectReportErrorType,
  selectIsRecoverableError,
  selectReportSuccess,
  selectLastReportId,
  selectReportedChallenges,
  selectIsChallengeReported,
  ReportingState,
} from '../reportingSlice';
import { ReportError, ReportErrorType } from '../../../services/reportErrors';
import { ModerationReason } from '../../../types/reporting';

// Mock the report service
jest.mock('../../../services/reportService', () => ({
  reportService: {
    reportChallenge: jest.fn(),
  },
  ReportService: {
    getUserFriendlyErrorMessage: jest.fn(),
    isRecoverableError: jest.fn(),
  },
}));

interface TestRootState {
  reporting: ReportingState;
}

type TestStore = EnhancedStore<TestRootState>;

describe('reportingSlice', () => {
  let store: TestStore;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        reporting: reportingReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: true,
        }),
    }) as TestStore;
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().reporting;
      
      expect(state.isReporting).toBe(false);
      expect(state.reportError).toBe(null);
      expect(state.reportErrorType).toBe(null);
      expect(state.isRecoverableError).toBe(true);
      expect(state.reportSuccess).toBe(false);
      expect(state.lastReportId).toBe(null);
      expect(state.lastReportedChallengeId).toBe(null);
      expect(Array.isArray(state.reportedChallenges)).toBe(true);
      expect(state.reportedChallenges.length).toBe(0);
    });
  });

  describe('synchronous actions', () => {
    it('should clear report error', () => {
      // Set an error first
      store.dispatch({ 
        type: 'reporting/submitReport/rejected', 
        payload: {
          message: 'Test error',
          type: ReportErrorType.NETWORK_ERROR,
          isRecoverable: false,
        }
      });
      
      // Clear the error
      store.dispatch(clearReportError());
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe(null);
      expect(state.reportErrorType).toBe(null);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should clear report success', () => {
      // Set success state first
      store.dispatch({
        type: 'reporting/submitReport/fulfilled',
        payload: { challengeId: 'test-123', reportId: 456, message: 'Success' },
      });
      
      // Clear success
      store.dispatch(clearReportSuccess());
      
      const state = store.getState().reporting;
      expect(state.reportSuccess).toBe(false);
      expect(state.lastReportId).toBe(null);
      expect(state.lastReportedChallengeId).toBe(null);
    });

    it('should reset reporting state', () => {
      // Set some state first
      store.dispatch({
        type: 'reporting/submitReport/fulfilled',
        payload: { challengeId: 'test-123', reportId: 456, message: 'Success' },
      });
      
      // Reset state
      store.dispatch(resetReportingState());
      
      const state = store.getState().reporting;
      expect(state.isReporting).toBe(false);
      expect(state.reportError).toBe(null);
      expect(state.reportErrorType).toBe(null);
      expect(state.isRecoverableError).toBe(true);
      expect(state.reportSuccess).toBe(false);
      expect(state.lastReportId).toBe(null);
      expect(state.lastReportedChallengeId).toBe(null);
    });

    it('should mark challenge as reported', () => {
      const challengeId = 'test-challenge-123';
      
      store.dispatch(markChallengeReported(challengeId));
      
      const state = store.getState().reporting;
      expect(state.reportedChallenges.includes(challengeId)).toBe(true);
    });

    it('should clear reported challenges', () => {
      // Add some challenges first
      store.dispatch(markChallengeReported('challenge-1'));
      store.dispatch(markChallengeReported('challenge-2'));
      
      // Clear them
      store.dispatch(clearReportedChallenges());
      
      const state = store.getState().reporting;
      expect(state.reportedChallenges.length).toBe(0);
    });
  });

  describe('async actions', () => {
    const mockReportService = require('../../../services/reportService').reportService;
    const mockReportServiceClass = require('../../../services/reportService').ReportService;

    beforeEach(() => {
      jest.clearAllMocks();
      
      // Set up default mock implementations
      mockReportServiceClass.getUserFriendlyErrorMessage.mockImplementation((error: any) => {
        if (error instanceof ReportError) {
          return error.userMessage;
        }
        if (error?.message?.includes('Network request failed')) {
          return 'Unable to connect to the server. Please check your internet connection and try again.';
        }
        return 'An unexpected error occurred while submitting your report. Please try again.';
      });
      
      mockReportServiceClass.isRecoverableError.mockImplementation((error: any) => {
        if (error instanceof ReportError) {
          return error.type !== ReportErrorType.DUPLICATE_REPORT && 
                 error.type !== ReportErrorType.NOT_FOUND;
        }
        return true;
      });
    });

    it('should handle successful report submission', async () => {
      const mockResponse = {
        report_id: 123,
        message: 'Report submitted successfully',
        challenge_id: 'test-challenge',
      };
      
      mockReportService.reportChallenge.mockResolvedValue(mockResponse);

      const action = submitReport({
        challengeId: 'test-challenge',
        reason: ModerationReason.SPAM,
        details: 'This is spam content',
      });

      await store.dispatch(action as any);

      const state = store.getState().reporting;
      expect(state.isReporting).toBe(false);
      expect(state.reportSuccess).toBe(true);
      expect(state.lastReportId).toBe(123);
      expect(state.lastReportedChallengeId).toBe('test-challenge');
      expect(state.reportError).toBe(null);
      expect(state.reportedChallenges.includes('test-challenge')).toBe(true);
    });

    it('should handle failed report submission with ReportError', async () => {
      const reportError = new ReportError(
        ReportErrorType.AUTHENTICATION_ERROR,
        'Authentication required',
        'Please log in to report content. Your session may have expired.'
      );
      mockReportService.reportChallenge.mockRejectedValue(reportError);

      const action = submitReport({
        challengeId: 'test-challenge',
        reason: ModerationReason.SPAM,
      });

      await store.dispatch(action as any);

      const state = store.getState().reporting;
      expect(state.isReporting).toBe(false);
      expect(state.reportSuccess).toBe(false);
      expect(state.reportError).toBe('Please log in to report content. Your session may have expired.');
      expect(state.reportErrorType).toBe(ReportErrorType.AUTHENTICATION_ERROR);
      expect(state.isRecoverableError).toBe(true);
      expect(state.lastReportId).toBe(null);
    });

    it('should handle failed report submission with generic error', async () => {
      const errorMessage = 'Generic error';
      mockReportService.reportChallenge.mockRejectedValue(new Error(errorMessage));

      const action = submitReport({
        challengeId: 'test-challenge',
        reason: ModerationReason.SPAM,
      });

      await store.dispatch(action as any);

      const state = store.getState().reporting;
      expect(state.isReporting).toBe(false);
      expect(state.reportSuccess).toBe(false);
      expect(state.reportError).toBe('An unexpected error occurred while submitting your report. Please try again.');
      expect(state.reportErrorType).toBe(ReportErrorType.UNKNOWN_ERROR);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should handle non-recoverable errors', async () => {
      const reportError = new ReportError(
        ReportErrorType.DUPLICATE_REPORT,
        'Already reported',
        'You have already reported this challenge. Thank you for helping keep our community safe.'
      );
      mockReportService.reportChallenge.mockRejectedValue(reportError);

      const action = submitReport({
        challengeId: 'test-challenge',
        reason: ModerationReason.SPAM,
      });

      await store.dispatch(action as any);

      const state = store.getState().reporting;
      expect(state.isRecoverableError).toBe(false);
      expect(state.reportErrorType).toBe(ReportErrorType.DUPLICATE_REPORT);
    });

    it('should set loading state during submission', () => {
      mockReportService.reportChallenge.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const action = submitReport({
        challengeId: 'test-challenge',
        reason: ModerationReason.SPAM,
      });

      store.dispatch(action as any);

      const state = store.getState().reporting;
      expect(state.isReporting).toBe(true);
      expect(state.reportError).toBe(null);
      expect(state.reportErrorType).toBe(null);
      expect(state.isRecoverableError).toBe(true);
      expect(state.reportSuccess).toBe(false);
    });
  });

  describe('selectors', () => {
    it('should select reporting state correctly', () => {
      const state = { reporting: store.getState().reporting };
      
      expect(selectIsReporting(state)).toBe(false);
      expect(selectReportError(state)).toBe(null);
      expect(selectReportErrorType(state)).toBe(null);
      expect(selectIsRecoverableError(state)).toBe(true);
      expect(selectReportSuccess(state)).toBe(false);
      expect(selectLastReportId(state)).toBe(null);
      expect(Array.isArray(selectReportedChallenges(state))).toBe(true);
    });

    it('should check if challenge is reported', () => {
      const challengeId = 'test-challenge';
      
      // Initially not reported
      let state = { reporting: store.getState().reporting };
      expect(selectIsChallengeReported(challengeId)(state)).toBe(false);
      
      // Mark as reported
      store.dispatch(markChallengeReported(challengeId));
      state = { reporting: store.getState().reporting };
      expect(selectIsChallengeReported(challengeId)(state)).toBe(true);
    });
  });
});