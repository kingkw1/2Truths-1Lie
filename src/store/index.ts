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
  devTools: process.env.NODE_ENV !== 'production',
    // .concat(gameMiddleware)
    // .concat(websocketMiddleware),
});

console.log('Redux store configured successfully');



export { store };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export { useAppDispatch, useAppSelector } from './hooks';