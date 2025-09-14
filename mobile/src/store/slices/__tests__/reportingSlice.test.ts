/**
 * Tests for reporting Redux slice
 * Comprehensive test coverage for actions, reducers, state transitions, and async thunk behavior
 */

import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import reportingReducer, {
  submitReport,
  clearReportError,
  clearReportSuccess,
  resetReportingState,
  markChallengeReported,
  clearReportedChallenges,
  selectReporting,
  selectIsReporting,
  selectReportError,
  selectReportErrorType,
  selectIsRecoverableError,
  selectReportSuccess,
  selectLastReportId,
  selectLastReportedChallengeId,
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
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      
      // Set an error first using the rejected action with rejectWithValue payload
      const error = new Error('Test error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, {
        message: 'Test error',
        type: ReportErrorType.NETWORK_ERROR,
        isRecoverable: false,
      });
      store.dispatch(rejectedAction);
      
      // Clear the error
      store.dispatch(clearReportError());
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe(null);
      expect(state.reportErrorType).toBe(null);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should clear report success', () => {
      const requestParams = { challengeId: 'test-123', reason: ModerationReason.SPAM };
      
      // Set success state first
      const payload = { challengeId: 'test-123', reportId: 456, message: 'Success' };
      store.dispatch(submitReport.fulfilled(payload, 'requestId', requestParams));
      
      // Clear success
      store.dispatch(clearReportSuccess());
      
      const state = store.getState().reporting;
      expect(state.reportSuccess).toBe(false);
      expect(state.lastReportId).toBe(null);
      expect(state.lastReportedChallengeId).toBe(null);
    });

    it('should reset reporting state', () => {
      const requestParams = { challengeId: 'test-123', reason: ModerationReason.SPAM };
      
      // Set some state first
      const payload = { challengeId: 'test-123', reportId: 456, message: 'Success' };
      store.dispatch(submitReport.fulfilled(payload, 'requestId', requestParams));
      
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
      expect(selectLastReportedChallengeId(state)).toBe(null);
      expect(Array.isArray(selectReportedChallenges(state))).toBe(true);
    });

    it('should select entire reporting state', () => {
      const state = { reporting: store.getState().reporting };
      const reportingState = selectReporting(state);
      
      expect(reportingState).toEqual(store.getState().reporting);
      expect(typeof reportingState).toBe('object');
      expect(reportingState).toHaveProperty('isReporting');
      expect(reportingState).toHaveProperty('reportError');
      expect(reportingState).toHaveProperty('reportErrorType');
      expect(reportingState).toHaveProperty('reportSuccess');
      expect(reportingState).toHaveProperty('lastReportId');
      expect(reportingState).toHaveProperty('lastReportedChallengeId');
      expect(reportingState).toHaveProperty('reportedChallenges');
      expect(reportingState).toHaveProperty('isRecoverableError');
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

    it('should handle multiple reported challenges in selector', () => {
      const challengeIds = ['challenge-1', 'challenge-2', 'challenge-3'];
      
      // Mark multiple challenges as reported
      challengeIds.forEach(id => store.dispatch(markChallengeReported(id)));
      
      const state = { reporting: store.getState().reporting };
      
      // Check each challenge individually
      challengeIds.forEach(id => {
        expect(selectIsChallengeReported(id)(state)).toBe(true);
      });
      
      // Check unreported challenge
      expect(selectIsChallengeReported('unreported-challenge')(state)).toBe(false);
    });

    it('should select last reported challenge ID correctly', () => {
      const challengeId = 'last-reported-challenge';
      
      // Submit a report using the fulfilled action creator
      store.dispatch(submitReport.fulfilled(
        { challengeId, reportId: 789, message: 'Success' },
        'requestId',
        { challengeId, reason: ModerationReason.SPAM }
      ));
      
      const state = { reporting: store.getState().reporting };
      expect(selectLastReportedChallengeId(state)).toBe(challengeId);
    });
  });

  describe('state transitions', () => {
    it('should transition from initial to loading state', () => {
      const initialState = store.getState().reporting;
      expect(initialState.isReporting).toBe(false);
      
      // Dispatch pending action using action creator
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      store.dispatch(submitReport.pending('requestId', requestParams));
      
      const loadingState = store.getState().reporting;
      expect(loadingState.isReporting).toBe(true);
      expect(loadingState.reportError).toBe(null);
      expect(loadingState.reportSuccess).toBe(false);
    });

    it('should transition from loading to success state', () => {
      const requestParams = { challengeId: 'test-123', reason: ModerationReason.SPAM };
      
      // Start with loading state
      store.dispatch(submitReport.pending('requestId', requestParams));
      expect(store.getState().reporting.isReporting).toBe(true);
      
      // Transition to success
      const payload = { challengeId: 'test-123', reportId: 456, message: 'Success' };
      store.dispatch(submitReport.fulfilled(payload, 'requestId', requestParams));
      
      const successState = store.getState().reporting;
      expect(successState.isReporting).toBe(false);
      expect(successState.reportSuccess).toBe(true);
      expect(successState.lastReportId).toBe(456);
      expect(successState.lastReportedChallengeId).toBe('test-123');
      expect(successState.reportError).toBe(null);
    });

    it('should transition from loading to error state', () => {
      const requestParams = { challengeId: 'test-error', reason: ModerationReason.SPAM };
      
      // Start with loading state
      store.dispatch(submitReport.pending('requestId', requestParams));
      expect(store.getState().reporting.isReporting).toBe(true);
      
      // Transition to error
      const error = new Error('Network error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, {
        message: 'Network error',
        type: ReportErrorType.NETWORK_ERROR,
        isRecoverable: true,
      });
      store.dispatch(rejectedAction);
      
      const errorState = store.getState().reporting;
      expect(errorState.isReporting).toBe(false);
      expect(errorState.reportSuccess).toBe(false);
      expect(errorState.reportError).toBe('Network error');
      expect(errorState.reportErrorType).toBe(ReportErrorType.NETWORK_ERROR);
      expect(errorState.isRecoverableError).toBe(true);
    });

    it('should handle state transitions with multiple actions', () => {
      // Initial state
      expect(store.getState().reporting.isReporting).toBe(false);
      
      const firstParams = { challengeId: 'test-first', reason: ModerationReason.SPAM };
      const secondParams = { challengeId: 'test-456', reason: ModerationReason.SPAM };
      
      // Start reporting
      store.dispatch(submitReport.pending('requestId1', firstParams));
      expect(store.getState().reporting.isReporting).toBe(true);
      
      // Fail first attempt
      const error = new Error('First error');
      const rejectedAction = submitReport.rejected(error, 'requestId1', firstParams, {
        message: 'First error',
        type: ReportErrorType.NETWORK_ERROR,
        isRecoverable: true,
      });
      store.dispatch(rejectedAction);
      expect(store.getState().reporting.isReporting).toBe(false);
      expect(store.getState().reporting.reportError).toBe('First error');
      
      // Clear error and try again
      store.dispatch(clearReportError());
      expect(store.getState().reporting.reportError).toBe(null);
      
      // Start second attempt
      store.dispatch(submitReport.pending('requestId2', secondParams));
      expect(store.getState().reporting.isReporting).toBe(true);
      
      // Succeed second attempt
      const successPayload = { challengeId: 'test-456', reportId: 789, message: 'Success' };
      store.dispatch(submitReport.fulfilled(successPayload, 'requestId2', secondParams));
      
      const finalState = store.getState().reporting;
      expect(finalState.isReporting).toBe(false);
      expect(finalState.reportSuccess).toBe(true);
      expect(finalState.reportError).toBe(null);
      expect(finalState.lastReportId).toBe(789);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed error payload', () => {
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      const error = new Error('Malformed error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, null);
      store.dispatch(rejectedAction);
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe('Failed to submit report');
      expect(state.reportErrorType).toBe(ReportErrorType.UNKNOWN_ERROR);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should handle string error payload', () => {
      const errorMessage = 'Simple string error';
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      const error = new Error(errorMessage);
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, errorMessage);
      store.dispatch(rejectedAction);
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe(errorMessage);
      expect(state.reportErrorType).toBe(ReportErrorType.UNKNOWN_ERROR);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should handle undefined error payload', () => {
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      const error = new Error('Undefined error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, undefined);
      store.dispatch(rejectedAction);
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe('Failed to submit report');
      expect(state.reportErrorType).toBe(ReportErrorType.UNKNOWN_ERROR);
      expect(state.isRecoverableError).toBe(true);
    });

    it('should handle partial error payload', () => {
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      const error = new Error('Partial error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, { 
        message: 'Partial error',
        // Missing type and isRecoverable properties to test partial payload handling
      });
      store.dispatch(rejectedAction);
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe('Partial error');
      expect(state.reportErrorType).toBe(undefined); // Should be undefined since not provided
      expect(state.isRecoverableError).toBe(undefined); // Should be undefined since not provided
    });
  });

  describe('duplicate challenge handling', () => {
    it('should not add duplicate challenges to reported list', () => {
      const challengeId = 'duplicate-test';
      
      // Add challenge multiple times
      store.dispatch(markChallengeReported(challengeId));
      store.dispatch(markChallengeReported(challengeId));
      store.dispatch(markChallengeReported(challengeId));
      
      const state = store.getState().reporting;
      const occurrences = state.reportedChallenges.filter(id => id === challengeId);
      expect(occurrences.length).toBe(1);
    });

    it('should handle duplicate challenges in async thunk fulfillment', () => {
      const challengeId = 'async-duplicate-test';
      const requestParams = { challengeId, reason: ModerationReason.SPAM };
      
      // Mark as reported via action
      store.dispatch(markChallengeReported(challengeId));
      
      // Submit report for same challenge
      const payload = { challengeId, reportId: 999, message: 'Success' };
      store.dispatch(submitReport.fulfilled(payload, 'requestId', requestParams));
      
      const state = store.getState().reporting;
      const occurrences = state.reportedChallenges.filter(id => id === challengeId);
      expect(occurrences.length).toBe(1);
    });
  });

  describe('async thunk behavior validation', () => {
    const mockReportService = require('../../../services/reportService').reportService;
    const mockReportServiceClass = require('../../../services/reportService').ReportService;

    it('should call report service with correct parameters', async () => {
      const mockResponse = { report_id: 123, message: 'Success', challenge_id: 'test' };
      mockReportService.reportChallenge.mockResolvedValue(mockResponse);

      const params = {
        challengeId: 'test-challenge',
        reason: ModerationReason.INAPPROPRIATE_LANGUAGE,
        details: 'Test details',
      };

      await store.dispatch(submitReport(params) as any);

      expect(mockReportService.reportChallenge).toHaveBeenCalledWith(
        params.challengeId,
        params.reason,
        params.details
      );
    });

    it('should handle async thunk without details parameter', async () => {
      const mockResponse = { report_id: 456, message: 'Success', challenge_id: 'test' };
      mockReportService.reportChallenge.mockResolvedValue(mockResponse);

      const params = {
        challengeId: 'test-challenge-no-details',
        reason: ModerationReason.SPAM,
      };

      await store.dispatch(submitReport(params) as any);

      expect(mockReportService.reportChallenge).toHaveBeenCalledWith(
        params.challengeId,
        params.reason,
        undefined
      );
    });

    it('should handle different moderation reasons', async () => {
      // Clear previous mock calls
      mockReportService.reportChallenge.mockClear();
      
      const mockResponse = { report_id: 789, message: 'Success', challenge_id: 'test' };
      mockReportService.reportChallenge.mockResolvedValue(mockResponse);

      const reasons = [
        ModerationReason.INAPPROPRIATE_LANGUAGE,
        ModerationReason.SPAM,
        ModerationReason.VIOLENCE,
        ModerationReason.HATE_SPEECH,
        ModerationReason.ADULT_CONTENT,
      ];

      for (const reason of reasons) {
        await store.dispatch(submitReport({
          challengeId: `test-${reason}`,
          reason,
        }) as any);
      }

      expect(mockReportService.reportChallenge).toHaveBeenCalledTimes(reasons.length);
    });

    it('should handle service error transformation correctly', async () => {
      const originalError = new Error('Network request failed');
      mockReportService.reportChallenge.mockRejectedValue(originalError);
      
      mockReportServiceClass.getUserFriendlyErrorMessage.mockReturnValue('Connection error');
      mockReportServiceClass.isRecoverableError.mockReturnValue(true);

      await store.dispatch(submitReport({
        challengeId: 'error-test',
        reason: ModerationReason.SPAM,
      }) as any);

      expect(mockReportServiceClass.getUserFriendlyErrorMessage).toHaveBeenCalledWith(originalError);
      expect(mockReportServiceClass.isRecoverableError).toHaveBeenCalledWith(originalError);
      
      const state = store.getState().reporting;
      expect(state.reportError).toBe('Connection error');
      expect(state.isRecoverableError).toBe(true);
    });
  });

  describe('reducer immutability', () => {
    it('should not mutate state when marking challenge as reported', () => {
      const initialState = store.getState().reporting;
      const initialChallenges = [...initialState.reportedChallenges];
      
      store.dispatch(markChallengeReported('immutability-test'));
      
      const newState = store.getState().reporting;
      expect(initialState.reportedChallenges).toEqual(initialChallenges);
      expect(newState.reportedChallenges).not.toBe(initialState.reportedChallenges);
      expect(newState.reportedChallenges.includes('immutability-test')).toBe(true);
    });

    it('should not mutate state when clearing errors', () => {
      const requestParams = { challengeId: 'test', reason: ModerationReason.SPAM };
      
      // Set error state
      const error = new Error('Test error');
      const rejectedAction = submitReport.rejected(error, 'requestId', requestParams, {
        message: 'Test error',
        type: ReportErrorType.NETWORK_ERROR,
        isRecoverable: false,
      });
      store.dispatch(rejectedAction);
      
      const errorState = store.getState().reporting;
      expect(errorState.reportError).toBe('Test error');
      
      // Clear error
      store.dispatch(clearReportError());
      
      const clearedState = store.getState().reporting;
      expect(errorState.reportError).toBe('Test error'); // Original state unchanged
      expect(clearedState.reportError).toBe(null); // New state updated
      expect(clearedState).not.toBe(errorState); // Different object references
    });

    it('should not mutate state during async thunk lifecycle', () => {
      const initialState = store.getState().reporting;
      const requestParams = { challengeId: 'immutable-test', reason: ModerationReason.SPAM };
      
      // Pending
      store.dispatch(submitReport.pending('requestId', requestParams));
      const pendingState = store.getState().reporting;
      expect(pendingState).not.toBe(initialState);
      expect(initialState.isReporting).toBe(false);
      expect(pendingState.isReporting).toBe(true);
      
      // Fulfilled
      const payload = { challengeId: 'immutable-test', reportId: 123, message: 'Success' };
      store.dispatch(submitReport.fulfilled(payload, 'requestId', requestParams));
      const fulfilledState = store.getState().reporting;
      expect(fulfilledState).not.toBe(pendingState);
      expect(pendingState.reportSuccess).toBe(false);
      expect(fulfilledState.reportSuccess).toBe(true);
    });
  });
});