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

import { GameSession, GameActivity, RewardCalculation } from '../types/game';
import { GameWebSocketManager } from './gameWebSocket';
import { SessionPersistenceService, PersistenceConfig } from './sessionPersistence';

export interface GameSessionManagerConfig {
  playerId: string;
  autoSaveInterval?: number; // milliseconds, default 5000
  idleTimeout?: number; // milliseconds, default 30000
  maxSessionDuration?: number; // milliseconds, default 4 hours
  enableWebSocket?: boolean;
  hintConfig?: {
    enableIdleHints?: boolean; // default true
    idleHintDelay?: number; // milliseconds after idle timeout, default 5000
    maxIdleHints?: number; // max hints per idle period, default 3
    hintCooldown?: number; // milliseconds between hints, default 10000
    enableStruggleHints?: boolean; // default true
    failureThreshold?: number; // failed attempts before hint, default 2
  };
  webSocketConfig?: {
    serverUrl: string;
  };
  persistenceConfig?: {
    serverUrl?: string;
    enableServerSync?: boolean;
    syncInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
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
  | 'hint_triggered'
  | 'hint_dismissed'
  | 'engagement_prompt'
  | 'session_saved'
  | 'session_restored';

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  timestamp: Date;
  data?: any;
}

export type HintType = 
  | 'idle_engagement' 
  | 'struggle_assistance' 
  | 'progress_encouragement'
  | 'feature_discovery';

export interface HintTrigger {
  id: string;
  type: HintType;
  message: string;
  animation?: string;
  actionPrompt?: string;
  priority: 'low' | 'medium' | 'high';
  triggeredAt: Date;
  dismissedAt?: Date;
  context?: {
    currentActivity?: GameActivity;
    failureCount?: number;
    idleDuration?: number;
    challengeId?: string;
  };
}

export interface IdleState {
  isIdle: boolean;
  idleStartTime?: Date | undefined;
  idleDuration: number; // milliseconds
  hintsShown: number;
  lastHintTime?: Date | undefined;
  engagementPrompts: number;
}

export class GameSessionManager {
  private config: GameSessionManagerConfig;
  private currentSession: GameSession | null = null;
  private webSocketManager: GameWebSocketManager | null = null;
  private persistenceService: SessionPersistenceService | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private idleTimer: NodeJS.Timeout | null = null;
  private hintTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<SessionEventType, ((event: SessionEvent) => void)[]> = new Map();
  private isInitialized = false;
  
  // Hint and engagement state
  private idleState: IdleState = {
    isIdle: false,
    idleDuration: 0,
    hintsShown: 0,
    engagementPrompts: 0,
  };
  private activeHints: Map<string, HintTrigger> = new Map();
  private failureCount: number = 0;
  private lastFailureTime?: Date | undefined;

