/**
 * Integration tests for core gameplay logic services
 * Tests the interaction between GameSessionManager, ProgressiveHintService, and game state
 * Relates to Requirements 1, 3, and 6
 */

import { GameSessionManager } from '../gameSessionManager';
import { ProgressiveHintService } from '../progressiveHintService';
import { AnalyzedStatement } from '../../types/challenge';
import { GameActivity } from '../../types/game';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock WebSocket and external services
jest.mock('../gameWebSocket', () => ({
  GameWebSocketManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    updateConfig: jest.fn(),
    sendActivityHeartbeat: jest.fn(),
  }))
}));

jest.mock('../sessionPersistence', () => ({
  SessionPersistenceService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    saveToLocal: jest.fn().mockResolvedValue(undefined),
    syncSession: jest.fn().mockResolvedValue(null),
    getSyncStatus: jest.fn().mockReturnValue({
      lastLocalSave: new Date(),
      lastServerSync: null,
      pendingSync: false,
    }),
    getBackupSessions: jest.fn().mockReturnValue([]),
    restoreFromBackup: jest.fn().mockResolvedValue(null),
    clearAllData: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn(),
  }))
}));

// Mock timers
jest.useFakeTimers();

// Test data
const mockStatements: AnalyzedStatement[] = [
  {
    id: 'stmt-1',
    text: 'I have traveled to Japan and climbed Mount Fuji',
    isLie: false,
    confidence: 0.8,
    viewCount: 150,
    guessAccuracy: 0.7,
    averageConfidence: 0.75,
    popularGuess: false,
    emotionScores: {
      confidence: 0.8,
      emotions: {
        joy: 0.6, sadness: 0.1, anger: 0.05, fear: 0.1,
        surprise: 0.1, disgust: 0.05, neutral: 0.1
      },
      dominantEmotion: 'joy',
      analysisTimestamp: new Date(),
    }
  },
  {
    id: 'stmt-2',
    text: 'I can speak seven languages fluently including Mandarin and Arabic',
    isLie: true,
    confidence: 0.6,
    viewCount: 200,
    guessAccuracy: 0.3,
    averageConfidence: 0.5,
    popularGuess: true,
    emotionScores: {
      confidence: 0.6,
      emotions: {
        joy: 0.2, sadness: 0.1, anger: 0.1, fear: 0.3,
        surprise: 0.1, disgust: 0.1, neutral: 0.1
      },
      dominantEmotion: 'fear',
      analysisTimestamp: new Date(),
    }
  },
  {
    id: 'stmt-3',
    text: 'I work as a software engineer at a tech company',
    isLie: false,
    confidence: 0.9,
    viewCount: 100,
    guessAccuracy: 0.85,
    averageConfidence: 0.9,
    popularGuess: false
  }
];

