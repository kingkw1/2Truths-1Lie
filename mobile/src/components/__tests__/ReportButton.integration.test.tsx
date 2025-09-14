/**
 * Integration test for ReportButton duplicate prevention functionality
 * Tests the complete workflow of reporting and button state management
 */

import { configureStore } from '@reduxjs/toolkit';
import reportingReducer, { 
  markChallengeReported, 
  selectIsChallengeReported 
} from '../../store/slices/reportingSlice';

describe('ReportButton Integration - Duplicate Prevention Logic', () => {
  const testChallengeId = 'test-challenge-123';

  const createTestStore = (initialState = {}) => {
    return configureStore({
      reducer: {
        reporting: reportingReducer,
      },
      preloadedState: {
        reporting: {
          isReporting: false,
          reportError: null,
          reportErrorType: null,
          reportSuccess: false,
          lastReportId: null,
          lastReportedChallengeId: null,
          reportedChallenges: [],
          isRecoverableError: true,
          ...initialState,
        },
      },
    });
  };

  it('should correctly identify when challenge is not reported', () => {
    const store = createTestStore();
    const state = { reporting: store.getState().reporting };
    
    const isReported = selectIsChallengeReported(testChallengeId)(state);
    expect(isReported).toBe(false);
  });

  it('should correctly identify when challenge is already reported', () => {
    const store = createTestStore({
      reportedChallenges: [testChallengeId],
    });
    const state = { reporting: store.getState().reporting };
    
    const isReported = selectIsChallengeReported(testChallengeId)(state);
    expect(isReported).toBe(true);
  });

  it('should update state when challenge is marked as reported', () => {
    const store = createTestStore();
    
    // Initially not reported
    let state = { reporting: store.getState().reporting };
    expect(selectIsChallengeReported(testChallengeId)(state)).toBe(false);
    
    // Mark as reported
    store.dispatch(markChallengeReported(testChallengeId));
    
    // Now reported
    state = { reporting: store.getState().reporting };
    expect(selectIsChallengeReported(testChallengeId)(state)).toBe(true);
  });

  it('should handle different challenge IDs independently', () => {
    const challengeId1 = 'challenge-1';
    const challengeId2 = 'challenge-2';
    
    const store = createTestStore({
      reportedChallenges: [challengeId1], // Only challenge-1 is reported
    });
    
    const state = { reporting: store.getState().reporting };
    
    expect(selectIsChallengeReported(challengeId1)(state)).toBe(true);
    expect(selectIsChallengeReported(challengeId2)(state)).toBe(false);
  });

  it('should prevent duplicate reports in the same session', () => {
    const store = createTestStore();
    
    // Mark challenge as reported twice
    store.dispatch(markChallengeReported(testChallengeId));
    store.dispatch(markChallengeReported(testChallengeId));
    
    const state = store.getState().reporting;
    
    // Should only appear once in the array
    const occurrences = state.reportedChallenges.filter(id => id === testChallengeId);
    expect(occurrences).toHaveLength(1);
  });

  it('should maintain reported challenges list across multiple reports', () => {
    const challengeId1 = 'challenge-1';
    const challengeId2 = 'challenge-2';
    const challengeId3 = 'challenge-3';
    
    const store = createTestStore();
    
    // Report multiple challenges
    store.dispatch(markChallengeReported(challengeId1));
    store.dispatch(markChallengeReported(challengeId2));
    store.dispatch(markChallengeReported(challengeId3));
    
    const state = { reporting: store.getState().reporting };
    
    expect(selectIsChallengeReported(challengeId1)(state)).toBe(true);
    expect(selectIsChallengeReported(challengeId2)(state)).toBe(true);
    expect(selectIsChallengeReported(challengeId3)(state)).toBe(true);
    expect(state.reporting.reportedChallenges).toHaveLength(3);
  });
});