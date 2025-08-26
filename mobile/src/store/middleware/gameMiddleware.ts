/**
 * Game-specific middleware for handling side effects
 * Manages auto-save, session timeouts, and achievement triggers
 */

import { Middleware } from '@reduxjs/toolkit';
import { storage } from '../../utils/storage';
import { 
  addExperience, 
  addAchievement, 
  updateGameStats,
  unlockCosmetic 
} from '../slices/playerProgressionSlice';
import { 
  setSessionIdle, 
  endGameSession 
} from '../slices/gameSessionSlice';
import { 
  showNotification, 
  openModal 
} from '../slices/uiSlice';

// Session timeout duration (30 seconds of inactivity)
const SESSION_TIMEOUT = 30 * 1000;

let sessionTimeoutId: NodeJS.Timeout | null = null;

export const gameMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);
  const state = store.getState();

  // Handle session timeout
  if (action.type.includes('gameSession/') || action.type.includes('challengeCreation/') || action.type.includes('guessingGame/')) {
    // Reset session timeout
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
    }
    
    if (state.gameSession.isActive) {
      sessionTimeoutId = setTimeout(() => {
        store.dispatch(setSessionIdle());
        store.dispatch(showNotification({
          type: 'info',
          message: 'Session idle - tap to continue playing!',
          duration: 10000,
        }));
      }, SESSION_TIMEOUT);
    }
  }

  // Handle experience and achievement triggers
  switch (action.type) {
    case 'guessingGame/setGuessResult': {
      const guessResult = action.payload;
      
      if (guessResult.correct) {
        // Award experience for correct guess
        const baseXP = 10;
        const streakBonus = Math.min(state.playerProgression.progression?.currentStreak || 0, 5) * 2;
        const timeBonus = guessResult.timeSpent < 30 ? 5 : 0;
        const totalXP = baseXP + streakBonus + timeBonus;
        
        store.dispatch(addExperience(totalXP));
        store.dispatch(updateGameStats({ 
          gamesPlayed: 1, 
          correctGuess: true, 
          streakIncrement: true 
        }));
        
        // Check for streak achievements
        const currentStreak = (state.playerProgression.progression?.currentStreak || 0) + 1;
        if (currentStreak === 5) {
          store.dispatch(addAchievement({
            id: 'streak_5',
            type: 'streak_master',
            name: 'Hot Streak',
            description: 'Get 5 correct guesses in a row',
            iconUrl: '🔥',
            unlockedAt: new Date(),
            progress: 100,
            maxProgress: 100,
            isUnlocked: true,
          }));
        }
        
        store.dispatch(showNotification({
          type: 'success',
          message: `Correct! +${totalXP} XP`,
        }));
      } else {
        // Handle incorrect guess
        store.dispatch(updateGameStats({ 
          gamesPlayed: 1, 
          correctGuess: false, 
          streakIncrement: false 
        }));
        
        store.dispatch(showNotification({
          type: 'error',
          message: 'Wrong guess! Better luck next time.',
        }));
      }
      break;
    }

    case 'challengeCreation/completeSubmission': {
      if (action.payload.success) {
        // Award XP for creating a challenge
        store.dispatch(addExperience(15));
        
        store.dispatch(showNotification({
          type: 'success',
          message: 'Challenge created successfully! +15 XP',
        }));
        
        // Check for creation achievements
        const totalChallenges = (state.playerProgression.progression?.totalGamesPlayed || 0) + 1;
        if (totalChallenges === 1) {
          store.dispatch(addAchievement({
            id: 'first_challenge',
            type: 'first_challenge',
            name: 'Creator',
            description: 'Create your first challenge',
            iconUrl: '🎭',
            unlockedAt: new Date(),
            progress: 100,
            maxProgress: 100,
            isUnlocked: true,
          }));
        }
      }
      break;
    }

    case 'playerProgression/addExperience': {
      // Check if player leveled up
      if (state.playerProgression.isLevelingUp) {
        const newLevel = state.playerProgression.progression?.level.currentLevel || 1;
        
        // Unlock cosmetics based on level
        if (newLevel % 5 === 0) {
          store.dispatch(unlockCosmetic(`Level ${newLevel} Badge`));
        }
        
        // Show level up modal
        store.dispatch(openModal({
          id: 'levelUp',
          type: 'levelUp',
          data: { newLevel },
        }));
        
        store.dispatch(showNotification({
          type: 'success',
          message: `Level Up! You're now level ${newLevel}!`,
          duration: 8000,
        }));
      }
      break;
    }

    case 'playerProgression/addAchievement': {
      // Show achievement modal
      store.dispatch(openModal({
        id: 'achievement',
        type: 'achievement',
        data: action.payload,
      }));
      break;
    }
  }

  // Auto-save game state to platform-agnostic storage
  if (action.type.includes('gameSession/') || action.type.includes('playerProgression/')) {
    try {
      const gameState = {
        gameSession: state.gameSession,
        playerProgression: state.playerProgression,
        timestamp: Date.now(),
      };
      storage.setItem('gameState', JSON.stringify(gameState));
    } catch (error) {
      console.warn('Failed to save game state:', error);
    }
  }

  return result;
};

// Helper function to load saved game state
export const loadSavedGameState = async () => {
  try {
    const savedState = await storage.getItem('gameState');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      // Only load if saved within last 7 days
      if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
        return {
          gameSession: parsed.gameSession,
          playerProgression: parsed.playerProgression,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load saved game state:', error);
  }
  return null;
};