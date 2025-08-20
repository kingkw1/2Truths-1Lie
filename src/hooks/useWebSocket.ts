/**
 * React hook for WebSocket integration
 * Provides easy access to WebSocket functionality in components
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '../store/hooks';
import { getGameWebSocket } from '../services/gameWebSocket';
import { getWebSocketStatus, requestLeaderboardUpdate, joinGameRoom, leaveGameRoom } from '../store/middleware/websocketMiddleware';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  subscriptions?: Array<{
    event: string;
    handler: (data: any) => void;
  }>;
}

export interface WebSocketHookReturn {
  isConnected: boolean;
  isAuthenticated: boolean;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  requestLeaderboardUpdate: () => boolean;
  joinRoom: (roomId: string) => boolean;
  leaveRoom: (roomId: string) => boolean;
  connectionStatus: { connected: boolean; authenticated: boolean };
}

/**
 * Hook for WebSocket functionality
 */
export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketHookReturn {
  const { autoConnect = true, subscriptions = [] } = options;
  
  const gameSession = useAppSelector(state => state.gameSession);
  const unsubscribeFunctionsRef = useRef<(() => void)[]>([]);

  // Get connection status
  const connectionStatus = getWebSocketStatus();

  // Subscribe to events
  const subscribe = useCallback((event: string, handler: (data: any) => void) => {
    try {
      const wsManager = getGameWebSocket();
      return wsManager.subscribe(event, handler);
    } catch (error) {
      console.warn('WebSocket not initialized for subscription:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }, []);

  // Set up subscriptions from options
  useEffect(() => {
    if (subscriptions.length > 0) {
      const unsubscribeFunctions = subscriptions.map(({ event, handler }) => 
        subscribe(event, handler)
      );
      
      unsubscribeFunctionsRef.current = unsubscribeFunctions;

      return () => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        unsubscribeFunctionsRef.current = [];
      };
    }
    return undefined;
  }, [subscriptions, subscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // WebSocket utility functions
  const handleRequestLeaderboardUpdate = useCallback(() => {
    return requestLeaderboardUpdate();
  }, []);

  const handleJoinRoom = useCallback((roomId: string) => {
    return joinGameRoom(roomId);
  }, []);

  const handleLeaveRoom = useCallback((roomId: string) => {
    return leaveGameRoom(roomId);
  }, []);

  return {
    isConnected: connectionStatus.connected,
    isAuthenticated: connectionStatus.authenticated,
    subscribe,
    requestLeaderboardUpdate: handleRequestLeaderboardUpdate,
    joinRoom: handleJoinRoom,
    leaveRoom: handleLeaveRoom,
    connectionStatus,
  };
}

/**
 * Hook for real-time notifications
 */
export function useWebSocketNotifications() {
  const notifications = useRef<any[]>([]);

  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe('notification', (notification) => {
      notifications.current.push(notification);
    });

    return unsubscribe;
  }, [subscribe]);

  return {
    notifications: notifications.current,
    clearNotifications: () => {
      notifications.current = [];
    },
  };
}

/**
 * Hook for leaderboard real-time updates
 */
export function useLeaderboardUpdates() {
  const { subscribe, requestLeaderboardUpdate } = useWebSocket();

  const subscribeToLeaderboard = useCallback((handler: (data: any) => void) => {
    return subscribe('leaderboard_update', handler);
  }, [subscribe]);

  const refreshLeaderboard = useCallback(() => {
    return requestLeaderboardUpdate();
  }, [requestLeaderboardUpdate]);

  return {
    subscribeToLeaderboard,
    refreshLeaderboard,
  };
}

/**
 * Hook for game room functionality
 */
export function useGameRoom(roomId?: string) {
  const { joinRoom, leaveRoom, subscribe } = useWebSocket();

  // Auto-join room when roomId is provided
  useEffect(() => {
    if (roomId) {
      const success = joinRoom(roomId);
      if (!success) {
        console.warn(`Failed to join room: ${roomId}`);
      }

      return () => {
        leaveRoom(roomId);
      };
    }
    return undefined;
  }, [roomId, joinRoom, leaveRoom]);

  const subscribeToRoomEvents = useCallback((handler: (data: any) => void) => {
    const unsubscribers = [
      subscribe('player_joined', handler),
      subscribe('player_left', handler),
      subscribe('room_message', handler),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe]);

  return {
    joinRoom,
    leaveRoom,
    subscribeToRoomEvents,
  };
}

/**
 * Hook for real-time guess results
 */
export function useGuessResults() {
  const { subscribe } = useWebSocket();

  const subscribeToGuessResults = useCallback((handler: (data: any) => void) => {
    return subscribe('guess_result', handler);
  }, [subscribe]);

  return {
    subscribeToGuessResults,
  };
}