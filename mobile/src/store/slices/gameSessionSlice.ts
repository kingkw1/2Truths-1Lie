/**
 * Game Session Redux slice
 * Manages current game session state, activity tracking, and session lifecycle
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GameSession } from '../../types';

export interface GameSessionState {
  currentSession: GameSession | null;
  isActive: boolean;
  lastActivity: number | null; // timestamp in milliseconds
  sessionHistory: GameSession[];
}

const initialState: GameSessionState = {
  currentSession: null,
  isActive: false,
  lastActivity: null,
  sessionHistory: [],
};

const gameSessionSlice = createSlice({
  name: 'gameSession',
  initialState,
  reducers: {
    startGameSession: (state, action: PayloadAction<{ playerId: string }>) => {
      const newSession: GameSession = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        playerId: action.payload.playerId,
        currentActivity: 'idle',
        startTime: Date.now(),
        lastActivity: Date.now(),
        pointsEarned: 0,
        challengesCompleted: 0,
        guessesSubmitted: 0,
        sessionDuration: 0,
        isActive: true,
      };
      
      state.currentSession = newSession;
      state.isActive = true;
      state.lastActivity = Date.now();
    },

    updateActivity: (state, action: PayloadAction<GameSession['currentActivity']>) => {
      if (state.currentSession) {
        state.currentSession.currentActivity = action.payload;
        state.lastActivity = Date.now();
      }
    },

    addPoints: (state, action: PayloadAction<number>) => {
      if (state.currentSession) {
        state.currentSession.pointsEarned += action.payload;
        state.lastActivity = Date.now();
      }
    },

    incrementChallengesCompleted: (state) => {
      if (state.currentSession) {
        state.currentSession.challengesCompleted += 1;
        state.lastActivity = Date.now();
      }
    },

    endGameSession: (state) => {
      if (state.currentSession) {
        // Archive the session
        state.sessionHistory.push({ ...state.currentSession });
        
        // Keep only last 10 sessions in history
        if (state.sessionHistory.length > 10) {
          state.sessionHistory = state.sessionHistory.slice(-10);
        }
      }
      
      state.currentSession = null;
      state.isActive = false;
      state.lastActivity = Date.now();
    },

    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },

    // Handle session timeout/idle state
    setSessionIdle: (state) => {
      if (state.currentSession) {
        state.currentSession.currentActivity = 'idle';
      }
    },
  },
});

export const {
  startGameSession,
  updateActivity,
  addPoints,
  incrementChallengesCompleted,
  endGameSession,
  updateLastActivity,
  setSessionIdle,
} = gameSessionSlice.actions;

export default gameSessionSlice.reducer;