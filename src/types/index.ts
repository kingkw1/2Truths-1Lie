/**
 * Main types export file for the Two Truths and a Lie game
 * Centralizes all TypeScript interfaces for easy importing
 */

// Game session, progression, and rewards types
export * from './game';

// Challenge creation and gameplay types  
export * from './challenge';

// Re-export commonly used types for convenience
export type {
  GameSession,
  PlayerProgression,
  PlayerInventory,
  RewardCalculation
} from './game';

export type {
  Statement,
  MediaCapture,
  EmotionScores,
  AnalyzedStatement,
  EnhancedChallenge,
  GuessingSession,
  GuessResult,
  ChallengeCreation
} from './challenge';