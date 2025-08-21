/**
 * Redux Store Provider Component
 * Wraps the application with Redux store and handles initialization
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './index';
import { loadSavedGameState } from './middleware/gameMiddleware';
import { initializeProgression } from './slices/playerProgressionSlice';
import { startGameSession } from './slices/gameSessionSlice';

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  useEffect(() => {
    try {
      // Initialize player progression
      store.dispatch(initializeProgression({
        playerId: 'default',
        level: {
          currentLevel: 1,
          experiencePoints: 0,
          experienceToNextLevel: 100,
          totalExperience: 0,
        },
        totalGamesPlayed: 0,
        challengesCreated: 0,
        challengesGuessed: 0,
        correctGuesses: 0,
        accuracyRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        achievements: [],
        unlockedCosmetics: ['default_avatar'],
        createdAt: new Date(), // Redux will handle serialization warnings
        lastUpdated: new Date(), // Redux will handle serialization warnings
      }));

      // Start game session
      const playerId = localStorage.getItem('playerId') || `player_${Date.now()}`;
      localStorage.setItem('playerId', playerId);
      store.dispatch(startGameSession({ playerId }));
      
    } catch (error) {
      console.error('StoreProvider initialization error:', error);
    }
  }, []);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
};