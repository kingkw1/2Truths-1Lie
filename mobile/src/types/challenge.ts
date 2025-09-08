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
 * Video segment metadata for merged videos
 */
export interface VideoSegment {
  statementIndex: number; // 0, 1, or 2 for the three statements
  startTime: number; // start time in milliseconds within the merged video
  endTime: number; // end time in milliseconds within the merged video
  duration: number; // segment duration in milliseconds
  originalDuration?: number; // original duration before compression
}

/**
 * Media capture data
 */
export interface MediaCapture {
  type: MediaType;
  url?: string; // Local blob URL for preview (temporary)
  streamingUrl?: string; // Persistent server URL for playback
  duration?: number; // in milliseconds
  fileSize?: number; // in bytes
  mimeType?: string;
  thumbnail?: string; // for video
  // Upload metadata
  mediaId?: string; // server-assigned media ID
  uploadTime?: number; // time taken to upload in milliseconds
  storageType?: 'local' | 'cloud' | 'cloud_fallback'; // where the media is stored
  cloudStorageKey?: string; // Cloud storage key for direct access
  uploadSessionId?: string; // Upload session ID for tracking
  isUploaded?: boolean; // Whether media has been successfully uploaded to server
  // Merged video metadata
  isMergedVideo?: boolean; // Whether this is a merged video with segments
  segments?: VideoSegment[]; // Segment metadata for merged videos
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
  createdAt: string; // ISO date string for Redux serialization
  lastPlayed: string; // ISO date string for Redux serialization
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
  startTime: number; // timestamp in milliseconds
  endTime?: number; // timestamp in milliseconds
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