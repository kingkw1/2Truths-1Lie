/**
 * WebSocket middleware for Redux store integration
 * Handles real-time events and synchronizes with game state
 */

import { Middleware } from '@reduxjs/toolkit';
import { GameWebSocketManager, getGameWebSocket, initializeGameWebSocket } from '../../services/gameWebSocket';
import { 
  showNotification,
  openModal,
} from '../slices/uiSlice';
import {
  addExperience,
  updateGameStats,
  addAchievement,
} from '../slices/playerProgressionSlice';
import {
  setGuessResult,
} from '../slices/guessingGameSlice';

// WebSocket connection state
let wsManager: GameWebSocketManager | null = null;
let isInitialized = false;

export const websocketMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);
  const state = store.getState();

  // Initialize WebSocket when game session starts
  if (action.type === 'gameSession/startGameSession' && !isInitialized) {
    initializeWebSocket(store, action.payload);
  }

  // Update WebSocket config when player info changes
  if (action.type === 'playerProgression/initializeProgression') {
    updateWebSocketConfig(action.payload.playerId, state.gameSession.sessionId);
  }

  // Handle WebSocket-related actions
  switch (action.type) {
    case 'guessingGame/submitGuess':
      handleGuessSubmission(action.payload);
      break;

    case 'challengeCreation/completeSubmission':
      if (action.payload.success) {
        handleChallengePublication(action.payload);
      }
      break;

    case 'gameSession/updateActivity':
      sendActivityHeartbeat(action.payload.activity);
      break;

    case 'gameSession/endGameSession':
      handleSessionEnd();
      break;
  }

  return result;
};

/**
 * Initialize WebSocket connection
 */
function initializeWebSocket(store: any, sessionData: any): void {
  try {
    const config = {
      serverUrl: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080/ws',
      playerId: sessionData.playerId,
      gameSessionId: sessionData.sessionId,
    };

    wsManager = initializeGameWebSocket(config);
    isInitialized = true;

    // Set up event handlers
    setupWebSocketHandlers(store);

    // Connect to WebSocket
    wsManager.connect().catch((error) => {
      console.error('Failed to connect to WebSocket:', error);
      store.dispatch(showNotification({
        type: 'warning',
        message: 'Real-time features unavailable. Playing in offline mode.',
        duration: 5000,
      }));
    });

  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
  }
}

/**
 * Set up WebSocket event handlers
 */
function setupWebSocketHandlers(store: any): void {
  if (!wsManager) return;

  // Connection events
  wsManager.subscribe('connected', () => {
    store.dispatch(showNotification({
      type: 'success',
      message: 'Connected to real-time game server!',
      duration: 3000,
    }));
  });

  wsManager.subscribe('disconnected', (data) => {
    store.dispatch(showNotification({
      type: 'warning',
      message: 'Lost connection to game server. Attempting to reconnect...',
      duration: 5000,
    }));
  });

  wsManager.subscribe('reconnecting', (data) => {
    store.dispatch(showNotification({
      type: 'info',
      message: `Reconnecting to server (attempt ${data.attempt})...`,
      duration: 3000,
    }));
  });

  // Game events
  wsManager.subscribe('guess_result', (data) => {
    handleIncomingGuessResult(store, data);
  });

  wsManager.subscribe('leaderboard_update', (data) => {
    handleLeaderboardUpdate(store, data);
  });

  wsManager.subscribe('challenge_published', (data) => {
    handleChallengePublishedNotification(store, data);
  });

  wsManager.subscribe('achievement_unlocked', (data) => {
    store.dispatch(addAchievement(data));
    store.dispatch(openModal({
      id: 'achievement',
      type: 'achievement',
      data,
    }));
  });

  wsManager.subscribe('player_joined', (data) => {
    store.dispatch(showNotification({
      type: 'info',
      message: `${data.playerName} joined the game!`,
      duration: 3000,
    }));
  });

  wsManager.subscribe('system_message', (data) => {
    store.dispatch(showNotification({
      type: data.severity || 'info',
      message: data.message,
      duration: data.duration || 5000,
    }));
  });

  // Error handling
  wsManager.subscribe('error', (data) => {
    console.error('WebSocket error:', data.error);
  });

  wsManager.subscribe('auth_failed', (data) => {
    store.dispatch(showNotification({
      type: 'error',
      message: 'Authentication failed. Some features may not work.',
      duration: 5000,
    }));
  });
}

