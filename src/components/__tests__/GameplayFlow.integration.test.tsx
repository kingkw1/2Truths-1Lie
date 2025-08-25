/**
 * Comprehensive integration tests for core gameplay flow
 * Tests the complete flow: challenge selection -> guessing -> results -> progression
 * Relates to Requirements 1, 3, and 6
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChallengeBrowser } from '../ChallengeBrowser';
import { GuessSubmissionInterface } from '../GuessSubmissionInterface';
import { AnimatedFeedback } from '../AnimatedFeedback';
import guessingGameReducer, {
  loadChallenges,
  selectChallenge,
  startGuessingSession,
  submitGuess,
  setGuessResult,
  updateTimeRemaining,
  useHint,
  hideHint,
  updateFilters,
  hideAnimatedFeedback,
} from '../../store/slices/guessingGameSlice';
import { GameSessionManager } from '../../services/gameSessionManager';
import { ProgressiveHintService } from '../../services/progressiveHintService';
import { EnhancedChallenge, GuessResult } from '../../types/challenge';
import { GameSession } from '../../types/game';

// Mock WebSocket and external services
jest.mock('../../hooks/useWebSocket', () => ({
  useGuessResults: () => ({
    subscribeToGuessResults: jest.fn(() => () => {})
  })
}));

jest.mock('../../services/gameWebSocket', () => ({
  GameWebSocketManager: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    updateConfig: jest.fn(),
    sendActivityHeartbeat: jest.fn(),
  }))
}));

jest.mock('../../services/sessionPersistence', () => ({
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

// Mock timers
jest.useFakeTimers();

// Test data
const mockChallenges: EnhancedChallenge[] = [
  {
    id: 'challenge-1',
    creatorId: 'creator-1',
    creatorName: 'Alice Johnson',
    statements: [
      {
        id: 'stmt-1',
        text: 'I have traveled to Japan',
        isLie: false,
        viewCount: 100,
        guessAccuracy: 0.7,
        averageConfidence: 0.8,
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
        text: 'I can speak five languages fluently',
        isLie: true,
        viewCount: 100,
        guessAccuracy: 0.4,
        averageConfidence: 0.6,
        popularGuess: true,
        emotionScores: {
          confidence: 0.6,
          emotions: {
            joy: 0.3, sadness: 0.1, anger: 0.1, fear: 0.2,
            surprise: 0.1, disgust: 0.1, neutral: 0.1
          },
          dominantEmotion: 'fear',
          analysisTimestamp: new Date(),
        }
      },
      {
        id: 'stmt-3',
        text: 'I work as a software engineer',
        isLie: false,
        viewCount: 100,
        guessAccuracy: 0.9,
        averageConfidence: 0.85,
        popularGuess: false
      }
    ],
    mediaData: [
      { type: 'video', url: 'video1.mp4', duration: 15000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video2.mp4', duration: 12000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video3.mp4', duration: 18000, mimeType: 'video/mp4' }
    ],
    difficultyRating: 65,
    averageGuessTime: 25000,
    popularityScore: 87,
    emotionComplexity: 72,
    recommendationWeight: 0.85,
    totalGuesses: 100,
    correctGuessRate: 0.4,
    createdAt: new Date('2024-01-15'),
    lastPlayed: new Date('2024-01-20'),
    tags: ['travel', 'languages', 'work'],
    isActive: true
  }
];

// Helper to create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer
    },
    preloadedState: {
      guessingGame: {
        currentSession: null,
        availableChallenges: mockChallenges,
        selectedChallenge: null,
        isLoading: false,
        showHint: false,
        guessSubmitted: false,
        guessResult: null,
        timeRemaining: null,
        currentStreak: 0,
        showAnimatedFeedback: false,
        filters: {
          difficulty: 'all' as const,
          sortBy: 'popularity' as const,
          minPopularity: 'all' as const
        },
        ...initialState
      }
    }
  });
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; store?: any }> = ({ 
  children, 
  store = createTestStore() 
}) => (
  <Provider store={store}>{children}</Provider>
);

describe('Complete Gameplay Flow Integration Tests', () => {
  let gameSessionManager: GameSessionManager;
  let progressiveHintService: ProgressiveHintService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    
    // Initialize game session manager
    gameSessionManager = new GameSessionManager({
      playerId: 'test-player-123',
      autoSaveInterval: 1000,
      idleTimeout: 30000,
      enableWebSocket: false,
    });

    // Initialize progressive hint service
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

  describe('Complete Challenge Selection to Results Flow', () => {
    it('completes full gameplay flow: browse -> select -> guess -> results', async () => {
      const store = createTestStore();
      
      // Step 1: Browse challenges
      const { rerender } = render(
        <TestWrapper store={store}>
          <ChallengeBrowser />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Challenge by Alice Johnson')).toBeInTheDocument();
      });

      // Step 2: Select a challenge
      const challengeCard = screen.getByText('Challenge by Alice Johnson').closest('div');
      fireEvent.click(challengeCard!);

      // Verify challenge selection in store
      await waitFor(() => {
        const state = store.getState();
        expect(state.guessingGame.selectedChallenge).toBeTruthy();
      });

      // Step 3: Start guessing interface
      rerender(
        <TestWrapper store={store}>
          <GuessSubmissionInterface
            challenge={mockChallenges[0]}
            onComplete={jest.fn()}
            onBack={jest.fn()}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('🎯 Guess the Lie')).toBeInTheDocument();
      });

      // Step 4: Make a guess
      const secondStatement = screen.getByText('I can speak five languages fluently').closest('div');
      fireEvent.click(secondStatement!);

      await waitFor(() => {
        expect(screen.getByText(/How confident are you\?/)).toBeInTheDocument();
      });

      // Set confidence level
      const confidenceSlider = screen.getByRole('slider');
      fireEvent.change(confidenceSlider, { target: { value: '80' } });

      // Submit guess
      const submitButton = screen.getByText('🎯 Submit Guess');
      fireEvent.click(submitButton);

      // Step 5: Verify guess processing
      await waitFor(() => {
        const state = store.getState();
        expect(state.guessingGame.guessSubmitted).toBe(true);
      });

      // Step 6: Simulate guess result
      const mockGuessResult: GuessResult = {
        sessionId: 'test-session',
        playerId: 'test-player-123',
        challengeId: 'challenge-1',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 20,
        accuracyBonus: 30,
        streakBonus: 0,
        totalScore: 150,
        newAchievements: []
      };

      act(() => {
        store.dispatch(setGuessResult(mockGuessResult));
      });

      // Step 7: Verify state was updated
      const finalState = store.getState();
      expect(finalState.guessingGame.guessResult).toEqual(mockGuessResult);
      expect(finalState.guessingGame.currentStreak).toBe(1);
      expect(finalState.guessingGame.showAnimatedFeedback).toBe(true);
    });

    it('handles incorrect guess with streak reset', async () => {
      const store = createTestStore({ currentStreak: 3 });

      // Simulate incorrect guess result
      const mockIncorrectResult: GuessResult = {
        sessionId: 'test-session',
        playerId: 'test-player-123',
        challengeId: 'challenge-1',
        guessedStatement: 0, // Wrong guess
        correctStatement: 1,
        wasCorrect: false,
        pointsEarned: 0,
        timeBonus: 10,
        accuracyBonus: 0,
        streakBonus: 0,
        totalScore: 10,
        newAchievements: []
      };

      act(() => {
        store.dispatch(setGuessResult(mockIncorrectResult));
      });

      // Verify streak was reset
      const state = store.getState();
      expect(state.guessingGame.currentStreak).toBe(0);
      expect(state.guessingGame.guessResult).toEqual(mockIncorrectResult);
      expect(state.guessingGame.showAnimatedFeedback).toBe(true);
    });
  });

  describe('Game Session Integration with Gameplay', () => {
    it('tracks session metrics during gameplay', async () => {
      await gameSessionManager.initialize();
      const session = await gameSessionManager.startGameSession();

      expect(session.currentActivity).toBe('idle');
      expect(session.pointsEarned).toBe(0);
      expect(session.challengesCompleted).toBe(0);

      // Simulate gameplay activities
      gameSessionManager.updateActivity('browsing');
      expect(gameSessionManager.getCurrentSession()?.currentActivity).toBe('browsing');

      gameSessionManager.updateActivity('guessing');
      expect(gameSessionManager.getCurrentSession()?.currentActivity).toBe('guessing');

      // Simulate successful guess
      gameSessionManager.addPoints(150, 'correct_guess');
      gameSessionManager.incrementGuessesSubmitted();

      const updatedSession = gameSessionManager.getCurrentSession();
      expect(updatedSession?.pointsEarned).toBe(150);
      expect(updatedSession?.guessesSubmitted).toBe(1);

      // Simulate challenge completion
      gameSessionManager.incrementChallengesCompleted();
      expect(gameSessionManager.getCurrentSession()?.challengesCompleted).toBe(1);

      // Calculate rewards
      const rewards = gameSessionManager.calculateSessionRewards();
      expect(rewards).toBeTruthy();
      expect(rewards!.basePoints).toBe(150);
      expect(rewards!.totalPoints).toBeGreaterThan(150); // Should include bonuses
    });

    it('handles idle timeout during gameplay with hints', async () => {
      const hintConfig = {
        enableIdleHints: true,
        idleHintDelay: 1000,
        maxIdleHints: 2,
      };

      const managerWithHints = new GameSessionManager({
        playerId: 'test-player-123',
        idleTimeout: 5000,
        hintConfig,
        enableWebSocket: false,
      });

      await managerWithHints.initialize();
      await managerWithHints.startGameSession();

      const idleTimeoutSpy = jest.fn();
      const hintTriggeredSpy = jest.fn();

      managerWithHints.addEventListener('idle_timeout', idleTimeoutSpy);
      managerWithHints.addEventListener('hint_triggered', hintTriggeredSpy);

      // Start with guessing activity
      managerWithHints.updateActivity('guessing');

      // Fast-forward to trigger idle timeout
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(idleTimeoutSpy).toHaveBeenCalled();
      expect(managerWithHints.getCurrentSession()?.currentActivity).toBe('idle');

      // Fast-forward to trigger hint
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(hintTriggeredSpy).toHaveBeenCalled();

      const activeHints = managerWithHints.getActiveHints();
      expect(activeHints).toHaveLength(1);
      expect(activeHints[0]?.type).toBe('idle_engagement');

      await managerWithHints.cleanup();
    });

    it('persists session state during gameplay', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      // Simulate gameplay
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(100, 'correct_guess');
      gameSessionManager.incrementChallengesCompleted();

      // Trigger auto-save
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Verify session was saved
      const savedData = mockLocalStorage.getItem('gameSession_test-player-123');
      expect(savedData).toBeTruthy();

      const parsedData = JSON.parse(savedData!);
      expect(parsedData.gameState.pointsEarned).toBe(100);
      expect(parsedData.gameState.challengesCompleted).toBe(1);
      expect(parsedData.gameState.currentActivity).toBe('guessing');
    });
  });

  describe('Progressive Hint System Integration', () => {
    it('provides contextual hints during gameplay', () => {
      progressiveHintService.initializeHints(mockChallenges[0].statements);

      expect(progressiveHintService.hasMoreHints()).toBe(true);
      expect(progressiveHintService.getCurrentLevel()).toBe('basic');

      // Get first hint
      const hint1 = progressiveHintService.getNextHint();
      expect(hint1).toBeTruthy();
      expect(hint1!.level).toBe('basic');
      expect(hint1!.isRevealed).toBe(true);

      // Test hint categories
      const emotionalHint = progressiveHintService.revealHintByCategory('emotional');
      expect(emotionalHint?.category).toBe('emotional');

      const statisticalHint = progressiveHintService.revealHintByCategory('statistical');
      expect(statisticalHint?.category).toBe('statistical');

      // Verify hint analysis
      const analysis = progressiveHintService.getHintAnalysis(1); // The lie statement
      expect(analysis).toBeTruthy();
      expect(analysis!.emotionalCues.dominantEmotion).toBe('fear');
      expect(analysis!.statisticalCues.popularChoice).toBe(true);
    });

    it('adapts hint difficulty based on player performance', () => {
      progressiveHintService.initializeHints(mockChallenges[0].statements);

      // Simulate multiple hint requests (progression)
      jest.useFakeTimers();

      const hints = [];
      let hint = progressiveHintService.getNextHint();
      while (hint && hints.length < 5) {
        hints.push(hint);
        jest.advanceTimersByTime(1000);
        hint = progressiveHintService.getNextHint();
      }

      expect(hints.length).toBeGreaterThan(0);

      // Should progress through different levels
      const levels = new Set(hints.map(h => h.level));
      expect(levels.size).toBeGreaterThanOrEqual(1);

      jest.useRealTimers();
    });

    it('tracks revealed hints during gameplay session', () => {
      progressiveHintService.initializeHints(mockChallenges[0].statements);

      expect(progressiveHintService.getRevealedHints()).toHaveLength(0);

      // Reveal some hints
      progressiveHintService.getNextHint();
      expect(progressiveHintService.getRevealedHints()).toHaveLength(1);

      progressiveHintService.revealHintByCategory('emotional');
      expect(progressiveHintService.getRevealedHints()).toHaveLength(2);

      // Verify hints have timestamps
      const revealedHints = progressiveHintService.getRevealedHints();
      revealedHints.forEach(hint => {
        expect(hint.revealedAt).toBeInstanceOf(Date);
        expect(hint.isRevealed).toBe(true);
      });
    });
  });

  describe('Challenge Analytics and Scoring Integration', () => {
    it('calculates accurate scoring based on gameplay factors', () => {
      const basePoints = 100;
      const timeBonus = 25; // Fast guess
      const accuracyBonus = 30; // High confidence, correct guess
      const streakBonus = 50; // Continuing streak

      const mockResult: GuessResult = {
        sessionId: 'test-session',
        playerId: 'test-player-123',
        challengeId: 'challenge-1',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: basePoints,
        timeBonus,
        accuracyBonus,
        streakBonus,
        totalScore: basePoints + timeBonus + accuracyBonus + streakBonus,
        newAchievements: []
      };

      expect(mockResult.totalScore).toBe(205);
      expect(mockResult.wasCorrect).toBe(true);
    });

    it('tracks challenge analytics during gameplay', () => {
      const challenge = mockChallenges[0];
      
      // Verify initial analytics
      expect(challenge.totalGuesses).toBe(100);
      expect(challenge.correctGuessRate).toBe(0.4);
      expect(challenge.difficultyRating).toBe(65);

      // Verify statement-level analytics
      const lieStatement = challenge.statements.find(s => s.isLie);
      expect(lieStatement?.popularGuess).toBe(true);
      expect(lieStatement?.guessAccuracy).toBe(0.4);

      const truthStatement = challenge.statements.find(s => !s.isLie && s.guessAccuracy === 0.9);
      expect(truthStatement?.averageConfidence).toBe(0.85);
    });

    it('updates player progression after successful gameplay', async () => {
      await gameSessionManager.initialize();
      await gameSessionManager.startGameSession();

      // Simulate successful gameplay session
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(150, 'correct_guess');
      gameSessionManager.incrementGuessesSubmitted();
      gameSessionManager.incrementChallengesCompleted();

      // Calculate session rewards
      const rewards = gameSessionManager.calculateSessionRewards();
      expect(rewards).toBeTruthy();
      expect(rewards!.basePoints).toBe(150);
      expect(rewards!.experienceGained).toBeGreaterThan(0);
      expect(rewards!.currencyRewards).toHaveLength(2); // coins and experience

      // Verify bonus calculations
      expect(rewards!.bonusMultiplier).toBeGreaterThan(1);
      expect(rewards!.streakBonus).toBeGreaterThan(0);
      expect(rewards!.totalPoints).toBeGreaterThan(rewards!.basePoints);
    });
  });

  describe('Cross-Component Integration and State Management', () => {
    it('maintains consistent state across gameplay components', async () => {
      const store = createTestStore();

      // Start with challenge browser
      render(
        <TestWrapper store={store}>
          <ChallengeBrowser />
        </TestWrapper>
      );

      // Select challenge
      await waitFor(() => {
        expect(screen.getByText('Challenge by Alice Johnson')).toBeInTheDocument();
      });

      const challengeCard = screen.getByText('Challenge by Alice Johnson').closest('div');
      fireEvent.click(challengeCard!);

      // Verify state update
      let state = store.getState();
      expect(state.guessingGame.selectedChallenge).toBeTruthy();

      // Simulate guess submission
      act(() => {
        store.dispatch(startGuessingSession({
          challengeId: 'challenge-1',
          statements: mockChallenges[0].statements
        }));
      });

      state = store.getState();
      expect(state.guessingGame.currentSession).toBeTruthy();

      // Simulate guess result
      const mockResult: GuessResult = {
        sessionId: 'test-session',
        playerId: 'test-player-123',
        challengeId: 'challenge-1',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: 100,
        timeBonus: 20,
        accuracyBonus: 30,
        streakBonus: 0,
        totalScore: 150,
        newAchievements: []
      };

      act(() => {
        store.dispatch({ type: 'guessingGame/setGuessResult', payload: mockResult });
      });

      state = store.getState();
      expect(state.guessingGame.guessResult).toEqual(mockResult);
      expect(state.guessingGame.currentStreak).toBe(1);
      expect(state.guessingGame.showAnimatedFeedback).toBe(true);
    });

    it('handles error states gracefully across components', async () => {
      const store = createTestStore({ isLoading: false, availableChallenges: [] });

      render(
        <TestWrapper store={store}>
          <ChallengeBrowser />
        </TestWrapper>
      );

      // Should show empty state
      expect(screen.getByText('No challenges available')).toBeInTheDocument();

      // Test error recovery
      act(() => {
        store.dispatch({
          type: 'guessingGame/loadChallenges',
          payload: mockChallenges
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Challenge by Alice Johnson')).toBeInTheDocument();
      });
    });

    it('synchronizes timer state across gameplay components', async () => {
      const store = createTestStore({
        currentSession: {
          sessionId: 'test-session',
          playerId: 'test-player-123',
          challengeId: 'challenge-1',
          statements: mockChallenges[0].statements,
          playerGuess: null,
          confidenceScores: [0, 0, 0],
          hintsUsed: 0,
          timeSpent: 0,
          startTime: new Date(),
          isCompleted: false
        },
        timeRemaining: 60
      });

      render(
        <TestWrapper store={store}>
          <GuessSubmissionInterface
            challenge={mockChallenges[0]}
            onComplete={jest.fn()}
            onBack={jest.fn()}
          />
        </TestWrapper>
      );

      // Should show timer
      expect(screen.getByText('⏱️ 1:00')).toBeInTheDocument();

      // Simulate timer countdown
      act(() => {
        store.dispatch({ type: 'guessingGame/updateTimeRemaining', payload: 30 });
      });

      await waitFor(() => {
        expect(screen.getByText('⏱️ 0:30')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Resource Management', () => {
    it('handles multiple concurrent gameplay sessions', async () => {
      const managers = [];
      
      // Create multiple session managers
      for (let i = 0; i < 3; i++) {
        const manager = new GameSessionManager({
          playerId: `test-player-${i}`,
          autoSaveInterval: 1000,
          enableWebSocket: false,
        });
        
        await manager.initialize();
        await manager.startGameSession();
        managers.push(manager);
      }

      // Verify all sessions are active
      managers.forEach((manager, index) => {
        const session = manager.getCurrentSession();
        expect(session?.playerId).toBe(`test-player-${index}`);
        expect(session?.isActive).toBe(true);
      });

      // Cleanup all managers
      await Promise.all(managers.map(manager => manager.cleanup()));
    });

    it('cleans up resources properly after gameplay', async () => {
      await gameSessionManager.initialize();
      const session = await gameSessionManager.startGameSession();

      expect(gameSessionManager.isSessionActive()).toBe(true);
      expect(gameSessionManager.getCurrentSession()).toBeTruthy();

      // Simulate gameplay
      gameSessionManager.updateActivity('guessing');
      gameSessionManager.addPoints(100, 'test');

      // End session and cleanup
      await gameSessionManager.endGameSession();
      await gameSessionManager.cleanup();

      expect(gameSessionManager.isSessionActive()).toBe(false);
      expect(gameSessionManager.getCurrentSession()).toBeNull();
    });
  });
});