  constructor(config: GameSessionManagerConfig) {
    this.config = {
      autoSaveInterval: 5000,
      idleTimeout: 30000,
      maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
      enableWebSocket: true,
      hintConfig: {
        enableIdleHints: true,
        idleHintDelay: 5000, // 5 seconds after idle timeout
        maxIdleHints: 3,
        hintCooldown: 10000, // 10 seconds between hints
        enableStruggleHints: true,
        failureThreshold: 2,
        ...config.hintConfig,
      },
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

    // Initialize persistence service
    const persistenceConfig: PersistenceConfig = {
      playerId: this.config.playerId,
      ...this.config.persistenceConfig,
    };
    this.persistenceService = new SessionPersistenceService(persistenceConfig);
    await this.persistenceService.initialize();

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

    // Try to restore previous session with cross-device sync
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

    // Reset failure count on successful activity change (not to idle)
    if (activity !== 'idle' && previousActivity === 'idle') {
      this.resetFailureCount();
    }

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
    if (!this.persistenceService) {
      return {
        totalSessions: 0,
        averageSessionDuration: 0,
        totalPlayTime: 0,
        lastSessionDate: null,
      };
    }

    // Get backup sessions to calculate metrics
    const backups = this.persistenceService.getBackupSessions();
    
    if (backups.length === 0) {
      return {
        totalSessions: 0,
        averageSessionDuration: 0,
        totalPlayTime: 0,
        lastSessionDate: null,
      };
    }

    const totalSessions = backups.length;
    const totalPlayTime = backups.reduce((total, backup) => total + backup.gameState.sessionDuration, 0);
    const averageSessionDuration = totalPlayTime / totalSessions;
    const lastSessionDate = backups[0]?.timestamp || null; // Most recent backup

    return {
      totalSessions,
      averageSessionDuration,
      totalPlayTime,
      lastSessionDate,
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
   * Get persistence service sync status
   */
  getSyncStatus() {
    return this.persistenceService?.getSyncStatus() || null;
  }

  /**
   * Force sync current session to server
   */
  async forceSync(): Promise<boolean> {
    if (!this.persistenceService || !this.currentSession) {
      return false;
    }
    
    return await this.persistenceService.forceSync(this.currentSession);
  }

  /**
   * Get backup sessions
   */
  getBackupSessions() {
    return this.persistenceService?.getBackupSessions() || [];
  }

  /**
   * Restore session from backup
   */
  async restoreFromBackup(backupIndex: number): Promise<boolean> {
    if (!this.persistenceService) {
      return false;
    }

    const restoredSession = await this.persistenceService.restoreFromBackup(backupIndex);
    if (!restoredSession) {
      return false;
    }

    // End current session if exists
    if (this.currentSession) {
      await this.endGameSession();
    }

    // Set restored session as current
    this.currentSession = restoredSession;

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
      fromBackup: true,
      backupIndex,
    });

    return true;
  }

  /**
   * Clear all session data
   */
  async clearAllSessionData(): Promise<void> {
    if (this.persistenceService) {
      await this.persistenceService.clearAllData();
    }
  }

  /**
   * Record a failure/incorrect attempt for hint triggering
   */
  recordFailure(challengeId?: string): void {
    if (!this.config.hintConfig?.enableStruggleHints) {
      return;
    }

    this.failureCount += 1;
    this.lastFailureTime = new Date();

    // Check if we should trigger a struggle hint
    if (this.failureCount >= (this.config.hintConfig.failureThreshold || 2)) {
      this.triggerStruggleHint(challengeId);
    }
  }

  /**
   * Reset failure count (called on success)
   */
  resetFailureCount(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Dismiss a specific hint
   */
  dismissHint(hintId: string): void {
    const hint = this.activeHints.get(hintId);
    if (hint) {
      hint.dismissedAt = new Date();
      this.activeHints.delete(hintId);

      this.emitEvent('hint_dismissed', {
        sessionId: this.currentSession?.sessionId,
        hintId,
        hint,
      });
    }
  }

  /**
   * Get all active hints
   */
  getActiveHints(): HintTrigger[] {
    return Array.from(this.activeHints.values());
  }

  /**
   * Get current idle state
   */
  getIdleState(): IdleState {
    if (this.idleState.isIdle && this.idleState.idleStartTime) {
      this.idleState.idleDuration = Date.now() - this.idleState.idleStartTime.getTime();
    }
    return { ...this.idleState };
  }

  /**
   * Manually trigger engagement prompt
   */
  triggerEngagementPrompt(): void {
    if (!this.currentSession) {
      return;
    }

    const hint = this.createHint('idle_engagement', this.getEngagementMessage());
    this.activeHints.set(hint.id, hint);
    this.idleState.engagementPrompts += 1;

    this.emitEvent('engagement_prompt', {
      sessionId: this.currentSession.sessionId,
      hint,
      idleState: { ...this.idleState },
    });
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
    this.stopHintTimer();

    if (this.webSocketManager) {
      this.webSocketManager.disconnect();
    }

    if (this.persistenceService) {
      this.persistenceService.cleanup();
    }

    this.eventListeners.clear();
    this.activeHints.clear();
    this.isInitialized = false;
  }

  // Private methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
    this.stopHintTimer();

    // Reset idle state when activity resumes
    if (this.idleState.isIdle) {
      this.idleState.isIdle = false;
      this.idleState.idleStartTime = undefined;
      this.idleState.idleDuration = 0;
      this.idleState.hintsShown = 0;
      this.idleState.lastHintTime = undefined;
    }

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

  private startIdleHintTimer(): void {
    if (!this.config.hintConfig?.enableIdleHints || !this.currentSession) {
      return;
    }

    const delay = this.config.hintConfig.idleHintDelay || 5000;
    
    this.hintTimer = setTimeout(() => {
      this.showIdleHint();
    }, delay);
  }

  private stopHintTimer(): void {
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
  }

  private showIdleHint(): void {
    if (!this.currentSession || !this.idleState.isIdle) {
      return;
    }

    const maxHints = this.config.hintConfig?.maxIdleHints || 3;
    const cooldown = this.config.hintConfig?.hintCooldown || 10000;

    // Check if we've reached max hints
    if (this.idleState.hintsShown >= maxHints) {
      return;
    }

    // Check cooldown
    if (this.idleState.lastHintTime) {
      const timeSinceLastHint = Date.now() - this.idleState.lastHintTime.getTime();
      if (timeSinceLastHint < cooldown) {
        // Schedule next hint after cooldown
        this.hintTimer = setTimeout(() => {
          this.showIdleHint();
        }, cooldown - timeSinceLastHint);
        return;
      }
    }

    // Create and show hint
    const hint = this.createHint('idle_engagement', this.getIdleHintMessage());
    this.activeHints.set(hint.id, hint);
    this.idleState.hintsShown += 1;
    this.idleState.lastHintTime = new Date();

    this.emitEvent('hint_triggered', {
      sessionId: this.currentSession.sessionId,
      hint,
      idleState: { ...this.idleState },
    });

    // Schedule next hint if we haven't reached the limit
    if (this.idleState.hintsShown < maxHints) {
      this.hintTimer = setTimeout(() => {
        this.showIdleHint();
      }, cooldown);
    }
  }

  private triggerStruggleHint(challengeId?: string): void {
    if (!this.currentSession) {
      return;
    }

    const hint = this.createHint('struggle_assistance', this.getStruggleHintMessage(), {
      currentActivity: this.currentSession.currentActivity,
      failureCount: this.failureCount,
      challengeId,
    });

    this.activeHints.set(hint.id, hint);

    this.emitEvent('hint_triggered', {
      sessionId: this.currentSession.sessionId,
      hint,
      triggerReason: 'struggle',
      failureCount: this.failureCount,
    });
  }

  private createHint(type: HintType, message: string, context?: any): HintTrigger {
    return {
      id: `hint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      message,
      animation: this.getHintAnimation(type),
      actionPrompt: this.getActionPrompt(type),
      priority: this.getHintPriority(type),
      triggeredAt: new Date(),
      context,
    };
  }

  private getIdleHintMessage(): string {
    const messages = [
      "Ready to create your next challenge?",
      "Try guessing someone else's lie!",
      "Check out the leaderboard to see how you're doing!",
      "Explore new challenges waiting for you!",
    ];
    const index = this.idleState.hintsShown % messages.length;
    return messages[index] ?? "Ready to continue playing?";
  }

  private getStruggleHintMessage(): string {
    const messages = [
      "Having trouble? Try looking for emotional cues in the statements.",
      "Pay attention to details that seem too specific or too vague.",
      "Consider which statement feels different from the others.",
      "Trust your instincts - sometimes the obvious choice is right!",
    ];
    const index = Math.max(0, Math.min(this.failureCount - 1, messages.length - 1));
    return messages[index] ?? "Take your time and trust your instincts!";
  }

  private getEngagementMessage(): string {
    const messages = [
      "Come back and continue your winning streak!",
      "New challenges are waiting for you!",
      "Your friends are climbing the leaderboard - catch up!",
    ];
    const index = this.idleState.engagementPrompts % messages.length;
    return messages[index] ?? "Come back and play!";
  }

  private getHintAnimation(type: HintType): string {
    const animations = {
      idle_engagement: 'pulse',
      struggle_assistance: 'bounce',
      progress_encouragement: 'glow',
      feature_discovery: 'slide',
    };
    return animations[type];
  }

  private getActionPrompt(type: HintType): string {
    const prompts = {
      idle_engagement: 'Tap to continue playing',
      struggle_assistance: 'Need a hint?',
      progress_encouragement: 'Keep going!',
      feature_discovery: 'Try this feature',
    };
    return prompts[type];
  }

  private getHintPriority(type: HintType): 'low' | 'medium' | 'high' {
    const priorities = {
      idle_engagement: 'low' as const,
      struggle_assistance: 'high' as const,
      progress_encouragement: 'medium' as const,
      feature_discovery: 'medium' as const,
    };
    return priorities[type];
  }

  private handleIdleTimeout(): void {
    if (!this.currentSession) {
      return;
    }

    const previousActivity = this.currentSession.currentActivity;
    
    // Update idle state
    this.idleState.isIdle = true;
    this.idleState.idleStartTime = new Date();
    this.idleState.idleDuration = 0;
    
    // Update session activity to idle
    if (previousActivity !== 'idle') {
      this.updateActivity('idle');
    }
    
    this.emitEvent('idle_timeout', {
      sessionId: this.currentSession.sessionId,
      previousActivity,
      idleState: { ...this.idleState },
    });

    // Start hint timer if idle hints are enabled
    if (this.config.hintConfig?.enableIdleHints) {
      this.startIdleHintTimer();
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.currentSession || !this.persistenceService) {
      return;
    }

    // Update session duration
    this.currentSession.sessionDuration = Date.now() - this.currentSession.startTime.getTime();

    try {
      await this.persistenceService.saveToLocal(this.currentSession);
      
      this.emitEvent('session_saved', {
        sessionId: this.currentSession.sessionId,
        lastSaved: new Date(),
      });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  private async restoreSession(): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    try {
      // Try to sync and get the most recent session across devices
      const restoredSession = await this.persistenceService.syncSession();
      
      if (restoredSession) {
        this.currentSession = restoredSession;

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
          fromBackup: false,
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