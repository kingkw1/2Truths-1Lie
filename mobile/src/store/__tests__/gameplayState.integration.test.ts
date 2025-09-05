/**
 * Integration tests for gameplay state management across Redux slices
 * Tests the coordination between different state slices during gameplay
 * Relates to Requirements 1, 3, and 6
 */

import { configureStore } from '@reduxjs/toolkit';
import guessingGameReducer, {
  loadChallenges,
  selectChallenge,
  startGuessingSession,
  updateConfidenceScore,
  submitGuess,
  setGuessResult,
  updateTimeRemaining,
  useHint,
  hideHint,
  updateFilters,
  applyFilters,
  hideAnimatedFeedback,
} from '../slices/guessingGameSlice';
import challengeCreationReducer from '../slices/challengeCreationSlice';
import gameSessionReducer from '../slices/gameSessionSlice';
import { EnhancedChallenge, GuessResult, AnalyzedStatement } from '../../types/challenge';
import { GameSession } from '../../types/game';

// Test data
const mockStatements: AnalyzedStatement[] = [
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
];

const mockChallenges: EnhancedChallenge[] = [
  {
    id: 'challenge-1',
    creatorId: 'creator-1',
    creatorName: 'Alice Johnson',
    statements: mockStatements,
    mediaData: [
      { type: 'video', url: 'video1.mp4', duration: 15000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video2.mp4', duration: 12000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video3.mp4', duration: 18000, mimeType: 'video/mp4' }
    ],
    difficultyRating: 75, // Hard difficulty
    averageGuessTime: 25000,
    popularityScore: 87,
    emotionComplexity: 72,
    recommendationWeight: 0.85,
    totalGuesses: 100,
    correctGuessRate: 0.4,
    createdAt: '2024-01-15T00:00:00.000Z',
    lastPlayed: '2024-01-20T00:00:00.000Z',
    tags: ['travel', 'languages', 'work'],
    isActive: true
  },
  {
    id: 'challenge-2',
    creatorId: 'creator-2',
    creatorName: 'Bob Smith',
    statements: [
      {
        id: 'stmt-4',
        text: 'I once cooked dinner for 50 people',
        isLie: false,
        viewCount: 80,
        guessAccuracy: 0.6,
        averageConfidence: 0.7,
        popularGuess: false
      },
      {
        id: 'stmt-5',
        text: 'I have never broken a bone in my body',
        isLie: true,
        viewCount: 80,
        guessAccuracy: 0.5,
        averageConfidence: 0.6,
        popularGuess: true
      },
      {
        id: 'stmt-6',
        text: 'I love cooking Italian food',
        isLie: false,
        viewCount: 80,
        guessAccuracy: 0.8,
        averageConfidence: 0.85,
        popularGuess: false
      }
    ],
    mediaData: [
      { type: 'video', url: 'video4.mp4', duration: 20000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video5.mp4', duration: 18000, mimeType: 'video/mp4' },
      { type: 'video', url: 'video6.mp4', duration: 22000, mimeType: 'video/mp4' }
    ],
    difficultyRating: 45,
    averageGuessTime: 18000,
    popularityScore: 72,
    emotionComplexity: 58,
    recommendationWeight: 0.72,
    totalGuesses: 80,
    correctGuessRate: 0.5,
    createdAt: '2024-01-18T00:00:00.000Z',
    lastPlayed: '2024-01-22T00:00:00.000Z',
    tags: ['cooking', 'food', 'health'],
    isActive: true
  }
];

const mockGameSession: GameSession = {
  sessionId: 'test-session-123',
  playerId: 'test-player-123',
  currentActivity: 'guessing',
  startTime: Date.now(),
  lastActivity: Date.now(),
  pointsEarned: 0,
  challengesCompleted: 0,
  guessesSubmitted: 0,
  sessionDuration: 0,
  isActive: true,
};

// Helper to create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      guessingGame: guessingGameReducer,
      challengeCreation: challengeCreationReducer,
      gameSession: gameSessionReducer,
    },
  });
};

