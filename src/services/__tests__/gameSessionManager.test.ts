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
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save session:', expect.any(Error));
      
      // Restore original method
      localStorageMock.setItem = originalSetItem;
      consoleSpy.mockRestore();
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