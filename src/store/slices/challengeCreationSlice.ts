/**
 * Challenge Creation Redux slice
 * Manages the state during challenge creation workflow
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChallengeCreation, Statement, MediaCapture, EmotionScores } from '../../types';

export interface ChallengeCreationState {
  currentChallenge: Partial<ChallengeCreation>;
  isRecording: boolean;
  recordingType: 'video' | 'audio' | null;
  currentStatementIndex: number;
  validationErrors: string[];
  isSubmitting: boolean;
  submissionSuccess: boolean;
  previewMode: boolean;
  // Media recording state per statement
  mediaRecordingState: {
    [statementIndex: number]: {
      isRecording: boolean;
      isPaused: boolean;
      duration: number;
      mediaType: 'video' | 'audio' | 'text' | null;
      hasPermission: boolean;
      error: string | null;
      isCompressing: boolean;
      compressionProgress: number | null;
    };
  };
  // Upload state per statement
  uploadState: {
    [statementIndex: number]: {
      isUploading: boolean;
      uploadProgress: number;
      uploadError: string | null;
      sessionId: string | null;
    };
  };
}

const initialState: ChallengeCreationState = {
  currentChallenge: {
    creatorId: '',
    statements: [
      { id: 'stmt_1', text: '', isLie: false, confidence: 0 },
      { id: 'stmt_2', text: '', isLie: false, confidence: 0 },
      { id: 'stmt_3', text: '', isLie: false, confidence: 0 },
    ],
    mediaData: [],
    isPublic: true,
  },
  isRecording: false,
  recordingType: null,
  currentStatementIndex: 0,
  validationErrors: [],
  isSubmitting: false,
  submissionSuccess: false,
  previewMode: false,
  mediaRecordingState: {},
  uploadState: {},
};

const challengeCreationSlice = createSlice({
  name: 'challengeCreation',
  initialState,
  reducers: {
    startNewChallenge: (state) => {
      state.currentChallenge = {
        creatorId: '',
        statements: [
          { id: 'stmt_1', text: '', isLie: false, confidence: 0 },
          { id: 'stmt_2', text: '', isLie: false, confidence: 0 },
          { id: 'stmt_3', text: '', isLie: false, confidence: 0 },
        ],
        mediaData: [],
        isPublic: true,
      };
      state.currentStatementIndex = 0;
      state.validationErrors = [];
      state.isSubmitting = false;
      state.submissionSuccess = false;
      state.previewMode = false;
    },

    updateStatement: (state, action: PayloadAction<{ index: number; statement: Statement }>) => {
      const { index, statement } = action.payload;
      
      // Ensure statements array has enough elements
      while (state.currentChallenge.statements!.length <= index) {
        state.currentChallenge.statements!.push({
          id: `stmt_${Date.now()}_${state.currentChallenge.statements!.length}`,
          text: '',
          isLie: false,
          confidence: 0,
        });
      }
      
      state.currentChallenge.statements![index] = statement;
      state.currentStatementIndex = index;
    },

    setLieStatement: (state, action: PayloadAction<number>) => {
      if (!state.currentChallenge.statements || state.currentChallenge.statements.length === 0) return;
      
      // Reset all statements to not be lies
      state.currentChallenge.statements.forEach(stmt => {
        stmt.isLie = false;
      });
      
      // Set the selected statement as the lie
      const targetIndex = action.payload;
      if (targetIndex >= 0 && targetIndex < state.currentChallenge.statements.length) {
        const targetStatement = state.currentChallenge.statements[targetIndex];
        if (targetStatement) {
          targetStatement.isLie = true;
        }
      }
    },

    startRecording: (state, action: PayloadAction<'video' | 'audio'>) => {
      state.isRecording = true;
      state.recordingType = action.payload;
    },

    stopRecording: (state) => {
      state.isRecording = false;
      state.recordingType = null;
    },

    setMediaData: (state, action: PayloadAction<MediaCapture>) => {
      if (!state.currentChallenge.mediaData) {
        state.currentChallenge.mediaData = [];
      }
      state.currentChallenge.mediaData.push(action.payload);
    },

    setStatementMedia: (state, action: PayloadAction<{ index: number; media: MediaCapture | null }>) => {
      const { index, media } = action.payload;
      
      if (!state.currentChallenge.mediaData) {
        state.currentChallenge.mediaData = [];
      }
      
      // Ensure mediaData array has enough elements
      while (state.currentChallenge.mediaData.length <= index) {
        state.currentChallenge.mediaData.push({
          type: 'text',
          duration: 0,
        });
      }
      
      if (media) {
        state.currentChallenge.mediaData[index] = media;
      } else {
        // Remove media for this statement
        state.currentChallenge.mediaData[index] = {
          type: 'text',
          duration: 0,
        };
      }
    },

    setEmotionAnalysis: (state, action: PayloadAction<EmotionScores>) => {
      if (!state.currentChallenge.emotionAnalysis) {
        state.currentChallenge.emotionAnalysis = [];
      }
      state.currentChallenge.emotionAnalysis.push(action.payload);
    },

    setQualityScore: (state, action: PayloadAction<number>) => {
      state.currentChallenge.qualityScore = action.payload;
    },

    setEstimatedDifficulty: (state, action: PayloadAction<'easy' | 'medium' | 'hard'>) => {
      state.currentChallenge.estimatedDifficulty = action.payload;
    },

    validateChallenge: (state) => {
      const errors: string[] = [];
      
      if (!state.currentChallenge.statements || state.currentChallenge.statements.length !== 3) {
        errors.push('Must have exactly 3 statements');
      }
      
      if (state.currentChallenge.statements) {
        const hasLie = state.currentChallenge.statements.some(stmt => stmt.isLie);
        if (!hasLie) {
          errors.push('Must select one statement as the lie');
        }
        
        // Simplified validation: text statements are always required as fallback
        // Media recording is optional - if it fails, text serves as fallback
        const emptyStatements = state.currentChallenge.statements.filter(stmt => !stmt.text.trim());
        if (emptyStatements.length > 0) {
          errors.push('All statements must have text (text serves as fallback when video recording is unavailable)');
        }
        
        // Optional: Check if any media recording failed and provide helpful message
        if (state.mediaRecordingState && Object.keys(state.mediaRecordingState).length > 0) {
          const hasFailedRecordings = Object.values(state.mediaRecordingState).some(
            recordingState => recordingState && recordingState.error !== null
          );
          
          if (hasFailedRecordings) {
            // This is informational only - not a blocking error
            console.info('Some media recordings failed, but text fallback is available');
          }
        }
      }
      
      state.validationErrors = errors;
    },

    enterPreviewMode: (state) => {
      state.previewMode = true;
    },

    exitPreviewMode: (state) => {
      state.previewMode = false;
    },

    startSubmission: (state) => {
      state.isSubmitting = true;
      state.submissionSuccess = false;
    },

    completeSubmission: (state, action: PayloadAction<{ success: boolean }>) => {
      state.isSubmitting = false;
      state.submissionSuccess = action.payload.success;
    },

    clearValidationErrors: (state) => {
      state.validationErrors = [];
    },

    // Media recording state actions
    setMediaRecordingState: (state, action: PayloadAction<{
      statementIndex: number;
      recordingState: Partial<ChallengeCreationState['mediaRecordingState'][number]>;
    }>) => {
      const { statementIndex, recordingState } = action.payload;
      if (!state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex] = {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        };
      }
      state.mediaRecordingState[statementIndex] = {
        ...state.mediaRecordingState[statementIndex],
        ...recordingState,
      };
    },

    startMediaRecording: (state, action: PayloadAction<{
      statementIndex: number;
      mediaType: 'video' | 'audio' | 'text';
    }>) => {
      const { statementIndex, mediaType } = action.payload;
      state.mediaRecordingState[statementIndex] = {
        isRecording: true,
        isPaused: false,
        duration: 0,
        mediaType,
        hasPermission: true,
        error: null,
        isCompressing: false,
        compressionProgress: null,
      };
      state.isRecording = true;
      state.recordingType = mediaType === 'text' ? null : mediaType;
      state.currentStatementIndex = statementIndex;
    },

    stopMediaRecording: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      if (state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex].isRecording = false;
        state.mediaRecordingState[statementIndex].isPaused = false;
      }
      state.isRecording = false;
      state.recordingType = null;
    },

    pauseMediaRecording: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      if (state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex].isPaused = true;
      }
    },

    resumeMediaRecording: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      if (state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex].isPaused = false;
      }
    },

    updateRecordingDuration: (state, action: PayloadAction<{
      statementIndex: number;
      duration: number;
    }>) => {
      const { statementIndex, duration } = action.payload;
      if (state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex].duration = duration;
      }
    },

    setMediaRecordingError: (state, action: PayloadAction<{
      statementIndex: number;
      error: string | null;
    }>) => {
      const { statementIndex, error } = action.payload;
      if (!state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex] = {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        };
      }
      state.mediaRecordingState[statementIndex].error = error;
    },

    setMediaCompression: (state, action: PayloadAction<{
      statementIndex: number;
      isCompressing: boolean;
      progress?: number;
    }>) => {
      const { statementIndex, isCompressing, progress } = action.payload;
      if (!state.mediaRecordingState[statementIndex]) {
        state.mediaRecordingState[statementIndex] = {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        };
      }
      state.mediaRecordingState[statementIndex].isCompressing = isCompressing;
      state.mediaRecordingState[statementIndex].compressionProgress = progress || null;
    },

    // Upload state actions
    setUploadState: (state, action: PayloadAction<{
      statementIndex: number;
      uploadState: Partial<ChallengeCreationState['uploadState'][number]>;
    }>) => {
      const { statementIndex, uploadState } = action.payload;
      if (!state.uploadState[statementIndex]) {
        state.uploadState[statementIndex] = {
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          sessionId: null,
        };
      }
      state.uploadState[statementIndex] = {
        ...state.uploadState[statementIndex],
        ...uploadState,
      };
    },

    startUpload: (state, action: PayloadAction<{
      statementIndex: number;
      sessionId: string;
    }>) => {
      const { statementIndex, sessionId } = action.payload;
      state.uploadState[statementIndex] = {
        isUploading: true,
        uploadProgress: 0,
        uploadError: null,
        sessionId,
      };
    },

    updateUploadProgress: (state, action: PayloadAction<{
      statementIndex: number;
      progress: number;
    }>) => {
      const { statementIndex, progress } = action.payload;
      if (state.uploadState[statementIndex]) {
        state.uploadState[statementIndex].uploadProgress = progress;
      }
    },

    completeUpload: (state, action: PayloadAction<{
      statementIndex: number;
      fileUrl: string;
    }>) => {
      const { statementIndex, fileUrl } = action.payload;
      if (state.uploadState[statementIndex]) {
        state.uploadState[statementIndex].isUploading = false;
        state.uploadState[statementIndex].uploadProgress = 100;
        state.uploadState[statementIndex].uploadError = null;
      }
      
      // Update the media data with the final URL
      if (state.currentChallenge.mediaData && state.currentChallenge.mediaData[statementIndex]) {
        state.currentChallenge.mediaData[statementIndex].url = fileUrl;
      }
    },

    setUploadError: (state, action: PayloadAction<{
      statementIndex: number;
      error: string;
    }>) => {
      const { statementIndex, error } = action.payload;
      if (state.uploadState[statementIndex]) {
        state.uploadState[statementIndex].isUploading = false;
        state.uploadState[statementIndex].uploadError = error;
      }
    },

    cancelUpload: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      if (state.uploadState[statementIndex]) {
        state.uploadState[statementIndex].isUploading = false;
        state.uploadState[statementIndex].uploadProgress = 0;
        state.uploadState[statementIndex].uploadError = null;
        state.uploadState[statementIndex].sessionId = null;
      }
    },

    resetMediaState: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      delete state.mediaRecordingState[statementIndex];
      delete state.uploadState[statementIndex];
      
      // Clear media data for this statement
      if (state.currentChallenge.mediaData && state.currentChallenge.mediaData[statementIndex]) {
        state.currentChallenge.mediaData[statementIndex] = {
          type: 'text',
          duration: 0,
        };
      }
    },
  },
});

export const {
  startNewChallenge,
  updateStatement,
  setLieStatement,
  startRecording,
  stopRecording,
  setMediaData,
  setStatementMedia,
  setEmotionAnalysis,
  setQualityScore,
  setEstimatedDifficulty,
  validateChallenge,
  enterPreviewMode,
  exitPreviewMode,
  startSubmission,
  completeSubmission,
  clearValidationErrors,
  // Media recording actions
  setMediaRecordingState,
  startMediaRecording,
  stopMediaRecording,
  pauseMediaRecording,
  resumeMediaRecording,
  updateRecordingDuration,
  setMediaRecordingError,
  setMediaCompression,
  // Upload actions
  setUploadState,
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
  cancelUpload,
  resetMediaState,
} = challengeCreationSlice.actions;

export default challengeCreationSlice.reducer;