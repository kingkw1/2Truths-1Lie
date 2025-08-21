/**
 * Challenge-related TypeScript interfaces
 * Supporting the core game session and progression system
 */

// ============================================================================
// CHALLENGE CREATION INTERFACES
// ============================================================================

/**
 * Individual statement in a challenge
 */
export interface Statement {
  id: string;
  text: string;
  isLie: boolean;
  confidence?: number; // 0-1 scale for AI analysis
  emotionScores?: EmotionScores;
}

/**
 * Media capture types supported
 */
export type MediaType = 'video' | 'audio' | 'text';

/**
 * Media capture data
 */
export interface MediaCapture {
  type: MediaType;
  url?: string;
  duration?: number; // in milliseconds
  fileSize?: number; // in bytes
  mimeType?: string;
  thumbnail?: string; // for video
  // Compression metadata
  originalSize?: number; // original file size before compression
  compressionRatio?: number; // ratio of compression (originalSize / compressedSize)
  compressionTime?: number; // time taken to compress in milliseconds
  compressionQuality?: number; // quality setting used (0-1)
}

/**
 * Emotion analysis scores from AffectLink API
 */
export interface EmotionScores {
  confidence: number; // 0-1 scale
  emotions: {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    disgust: number;
    neutral: number;
  };
  dominantEmotion: string;
  analysisTimestamp: Date;
}

/**
 * Challenge creation data structure
 */
export interface ChallengeCreation {
  creatorId: string;
  statements: Statement[];
  mediaData: MediaCapture[];
  emotionAnalysis?: EmotionScores[];
  qualityScore?: number; // 0-100 scale
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  isPublic: boolean;
}

// ============================================================================
// CHALLENGE GAMEPLAY INTERFACES
// ============================================================================

/**
 * Analyzed statement with additional metadata for guessing
 */
export interface AnalyzedStatement extends Statement {
  viewCount: number;
  guessAccuracy: number; // percentage of correct guesses
  averageConfidence: number;
  popularGuess?: boolean; // most commonly guessed as lie
}

/**
 * Enhanced challenge with analytics data
 */
export interface EnhancedChallenge {
  id: string;
  creatorId: string;
  creatorName: string;
  statements: AnalyzedStatement[];
  mediaData: MediaCapture[];
  difficultyRating: number; // 0-100 scale
  averageGuessTime: number; // in milliseconds
  popularityScore: number; // based on plays and ratings
  emotionComplexity: number; // 0-100 scale
  recommendationWeight: number;
  totalGuesses: number;
  correctGuessRate: number; // percentage
  createdAt: Date;
  lastPlayed: Date;
  tags: string[];
  isActive: boolean;
}

/**
 * Player's guessing session for a specific challenge
 */
export interface GuessingSession {
  sessionId: string;
  playerId: string;
  challengeId: string;
  statements: AnalyzedStatement[];
  playerGuess: number | null; // index of statement guessed as lie
  confidenceScores: number[]; // player's confidence in each statement
  hintsUsed: number;
  timeSpent: number; // in milliseconds
  startTime: Date;
  endTime?: Date;
  isCompleted: boolean;
  wasCorrect?: boolean;
}

// ============================================================================
// CHALLENGE BROWSING AND FILTERING
// ============================================================================

/**
 * Filter options for browsing challenges
 */
export interface ChallengeFilters {
  difficulty?: 'easy' | 'medium' | 'hard';
  mediaType?: MediaType;
  tags?: string[];
  minPopularity?: number;
  maxDuration?: number; // in milliseconds
  createdAfter?: Date;
  hasEmotionAnalysis?: boolean;
}

/**
 * Sorting options for challenge lists
 */
export type ChallengeSortBy = 
  | 'popularity' 
  | 'difficulty' 
  | 'newest' 
  | 'oldest' 
  | 'most_played' 
  | 'highest_rated';

/**
 * Challenge browsing request
 */
export interface ChallengeBrowseRequest {
  filters?: ChallengeFilters;
  sortBy?: ChallengeSortBy;
  page: number;
  limit: number;
  excludePlayedBy?: string; // player ID to exclude already played challenges
}

/**
 * Challenge browsing response
 */
export interface ChallengeBrowseResponse {
  challenges: EnhancedChallenge[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

// ============================================================================
// CHALLENGE RESULTS AND FEEDBACK
// ============================================================================

/**
 * Result of a guess submission
 */
export interface GuessResult {
  sessionId: string;
  playerId: string;
  challengeId: string;
  guessedStatement: number;
  correctStatement: number;
  wasCorrect: boolean;
  pointsEarned: number;
  timeBonus: number;
  accuracyBonus: number;
  streakBonus: number;
  totalScore: number;
  newAchievements: string[]; // achievement IDs
  levelUp?: {
    oldLevel: number;
    newLevel: number;
    rewardsUnlocked: string[];
  };
}

/**
 * Challenge rating and feedback
 */
export interface ChallengeRating {
  playerId: string;
  challengeId: string;
  rating: number; // 1-5 stars
  difficulty: 'easy' | 'medium' | 'hard';
  feedback?: string;
  wouldRecommend: boolean;
  ratedAt: Date;
}

// ============================================================================
// CHALLENGE MODERATION
// ============================================================================

/**
 * Content moderation status
 */
export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

/**
 * Challenge moderation data
 */
export interface ChallengeModerationData {
  challengeId: string;
  status: ModerationStatus;
  moderatorId?: string;
  moderationReason?: string;
  flagCount: number;
  reportReasons: string[];
  reviewedAt?: Date;
  autoModeration: {
    contentScore: number; // 0-100, higher is safer
    languageAppropriate: boolean;
    containsPII: boolean;
    isSpam: boolean;
  };
}