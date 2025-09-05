/**
 * Unit tests for guessingGameSlice
 * Tests the new filtering and sorting functionality
 */

import guessingGameReducer, {
  loadChallenges,
  updateFilters,
  applyFilters,
  setGuessResult,
  hideAnimatedFeedback,
  GuessingGameState,
} from '../guessingGameSlice';
import { EnhancedChallenge, GuessResult } from '../../../types/challenge';

const mockChallenges: EnhancedChallenge[] = [
  {
    id: 'challenge_1',
    creatorId: 'user_1',
    creatorName: 'Alice Johnson',
    statements: [],
    mediaData: [],
    difficultyRating: 25, // Easy
    averageGuessTime: 25000,
    popularityScore: 87,
    emotionComplexity: 72,
    recommendationWeight: 0.85,
    totalGuesses: 45,
    correctGuessRate: 0.33,
    createdAt: '2024-01-15T00:00:00.000Z',
    lastPlayed: '2024-01-20T00:00:00.000Z',
    tags: ['travel', 'languages'],
    isActive: true
  },
  {
    id: 'challenge_2',
    creatorId: 'user_2',
    creatorName: 'Bob Smith',
    statements: [],
    mediaData: [],
    difficultyRating: 45, // Medium
    averageGuessTime: 18000,
    popularityScore: 72,
    emotionComplexity: 58,
    recommendationWeight: 0.72,
    totalGuesses: 32,
    correctGuessRate: 0.44,
    createdAt: '2024-01-18T00:00:00.000Z',
    lastPlayed: '2024-01-22T00:00:00.000Z',
    tags: ['cooking', 'food'],
    isActive: true
  },
  {
    id: 'challenge_3',
    creatorId: 'user_3',
    creatorName: 'Carol Davis',
    statements: [],
    mediaData: [],
    difficultyRating: 85, // Hard
    averageGuessTime: 32000,
    popularityScore: 91,
    emotionComplexity: 88,
    recommendationWeight: 0.91,
    totalGuesses: 28,
    correctGuessRate: 0.25,
    createdAt: '2024-01-20T00:00:00.000Z',
    lastPlayed: '2024-01-23T00:00:00.000Z',
    tags: ['pets', 'work'],
    isActive: true
  }
];

