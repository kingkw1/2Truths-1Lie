/**
 * Store utility functions
 * Helper functions for common store operations and state management
 */

import { store } from './index';
import { 
  startGameSession, 
  endGameSession, 
  updateActivity 
} from './slices/gameSessionSlice';
import { 
  showNotification, 
  setLoading 
} from './slices/uiSlice';
import { 
  startNewChallenge, 
  validateChallenge 
} from './slices/challengeCreationSlice';
import { 
  startGuessingSession, 
  loadChallenges 
} from './slices/guessingGameSlice';

/**
 * Initialize a new game session for a player
 */
export const initializeGameSession = (playerId: string) => {
  store.dispatch(startGameSession({ playerId }));
  store.dispatch(showNotification({
    type: 'info',
    message: 'Welcome back! Ready to play?',
    duration: 3000,
  }));
};

/**
 * Safely end the current game session
 */
export const terminateGameSession = () => {
  const state = store.getState();
  if (state.gameSession.currentSession) {
    store.dispatch(endGameSession());
    store.dispatch(showNotification({
      type: 'info',
      message: 'Session ended. See you next time!',
      duration: 3000,
    }));
  }
};

/**
 * Update player activity and reset idle timer
 */
export const updatePlayerActivity = (activity: 'creating' | 'browsing' | 'guessing' | 'idle') => {
  store.dispatch(updateActivity(activity));
};

/**
 * Start challenge creation workflow
 */
export const beginChallengeCreation = () => {
  store.dispatch(startNewChallenge());
  updatePlayerActivity('creating');
  store.dispatch(showNotification({
    type: 'info',
    message: 'Create your challenge! Enter 3 statements and pick the lie.',
    duration: 5000,
  }));
};

/**
 * Validate and prepare challenge for submission
 */
export const prepareChallengeSubmission = () => {
  store.dispatch(validateChallenge());
  const state = store.getState();
  
  if (state.challengeCreation.validationErrors.length > 0) {
    store.dispatch(showNotification({
      type: 'error',
      message: 'Please fix the errors before submitting.',
      duration: 4000,
    }));
    return false;
  }
  
  return true;
};

/**
 * Start guessing game with a specific challenge
 */
export const beginGuessingGame = async (challengeId: string) => {
  store.dispatch(setLoading({ isLoading: true, message: 'Loading challenge...' }));
  
  try {
    // In a real app, this would fetch from an API
    // For now, we'll simulate loading challenge data
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockStatements = [
      { 
        id: '1', 
        text: 'I once met a celebrity at a coffee shop', 
        isLie: false, 
        confidence: 0.8,
        viewCount: 10,
        guessAccuracy: 75,
        averageConfidence: 0.8
      },
      { 
        id: '2', 
        text: 'I can speak 5 languages fluently', 
        isLie: true, 
        confidence: 0.3,
        viewCount: 10,
        guessAccuracy: 45,
        averageConfidence: 0.3
      },
      { 
        id: '3', 
        text: 'I have traveled to 15 countries', 
        isLie: false, 
        confidence: 0.7,
        viewCount: 10,
        guessAccuracy: 80,
        averageConfidence: 0.7
      },
    ];
    
    store.dispatch(startGuessingSession({ 
      challengeId, 
      statements: mockStatements 
    }));
    
    updatePlayerActivity('guessing');
    
    store.dispatch(showNotification({
      type: 'info',
      message: 'Which statement is the lie? Choose wisely!',
      duration: 4000,
    }));
    
  } catch (error) {
    store.dispatch(showNotification({
      type: 'error',
      message: 'Failed to load challenge. Please try again.',
      duration: 4000,
    }));
  } finally {
    store.dispatch(setLoading({ isLoading: false }));
  }
};

/**
 * Load available challenges for browsing
 */
export const loadAvailableChallenges = async () => {
  store.dispatch(setLoading({ isLoading: true, message: 'Loading challenges...' }));
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock challenge data
    const mockChallenges = [
      {
        id: 'challenge_1',
        creatorId: 'user_123',
        creatorName: 'TestUser',
        statements: [],
        mediaData: [],
        createdAt: new Date(),
        lastPlayed: new Date(),
        difficultyRating: 70,
        averageGuessTime: 45000,
        popularityScore: 0.8,
        emotionComplexity: 0.6,
        recommendationWeight: 0.75,
        totalGuesses: 100,
        correctGuessRate: 65,
        tags: ['fun', 'medium'],
        isActive: true,
      },
      // Add more mock challenges as needed
    ];
    
    store.dispatch(loadChallenges(mockChallenges));
    updatePlayerActivity('browsing');
    
  } catch (error) {
    store.dispatch(showNotification({
      type: 'error',
      message: 'Failed to load challenges. Please check your connection.',
      duration: 4000,
    }));
  } finally {
    store.dispatch(setLoading({ isLoading: false }));
  }
};

/**
 * Get current game statistics
 */
export const getGameStatistics = () => {
  const state = store.getState();
  return {
    currentLevel: state.playerProgression.progression?.level.currentLevel || 1,
    totalXP: state.playerProgression.progression?.level.experiencePoints || 0,
    gamesPlayed: state.playerProgression.progression?.totalGamesPlayed || 0,
    accuracy: state.playerProgression.progression?.accuracyRate || 0,
    currentStreak: state.playerProgression.progression?.currentStreak || 0,
    achievements: state.playerProgression.progression?.achievements || [],
    sessionActive: state.gameSession.isActive,
    sessionDuration: state.gameSession.currentSession ? 
      Date.now() - state.gameSession.currentSession.startTime.getTime() : 0,
  };
};

/**
 * Export current state for debugging
 */
export const exportGameState = () => {
  const state = store.getState();
  return {
    timestamp: new Date().toISOString(),
    gameSession: state.gameSession,
    playerProgression: state.playerProgression,
    ui: {
      currentScreen: state.ui.currentScreen,
      theme: state.ui.theme,
      soundEnabled: state.ui.soundEnabled,
    },
  };
};