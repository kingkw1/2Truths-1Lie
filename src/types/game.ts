/**
 * Core TypeScript interfaces for game sessions, player progression, and rewards
 * Relates to Requirements 1, 5, and 6
 */

// ============================================================================
// GAME SESSION INTERFACES
// ============================================================================

/**
 * Represents the current activity state of a player in the game
 */
export type GameActivity = 'creating' | 'browsing' | 'guessing' | 'idle';

/**
 * Core game session interface tracking player state and progress
 * Requirement 1: Intuitive Core Game Loop
 * Requirement 6: Auto-Save and Cross-Device Sync
 */
export interface GameSession {
  sessionId: string;
  playerId: string;
  currentActivity: GameActivity;
  startTime: Date;
  lastActivity: Date;
  pointsEarned: number;
  challengesCompleted: number;
  guessesSubmitted: number;
  sessionDuration: number; // in milliseconds
  isActive: boolean;
}

/**
 * Session persistence data for auto-save functionality
 * Requirement 6: Auto-Save and Cross-Device Sync
 */
export interface SessionPersistence {
  sessionId: string;
  playerId: string;
  gameState: GameSession;
  lastSaved: Date;
  syncStatus: 'synced' | 'pending' | 'failed';
  deviceId: string;
}

// ============================================================================
// PLAYER PROGRESSION INTERFACES
// ============================================================================

/**
 * Achievement types that players can unlock
 */
export type AchievementType = 
  | 'first_challenge' 
  | 'first_correct_guess' 
  | 'streak_master' 
  | 'deception_expert' 
  | 'social_butterfly' 
  | 'perfectionist';

/**
 * Individual achievement definition
 * Requirement 2: Progress and Achievement Feedback
 */
export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  iconUrl: string;
  unlockedAt?: Date;
  progress: number; // 0-100 percentage
  maxProgress: number;
  isUnlocked: boolean;
}

/**
 * Player level and experience tracking
 * Requirement 2: Progress and Achievement Feedback
 */
export interface PlayerLevel {
  currentLevel: number;
  experiencePoints: number;
  experienceToNextLevel: number;
  totalExperience: number;
}

/**
 * Comprehensive player progression tracking
 * Requirements 2: Progress and Achievement Feedback
 * Requirements 5: Resource Earning and Monetization
 */
export interface PlayerProgression {
  playerId: string;
  level: PlayerLevel;
  totalGamesPlayed: number;
  challengesCreated: number;
  challengesGuessed: number;
  correctGuesses: number;
  accuracyRate: number; // percentage 0-100
  currentStreak: number;
  longestStreak: number;
  achievements: Achievement[];
  unlockedCosmetics: string[];
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * Player statistics for analytics and matchmaking
 */
export interface PlayerStats {
  playerId: string;
  averageGuessTime: number; // in milliseconds
  preferredDifficulty: 'easy' | 'medium' | 'hard';
  dominantEmotionTypes: string[];
  weeklyGamesPlayed: number;
  monthlyGamesPlayed: number;
  totalPlayTime: number; // in milliseconds
}

// ============================================================================
// REWARDS AND MONETIZATION INTERFACES
// ============================================================================

/**
 * Types of virtual currency in the game
 */
export type CurrencyType = 'coins' | 'gems' | 'experience';

/**
 * Virtual currency balance tracking
 * Requirement 5: Resource Earning and Monetization
 */
export interface VirtualCurrency {
  type: CurrencyType;
  amount: number;
  lastEarned: Date;
  totalEarned: number;
  totalSpent: number;
}

/**
 * Cosmetic item types available for purchase/unlock
 */
export type CosmeticType = 
  | 'avatar_frame' 
  | 'voice_changer' 
  | 'overlay_effect' 
  | 'celebration_animation' 
  | 'theme_pack';

/**
 * Individual cosmetic item definition
 * Requirement 5: Resource Earning and Monetization
 */
export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  type: CosmeticType;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  cost: {
    currency: CurrencyType;
    amount: number;
  };
  previewUrl: string;
  isOwned: boolean;
  isEquipped: boolean;
  unlockedAt?: Date;
}

/**
 * Player inventory management
 * Requirement 5: Resource Earning and Monetization
 */
export interface PlayerInventory {
  playerId: string;
  currencies: VirtualCurrency[];
  ownedCosmetics: CosmeticItem[];
  equippedCosmetics: {
    [key in CosmeticType]?: string; // cosmetic item id
  };
  lastUpdated: Date;
}

/**
 * Reward calculation and distribution
 * Requirements 2: Progress and Achievement Feedback
 * Requirements 5: Resource Earning and Monetization
 */
export interface RewardCalculation {
  basePoints: number;
  bonusMultiplier: number;
  streakBonus: number;
  difficultyBonus: number;
  speedBonus: number;
  totalPoints: number;
  currencyRewards: VirtualCurrency[];
  experienceGained: number;
  achievementsUnlocked: Achievement[];
}

/**
 * Milestone tracking for progression rewards
 * Requirement 2: Progress and Achievement Feedback
 */
export interface ProgressMilestone {
  id: string;
  name: string;
  description: string;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  reward: {
    currencies: VirtualCurrency[];
    cosmetics: string[]; // cosmetic item ids
    achievements: string[]; // achievement ids
  };
  completedAt?: Date;
}

// ============================================================================
// LEADERBOARD AND SOCIAL INTERFACES
// ============================================================================

/**
 * Leaderboard entry for competitive features
 * Requirements 2: Progress and Achievement Feedback
 * Requirements 4: Social Guessing and Interaction
 */
export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  avatarUrl?: string;
  rank: number;
  score: number;
  level: number;
  accuracyRate: number;
  gamesPlayed: number;
  lastActive: Date;
}

/**
 * Different leaderboard types
 */
export type LeaderboardType = 'global' | 'weekly' | 'friends' | 'accuracy' | 'streak';

/**
 * Leaderboard configuration and data
 */
export interface Leaderboard {
  type: LeaderboardType;
  entries: LeaderboardEntry[];
  lastUpdated: Date;
  resetDate?: Date; // for weekly/monthly leaderboards
  totalPlayers: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic response wrapper for API calls
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/**
 * Event tracking for analytics
 */
export interface GameEvent {
  eventType: string;
  playerId: string;
  sessionId: string;
  timestamp: Date;
  data: Record<string, any>;
}