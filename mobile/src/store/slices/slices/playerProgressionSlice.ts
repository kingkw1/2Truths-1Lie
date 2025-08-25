/**
 * Player Progression Redux slice
 * Manages player level, experience, achievements, and unlockables
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlayerProgression, Achievement } from '../../../types';

export interface PlayerProgressionState {
  progression: PlayerProgression | null;
  recentAchievements: Achievement[];
  isLevelingUp: boolean;
  pendingRewards: string[];
}

const initialState: PlayerProgressionState = {
  progression: null,
  recentAchievements: [],
  isLevelingUp: false,
  pendingRewards: [],
};

const playerProgressionSlice = createSlice({
  name: 'playerProgression',
  initialState,
  reducers: {
    initializeProgression: (state, action: PayloadAction<PlayerProgression>) => {
      state.progression = action.payload;
    },

    addExperience: (state, action: PayloadAction<number>) => {
      if (!state.progression) return;
      
      const oldLevel = state.progression.level.currentLevel;
      state.progression.level.experiencePoints += action.payload;
      state.progression.level.totalExperience += action.payload;
      
      // Simple leveling formula: level = floor(sqrt(xp / 100))
      const newLevel = Math.floor(Math.sqrt(state.progression.level.totalExperience / 100)) + 1;
      
      if (newLevel > oldLevel) {
        state.progression.level.currentLevel = newLevel;
        state.progression.level.experienceToNextLevel = Math.pow(newLevel, 2) * 100 - state.progression.level.totalExperience;
        state.isLevelingUp = true;
        
        // Add level-up rewards
        state.pendingRewards.push(`Level ${newLevel} Cosmetic Pack`);
      }
    },

    updateGameStats: (state, action: PayloadAction<{
      gamesPlayed?: number;
      correctGuess?: boolean;
      streakIncrement?: boolean;
    }>) => {
      if (!state.progression) return;
      
      const { gamesPlayed = 0, correctGuess, streakIncrement } = action.payload;
      
      state.progression.totalGamesPlayed += gamesPlayed;
      
      if (correctGuess !== undefined) {
        // Update accuracy rate
        const totalCorrect = Math.round(state.progression.accuracyRate * state.progression.totalGamesPlayed / 100);
        const newTotal = correctGuess ? totalCorrect + 1 : totalCorrect;
        state.progression.accuracyRate = (newTotal / state.progression.totalGamesPlayed) * 100;
      }
      
      if (streakIncrement) {
        state.progression.currentStreak += 1;
      } else if (streakIncrement === false) {
        state.progression.currentStreak = 0;
      }
    },

    unlockCosmetic: (state, action: PayloadAction<string>) => {
      if (!state.progression) return;
      
      if (!state.progression.unlockedCosmetics.includes(action.payload)) {
        state.progression.unlockedCosmetics.push(action.payload);
        state.pendingRewards.push(action.payload);
      }
    },

    addAchievement: (state, action: PayloadAction<Achievement>) => {
      if (!state.progression) return;
      
      const existingAchievement = state.progression.achievements.find(
        (a: Achievement) => a.id === action.payload.id
      );
      
      if (!existingAchievement) {
        state.progression.achievements.push(action.payload);
        state.recentAchievements.push(action.payload);
        
        // Keep only last 5 recent achievements
        if (state.recentAchievements.length > 5) {
          state.recentAchievements = state.recentAchievements.slice(-5);
        }
      }
    },

    clearLevelUpState: (state) => {
      state.isLevelingUp = false;
    },

    claimReward: (state, action: PayloadAction<string>) => {
      state.pendingRewards = state.pendingRewards.filter(
        reward => reward !== action.payload
      );
    },

    clearRecentAchievements: (state) => {
      state.recentAchievements = [];
    },
  },
});

export const {
  initializeProgression,
  addExperience,
  updateGameStats,
  unlockCosmetic,
  addAchievement,
  clearLevelUpState,
  claimReward,
  clearRecentAchievements,
} = playerProgressionSlice.actions;

export default playerProgressionSlice.reducer;