describe('guessingGameSlice', () => {
  let initialState: GuessingGameState;

  beforeEach(() => {
    initialState = {
      currentSession: null,
      availableChallenges: [],
      selectedChallenge: null,
      isLoading: false,
      loadError: null,
      retryCount: 0,
      lastSuccessfulLoad: Date.now(),
      showHint: false,
      guessSubmitted: false,
      guessResult: null,
      timeRemaining: null,
      currentStreak: 0,
      showAnimatedFeedback: false,
      filters: {
        difficulty: 'all',
        sortBy: 'popularity',
        minPopularity: 'all',
      },
    };
  });

  it('should load challenges', () => {
    const action = loadChallenges(mockChallenges);
    const state = guessingGameReducer(initialState, action);

    expect(state.availableChallenges).toEqual(mockChallenges);
    expect(state.isLoading).toBe(false);
  });

  it('should update filters', () => {
    const action = updateFilters({ difficulty: 'hard', sortBy: 'difficulty' });
    const state = guessingGameReducer(initialState, action);

    expect(state.filters.difficulty).toBe('hard');
    expect(state.filters.sortBy).toBe('difficulty');
  });

  it('should filter by difficulty', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ difficulty: 'hard' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges).toHaveLength(1);
    expect(state.availableChallenges[0].id).toBe('challenge_3'); // Carol's hard challenge
  });

  it('should filter by popularity', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ minPopularity: '90' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges).toHaveLength(1);
    expect(state.availableChallenges[0].id).toBe('challenge_3'); // Carol's challenge with 91 popularity
  });

  it('should sort by popularity (default)', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_3'); // 91 popularity
    expect(state.availableChallenges[1].id).toBe('challenge_1'); // 87 popularity
    expect(state.availableChallenges[2].id).toBe('challenge_2'); // 72 popularity
  });

  it('should sort by difficulty', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ sortBy: 'difficulty' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_3'); // 85 difficulty
    expect(state.availableChallenges[1].id).toBe('challenge_2'); // 45 difficulty
    expect(state.availableChallenges[2].id).toBe('challenge_1'); // 25 difficulty
  });

  it('should sort by most played', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ sortBy: 'most_played' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_1'); // 45 guesses
    expect(state.availableChallenges[1].id).toBe('challenge_2'); // 32 guesses
    expect(state.availableChallenges[2].id).toBe('challenge_3'); // 28 guesses
  });

  it('should sort by highest rated (correct guess rate)', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ sortBy: 'highest_rated' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_2'); // 0.44 rate
    expect(state.availableChallenges[1].id).toBe('challenge_1'); // 0.33 rate
    expect(state.availableChallenges[2].id).toBe('challenge_3'); // 0.25 rate
  });

  it('should sort by newest', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ sortBy: 'recent' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_3'); // 2024-01-20
    expect(state.availableChallenges[1].id).toBe('challenge_2'); // 2024-01-18
    expect(state.availableChallenges[2].id).toBe('challenge_1'); // 2024-01-15
  });

  it('should sort by oldest', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ sortBy: 'oldest' }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges[0].id).toBe('challenge_1'); // 2024-01-15
    expect(state.availableChallenges[1].id).toBe('challenge_2'); // 2024-01-18
    expect(state.availableChallenges[2].id).toBe('challenge_3'); // 2024-01-20
  });

  it('should combine filters', () => {
    let state = guessingGameReducer(initialState, loadChallenges(mockChallenges));
    state = guessingGameReducer(state, updateFilters({ 
      difficulty: 'medium', 
      minPopularity: '70',
      sortBy: 'difficulty'
    }));
    state = guessingGameReducer(state, applyFilters());

    expect(state.availableChallenges).toHaveLength(1);
    expect(state.availableChallenges[0].id).toBe('challenge_2'); // Bob's medium difficulty, 72 popularity
  });

  describe('streak tracking', () => {
    const mockCorrectResult: GuessResult = {
      sessionId: 'test-session',
      playerId: 'test-player',
      challengeId: 'test-challenge',
      guessedStatement: 1,
      correctStatement: 1,
      wasCorrect: true,
      pointsEarned: 100,
      timeBonus: 20,
      accuracyBonus: 30,
      streakBonus: 25,
      totalScore: 175,
      newAchievements: []
    };

    const mockIncorrectResult: GuessResult = {
      sessionId: 'test-session',
      playerId: 'test-player',
      challengeId: 'test-challenge',
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

    it('should increment streak on correct guess', () => {
      const state = guessingGameReducer(initialState, setGuessResult(mockCorrectResult));

      expect(state.currentStreak).toBe(1);
      expect(state.showAnimatedFeedback).toBe(true);
      expect(state.guessResult).toEqual(mockCorrectResult);
    });

    it('should reset streak on incorrect guess', () => {
      let state = guessingGameReducer(initialState, setGuessResult(mockCorrectResult));
      expect(state.currentStreak).toBe(1);

      state = guessingGameReducer(state, setGuessResult(mockIncorrectResult));
      expect(state.currentStreak).toBe(0);
      expect(state.showAnimatedFeedback).toBe(true);
    });

    it('should continue building streak on consecutive correct guesses', () => {
      let state = guessingGameReducer(initialState, setGuessResult(mockCorrectResult));
      expect(state.currentStreak).toBe(1);

      state = guessingGameReducer(state, setGuessResult(mockCorrectResult));
      expect(state.currentStreak).toBe(2);

      state = guessingGameReducer(state, setGuessResult(mockCorrectResult));
      expect(state.currentStreak).toBe(3);
    });

    it('should hide animated feedback', () => {
      let state = guessingGameReducer(initialState, setGuessResult(mockCorrectResult));
      expect(state.showAnimatedFeedback).toBe(true);

      state = guessingGameReducer(state, hideAnimatedFeedback());
      expect(state.showAnimatedFeedback).toBe(false);
    });
  });
});