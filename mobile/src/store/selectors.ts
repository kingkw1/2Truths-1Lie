/**
 * Redux selectors for computed state values
 * Provides memoized selectors for complex state derivations
 */

import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './index';

// Game Session Selectors
export const selectCurrentSession = (state: RootState) => state.gameSession.currentSession;
export const selectIsGameActive = (state: RootState) => state.gameSession.isActive;
export const selectSessionHistory = (state: RootState) => state.gameSession.sessionHistory;

export const selectSessionDuration = createSelector(
  [selectCurrentSession],
  (session) => {
    if (!session) return 0;
    return Date.now() - session.startTime.getTime();
  }
);

// Player Progression Selectors
export const selectPlayerProgression = (state: RootState) => state.playerProgression.progression;
export const selectPlayerLevel = (state: RootState) => state.playerProgression.progression?.level.currentLevel || 1;
export const selectPlayerXP = (state: RootState) => state.playerProgression.progression?.level.experiencePoints || 0;
export const selectIsLevelingUp = (state: RootState) => state.playerProgression.isLevelingUp;
export const selectPendingRewards = (state: RootState) => state.playerProgression.pendingRewards;
export const selectRecentAchievements = (state: RootState) => state.playerProgression.recentAchievements;

export const selectXPToNextLevel = createSelector(
  [selectPlayerProgression],
  (progression) => progression?.level.experienceToNextLevel || 100
);

export const selectLevelProgress = createSelector(
  [selectPlayerLevel, selectPlayerXP],
  (level, xp) => {
    const currentLevelXP = Math.pow(level - 1, 2) * 100;
    const nextLevelXP = Math.pow(level, 2) * 100;
    const progressXP = xp - currentLevelXP;
    const totalXPNeeded = nextLevelXP - currentLevelXP;
    return Math.min(100, (progressXP / totalXPNeeded) * 100);
  }
);

// Challenge Creation Selectors
export const selectCurrentChallenge = (state: RootState) => state.challengeCreation.currentChallenge;
export const selectIsRecording = (state: RootState) => state.challengeCreation.isRecording;
export const selectRecordingType = (state: RootState) => state.challengeCreation.recordingType;
export const selectValidationErrors = (state: RootState) => state.challengeCreation.validationErrors;
export const selectIsSubmitting = (state: RootState) => state.challengeCreation.isSubmitting;
export const selectIsPreviewMode = (state: RootState) => state.challengeCreation.previewMode;

export const selectChallengeIsValid = createSelector(
  [selectCurrentChallenge, selectValidationErrors],
  (challenge, errors) => {
    return errors.length === 0 && 
           challenge.statements?.length === 3 &&
           challenge.statements.some((stmt: any) => stmt.isLie) &&
           challenge.statements.every((stmt: any) => stmt.text.trim().length > 0);
  }
);

// Guessing Game Selectors
export const selectGuessingSession = (state: RootState) => state.guessingGame.currentSession;
export const selectSelectedChallenge = (state: RootState) => state.guessingGame.selectedChallenge;
export const selectAvailableChallenges = (state: RootState) => state.guessingGame.availableChallenges;
export const selectGuessResult = (state: RootState) => state.guessingGame.guessResult;
export const selectTimeRemaining = (state: RootState) => state.guessingGame.timeRemaining;
export const selectShowHint = (state: RootState) => state.guessingGame.showHint;
export const selectGuessingFilters = (state: RootState) => state.guessingGame.filters;

export const selectCanSubmitGuess = createSelector(
  [selectGuessingSession],
  (session) => {
    return session?.playerGuess !== null && !session?.playerGuess;
  }
);

// UI Selectors
export const selectCurrentScreen = (state: RootState) => state.ui.currentScreen;
export const selectIsMenuOpen = (state: RootState) => state.ui.isMenuOpen;
export const selectNotifications = (state: RootState) => state.ui.notifications;
export const selectModals = (state: RootState) => state.ui.modals;
export const selectIsLoading = (state: RootState) => state.ui.isLoading;
export const selectLoadingMessage = (state: RootState) => state.ui.loadingMessage;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectSoundEnabled = (state: RootState) => state.ui.soundEnabled;
export const selectAnimationsEnabled = (state: RootState) => state.ui.animationsEnabled;

export const selectActiveModals = createSelector(
  [selectModals],
  (modals) => modals.filter((modal: any) => modal.isOpen)
);

export const selectUnreadNotifications = createSelector(
  [selectNotifications],
  (notifications) => notifications.length
);