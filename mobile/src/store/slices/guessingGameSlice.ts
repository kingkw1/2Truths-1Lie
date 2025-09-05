/**
 * Guessing Game Redux slice
 * Manages state during challenge guessing gameplay
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GuessingSession, AnalyzedStatement, GuessResult, EnhancedChallenge } from '../../types';

export interface ChallengeLoadError {
  type: 'network' | 'server' | 'auth' | 'timeout' | 'unknown';
  message: string;
  timestamp: number; // Changed from Date to timestamp
  retryable: boolean;
}

export interface GuessingGameState {
  currentSession: GuessingSession | null;
  availableChallenges: EnhancedChallenge[];
  selectedChallenge: EnhancedChallenge | null;
  isLoading: boolean;
  loadError: ChallengeLoadError | null;
  retryCount: number;
  lastSuccessfulLoad: number | null; // Changed from Date to timestamp
  showHint: boolean;
  guessSubmitted: boolean;
  guessResult: GuessResult | null;
  timeRemaining: number | null;
  currentStreak: number;
  showAnimatedFeedback: boolean;
  filters: {
    difficulty: 'all' | 'easy' | 'medium' | 'hard';
    sortBy: 'popularity' | 'difficulty' | 'recent' | 'oldest' | 'most_played' | 'highest_rated';
    minPopularity?: 'all' | '50' | '70' | '90';
  };
}

const initialState: GuessingGameState = {
  currentSession: null,
  availableChallenges: [],
  selectedChallenge: null,
  isLoading: false,
  loadError: null,
  retryCount: 0,
  lastSuccessfulLoad: null,
  showHint: false,
  guessSubmitted: false,
  guessResult: null,
  timeRemaining: null,
  currentStreak: 0,
  showAnimatedFeedback: false,
  filters: {
    difficulty: 'all',
    sortBy: 'popularity',
    minPopularity: 'all',
  },
};

const guessingGameSlice = createSlice({
  name: 'guessingGame',
  initialState,
  reducers: {
    startGuessingSession: (state, action: PayloadAction<{ challengeId: string; statements: AnalyzedStatement[] }>) => {
      const { challengeId, statements } = action.payload;
      
      state.currentSession = {
        sessionId: `guess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        playerId: 'current_player', // This would come from auth state in real app
        challengeId,
        statements,
        playerGuess: null,
        confidenceScores: statements.map(() => 0),
        hintsUsed: 0,
        timeSpent: 0,
        startTime: Date.now(),
        isCompleted: false,
      };
      
      state.guessSubmitted = false;
      state.guessResult = null;
      state.showHint = false;
      state.timeRemaining = 60; // 60 seconds per guess
    },

    selectChallenge: (state, action: PayloadAction<EnhancedChallenge>) => {
      state.selectedChallenge = action.payload;
    },

    loadChallenges: (state, action: PayloadAction<EnhancedChallenge[]>) => {
      state.availableChallenges = action.payload;
      state.isLoading = false;
      state.loadError = null;
      state.retryCount = 0;
      state.lastSuccessfulLoad = Date.now(); // Store as timestamp
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        // Clear previous error when starting new load
        state.loadError = null;
      }
    },

    setChallengeLoadError: (state, action: PayloadAction<{ error: string; errorType?: string }>) => {
      const { error, errorType } = action.payload;
      
      // Determine error type based on error message if not provided
      let type: ChallengeLoadError['type'] = 'unknown';
      let retryable = true;
      
      if (errorType) {
        type = errorType as ChallengeLoadError['type'];
      } else if (error.toLowerCase().includes('network') || error.toLowerCase().includes('fetch')) {
        type = 'network';
      } else if (error.toLowerCase().includes('timeout')) {
        type = 'timeout';
      } else if (error.toLowerCase().includes('401') || error.toLowerCase().includes('unauthorized')) {
        type = 'auth';
        retryable = false;
      } else if (error.toLowerCase().includes('500') || error.toLowerCase().includes('server')) {
        type = 'server';
      }
      
      state.loadError = {
        type,
        message: error || 'An unknown error occurred',
        timestamp: Date.now(),
        retryable,
      };
      state.isLoading = false;
      state.retryCount += 1;
    },

    clearChallengeLoadError: (state) => {
      state.loadError = null;
      state.retryCount = 0;
    },

    resetRetryCount: (state) => {
      state.retryCount = 0;
    },

    updateConfidenceScore: (state, action: PayloadAction<{ statementIndex: number; confidence: number }>) => {
      if (!state.currentSession) return;
      
      const { statementIndex, confidence } = action.payload;
      if (statementIndex >= 0 && statementIndex < state.currentSession.confidenceScores.length) {
        state.currentSession.confidenceScores[statementIndex] = confidence;
      }
    },

    submitGuess: (state, action: PayloadAction<number>) => {
      if (!state.currentSession) return;
      
      state.currentSession.playerGuess = action.payload;
      state.guessSubmitted = true;
    },

    setGuessResult: (state, action: PayloadAction<GuessResult>) => {
      state.guessResult = action.payload;
      
      // Only set showAnimatedFeedback to true if it's not already true
      // This prevents restarting the animation when duplicate results arrive
      if (!state.showAnimatedFeedback) {
        state.showAnimatedFeedback = true;
      }
      
      // Update streak based on result
      if (action.payload.wasCorrect) {
        state.currentStreak += 1;
      } else {
        state.currentStreak = 0;
      }
    },

    useHint: (state) => {
      if (!state.currentSession) return;
      
      state.currentSession.hintsUsed += 1;
      state.showHint = true;
    },

    hideHint: (state) => {
      state.showHint = false;
    },

    updateTimeSpent: (state, action: PayloadAction<number>) => {
      if (!state.currentSession) return;
      
      state.currentSession.timeSpent = action.payload;
    },

    updateTimeRemaining: (state, action: PayloadAction<number>) => {
      state.timeRemaining = action.payload;
    },

    endGuessingSession: (state) => {
      state.currentSession = null;
      state.selectedChallenge = null;
      state.guessSubmitted = false;
      state.guessResult = null;
      state.showHint = false;
      state.timeRemaining = null;
      state.showAnimatedFeedback = false;
    },

    hideAnimatedFeedback: (state) => {
      state.showAnimatedFeedback = false;
    },

    clearGuessResult: (state) => {
      state.guessResult = null;
      state.showAnimatedFeedback = false;
    },

    updateFilters: (state, action: PayloadAction<Partial<GuessingGameState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    // Filter and sort challenges based on current filters
    applyFilters: (state) => {
      let filtered = [...state.availableChallenges];
      
      // Apply difficulty filter
      if (state.filters.difficulty !== 'all') {
        filtered = filtered.filter(challenge => {
          // Map difficulty rating to estimated difficulty
          const difficulty = challenge.difficultyRating < 33 ? 'easy' : 
                           challenge.difficultyRating < 66 ? 'medium' : 'hard';
          return difficulty === state.filters.difficulty;
        });
      }
      
      // Apply popularity filter
      if (state.filters.minPopularity && state.filters.minPopularity !== 'all') {
        const minScore = parseInt(state.filters.minPopularity);
        filtered = filtered.filter(challenge => challenge.popularityScore >= minScore);
      }
      
      // Apply sorting
      switch (state.filters.sortBy) {
        case 'popularity':
          filtered.sort((a, b) => b.popularityScore - a.popularityScore);
          break;
        case 'difficulty':
          filtered.sort((a, b) => b.difficultyRating - a.difficultyRating);
          break;
        case 'recent':
          filtered.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case 'oldest':
          filtered.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          break;
        case 'most_played':
          filtered.sort((a, b) => b.totalGuesses - a.totalGuesses);
          break;
        case 'highest_rated':
          filtered.sort((a, b) => b.correctGuessRate - a.correctGuessRate);
          break;
      }
      
      state.availableChallenges = filtered;
    },
  },
});

export const {
  startGuessingSession,
  selectChallenge,
  loadChallenges,
  setLoading,
  setChallengeLoadError,
  clearChallengeLoadError,
  resetRetryCount,
  updateConfidenceScore,
  submitGuess,
  setGuessResult,
  useHint,
  hideHint,
  updateTimeSpent,
  updateTimeRemaining,
  endGuessingSession,
  updateFilters,
  applyFilters,
  hideAnimatedFeedback,
  clearGuessResult,
} = guessingGameSlice.actions;

export default guessingGameSlice.reducer;