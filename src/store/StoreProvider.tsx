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
    // Load saved game state on app initialization
    const savedState = loadSavedGameState();

    if (savedState?.playerProgression?.progression) {
      store.dispatch(initializeProgression(savedState.playerProgression.progression));
    } else {
      // Initialize new player progression
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
        createdAt: new Date(),
        lastUpdated: new Date(),
      }));
    }

    // Start a new game session if none exists
    if (!savedState?.gameSession?.currentSession) {
      const playerId = localStorage.getItem('playerId') || `player_${Date.now()}`;
      localStorage.setItem('playerId', playerId);
      store.dispatch(startGameSession({ playerId }));
    }
  }, []);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
};