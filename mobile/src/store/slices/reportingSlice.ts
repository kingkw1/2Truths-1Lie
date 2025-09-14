/**
 * Reporting Redux slice
 * Manages content reporting state, submission actions, and user feedback
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { reportService, ReportService } from '../../services/reportService';
import { ReportError, ReportErrorType } from '../../services/reportErrors';
import { ModerationReason } from '../../components/ReportModal';

export interface ReportingState {
  isReporting: boolean;
  reportError: string | null;
  reportErrorType: ReportErrorType | null;
  reportSuccess: boolean;
  lastReportId: number | null;
  lastReportedChallengeId: string | null;
  reportedChallenges: string[];
  isRecoverableError: boolean;
}

const initialState: ReportingState = {
  isReporting: false,
  reportError: null,
  reportErrorType: null,
  reportSuccess: false,
  lastReportId: null,
  lastReportedChallengeId: null,
  reportedChallenges: [],
  isRecoverableError: true,
};

// Async thunk for submitting a report
export const submitReport = createAsyncThunk(
  'reporting/submit',
  async (
    { challengeId, reason, details }: { challengeId: string; reason: ModerationReason; details?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await reportService.reportChallenge(challengeId, reason, details);
      
      return {
        challengeId,
        reportId: response.report_id,
        message: response.message,
      };
    } catch (error: any) {
      const userMessage = ReportService.getUserFriendlyErrorMessage(error);
      const errorType = error instanceof ReportError ? error.type : ReportErrorType.UNKNOWN_ERROR;
      const isRecoverable = ReportService.isRecoverableError(error);
      
      return rejectWithValue({
        message: userMessage,
        type: errorType,
        isRecoverable,
        originalError: error.message || 'Failed to submit report',
      });
    }
  }
);

const reportingSlice = createSlice({
  name: 'reporting',
  initialState,
  reducers: {
    clearReportError: (state) => {
      state.reportError = null;
      state.reportErrorType = null;
      state.isRecoverableError = true;
    },
    
    clearReportSuccess: (state) => {
      state.reportSuccess = false;
      state.lastReportId = null;
      state.lastReportedChallengeId = null;
    },
    
    resetReportingState: (state) => {
      state.isReporting = false;
      state.reportError = null;
      state.reportErrorType = null;
      state.reportSuccess = false;
      state.lastReportId = null;
      state.lastReportedChallengeId = null;
      state.isRecoverableError = true;
    },
    
    // Mark a challenge as reported (for UI state management)
    markChallengeReported: (state, action: PayloadAction<string>) => {
      if (!state.reportedChallenges.includes(action.payload)) {
        state.reportedChallenges.push(action.payload);
      }
    },
    
    // Clear all reported challenges (e.g., on app restart)
    clearReportedChallenges: (state) => {
      state.reportedChallenges = [];
    },
  },
  extraReducers: (builder) => {
    // Submit report
    builder
      .addCase(submitReport.pending, (state) => {
        state.isReporting = true;
        state.reportError = null;
        state.reportErrorType = null;
        state.reportSuccess = false;
        state.isRecoverableError = true;
      })
      .addCase(submitReport.fulfilled, (state, action) => {
        state.isReporting = false;
        state.reportSuccess = true;
        state.lastReportId = action.payload.reportId;
        state.lastReportedChallengeId = action.payload.challengeId;
        state.reportError = null;
        state.reportErrorType = null;
        state.isRecoverableError = true;
        
        // Mark challenge as reported
        if (!state.reportedChallenges.includes(action.payload.challengeId)) {
          state.reportedChallenges.push(action.payload.challengeId);
        }
      })
      .addCase(submitReport.rejected, (state, action) => {
        state.isReporting = false;
        state.reportSuccess = false;
        
        const payload = action.payload as any;
        if (payload && typeof payload === 'object') {
          state.reportError = payload.message;
          state.reportErrorType = payload.type;
          state.isRecoverableError = payload.isRecoverable;
        } else {
          state.reportError = payload as string || 'Failed to submit report';
          state.reportErrorType = ReportErrorType.UNKNOWN_ERROR;
          state.isRecoverableError = true;
        }
      });
  },
});

export const {
  clearReportError,
  clearReportSuccess,
  resetReportingState,
  markChallengeReported,
  clearReportedChallenges,
} = reportingSlice.actions;

// Selectors
export const selectReporting = (state: { reporting: ReportingState }) => state.reporting;
export const selectIsReporting = (state: { reporting: ReportingState }) => state.reporting.isReporting;
export const selectReportError = (state: { reporting: ReportingState }) => state.reporting.reportError;
export const selectReportErrorType = (state: { reporting: ReportingState }) => state.reporting.reportErrorType;
export const selectIsRecoverableError = (state: { reporting: ReportingState }) => state.reporting.isRecoverableError;
export const selectReportSuccess = (state: { reporting: ReportingState }) => state.reporting.reportSuccess;
export const selectLastReportId = (state: { reporting: ReportingState }) => state.reporting.lastReportId;
export const selectLastReportedChallengeId = (state: { reporting: ReportingState }) => state.reporting.lastReportedChallengeId;
export const selectReportedChallenges = (state: { reporting: ReportingState }) => state.reporting.reportedChallenges;

// Helper selector to check if a specific challenge has been reported
export const selectIsChallengeReported = (challengeId: string) => (state: { reporting: ReportingState }) =>
  state.reporting.reportedChallenges.includes(challengeId);

export default reportingSlice.reducer;