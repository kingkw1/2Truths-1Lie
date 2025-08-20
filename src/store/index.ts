/**
 * Redux store configuration for Two Truths and a Lie game
 * Manages game session, player progression, challenges, and UI state
 */

import { configureStore } from '@reduxjs/toolkit';
import gameSessionReducer from './slices/gameSessionSlice';
import playerProgressionReducer from './slices/playerProgressionSlice';
import challengeCreationReducer from './slices/challengeCreationSlice';
import guessingGameReducer from './slices/guessingGameSlice';
import uiReducer from './slices/uiSlice';

const store = configureStore({
  reducer: {
    gameSession: gameSessionReducer,
    playerProgression: playerProgressionReducer,
    challengeCreation: challengeCreationReducer,
    guessingGame: guessingGameReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['gameSession.startTime', 'gameSession.lastActivity'],
      },
    }),
});

// Add game middleware after store creation to avoid circular dependency
import('./middleware/gameMiddleware').then(({ gameMiddleware }) => {
  // In a real app, you'd configure this differently to avoid runtime middleware addition
  // This is just for demonstration purposes
});

export { store };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export { useAppDispatch, useAppSelector } from './hooks';