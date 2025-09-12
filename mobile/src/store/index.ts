/**
 * Redux store configuration for Two Truths and a Lie game
 * Simplified mobile version for better performance
 */

import { configureStore } from '@reduxjs/toolkit';
import guessingGameReducer from './slices/guessingGameSlice';
import challengeCreationReducer from './slices/challengeCreationSlice';
import gameSessionReducer from './slices/gameSessionSlice';
import playerProgressionReducer from './slices/playerProgressionSlice';
import uiReducer from './slices/uiSlice';
import networkReducer from './slices/networkSlice';

if (__DEV__) {
  console.log('⚡ Configuring simplified mobile Redux store...');
}

const store = configureStore({
  reducer: {
    guessingGame: guessingGameReducer,
    challengeCreation: challengeCreationReducer,
    gameSession: gameSessionReducer,
    playerProgression: playerProgressionReducer,
    ui: uiReducer,
    network: networkReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in actions/state for now
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['guessingGame.availableChallenges.0.createdAt', 'guessingGame.availableChallenges.0.lastPlayed'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

if (__DEV__) {
  console.log('✅ Redux store configured successfully');
}

export { store };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export { useAppDispatch, useAppSelector } from './hooks';