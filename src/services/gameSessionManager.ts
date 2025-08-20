/**
 * GameSessionManager - Orchestrates game sessions and activity states
 * 
 * This class manages the lifecycle of game sessions, tracks player activities,
 * handles session persistence, and coordinates with the Redux store and WebSocket
 * for real-time updates.
 * 
 * Relates to Requirements:
 * - Req 1: Intuitive Core Game Loop
 * - Req 5: Resource Earning and Monetization  
 * - Req 6: Auto-Save and Cross-Device Sync
 */

import { GameSession, GameActivity, SessionPersistence, RewardCalculation } from '../types/game';
import { GameWebSocketManager } from './gameWebSocket';

export interface GameSessionManagerConfig {
  playerId: string;
  autoSaveInterval?: number; // milliseconds, default 5000
  idleTimeout?: number; // milliseconds, default 30000
  maxSessionDuration?: number; // milliseconds, default 4 hours
  enableWebSocket?: boolean;
  webSocketConfig?: {
    serverUrl: string;
  };
}

export interface SessionMetrics {
  totalSessions: number;
  averageSessionDuration: number;
  totalPlayTime: number;
  lastSessionDate: Date | null;
}

export type SessionEventType = 
  | 'session_started'
  | 'session_ended' 
  | 'activity_changed'
  | 'points_earned'
  | 'idle_timeout'
  | 'session_saved'
  | 'session_restored';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: Date;
  data?: any;
}

export class GameSessionManager {
  private config: GameSessionManagerConfig;
  private currentSession: GameSession | null = null;
  private webSocketManager: GameWebSocketManager | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<SessionEventType, ((event: SessionEvent) => void)[]> = new Map();
  private isInitialized = false;

  constructor(config: GameSessionManagerConfig) {
    this.config = {
      autoSaveInterval: 5000,
      idleTimeout: 30000,
      maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
      enableWebSocket: true,
      ...config,
    };
  }

  /**
   * Initialize the session manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Initialize WebSocket if enabled
    if (this.config.enableWebSocket && this.config.webSocketConfig) {
      this.webSocketManager = new GameWebSocketManager({
        serverUrl: this.config.webSocketConfig.serverUrl,
        playerId: this.config.playerId,
      });

      try {
        await this.webSocketManager.connect();
      } catch (error) {
        console.warn('Failed to connect WebSocket, continuing without real-time features:', error);
      }
    }

    // Try to restore previous session
    await this.restoreSession();

    this.isInitialized = true;
  }

  /**
   * Start a new game session
   */
  async startGameSession(): Promise<GameSession> {
    // End current session if exists
    if (this.currentSession) {
      await this.endGameSession();
    }

    const sessionId = this.generateSessionId();
    const now = new Date();

    this.currentSession = {
      sessionId,
      playerId: this.config.playerId,
      currentActivity: 'idle',
      startTime: now,
      lastActivity: now,
      pointsEarned: 0,
      challengesCompleted: 0,
      guessesSubmitted: 0,
      sessionDuration: 0,
      isActive: true,
    };

    // Update WebSocket with session ID
    if (this.webSocketManager) {
      this.webSocketManager.updateConfig({ gameSessionId: sessionId });
    }

    // Start auto-save timer
    this.startAutoSave();

    // Start idle monitoring
    this.resetIdleTimer();

    // Emit session started event
    this.emitEvent('session_started', {
      sessionId,
      playerId: this.config.playerId,
    });

    // Send activity heartbeat
    this.sendActivityHeartbeat();

    return this.currentSession;
  }

  /**
   * End the current game session
   */
  async endGameSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const sessionId = this.currentSession.sessionId;

    // Update session duration
    this.currentSession.sessionDuration = Date.now() - this.currentSession.startTime.getTime();
    this.currentSession.isActive = false;

    // Save final session state
    await this.saveSession();

    // Stop timers
    this.stopAutoSave();
    this.stopIdleTimer();

