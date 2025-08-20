/**
 * Integration layer between GameSessionManager and Redux store
 * Provides hooks and utilities to connect the session manager with the application state
 */

import { GameSessionManager, SessionEvent } from './gameSessionManager';
import { 
  startGameSession as startReduxSession,
  updateActivity,
  addPoints,
  incrementChallengesCompleted,
  endGameSession as endReduxSession,
  updateLastActivity,
} from '../store/slices/gameSessionSlice';
import { GameActivity } from '../types/game';

export interface SessionIntegrationConfig {
  dispatch: (action: any) => void;
  sessionManager: GameSessionManager;
}

/**
 * Integrates GameSessionManager with Redux store
 * Automatically syncs session state between the manager and Redux
 */
export class GameSessionIntegration {
  private config: SessionIntegrationConfig;
  private unsubscribeFunctions: (() => void)[] = [];

  constructor(config: SessionIntegrationConfig) {
    this.config = config;
    this.setupEventListeners();
  }

  /**
   * Start a new game session and sync with Redux
   */
  async startSession(playerId: string): Promise<void> {
    const session = await this.config.sessionManager.startGameSession();
    
    // Update Redux store
    this.config.dispatch(startReduxSession({ playerId }));
  }

  /**
   * End the current session and sync with Redux
   */
  async endSession(): Promise<void> {
    await this.config.sessionManager.endGameSession();
    
    // Update Redux store
    this.config.dispatch(endReduxSession());
  }

  /**
   * Update player activity and sync with Redux
   */
  updatePlayerActivity(activity: GameActivity): void {
    this.config.sessionManager.updateActivity(activity);
    
    // Redux will be updated via event listener
  }

  /**
   * Add points and sync with Redux
   */
  addSessionPoints(points: number, source?: string): void {
    this.config.sessionManager.addPoints(points, source);
    
    // Redux will be updated via event listener
  }

  /**
   * Increment challenges completed and sync with Redux
   */
  completedChallenge(): void {
    this.config.sessionManager.incrementChallengesCompleted();
    
    // Redux will be updated via event listener
  }

  /**
   * Get current session from manager
   */
  getCurrentSession() {
    return this.config.sessionManager.getCurrentSession();
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.config.sessionManager.isSessionActive();
  }

  /**
   * Cleanup integration
   */
  cleanup(): void {
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    this.unsubscribeFunctions = [];
  }

  private setupEventListeners(): void {
    // Listen to session manager events and sync with Redux
    
    const unsubscribeActivity = this.config.sessionManager.addEventListener(
      'activity_changed',
      (event: SessionEvent) => {
        if (event.data?.newActivity) {
          this.config.dispatch(updateActivity(event.data.newActivity));
          this.config.dispatch(updateLastActivity());
        }
      }
    );

    const unsubscribePoints = this.config.sessionManager.addEventListener(
      'points_earned',
      (event: SessionEvent) => {
        if (event.data?.points) {
          this.config.dispatch(addPoints(event.data.points));
          this.config.dispatch(updateLastActivity());
        }
      }
    );

    const unsubscribeIdle = this.config.sessionManager.addEventListener(
      'idle_timeout',
      () => {
        this.config.dispatch(updateActivity('idle'));
      }
    );

    // Store unsubscribe functions for cleanup
    this.unsubscribeFunctions.push(
      unsubscribeActivity,
      unsubscribePoints,
      unsubscribeIdle
    );
  }
}

/**
 * React hook for using GameSessionManager with Redux integration
 */
export function useGameSessionManager(
  sessionManager: GameSessionManager,
  dispatch: (action: any) => void
) {
  const integration = new GameSessionIntegration({ sessionManager, dispatch });

  return {
    startSession: integration.startSession.bind(integration),
    endSession: integration.endSession.bind(integration),
    updateActivity: integration.updatePlayerActivity.bind(integration),
    addPoints: integration.addSessionPoints.bind(integration),
    completeChallenge: integration.completedChallenge.bind(integration),
    getCurrentSession: integration.getCurrentSession.bind(integration),
    isActive: integration.isSessionActive.bind(integration),
    cleanup: integration.cleanup.bind(integration),
  };
}