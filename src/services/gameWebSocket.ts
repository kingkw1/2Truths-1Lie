/**
 * Game-specific WebSocket manager for real-time notifications and updates
 * Handles game events, leaderboard updates, and player interactions
 */

import { WebSocketService, WebSocketMessage, WebSocketEventHandlers } from './websocket';

export interface GameWebSocketConfig {
  serverUrl: string;
  playerId?: string;
  gameSessionId?: string;
}

export interface GameNotification {
  type: 'guess_result' | 'leaderboard_update' | 'challenge_published' | 'achievement_unlocked' | 'player_joined' | 'system_message';
  data: any;
  priority: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface LeaderboardUpdate {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  change: number;
}

export interface GuessResult {
  challengeId: string;
  guesserId: string;
  guesserName: string;
  correct: boolean;
  pointsAwarded: number;
  timeSpent: number;
}

export class GameWebSocketManager {
  private wsService: WebSocketService;
  private config: GameWebSocketConfig;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private isAuthenticated = false;

  constructor(config: GameWebSocketConfig) {
    this.config = config;
    
    const wsConfig = {
      url: this.buildWebSocketUrl(),
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
    };

    const handlers: WebSocketEventHandlers = {
      onConnect: this.handleConnect.bind(this),
      onDisconnect: this.handleDisconnect.bind(this),
      onMessage: this.handleMessage.bind(this),
      onError: this.handleError.bind(this),
      onReconnect: this.handleReconnect.bind(this),
    };

    this.wsService = new WebSocketService(wsConfig, handlers);
  }

  /**
   * Connect to the game WebSocket server
   */
  async connect(): Promise<void> {
    try {
      await this.wsService.connect();
    } catch (error) {
      console.error('Failed to connect to game WebSocket:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the game WebSocket server
   */
  disconnect(): void {
    this.wsService.disconnect();
    this.isAuthenticated = false;
  }

  /**
   * Subscribe to game events
   */
  subscribe(eventType: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    this.eventHandlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Send guess result notification
   */
  sendGuessResult(result: GuessResult): boolean {
    return this.wsService.send('guess_result', result);
  }

  /**
   * Request leaderboard updates
   */
  requestLeaderboardUpdate(): boolean {
    return this.wsService.send('request_leaderboard', {
      playerId: this.config.playerId,
      timestamp: Date.now(),
    });
  }

  /**
   * Notify about challenge publication
   */
  notifyChallengePublished(challengeId: string, challengeData: any): boolean {
    return this.wsService.send('challenge_published', {
      challengeId,
      publisherId: this.config.playerId,
      challengeData,
      timestamp: Date.now(),
    });
  }

  /**
   * Send player activity heartbeat
   */
  sendActivityHeartbeat(activity: string): boolean {
    return this.wsService.send('player_activity', {
      playerId: this.config.playerId,
      gameSessionId: this.config.gameSessionId,
      activity,
      timestamp: Date.now(),
    });
  }

  /**
   * Join a game room for real-time interactions
   */
  joinGameRoom(roomId: string): boolean {
    return this.wsService.send('join_room', {
      roomId,
      playerId: this.config.playerId,
      timestamp: Date.now(),
    });
  }

  /**
   * Leave a game room
   */
  leaveGameRoom(roomId: string): boolean {
    return this.wsService.send('leave_room', {
      roomId,
      playerId: this.config.playerId,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if connected and authenticated
   */
  isReady(): boolean {
    return this.wsService.isConnected() && this.isAuthenticated;
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; authenticated: boolean; state: string } {
    return {
      connected: this.wsService.isConnected(),
      authenticated: this.isAuthenticated,
      state: this.wsService.getConnectionState(),
    };
  }

  /**
   * Update player and session IDs
   */
  updateConfig(updates: Partial<GameWebSocketConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Re-authenticate if connected
    if (this.wsService.isConnected()) {
      this.authenticate();
    }
  }

  private buildWebSocketUrl(): string {
    const url = new URL(this.config.serverUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    
    if (this.config.playerId) {
      url.searchParams.set('playerId', this.config.playerId);
    }
    
    if (this.config.gameSessionId) {
      url.searchParams.set('sessionId', this.config.gameSessionId);
    }
    
    return url.toString();
  }

  private handleConnect(): void {
    console.log('Connected to game WebSocket server');
    this.authenticate();
    this.emit('connected', {});
  }

  private handleDisconnect(event: CloseEvent): void {
    console.log('Disconnected from game WebSocket server:', event.reason);
    this.isAuthenticated = false;
    this.emit('disconnected', { reason: event.reason, code: event.code });
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth_success':
        this.isAuthenticated = true;
        this.emit('authenticated', message.payload);
        break;

      case 'auth_failed':
        this.isAuthenticated = false;
        this.emit('auth_failed', message.payload);
        break;

      case 'notification':
        this.handleNotification(message.payload as GameNotification);
        break;

      case 'leaderboard_update':
        this.emit('leaderboard_update', message.payload);
        break;

      case 'guess_result':
        this.emit('guess_result', message.payload);
        break;

      case 'challenge_published':
        this.emit('challenge_published', message.payload);
        break;

      case 'player_joined':
        this.emit('player_joined', message.payload);
        break;

      case 'player_left':
        this.emit('player_left', message.payload);
        break;

      case 'system_message':
        this.emit('system_message', message.payload);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private handleError(error: Event): void {
    console.error('Game WebSocket error:', error);
    this.emit('error', { error });
  }

  private handleReconnect(attempt: number): void {
    console.log(`Attempting to reconnect to game WebSocket (attempt ${attempt})`);
    this.emit('reconnecting', { attempt });
  }

  private handleNotification(notification: GameNotification): void {
    // Emit specific notification type
    this.emit(notification.type, notification.data);
    
    // Emit general notification event
    this.emit('notification', notification);
  }

  private authenticate(): void {
    if (!this.config.playerId) {
      console.warn('Cannot authenticate: playerId not provided');
      return;
    }

    this.wsService.send('authenticate', {
      playerId: this.config.playerId,
      gameSessionId: this.config.gameSessionId,
      timestamp: Date.now(),
    });
  }

  private emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${eventType}:`, error);
        }
      });
    }
  }
}

// Singleton instance for global access
let gameWebSocketInstance: GameWebSocketManager | null = null;

/**
 * Get or create the global game WebSocket instance
 */
export function getGameWebSocket(config?: GameWebSocketConfig): GameWebSocketManager {
  if (!gameWebSocketInstance && config) {
    gameWebSocketInstance = new GameWebSocketManager(config);
  }
  
  if (!gameWebSocketInstance) {
    throw new Error('GameWebSocket not initialized. Provide config on first call.');
  }
  
  return gameWebSocketInstance;
}

/**
 * Initialize the global game WebSocket instance
 */
export function initializeGameWebSocket(config: GameWebSocketConfig): GameWebSocketManager {
  gameWebSocketInstance = new GameWebSocketManager(config);
  return gameWebSocketInstance;
}

/**
 * Cleanup the global game WebSocket instance
 */
export function cleanupGameWebSocket(): void {
  if (gameWebSocketInstance) {
    gameWebSocketInstance.disconnect();
    gameWebSocketInstance = null;
  }
}