    // Emit session ended event
    this.emitEvent('session_ended', {
      sessionId,
      duration: this.currentSession.sessionDuration,
      pointsEarned: this.currentSession.pointsEarned,
      challengesCompleted: this.currentSession.challengesCompleted,
    });

    this.currentSession = null;
  }

  /**
   * Update player activity state
   */
  updateActivity(activity: GameActivity): void {
    if (!this.currentSession) {
      throw new Error('No active session to update activity');
    }

    const previousActivity = this.currentSession.currentActivity;
    this.currentSession.currentActivity = activity;
    this.currentSession.lastActivity = new Date();

    // Reset idle timer on activity change
    this.resetIdleTimer();

    // Send activity heartbeat
    this.sendActivityHeartbeat();

    // Emit activity changed event
    this.emitEvent('activity_changed', {
      sessionId: this.currentSession.sessionId,
      previousActivity,
      newActivity: activity,
    });
  }

  /**
   * Add points to current session
   */
  addPoints(points: number, source?: string): void {
    if (!this.currentSession) {
      throw new Error('No active session to add points to');
    }

    this.currentSession.pointsEarned += points;
    this.currentSession.lastActivity = new Date();

    // Reset idle timer
    this.resetIdleTimer();

    // Emit points earned event
    this.emitEvent('points_earned', {
      sessionId: this.currentSession.sessionId,
      points,
      totalPoints: this.currentSession.pointsEarned,
      source,
    });
  }

  /**
   * Increment challenges completed
   */
  incrementChallengesCompleted(): void {
    if (!this.currentSession) {
      throw new Error('No active session to update');
    }

    this.currentSession.challengesCompleted += 1;
    this.currentSession.lastActivity = new Date();
    this.resetIdleTimer();
  }

  /**
   * Increment guesses submitted
   */
  incrementGuessesSubmitted(): void {
    if (!this.currentSession) {
      throw new Error('No active session to update');
    }

    this.currentSession.guessesSubmitted += 1;
    this.currentSession.lastActivity = new Date();
    this.resetIdleTimer();
  }

  /**
   * Get current session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentSession?.isActive ?? false;
  }

  /**
   * Calculate session rewards based on performance
   */
  calculateSessionRewards(): RewardCalculation | null {
    if (!this.currentSession) {
      return null;
    }

    const basePoints = this.currentSession.pointsEarned;
    const sessionDurationHours = this.currentSession.sessionDuration / (1000 * 60 * 60);
    
    // Calculate bonuses
    const bonusMultiplier = Math.min(1.5, 1 + (this.currentSession.challengesCompleted * 0.1));
    const streakBonus = Math.min(100, this.currentSession.challengesCompleted * 10);
    const difficultyBonus = 0; // Would be calculated based on challenge difficulty
    const speedBonus = sessionDurationHours < 1 ? 50 : 0;

    const totalPoints = Math.floor(basePoints * bonusMultiplier + streakBonus + speedBonus);
    const experienceGained = Math.floor(totalPoints * 0.8);

    return {
      basePoints,
      bonusMultiplier,
      streakBonus,
      difficultyBonus,
      speedBonus,
      totalPoints,
      currencyRewards: [
        { type: 'coins', amount: totalPoints, lastEarned: new Date(), totalEarned: 0, totalSpent: 0 },
        { type: 'experience', amount: experienceGained, lastEarned: new Date(), totalEarned: 0, totalSpent: 0 }
      ],
      experienceGained,
      achievementsUnlocked: [], // Would be populated based on achievements logic
    };
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    // This would typically fetch from persistent storage
    // For now, return basic metrics
    return {
      totalSessions: 0,
      averageSessionDuration: 0,
      totalPlayTime: 0,
      lastSessionDate: null,
    };
  }

  /**
   * Subscribe to session events
   */
  addEventListener(eventType: SessionEventType, listener: (event: SessionEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.currentSession) {
      await this.endGameSession();
    }

    this.stopAutoSave();
    this.stopIdleTimer();

    if (this.webSocketManager) {
      this.webSocketManager.disconnect();
    }

    this.eventListeners.clear();
    this.isInitialized = false;
  }

  // Private methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startAutoSave(): void {
    this.stopAutoSave();
    
    this.autoSaveTimer = setInterval(async () => {
      if (this.currentSession) {
        await this.saveSession();
      }
    }, this.config.autoSaveInterval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private resetIdleTimer(): void {
    this.stopIdleTimer();

    this.idleTimer = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.config.idleTimeout);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private handleIdleTimeout(): void {
    if (this.currentSession && this.currentSession.currentActivity !== 'idle') {
      this.updateActivity('idle');
      
      this.emitEvent('idle_timeout', {
        sessionId: this.currentSession.sessionId,
        previousActivity: this.currentSession.currentActivity,
      });
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // Update session duration
    this.currentSession.sessionDuration = Date.now() - this.currentSession.startTime.getTime();

    const persistenceData: SessionPersistence = {
      sessionId: this.currentSession.sessionId,
      playerId: this.config.playerId,
      gameState: { ...this.currentSession },
      lastSaved: new Date(),
      syncStatus: 'pending',
      deviceId: this.getDeviceId(),
    };

    try {
      // Save to localStorage
      localStorage.setItem(`gameSession_${this.config.playerId}`, JSON.stringify(persistenceData));
      
      // TODO: Save to server via API
      
      this.emitEvent('session_saved', {
        sessionId: this.currentSession.sessionId,
        lastSaved: persistenceData.lastSaved,
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private async restoreSession(): Promise<void> {
    try {
      const savedData = localStorage.getItem(`gameSession_${this.config.playerId}`);
      if (!savedData) {
        return;
      }

      const persistenceData: SessionPersistence = JSON.parse(savedData);
      
      // Check if session is recent (within last hour)
      const lastSaved = new Date(persistenceData.lastSaved);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastSaved > hourAgo && persistenceData.gameState.isActive) {
        this.currentSession = {
          ...persistenceData.gameState,
          startTime: new Date(persistenceData.gameState.startTime),
          lastActivity: new Date(persistenceData.gameState.lastActivity),
        };

        // Update WebSocket with restored session
        if (this.webSocketManager) {
          this.webSocketManager.updateConfig({ 
            gameSessionId: this.currentSession.sessionId 
          });
        }

        // Restart timers
        this.startAutoSave();
        this.resetIdleTimer();

        this.emitEvent('session_restored', {
          sessionId: this.currentSession.sessionId,
          restoredAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  }

  private sendActivityHeartbeat(): void {
    if (this.webSocketManager && this.currentSession) {
      this.webSocketManager.sendActivityHeartbeat(this.currentSession.currentActivity);
    }
  }

  private getDeviceId(): string {
    // Simple device ID generation - in production, use a more robust method
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private emitEvent(type: SessionEventType, data?: any): void {
    const event: SessionEvent = {
      type,
      sessionId: this.currentSession?.sessionId ?? 'unknown',
      timestamp: new Date(),
      data,
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in session event listener for ${type}:`, error);
        }
      });
    }
  }
}

// Singleton instance for global access
let gameSessionManagerInstance: GameSessionManager | null = null;

/**
 * Get or create the global game session manager instance
 */
export function getGameSessionManager(config?: GameSessionManagerConfig): GameSessionManager {
  if (!gameSessionManagerInstance && config) {
    gameSessionManagerInstance = new GameSessionManager(config);
  }
  
  if (!gameSessionManagerInstance) {
    throw new Error('GameSessionManager not initialized. Provide config on first call.');
  }
  
  return gameSessionManagerInstance;
}

/**
 * Initialize the global game session manager instance
 */
export function initializeGameSessionManager(config: GameSessionManagerConfig): GameSessionManager {
  gameSessionManagerInstance = new GameSessionManager(config);
  return gameSessionManagerInstance;
}

/**
 * Cleanup the global game session manager instance
 */
export function cleanupGameSessionManager(): Promise<void> {
  if (gameSessionManagerInstance) {
    return gameSessionManagerInstance.cleanup().then(() => {
      gameSessionManagerInstance = null;
    });
  }
  return Promise.resolve();
}