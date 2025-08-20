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
}

const initialState: ChallengeCreationState = {
  currentChallenge: {
    creatorId: '',
    statements: [],
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
};

const challengeCreationSlice = createSlice({
  name: 'challengeCreation',
  initialState,
  reducers: {
    startNewChallenge: (state) => {
      state.currentChallenge = {
        creatorId: '',
        statements: [],
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
        
        const emptyStatements = state.currentChallenge.statements.filter(stmt => !stmt.text.trim());
        if (emptyStatements.length > 0) {
          errors.push('All statements must have text');
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
} = challengeCreationSlice.actions;

export default challengeCreationSlice.reducer;