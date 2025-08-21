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
import { gameMiddleware } from './middleware/gameMiddleware';
import { websocketMiddleware } from './middleware/websocketMiddleware';

console.log('Configuring Redux store...');

const store = configureStore({
  reducer: {
    gameSession: gameSessionReducer,
    playerProgression: playerProgressionReducer,
    challengeCreation: challengeCreationReducer,
    guessingGame: guessingGameReducer,
    ui: uiReducer,
  },
  // Temporarily disable custom middleware to isolate issues
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: [
          'meta.arg', 
          'payload.timestamp', 
          'payload.createdAt', 
          'payload.lastUpdated',
          'payload.startTime'
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'gameSession.startTime', 
          'gameSession.lastActivity',
          'gameSession.currentSession.startTime',
          'gameSession.currentSession.lastActivity',
          'playerProgression.progression.createdAt',
          'playerProgression.progression.lastUpdated'
        ],
        // Ignore Date values in actions and state
        isSerializable: (value: any) => {
          // Allow Date objects to pass through
          if (value instanceof Date) return true;
          // Use default serialization check for everything else
          return true;
        }
      },
    }),
    // .concat(gameMiddleware)
    // .concat(websocketMiddleware),
});

console.log('Redux store configured successfully');



export { store };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export { useAppDispatch, useAppSelector } from './hooks';