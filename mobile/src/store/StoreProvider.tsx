/**
 * Redux Store Provider Component
 * Wraps the application with Redux store and handles initialization
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import storage from '../utils/storage';
import { store } from './index';
import { loadSavedGameState } from './middleware/gameMiddleware';
import { initializeProgression } from './slices/playerProgressionSlice';
import { startGameSession } from './slices/gameSessionSlice';
import { PlayerProgression } from '../types';

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  useEffect(() => {
    const initializeStore = async () => {
      try {
        // Check for existing player profile
        const existingProfile = await storage.getItem('playerProfile');
        let playerProgression: PlayerProgression;
        
        if (existingProfile) {
          playerProgression = JSON.parse(existingProfile);
          console.log('Existing player profile loaded:', playerProgression.playerId);
        } else {
          // Create new player progression
          const playerId = `player_${Date.now()}`;
          playerProgression = {
            playerId,
            level: {
              currentLevel: 1,
              experiencePoints: 0,
              totalExperience: 0,
              experienceToNextLevel: 100
            },
            totalGamesPlayed: 0,
            challengesCreated: 0,
            challengesGuessed: 0,
            correctGuesses: 0,
            accuracyRate: 0,
            currentStreak: 0,
            longestStreak: 0,
            achievements: [],
            unlockedCosmetics: [],
            createdAt: new Date(),
            lastUpdated: new Date()
          };
          
          // Save the new profile
          await storage.setItem('playerProfile', JSON.stringify(playerProgression));
          console.log('New player profile created:', playerId);
        }
        
        // Initialize player progression in store
        store.dispatch(initializeProgression(playerProgression));
        
        // Start a new game session
        store.dispatch(startGameSession({ playerId: playerProgression.playerId }));
        
        // Load any saved game state
        loadSavedGameState();
      } catch (error) {
        console.error('StoreProvider initialization error:', error);
      }
    };

    initializeStore();
  }, []);

  return (
    <Provider store={store}>
      {children}
    </Provider>
  );
};