/**
 * Update WebSocket configuration
 */
function updateWebSocketConfig(playerId: string, sessionId: string): void {
  if (wsManager) {
    wsManager.updateConfig({
      playerId,
      gameSessionId: sessionId,
    });
  }
}

/**
 * Handle guess submission
 */
function handleGuessSubmission(guessData: any): void {
  if (wsManager && wsManager.isReady()) {
    wsManager.sendGuessResult({
      challengeId: guessData.challengeId,
      guesserId: guessData.playerId,
      guesserName: guessData.playerName || 'Anonymous',
      correct: guessData.correct,
      pointsAwarded: guessData.pointsAwarded || 0,
      timeSpent: guessData.timeSpent || 0,
    });
  }
}

/**
 * Handle challenge publication
 */
function handleChallengePublication(submissionData: any): void {
  if (wsManager && wsManager.isReady()) {
    wsManager.notifyChallengePublished(
      submissionData.challengeId,
      submissionData.challengeData
    );
  }
}

/**
 * Send activity heartbeat
 */
function sendActivityHeartbeat(activity: string): void {
  if (wsManager && wsManager.isReady()) {
    wsManager.sendActivityHeartbeat(activity);
  }
}

/**
 * Handle session end
 */
function handleSessionEnd(): void {
  if (wsManager) {
    wsManager.disconnect();
  }
}

/**
 * Handle incoming guess result from other players
 */
function handleIncomingGuessResult(store: any, data: any): void {
  const state = store.getState();
  
  // Only show notification if this is about the current player's challenge
  if (data.challengeCreatorId === state.gameSession.playerId) {
    const message = data.correct 
      ? `${data.guesserName} correctly guessed your lie!`
      : `${data.guesserName} fell for your lie! 😈`;
    
    store.dispatch(showNotification({
      type: data.correct ? 'info' : 'success',
      message,
      duration: 4000,
    }));

    // Award points to challenge creator
    if (!data.correct) {
      store.dispatch(addExperience(5)); // Bonus for successful deception
    }
  }
}

/**
 * Handle leaderboard updates
 */
function handleLeaderboardUpdate(store: any, data: any): void {
  const state = store.getState();
  
  // Show notification if current player's rank changed significantly
  const currentPlayer = data.players?.find((p: any) => p.playerId === state.gameSession.playerId);
  if (currentPlayer && Math.abs(currentPlayer.change) >= 3) {
    const direction = currentPlayer.change > 0 ? 'up' : 'down';
    const emoji = currentPlayer.change > 0 ? '📈' : '📉';
    
    store.dispatch(showNotification({
      type: currentPlayer.change > 0 ? 'success' : 'warning',
      message: `You moved ${Math.abs(currentPlayer.change)} places ${direction} on the leaderboard! ${emoji}`,
      duration: 5000,
    }));
  }
}

/**
 * Handle challenge published notifications
 */
function handleChallengePublishedNotification(store: any, data: any): void {
  const state = store.getState();
  
  // Don't show notification for own challenges
  if (data.publisherId !== state.gameSession.playerId) {
    store.dispatch(showNotification({
      type: 'info',
      message: `New challenge available from ${data.publisherName || 'another player'}!`,
      duration: 4000,
    }));
  }
}

/**
 * Get WebSocket connection status
 */
export function getWebSocketStatus(): { connected: boolean; authenticated: boolean } {
  if (!wsManager) {
    return { connected: false, authenticated: false };
  }
  
  const status = wsManager.getStatus();
  return {
    connected: status.connected,
    authenticated: status.authenticated,
  };
}

/**
 * Manually request leaderboard update
 */
export function requestLeaderboardUpdate(): boolean {
  if (wsManager && wsManager.isReady()) {
    return wsManager.requestLeaderboardUpdate();
  }
  return false;
}

/**
 * Join a game room
 */
export function joinGameRoom(roomId: string): boolean {
  if (wsManager && wsManager.isReady()) {
    return wsManager.joinGameRoom(roomId);
  }
  return false;
}

/**
 * Leave a game room
 */
export function leaveGameRoom(roomId: string): boolean {
  if (wsManager && wsManager.isReady()) {
    return wsManager.leaveGameRoom(roomId);
  }
  return false;
}