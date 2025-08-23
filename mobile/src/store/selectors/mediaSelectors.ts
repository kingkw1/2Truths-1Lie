/**
 * Memoized selectors for media recording state
 * Prevents unnecessary re-renders by memoizing complex state selections
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';

// Base selectors
const selectChallengeCreation = (state: RootState) => state.challengeCreation;

// Memoized selector for media recording state by statement index
export const selectMediaRecordingState = createSelector(
  [selectChallengeCreation, (_: RootState, statementIndex: number) => statementIndex],
  (challengeCreation, statementIndex) => 
    challengeCreation.mediaRecordingState[statementIndex] || {
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: null,
      hasPermission: false,
      error: null,
      isCompressing: false,
      compressionProgress: null,
    }
);

// Memoized selector for upload state by statement index
export const selectUploadState = createSelector(
  [selectChallengeCreation, (_: RootState, statementIndex: number) => statementIndex],
  (challengeCreation, statementIndex) => 
    challengeCreation.uploadState[statementIndex] || {
      isUploading: false,
      uploadProgress: 0,
      uploadError: null,
      sessionId: null,
    }
);

// Memoized selector for current media by statement index
export const selectCurrentMedia = createSelector(
  [selectChallengeCreation, (_: RootState, statementIndex: number) => statementIndex],
  (challengeCreation, statementIndex) => 
    challengeCreation.currentChallenge.mediaData?.[statementIndex]
);

// Memoized selector for all media recording states
export const selectAllMediaRecordingStates = createSelector(
  [selectChallengeCreation],
  (challengeCreation) => challengeCreation.mediaRecordingState
);

// Memoized selector for all upload states
export const selectAllUploadStates = createSelector(
  [selectChallengeCreation],
  (challengeCreation) => challengeCreation.uploadState
);

// Memoized selector for current challenge
export const selectCurrentChallenge = createSelector(
  [selectChallengeCreation],
  (challengeCreation) => challengeCreation.currentChallenge
);

// Memoized selector for validation errors
export const selectValidationErrors = createSelector(
  [selectChallengeCreation],
  (challengeCreation) => challengeCreation.validationErrors
);

// Memoized selector for submission state
export const selectSubmissionState = createSelector(
  [selectChallengeCreation],
  (challengeCreation) => ({
    isSubmitting: challengeCreation.isSubmitting,
    previewMode: challengeCreation.previewMode,
  })
);