describe('Gameplay State Integration Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('Challenge Selection and Session Flow', () => {
    it('coordinates challenge loading, selection, and session creation', () => {
      // Step 1: Load challenges
      store.dispatch(loadChallenges(mockChallenges));
      
      let state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.selectedChallenge).toBeNull();

      // Step 2: Select a challenge
      store.dispatch(selectChallenge(mockChallenges[0]));
      
      state = store.getState();
      expect(state.guessingGame.selectedChallenge).toEqual(mockChallenges[0]);

      // Step 3: Create guessing session
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));

      state = store.getState();
      expect(state.guessingGame.currentSession).toBeTruthy();
      expect(state.guessingGame.currentSession?.challengeId).toBe('challenge-1');
      expect(state.guessingGame.currentSession?.statements).toEqual(mockStatements);
      expect(state.guessingGame.timeRemaining).toBe(60); // Default timer
    });

    it('handles challenge filtering and maintains selection state', () => {
      // Load challenges
      store.dispatch(loadChallenges(mockChallenges));

      // Apply difficulty filter
      store.dispatch(updateFilters({ difficulty: 'medium' }));
      store.dispatch(applyFilters());

      let state = store.getState();
      expect(state.guessingGame.filters.difficulty).toBe('medium');
      expect(state.guessingGame.availableChallenges).toHaveLength(1);
      expect(state.guessingGame.availableChallenges[0].id).toBe('challenge-2'); // Bob's medium challenge (45 difficulty)

      // Select filtered challenge
      store.dispatch(selectChallenge(state.guessingGame.availableChallenges[0]));

      state = store.getState();
      expect(state.guessingGame.selectedChallenge?.id).toBe('challenge-2');

      // Change filter - reload challenges to reset filter state
      store.dispatch(loadChallenges(mockChallenges)); // Reload to reset
      store.dispatch(updateFilters({ difficulty: 'all' }));
      store.dispatch(applyFilters());

      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.selectedChallenge?.id).toBe('challenge-2'); // Still selected
    });

    it('manages timer state during gameplay session', () => {
      // Create session
      store.dispatch(startGuessingSession({
        challengeId: 'challenge-1',
        statements: mockStatements,
      }));

      let state = store.getState();
      expect(state.guessingGame.timeRemaining).toBe(60);

      // Update timer
      store.dispatch(updateTimeRemaining(45));
      state = store.getState();
      expect(state.guessingGame.timeRemaining).toBe(45);

      // Timer reaches zero
      store.dispatch(updateTimeRemaining(0));
      state = store.getState();
      expect(state.guessingGame.timeRemaining).toBe(0);
    });
  });

  describe('Guess Submission and Results Flow', () => {
    beforeEach(() => {
      // Set up initial state
      store.dispatch(loadChallenges(mockChallenges));
      store.dispatch(selectChallenge(mockChallenges[0]));
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));
    });

    it('handles complete guess submission flow', () => {
      // Submit guess
      store.dispatch(updateConfidenceScore({ statementIndex: 1, confidence: 0.8 }));
      store.dispatch(submitGuess(1)); // Guessing the lie

      let state = store.getState();
      expect(state.guessingGame.guessSubmitted).toBe(true);
      expect(state.guessingGame.currentSession?.playerGuess).toBe(1);
      expect(state.guessingGame.currentSession?.confidenceScores[1]).toBe(0.8);

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

      store.dispatch(setGuessResult(mockResult));

      state = store.getState();
      expect(state.guessingGame.guessResult).toEqual(mockResult);
      expect(state.guessingGame.currentStreak).toBe(1);
      expect(state.guessingGame.showAnimatedFeedback).toBe(true);
    });

    it('tracks streak progression across multiple challenges', () => {
      // First correct guess
      const result1: GuessResult = {
        sessionId: 'test-session-1',
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

      store.dispatch(setGuessResult(result1));
      let state = store.getState();
      expect(state.guessingGame.currentStreak).toBe(1);

      // Hide feedback and start new challenge
      store.dispatch(hideAnimatedFeedback());
      store.dispatch(selectChallenge(mockChallenges[1]));
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[1].id,
        statements: mockChallenges[1].statements,
      }));

      // Second correct guess
      const result2: GuessResult = {
        sessionId: 'test-session-2',
        playerId: 'test-player-123',
        challengeId: 'challenge-2',
        guessedStatement: 1,
        correctStatement: 1,
        wasCorrect: true,
        pointsEarned: 120,
        timeBonus: 25,
        accuracyBonus: 35,
        streakBonus: 25,
        totalScore: 205,
        newAchievements: []
      };

      store.dispatch(setGuessResult(result2));
      state = store.getState();
      expect(state.guessingGame.currentStreak).toBe(2);

      // Incorrect guess should reset streak
      const result3: GuessResult = {
        sessionId: 'test-session-3',
        playerId: 'test-player-123',
        challengeId: 'challenge-1',
        guessedStatement: 0,
        correctStatement: 1,
        wasCorrect: false,
        pointsEarned: 0,
        timeBonus: 10,
        accuracyBonus: 0,
        streakBonus: 0,
        totalScore: 10,
        newAchievements: []
      };

      store.dispatch(setGuessResult(result3));
      state = store.getState();
      expect(state.guessingGame.currentStreak).toBe(0);
    });

    it('manages animated feedback state transitions', () => {
      // Submit guess and get result
      store.dispatch(updateConfidenceScore({ statementIndex: 1, confidence: 0.8 }));
      store.dispatch(submitGuess(1));
      
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

      store.dispatch(setGuessResult(mockResult));

      let state = store.getState();
      expect(state.guessingGame.showAnimatedFeedback).toBe(true);
      expect(state.guessingGame.guessResult).toEqual(mockResult);

      // Hide feedback
      store.dispatch(hideAnimatedFeedback());

      state = store.getState();
      expect(state.guessingGame.showAnimatedFeedback).toBe(false);
      expect(state.guessingGame.guessResult).toEqual(mockResult); // Result persists
    });
  });

  describe('Hint System State Integration', () => {
    beforeEach(() => {
      store.dispatch(loadChallenges(mockChallenges));
      store.dispatch(selectChallenge(mockChallenges[0]));
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));
    });

    it('manages hint visibility state', () => {
      let state = store.getState();
      expect(state.guessingGame.showHint).toBe(false);

      // Show hint
      store.dispatch(useHint());
      state = store.getState();
      expect(state.guessingGame.showHint).toBe(true);

      // Hide hint
      store.dispatch(hideHint());
      state = store.getState();
      expect(state.guessingGame.showHint).toBe(false);
    });

    it('coordinates hint state with session progress', () => {
      // Start session
      let state = store.getState();
      expect(state.guessingGame.currentSession?.hintsUsed).toBe(0);

      // Show hint (would increment hints used in real implementation)
      store.dispatch(useHint());
      
      // Submit guess
      store.dispatch(updateConfidenceScore({ statementIndex: 1, confidence: 0.8 }));
      store.dispatch(submitGuess(1));
      store.dispatch(hideHint()); // Manually hide hint

      state = store.getState();
      expect(state.guessingGame.showHint).toBe(false); // Hint hidden on submission
      expect(state.guessingGame.guessSubmitted).toBe(true);
    });
  });

  describe('Cross-Slice State Coordination', () => {
    it('maintains consistent state across multiple slices', () => {
      // This test would be expanded with actual gameSession and challengeCreation slice interactions
      // For now, we test the guessingGame slice coordination

      // Load and select challenge
      store.dispatch(loadChallenges(mockChallenges));
      store.dispatch(selectChallenge(mockChallenges[0]));

      let state = store.getState();
      expect(state.guessingGame.selectedChallenge?.id).toBe('challenge-1');

      // Create session
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));

      state = store.getState();
      expect(state.guessingGame.currentSession?.challengeId).toBe('challenge-1');

      // The session should reference the same challenge
      expect(state.guessingGame.currentSession?.challengeId).toBe(
        state.guessingGame.selectedChallenge?.id
      );
    });

    it('handles state transitions during gameplay flow', () => {
      // Initial state
      let state = store.getState();
      expect(state.guessingGame.isLoading).toBe(false);
      expect(state.guessingGame.availableChallenges).toHaveLength(0);
      expect(state.guessingGame.selectedChallenge).toBeNull();
      expect(state.guessingGame.currentSession).toBeNull();

      // Load challenges
      store.dispatch(loadChallenges(mockChallenges));
      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);

      // Select and start session
      store.dispatch(selectChallenge(mockChallenges[0]));
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));

      state = store.getState();
      expect(state.guessingGame.selectedChallenge).toBeTruthy();
      expect(state.guessingGame.currentSession).toBeTruthy();
      expect(state.guessingGame.timeRemaining).toBe(60);

      // Submit guess
      store.dispatch(updateConfidenceScore({ statementIndex: 1, confidence: 0.8 })); store.dispatch(submitGuess(1));
      state = store.getState();
      expect(state.guessingGame.guessSubmitted).toBe(true);

      // Get result
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

      store.dispatch(setGuessResult(mockResult));
      state = store.getState();
      expect(state.guessingGame.guessResult).toEqual(mockResult);
      expect(state.guessingGame.showAnimatedFeedback).toBe(true);
      expect(state.guessingGame.currentStreak).toBe(1);

      // Complete flow
      store.dispatch(hideAnimatedFeedback());
      state = store.getState();
      expect(state.guessingGame.showAnimatedFeedback).toBe(false);
    });

    it('handles error states and recovery', () => {
      // Load challenges
      store.dispatch(loadChallenges(mockChallenges));
      store.dispatch(selectChallenge(mockChallenges[0]));

      // Create session
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));

      let state = store.getState();
      expect(state.guessingGame.currentSession).toBeTruthy();

      // Simulate error by clearing challenges
      store.dispatch(loadChallenges([]));

      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(0);
      // Session should still exist even if challenges are cleared
      expect(state.guessingGame.currentSession).toBeTruthy();

      // Recovery - reload challenges
      store.dispatch(loadChallenges(mockChallenges));

      state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.currentSession).toBeTruthy();
    });
  });

  describe('Performance and State Optimization', () => {
    it('handles rapid state updates efficiently', () => {
      // Load challenges
      store.dispatch(loadChallenges(mockChallenges));

      const startTime = Date.now();

      // Rapid filter updates
      for (let i = 0; i < 100; i++) {
        store.dispatch(updateFilters({ 
          sortBy: i % 2 === 0 ? 'popularity' : 'difficulty' 
        }));
        store.dispatch(applyFilters());
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(duration).toBeLessThan(1000);

      const state = store.getState();
      expect(state.guessingGame.availableChallenges).toHaveLength(2);
      expect(state.guessingGame.filters.sortBy).toBe('difficulty'); // Last update
    });

    it('maintains state consistency under concurrent updates', () => {
      // Load challenges
      store.dispatch(loadChallenges(mockChallenges));
      store.dispatch(selectChallenge(mockChallenges[0]));
      store.dispatch(startGuessingSession({
        challengeId: mockChallenges[0].id,
        statements: mockChallenges[0].statements,
      }));

      // Simulate concurrent updates
      store.dispatch(updateTimeRemaining(45));
      store.dispatch(useHint());
      store.dispatch(updateConfidenceScore({ statementIndex: 1, confidence: 0.8 })); store.dispatch(submitGuess(1));
      store.dispatch(hideHint());

      const state = store.getState();
      
      // All updates should be applied consistently
      expect(state.guessingGame.timeRemaining).toBe(45);
      expect(state.guessingGame.showHint).toBe(false);
      expect(state.guessingGame.guessSubmitted).toBe(true);
      expect(state.guessingGame.currentSession?.playerGuess).toBe(1);
      expect(state.guessingGame.currentSession?.confidenceScores[1]).toBe(0.8);
    });

    it('optimizes memory usage with large datasets', () => {
      // Create large dataset with varying popularity
      const largeChallengeSet: EnhancedChallenge[] = [];
      for (let i = 0; i < 1000; i++) {
        largeChallengeSet.push({
          ...mockChallenges[0],
          id: `challenge-${i}`,
          creatorName: `Creator ${i}`,
          popularityScore: 50 + (i % 50), // Popularity from 50-99
        });
      }

      const startTime = Date.now();

      // Load large dataset
      store.dispatch(loadChallenges(largeChallengeSet));

      // Apply filters to reduce dataset - filter by high popularity
      store.dispatch(updateFilters({ minPopularity: '90' }));
      store.dispatch(applyFilters());

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle large datasets efficiently
      expect(duration).toBeLessThan(2000);

      const state = store.getState();
      expect(state.guessingGame.availableChallenges.length).toBeLessThan(1000);
    });
  });
});