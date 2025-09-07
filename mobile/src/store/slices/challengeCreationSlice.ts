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

    };
  };
  // Upload state per statement
  uploadState: {
    [statementIndex: number]: {
      isUploading: boolean;
      uploadProgress: number;
      uploadError: string | null;
      sessionId: string | null;
      startTime?: number;
      bytesUploaded?: number;
      totalBytes?: number;
      currentChunk?: number;
      totalChunks?: number;
    };
  };
  // Individual statement recordings
  individualRecordings: {
    [statementIndex: number]: MediaCapture | null;
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
  individualRecordings: {},
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
        
        // Video-only mode: Check if we have video recordings for each statement
        const hasIndividualRecordings = state.individualRecordings &&
          [0, 1, 2].every(index => 
            state.individualRecordings[index] && 
            state.individualRecordings[index]?.type === 'video' && 
            state.individualRecordings[index]?.url
          );
        
        if (!hasIndividualRecordings) {
          // Check for partial recordings to give more specific error messages
          if (state.individualRecordings) {
            const missingVideoStatements = [];
            for (let i = 0; i < 3; i++) {
              const media = state.individualRecordings[i];
              if (!media || media.type !== 'video' || !media.url) {
                missingVideoStatements.push(i + 1);
              }
            }
            
            if (missingVideoStatements.length > 0) {
              errors.push(`Statement${missingVideoStatements.length > 1 ? 's' : ''} ${missingVideoStatements.join(', ')} must have video recordings`);
            }
          } else {
            errors.push('All statements must have video recordings');
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
        };
      }
      state.mediaRecordingState[statementIndex].error = error;
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
      mediaCapture?: MediaCapture;
    }>) => {
      const { statementIndex, fileUrl, mediaCapture } = action.payload;
      if (state.uploadState[statementIndex]) {
        state.uploadState[statementIndex].isUploading = false;
        state.uploadState[statementIndex].uploadProgress = 100;
        state.uploadState[statementIndex].uploadError = null;
      }
      
      // Update the media data with persistent URLs and metadata
      if (state.currentChallenge.mediaData && state.currentChallenge.mediaData[statementIndex]) {
        if (mediaCapture) {
          // Update with full media capture data including persistent URLs
          state.currentChallenge.mediaData[statementIndex] = {
            ...state.currentChallenge.mediaData[statementIndex],
            ...mediaCapture,
            url: fileUrl, // Keep for backward compatibility
            streamingUrl: mediaCapture.streamingUrl || fileUrl,
            isUploaded: true,
          };
        } else {
          // Fallback to just updating the URL
          state.currentChallenge.mediaData[statementIndex].url = fileUrl;
          state.currentChallenge.mediaData[statementIndex].streamingUrl = fileUrl;
          state.currentChallenge.mediaData[statementIndex].isUploaded = true;
        }
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

    setMediaUploadProgress: (state, action: PayloadAction<{
      statementIndex: number;
      progress?: {
        stage: 'preparing' | 'compressing' | 'uploading' | 'finalizing';
        progress: number;
        bytesUploaded?: number;
        totalBytes?: number;
        currentChunk?: number;
        totalChunks?: number;
      };
    }>) => {
      const { statementIndex, progress } = action.payload;
      if (!state.uploadState[statementIndex]) {
        state.uploadState[statementIndex] = {
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          sessionId: null,
        };
      }
      
      if (progress) {
        state.uploadState[statementIndex].isUploading = true;
        state.uploadState[statementIndex].uploadProgress = progress.progress;
        state.uploadState[statementIndex].uploadError = null;
      } else {
        // Clear progress when undefined (upload complete)
        state.uploadState[statementIndex].isUploading = false;
        state.uploadState[statementIndex].uploadProgress = 0;
      }
    },

    resetMediaState: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      delete state.mediaRecordingState[statementIndex];
      delete state.uploadState[statementIndex];
      delete state.individualRecordings[statementIndex];
      
      // Clear media data for this statement
      if (state.currentChallenge.mediaData && state.currentChallenge.mediaData[statementIndex]) {
        state.currentChallenge.mediaData[statementIndex] = {
          type: 'text',
          duration: 0,
        };
      }
    },

    // Individual recording actions
    setIndividualRecording: (state, action: PayloadAction<{
      statementIndex: number;
      recording: MediaCapture;
    }>) => {
      const { statementIndex, recording } = action.payload;
      state.individualRecordings[statementIndex] = recording;
    },

    clearIndividualRecording: (state, action: PayloadAction<{ statementIndex: number }>) => {
      const { statementIndex } = action.payload;
      delete state.individualRecordings[statementIndex];
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
  // Upload actions
  setUploadState,
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
  cancelUpload,
  setMediaUploadProgress,
  resetMediaState,
  // Individual recording actions
  setIndividualRecording,
  clearIndividualRecording,
} = challengeCreationSlice.actions;

export default challengeCreationSlice.reducer;