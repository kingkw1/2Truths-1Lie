/**
 * Main entry point for the Two Truths and a Lie game
 * Exports the Redux store and main App component
 */

// Export the store and types for external use
export { store } from './store';
export type { RootState, AppDispatch } from './store';

// Export hooks for components
export { useAppDispatch, useAppSelector } from './store/hooks';

// Export main App component
export { App } from './App';

// Export utility functions
export * from './store/utils';

// Export selectors
export * from './store/selectors';

// Export WebSocket services and hooks
export { WebSocketService } from './services/websocket';
export { GameWebSocketManager, getGameWebSocket, initializeGameWebSocket } from './services/gameWebSocket';
export { useWebSocket, useWebSocketNotifications, useLeaderboardUpdates, useGameRoom, useGuessResults } from './hooks/useWebSocket';
export { WebSocketStatus } from './components/WebSocketStatus';
export { getWebSocketStatus, requestLeaderboardUpdate, joinGameRoom, leaveGameRoom } from './store/middleware/websocketMiddleware';

// Export action creators from slices
export {
  startGameSession,
  updateActivity,
  addPoints,
  incrementChallengesCompleted,
  endGameSession,
  updateLastActivity,
  setSessionIdle,
} from './store/slices/gameSessionSlice';

export {
  initializeProgression,
  addExperience,
  updateGameStats,
  unlockCosmetic,
  addAchievement,
  clearLevelUpState,
  claimReward,
  clearRecentAchievements,
} from './store/slices/playerProgressionSlice';

export {
  startNewChallenge,
  updateStatement,
  setLieStatement,
  startRecording,
  stopRecording,
  setMediaData,
  setEmotionAnalysis,
  setQualityScore,
  setEstimatedDifficulty,
  validateChallenge,
  enterPreviewMode,
  exitPreviewMode,
  startSubmission,
  completeSubmission,
  clearValidationErrors,
} from './store/slices/challengeCreationSlice';

export {
  startGuessingSession,
  selectChallenge,
  loadChallenges,
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
} from './store/slices/guessingGameSlice';

export {
  showNotification,
  dismissNotification,
  clearAllNotifications,
  openModal,
  closeModal,
  closeAllModals,
  toggleMenu,
  setMenuOpen,
  navigateToScreen,
  setTheme,
  toggleSound,
  toggleAnimations,
  completeTutorial,
  toggleFPS,
  updateSettings,
} from './store/slices/uiSlice';

// Export types
export * from './types';