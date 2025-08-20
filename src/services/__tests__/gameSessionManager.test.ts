/**
 * Unit tests for GameSessionManager
 * Tests session lifecycle, activity tracking, and persistence
 */

import { GameSessionManager, GameSessionManagerConfig } from '../gameSessionManager';
import { GameActivity } from '../../types/game';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock timers
jest.useFakeTimers();

describe('GameSessionManager', () => {
  let manager: GameSessionManager;
  let config: GameSessionManagerConfig;

  beforeEach(() => {
    config = {
      playerId: 'test-player-123',
      autoSaveInterval: 1000,
      idleTimeout: 5000,
      enableWebSocket: false, // Disable WebSocket for tests
    };
    
    manager = new GameSessionManager(config);
    localStorageMock.clear();
  });

  afterEach(async () => {
    await manager.cleanup();
    jest.clearAllTimers();
  });

  describe('Session Lifecycle', () => {
    test('should start a new game session', async () => {
      await manager.initialize();
      const session = await manager.startGameSession();

      expect(session).toBeDefined();
      expect(session.playerId).toBe('test-player-123');
      expect(session.currentActivity).toBe('idle');
      expect(session.isActive).toBe(true);
      expect(session.pointsEarned).toBe(0);
      expect(session.challengesCompleted).toBe(0);
    });

    test('should end a game session', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      expect(manager.isSessionActive()).toBe(true);
      
      await manager.endGameSession();
      
      expect(manager.isSessionActive()).toBe(false);
      expect(manager.getCurrentSession()).toBeNull();
    });

    test('should generate unique session IDs', async () => {
      await manager.initialize();
      
      const session1 = await manager.startGameSession();
      await manager.endGameSession();
      
      const session2 = await manager.startGameSession();
      
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('Activity Management', () => {
    beforeEach(async () => {
      await manager.initialize();
      await manager.startGameSession();
    });

    test('should update player activity', () => {
      const activities: GameActivity[] = ['creating', 'browsing', 'guessing', 'idle'];
      
      activities.forEach(activity => {
        manager.updateActivity(activity);
        const session = manager.getCurrentSession();
        expect(session?.currentActivity).toBe(activity);
      });
    });

    test('should throw error when updating activity without active session', async () => {
      await manager.endGameSession();
      
      expect(() => {
        manager.updateActivity('creating');
      }).toThrow('No active session to update activity');
    });

    test('should handle idle timeout', () => {
      const eventSpy = jest.fn();
      manager.addEventListener('idle_timeout', eventSpy);
      
      manager.updateActivity('creating');
      
      // Fast-forward past idle timeout
      jest.advanceTimersByTime(6000);
      
      expect(eventSpy).toHaveBeenCalled();
      const session = manager.getCurrentSession();
      expect(session?.currentActivity).toBe('idle');
    });
  });

  describe('Points and Progress', () => {
    beforeEach(async () => {
      await manager.initialize();
      await manager.startGameSession();
    });

    test('should add points to session', () => {
      const eventSpy = jest.fn();
      manager.addEventListener('points_earned', eventSpy);
      
      manager.addPoints(100, 'correct_guess');
      
      const session = manager.getCurrentSession();
      expect(session?.pointsEarned).toBe(100);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'points_earned',
          data: expect.objectContaining({
            points: 100,
            totalPoints: 100,
            source: 'correct_guess',
          }),
        })
      );
    });

    test('should increment challenges completed', () => {
      manager.incrementChallengesCompleted();
      
      const session = manager.getCurrentSession();
      expect(session?.challengesCompleted).toBe(1);
    });

    test('should increment guesses submitted', () => {
      manager.incrementGuessesSubmitted();
      
      const session = manager.getCurrentSession();
      expect(session?.guessesSubmitted).toBe(1);
    });

    test('should calculate session rewards', () => {
      manager.addPoints(200);
      manager.incrementChallengesCompleted();
      manager.incrementChallengesCompleted();
      
      const rewards = manager.calculateSessionRewards();
      
      expect(rewards).toBeDefined();
      expect(rewards?.basePoints).toBe(200);
      expect(rewards?.totalPoints).toBeGreaterThan(200); // Should include bonuses
      expect(rewards?.currencyRewards).toHaveLength(2); // coins and experience
    });
  });

  describe('Event System', () => {
    test('should emit session started event', async () => {
      const eventSpy = jest.fn();
      manager.addEventListener('session_started', eventSpy);
      
      await manager.initialize();
      await manager.startGameSession();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_started',
          data: expect.objectContaining({
            playerId: 'test-player-123',
          }),
        })
      );
    });

    test('should emit session ended event', async () => {
      const eventSpy = jest.fn();
      manager.addEventListener('session_ended', eventSpy);
      
      await manager.initialize();
      await manager.startGameSession();
      await manager.endGameSession();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_ended',
          data: expect.objectContaining({
            duration: expect.any(Number),
            pointsEarned: 0,
            challengesCompleted: 0,
          }),
        })
      );
    });

    test('should emit activity changed event', async () => {
      const eventSpy = jest.fn();
      manager.addEventListener('activity_changed', eventSpy);
      
      await manager.initialize();
      await manager.startGameSession();
      manager.updateActivity('creating');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'activity_changed',
          data: expect.objectContaining({
            previousActivity: 'idle',
            newActivity: 'creating',
          }),
        })
      );
    });

    test('should unsubscribe event listeners', async () => {
      const eventSpy = jest.fn();
      const unsubscribe = manager.addEventListener('session_started', eventSpy);
      
      await manager.initialize();
      unsubscribe();
      
      await manager.startGameSession();
      
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe('Session Persistence', () => {
    test('should save session to localStorage', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Trigger auto-save
      jest.advanceTimersByTime(1500);
      
      const savedData = localStorageMock.getItem('gameSession_test-player-123');
      expect(savedData).toBeDefined();
      
      const parsedData = JSON.parse(savedData!);
      expect(parsedData.playerId).toBe('test-player-123');
      expect(parsedData.gameState).toBeDefined();
    });

    test('should restore session from localStorage', async () => {
      // Simulate saved session data
      const sessionData = {
        sessionId: 'test-session-123',
        playerId: 'test-player-123',
        gameState: {
          sessionId: 'test-session-123',
          playerId: 'test-player-123',
          currentActivity: 'creating',
          startTime: new Date(Date.now() - 1000),
          lastActivity: new Date(),
          pointsEarned: 150,
          challengesCompleted: 2,
          guessesSubmitted: 5,
          sessionDuration: 1000,
          isActive: true,
        },
        lastSaved: new Date(),
        syncStatus: 'synced',
        deviceId: 'test-device',
      };
      
      localStorageMock.setItem('gameSession_test-player-123', JSON.stringify(sessionData));
      
      const eventSpy = jest.fn();
      manager.addEventListener('session_restored', eventSpy);
      
      await manager.initialize();
      
      const session = manager.getCurrentSession();
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('test-session-123');
      expect(session?.pointsEarned).toBe(150);
      expect(eventSpy).toHaveBeenCalled();
    });

    test('should get sync status', async () => {
      await manager.initialize();
      
      const syncStatus = manager.getSyncStatus();
      expect(syncStatus).toHaveProperty('lastLocalSave');
      expect(syncStatus).toHaveProperty('lastServerSync');
      expect(syncStatus).toHaveProperty('pendingSync');
    });

    test('should get backup sessions', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Trigger save to create backup
      jest.advanceTimersByTime(1500);
      
      const backups = manager.getBackupSessions();
      expect(Array.isArray(backups)).toBe(true);
    });

    test('should restore from backup', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Trigger save to create backup
      jest.advanceTimersByTime(1500);
      
      const originalSessionId = manager.getCurrentSession()?.sessionId;
      
      // End current session
      await manager.endGameSession();
      
      // Restore from backup
      const restored = await manager.restoreFromBackup(0);
      expect(restored).toBe(true);
      
      const restoredSession = manager.getCurrentSession();
      expect(restoredSession?.sessionId).toBe(originalSessionId);
    });

    test('should clear all session data', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Trigger save
      jest.advanceTimersByTime(1500);
      
      await manager.clearAllSessionData();
      
      // Check that data is cleared
      const savedData = localStorageMock.getItem('gameSession_test-player-123');
      expect(savedData).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle operations without active session gracefully', () => {
      expect(() => manager.addPoints(100)).toThrow('No active session to add points to');
      expect(() => manager.incrementChallengesCompleted()).toThrow('No active session to update');
      expect(() => manager.incrementGuessesSubmitted()).toThrow('No active session to update');
    });

    test('should handle localStorage errors gracefully', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Mock localStorage to throw error after session is started
      const originalSetItem = localStorageMock.setItem;
      let callCount = 0;
      localStorageMock.setItem = jest.fn((key: string, value: string) => {
        callCount++;
        // Allow deviceId to be set, but fail on session save
        if (key === 'deviceId') {
          originalSetItem(key, value);
        } else {
          throw new Error('Storage quota exceeded');
        }
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Trigger auto-save
      jest.advanceTimersByTime(1500);
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save session to local storage:', expect.any(Error));
      
      // Restore original method
      localStorageMock.setItem = originalSetItem;
      consoleSpy.mockRestore();
    });
  });

  describe('Idle Timeout and Hints', () => {
    test('should trigger idle timeout and show hints', async () => {
      const hintConfig = {
        enableIdleHints: true,
        idleHintDelay: 1000,
        maxIdleHints: 2,
        hintCooldown: 2000,
      };
      
      const managerWithHints = new GameSessionManager({
        ...config,
        hintConfig,
      });
      
      await managerWithHints.initialize();
      const session = await managerWithHints.startGameSession();
      
      const idleTimeoutSpy = jest.fn();
      const hintTriggeredSpy = jest.fn();
      
      managerWithHints.addEventListener('idle_timeout', idleTimeoutSpy);
      managerWithHints.addEventListener('hint_triggered', hintTriggeredSpy);
      
      // Trigger idle timeout
      jest.advanceTimersByTime(5000);
      
      expect(idleTimeoutSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'idle_timeout',
        sessionId: session.sessionId,
      }));
      
      // Advance time to trigger first hint
      jest.advanceTimersByTime(1000);
      
      expect(hintTriggeredSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'hint_triggered',
        data: expect.objectContaining({
          hint: expect.objectContaining({
            type: 'idle_engagement',
            message: expect.any(String),
          }),
        }),
      }));
      
      // Check idle state
      const idleState = managerWithHints.getIdleState();
      expect(idleState.isIdle).toBe(true);
      expect(idleState.hintsShown).toBe(1);
      
      await managerWithHints.cleanup();
    });

    test('should respect max hints limit', async () => {
      const hintConfig = {
        enableIdleHints: true,
        idleHintDelay: 1000,
        maxIdleHints: 2,
        hintCooldown: 1000,
      };
      
      const managerWithHints = new GameSessionManager({
        ...config,
        hintConfig,
      });
      
      await managerWithHints.initialize();
      await managerWithHints.startGameSession();
      
      const hintTriggeredSpy = jest.fn();
      managerWithHints.addEventListener('hint_triggered', hintTriggeredSpy);
      
      // Trigger idle timeout
      jest.advanceTimersByTime(5000);
      
      // Trigger first hint
      jest.advanceTimersByTime(1000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(1);
      
      // Trigger second hint
      jest.advanceTimersByTime(1000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(2);
      
      // Try to trigger third hint - should not happen
      jest.advanceTimersByTime(1000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(2);
      
      const idleState = managerWithHints.getIdleState();
      expect(idleState.hintsShown).toBe(2);
      
      await managerWithHints.cleanup();
    });

    test('should reset idle state on activity change', async () => {
      const hintConfig = {
        enableIdleHints: true,
        idleHintDelay: 1000,
      };
      
      const managerWithHints = new GameSessionManager({
        ...config,
        hintConfig,
      });
      
      await managerWithHints.initialize();
      await managerWithHints.startGameSession();
      
      // Trigger idle timeout
      jest.advanceTimersByTime(5000);
      
      let idleState = managerWithHints.getIdleState();
      expect(idleState.isIdle).toBe(true);
      
      // Change activity - should reset idle state
      managerWithHints.updateActivity('creating');
      
      idleState = managerWithHints.getIdleState();
      expect(idleState.isIdle).toBe(false);
      expect(idleState.hintsShown).toBe(0);
      
      await managerWithHints.cleanup();
    });
  });

  describe('Struggle Hints', () => {
    test('should trigger struggle hints after failures', async () => {
      const hintConfig = {
        enableStruggleHints: true,
        failureThreshold: 2,
      };
      
      const managerWithHints = new GameSessionManager({
        ...config,
        hintConfig,
      });
      
      await managerWithHints.initialize();
      await managerWithHints.startGameSession();
      
      const hintTriggeredSpy = jest.fn();
      managerWithHints.addEventListener('hint_triggered', hintTriggeredSpy);
      
      // Record first failure - should not trigger hint yet
      managerWithHints.recordFailure('challenge-123');
      expect(hintTriggeredSpy).not.toHaveBeenCalled();
      
      // Record second failure - should trigger hint
      managerWithHints.recordFailure('challenge-123');
      expect(hintTriggeredSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'hint_triggered',
        data: expect.objectContaining({
          hint: expect.objectContaining({
            type: 'struggle_assistance',
            message: expect.any(String),
          }),
          triggerReason: 'struggle',
          failureCount: 2,
        }),
      }));
      
      await managerWithHints.cleanup();
    });

    test('should reset failure count on successful activity', async () => {
      const hintConfig = {
        enableStruggleHints: true,
        failureThreshold: 2,
      };
      
      const managerWithHints = new GameSessionManager({
        ...config,
        hintConfig,
      });
      
      await managerWithHints.initialize();
      await managerWithHints.startGameSession();
      
      // Record failure
      managerWithHints.recordFailure();
      
      // Reset failure count
      managerWithHints.resetFailureCount();
      
      const hintTriggeredSpy = jest.fn();
      managerWithHints.addEventListener('hint_triggered', hintTriggeredSpy);
      
      // Record another failure - should not trigger hint since count was reset
      managerWithHints.recordFailure();
      expect(hintTriggeredSpy).not.toHaveBeenCalled();
      
      await managerWithHints.cleanup();
    });
  });

  describe('Hint Management', () => {
    test('should manage active hints', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      // Trigger engagement prompt
      manager.triggerEngagementPrompt();
      
      const activeHints = manager.getActiveHints();
      expect(activeHints).toHaveLength(1);
      expect(activeHints[0]?.type).toBe('idle_engagement');
      
      // Dismiss hint
      const hintId = activeHints[0]?.id;
      expect(hintId).toBeDefined();
      manager.dismissHint(hintId!);
      
      const activeHintsAfterDismiss = manager.getActiveHints();
      expect(activeHintsAfterDismiss).toHaveLength(0);
    });

    test('should emit hint dismissed event', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      const hintDismissedSpy = jest.fn();
      manager.addEventListener('hint_dismissed', hintDismissedSpy);
      
      // Trigger engagement prompt
      manager.triggerEngagementPrompt();
      const activeHints = manager.getActiveHints();
      const hintId = activeHints[0]?.id;
      expect(hintId).toBeDefined();
      
      // Dismiss hint
      manager.dismissHint(hintId!);
      
      expect(hintDismissedSpy).toHaveBeenCalledWith(expect.objectContaining({
        type: 'hint_dismissed',
        data: expect.objectContaining({
          hintId,
          hint: expect.objectContaining({
            dismissedAt: expect.any(Date),
          }),
        }),
      }));
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await manager.initialize();
      await manager.startGameSession();
      
      expect(manager.isSessionActive()).toBe(true);
      
      await manager.cleanup();
      
      expect(manager.isSessionActive()).toBe(false);
      expect(manager.getCurrentSession()).toBeNull();
    });
  });
});