describe('Gameplay Logic Integration Tests', () => {
  let gameSessionManager: GameSessionManager;
  let progressiveHintService: ProgressiveHintService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    gameSessionManager = new GameSessionManager({
      playerId: 'test-player-123',
      autoSaveInterval: 1000,
      idleTimeout: 30000,
      enableWebSocket: false,
      hintConfig: {
        enableIdleHints: true,
        idleHintDelay: 2000,
        maxIdleHints: 3,
        hintCooldown: 5000,
        enableStruggleHints: true,
        failureThreshold: 2,
      }
    });

    progressiveHintService = new ProgressiveHintService({
      maxHintsPerLevel: 2,
      timeBetweenHints: 1000,
      enableEmotionalAnalysis: true,
      enableLinguisticAnalysis: true,
      enableBehavioralAnalysis: true,
      enableStatisticalAnalysis: true,
      adaptiveDifficulty: true,
    });
  });

  afterEach(async () => {
    await gameSessionManager.cleanup();
    jest.clearAllTimers();
  });

  describe('Session Management with Hint System Integration', () => {
    it('coordinates session state with hint progression', async () => {
      await gameSessionManager.initialize();
      const session = await gameSessionManager.startGameSession();

      // Initialize hints for the challenge
      progressiveHintService.initializeHints(mockStatements);

      // Start guessing activity
      gameSessionManager.updateActivity('guessing');
      expect(session.currentActivity).toBe('guessing');

      // Simulate player struggling - record failures
      gameSessionManager.recordFailure('challenge-123');
      gameSessionManager.recordFailure('challenge-123');

      // Should trigger struggle hint
      const hintTriggeredSpy = jest.fn();
      gameSessionManager.addEventListener('hint_triggered', hintTriggeredSpy);

      // Record another failure to trigger hint
      gameSessionManager.recordFailure('challenge-123');

      expect(hintTriggeredSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hint_triggered',
          data: expect.objectContaining({
            hint: expect.objectContaining({
              type: 'struggle_assistance',
            }),
            triggerReason: 'struggle',
            failureCount: 3,
          }),
        })
      );

      // Get progressive hint
      const progressiveHint = progressiveHintService.getNextHint();
      expect(progressiveHint).toBeTruthy();
      expect(progressiveHint!.level).toBe('basic');

      // Simulate successful guess - should reset failure count
      gameSessionManager.resetFailureCount();
      gameSessionManager.addPoints(100, 'correct_guess');

      const updatedSession = gameSessionManager.getCurrentSession();
      expect(updatedSession?.pointsEarned).toBe(100);
    });

    it('handles idle timeout with progressive hint integration', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      const idleTimeoutSpy = jest.fn();
      const hintTriggeredSpy = jest.fn();

      gameSessionManager.addEventListener('idle_timeout', idleTimeoutSpy);
      gameSessionManager.addEventListener('hint_triggered', hintTriggeredSpy);

      // Start with active gameplay
      gameSessionManager.updateActivity('guessing');

      // Fast-forward to trigger idle timeout (30 seconds)
      jest.advanceTimersByTime(30000);

      expect(idleTimeoutSpy).toHaveBeenCalled();
      expect(gameSessionManager.getCurrentSession()?.currentActivity).toBe('idle');

      // Fast-forward to trigger idle hint (2 seconds after idle timeout)
      jest.advanceTimersByTime(2000);

      expect(hintTriggeredSpy).toHaveBeenCalled();

      const activeHints = gameSessionManager.getActiveHints();
      expect(activeHints).toHaveLength(1);
      expect(activeHints[0]?.type).toBe('idle_engagement');

      // Get progressive hint during idle state
      const progressiveHint = progressiveHintService.getNextHint();
      expect(progressiveHint).toBeTruthy();

      // Resume activity should reset idle state
      gameSessionManager.updateActivity('guessing');
      const idleState = gameSessionManager.getIdleState();
      expect(idleState.isIdle).toBe(false);
      expect(idleState.hintsShown).toBe(0);
    });

    it('manages hint cooldowns and limits during gameplay', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      const hintTriggeredSpy = jest.fn();
      gameSessionManager.addEventListener('hint_triggered', hintTriggeredSpy);

      // Trigger idle timeout
      gameSessionManager.updateActivity('guessing');
      jest.advanceTimersByTime(30000); // Idle timeout

      // Trigger first idle hint
      jest.advanceTimersByTime(2000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(1);

      // Try to trigger second hint immediately - should respect cooldown
      jest.advanceTimersByTime(1000); // Less than 5 second cooldown
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(1); // No new hint

      // Wait for cooldown to pass
      jest.advanceTimersByTime(4000); // Total 5 seconds
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(2); // Second hint

      // Third hint after cooldown
      jest.advanceTimersByTime(5000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(3); // Third hint

      // Should not trigger fourth hint (max 3)
      jest.advanceTimersByTime(5000);
      expect(hintTriggeredSpy).toHaveBeenCalledTimes(3); // Still 3

      const idleState = gameSessionManager.getIdleState();
      expect(idleState.hintsShown).toBe(3);
    });
  });

  describe('Gameplay Flow with Analytics Integration', () => {
    it('tracks detailed gameplay metrics with hint usage', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Simulate complete gameplay flow
      const activities: GameActivity[] = ['browsing', 'guessing', 'idle', 'guessing'];
      const pointsPerActivity = [0, 50, 0, 100];

      for (let i = 0; i < activities.length; i++) {
        gameSessionManager.updateActivity(activities[i]);
        
        if (pointsPerActivity[i] > 0) {
          gameSessionManager.addPoints(pointsPerActivity[i], `activity_${i}`);
        }

        // Use hints during guessing
        if (activities[i] === 'guessing') {
          const hint = progressiveHintService.getNextHint();
          if (hint) {
            expect(hint.isRevealed).toBe(true);
            expect(hint.revealedAt).toBeInstanceOf(Date);
          }
        }

        // Advance time to trigger auto-save
        jest.advanceTimersByTime(1500);
      }

      const session = gameSessionManager.getCurrentSession();
      expect(session?.pointsEarned).toBe(150);
      expect(session?.currentActivity).toBe('guessing');

      // Check hint usage
      const revealedHints = progressiveHintService.getRevealedHints();
      expect(revealedHints.length).toBeGreaterThan(0);

      // Calculate rewards including hint penalty
      const rewards = gameSessionManager.calculateSessionRewards();
      expect(rewards).toBeTruthy();
      expect(rewards!.basePoints).toBe(150);
      expect(rewards!.totalPoints).toBeGreaterThan(150);
    });

    it('adapts hint difficulty based on player performance', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Simulate successful gameplay (no failures)
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(100, 'correct_guess');
      gameSessionManager.incrementGuessesSubmitted();
      gameSessionManager.incrementChallengesCompleted();

      // Get hints - should start with basic level
      const hint1 = progressiveHintService.getNextHint();
      expect(hint1?.level).toBe('basic');

      // Advance time and get more hints
      jest.advanceTimersByTime(1000);
      const hint2 = progressiveHintService.getNextHint();
      expect(hint2).toBeTruthy();

      // Continue progression
      jest.advanceTimersByTime(1000);
      const hint3 = progressiveHintService.getNextHint();
      expect(hint3).toBeTruthy();

      // Should progress through levels
      const allHints = [hint1, hint2, hint3].filter(Boolean);
      const levels = new Set(allHints.map(h => h!.level));
      expect(levels.size).toBeGreaterThanOrEqual(1);

      // Test hint analysis for the lie statement
      const lieAnalysis = progressiveHintService.getHintAnalysis(1);
      expect(lieAnalysis).toBeTruthy();
      expect(lieAnalysis!.emotionalCues.dominantEmotion).toBe('fear');
      expect(lieAnalysis!.statisticalCues.popularChoice).toBe(true);
      expect(lieAnalysis!.statisticalCues.guessAccuracy).toBe(0.3);
    });

    it('handles concurrent hint systems without conflicts', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      const sessionHintSpy = jest.fn();
      gameSessionManager.addEventListener('hint_triggered', sessionHintSpy);

      // Trigger both idle hints and struggle hints
      gameSessionManager.updateActivity('guessing');

      // Record failures to trigger struggle hints
      gameSessionManager.recordFailure('challenge-123');
      gameSessionManager.recordFailure('challenge-123');

      // Trigger idle timeout
      jest.advanceTimersByTime(30000);

      // Should have idle timeout
      expect(gameSessionManager.getCurrentSession()?.currentActivity).toBe('idle');

      // Trigger idle hint
      jest.advanceTimersByTime(2000);

      // Get progressive hints
      const progressiveHint1 = progressiveHintService.getNextHint();
      jest.advanceTimersByTime(1000);
      const progressiveHint2 = progressiveHintService.getNextHint();

      // Verify both systems work independently
      expect(sessionHintSpy).toHaveBeenCalled();
      expect(progressiveHint1).toBeTruthy();
      expect(progressiveHint2).toBeTruthy();

      const activeSessionHints = gameSessionManager.getActiveHints();
      const revealedProgressiveHints = progressiveHintService.getRevealedHints();

      expect(activeSessionHints.length).toBeGreaterThan(0);
      expect(revealedProgressiveHints.length).toBeGreaterThan(0);
    });
  });

  describe('Session Persistence with Gameplay State', () => {
    it('persists and restores complete gameplay state', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Build up gameplay state
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(150, 'correct_guess');
      gameSessionManager.incrementChallengesCompleted();
      gameSessionManager.incrementGuessesSubmitted();

      // Use some hints
      const hint1 = progressiveHintService.getNextHint();
      jest.advanceTimersByTime(1000);
      const hint2 = progressiveHintService.getNextHint();

      expect(hint1).toBeTruthy();
      expect(hint2).toBeTruthy();

      // Trigger auto-save
      jest.advanceTimersByTime(1500);

      const originalSessionId = gameSessionManager.getCurrentSession()?.sessionId;

      // Verify session was saved
      const savedData = mockLocalStorage.getItem('gameSession_test-player-123');
      expect(savedData).toBeTruthy();

      const parsedData = JSON.parse(savedData!);
      expect(parsedData.gameState.pointsEarned).toBe(150);
      expect(parsedData.gameState.challengesCompleted).toBe(1);
      expect(parsedData.gameState.guessesSubmitted).toBe(1);
      expect(parsedData.gameState.currentActivity).toBe('guessing');

      // Simulate app restart - create new manager
      await gameSessionManager.cleanup();

      const newManager = new GameSessionManager({
        playerId: 'test-player-123',
        autoSaveInterval: 1000,
        enableWebSocket: false,
      });

      await newManager.initialize();

      // Should restore previous session
      const restoredSession = newManager.getCurrentSession();
      expect(restoredSession).toBeTruthy();
      expect(restoredSession?.sessionId).toBe(originalSessionId);
      expect(restoredSession?.pointsEarned).toBe(150);
      expect(restoredSession?.challengesCompleted).toBe(1);
      expect(restoredSession?.currentActivity).toBe('guessing');

      await newManager.cleanup();
    });

    it('handles session recovery after unexpected termination', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      // Build up significant gameplay state
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(200, 'correct_guess');
      gameSessionManager.incrementChallengesCompleted();
      gameSessionManager.recordFailure('challenge-123'); // Some failure state

      // Force save
      jest.advanceTimersByTime(1500);

      const originalSessionId = gameSessionManager.getCurrentSession()?.sessionId;

      // Simulate crash (don't call cleanup properly)
      gameSessionManager['currentSession'] = null;

      // Create recovery manager
      const recoveryManager = new GameSessionManager({
        playerId: 'test-player-123',
        autoSaveInterval: 1000,
        enableWebSocket: false,
      });

      const sessionRestoredSpy = jest.fn();
      recoveryManager.addEventListener('session_restored', sessionRestoredSpy);

      await recoveryManager.initialize();

      // Should restore the crashed session
      const recoveredSession = recoveryManager.getCurrentSession();
      expect(recoveredSession).toBeTruthy();
      expect(recoveredSession?.sessionId).toBe(originalSessionId);
      expect(recoveredSession?.pointsEarned).toBe(200);
      expect(recoveredSession?.challengesCompleted).toBe(1);

      expect(sessionRestoredSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_restored',
          data: expect.objectContaining({
            sessionId: originalSessionId,
            fromBackup: false,
          }),
        })
      );

      await recoveryManager.cleanup();
    });

    it('maintains hint state consistency across sessions', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Use several hints
      const hints = [];
      for (let i = 0; i < 3; i++) {
        const hint = progressiveHintService.getNextHint();
        if (hint) hints.push(hint);
        jest.advanceTimersByTime(1000);
      }

      expect(hints.length).toBe(3);

      // Get hint progress
      const progress = progressiveHintService.getHintProgress();
      const currentLevel = progressiveHintService.getCurrentLevel();
      const revealedHints = progressiveHintService.getRevealedHints();

      expect(progress).toBeGreaterThan(0);
      expect(revealedHints).toHaveLength(3);

      // Verify hint analysis is consistent
      const analysis0 = progressiveHintService.getHintAnalysis(0);
      const analysis1 = progressiveHintService.getHintAnalysis(1);
      const analysis2 = progressiveHintService.getHintAnalysis(2);

      expect(analysis0?.statementIndex).toBe(0);
      expect(analysis1?.statementIndex).toBe(1);
      expect(analysis2?.statementIndex).toBe(2);

      // The lie statement should have specific characteristics
      expect(analysis1?.emotionalCues.dominantEmotion).toBe('fear');
      expect(analysis1?.statisticalCues.popularChoice).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    it('handles high-frequency gameplay events efficiently', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      const startTime = Date.now();

      // Simulate rapid gameplay events
      for (let i = 0; i < 100; i++) {
        gameSessionManager.updateActivity(i % 2 === 0 ? 'guessing' : 'browsing');
        gameSessionManager.addPoints(10, `rapid_event_${i}`);
        
        if (i % 10 === 0) {
          progressiveHintService.getNextHint();
          jest.advanceTimersByTime(100);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 100 events quickly (less than 1 second in real time)
      expect(duration).toBeLessThan(1000);

      const session = gameSessionManager.getCurrentSession();
      expect(session?.pointsEarned).toBe(1000); // 100 * 10 points
      expect(session?.currentActivity).toBe('browsing'); // Last activity
    });

    it('manages memory usage with long gameplay sessions', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Simulate long session with many hints
      for (let i = 0; i < 50; i++) {
        gameSessionManager.addPoints(5, `long_session_${i}`);
        
        // Trigger hints periodically
        if (i % 5 === 0) {
          const hint = progressiveHintService.getNextHint();
          if (hint) {
            // Dismiss old hints to prevent memory buildup
            if (i > 20) {
              const activeHints = gameSessionManager.getActiveHints();
              if (activeHints.length > 5) {
                gameSessionManager.dismissHint(activeHints[0].id);
              }
            }
          }
          jest.advanceTimersByTime(1000);
        }
      }

      // Verify session state is still consistent
      const session = gameSessionManager.getCurrentSession();
      expect(session?.pointsEarned).toBe(250); // 50 * 5 points

      // Verify hint system is still functional
      const revealedHints = progressiveHintService.getRevealedHints();
      expect(revealedHints.length).toBeGreaterThan(0);

      // Active hints should be managed (not growing indefinitely)
      const activeHints = gameSessionManager.getActiveHints();
      expect(activeHints.length).toBeLessThan(10);
    });

    it('cleans up resources properly after gameplay', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      progressiveHintService.initializeHints(mockStatements);

      // Use various features
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(100, 'test');
      progressiveHintService.getNextHint();

      // Trigger idle timeout to create hints
      jest.advanceTimersByTime(30000);
      jest.advanceTimersByTime(2000);

      expect(gameSessionManager.getActiveHints().length).toBeGreaterThan(0);

      // Cleanup
      await gameSessionManager.cleanup();

      // Verify cleanup
      expect(gameSessionManager.isSessionActive()).toBe(false);
      expect(gameSessionManager.getCurrentSession()).toBeNull();
      expect(gameSessionManager.getActiveHints()).toHaveLength(0);
    });
  });
});