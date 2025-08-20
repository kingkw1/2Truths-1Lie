/**
 * Validation tests for TypeScript interfaces
 * Ensures all interfaces are properly defined and usable
 */

import {
  GameSession,
  PlayerProgression,
  PlayerInventory,
  RewardCalculation,
  EnhancedChallenge,
  GuessingSession,
  GuessResult,
  ChallengeCreation,
  Achievement,
  VirtualCurrency,
  CosmeticItem
} from './index';

// Test GameSession interface
const testGameSession: GameSession = {
  sessionId: 'session-123',
  playerId: 'player-456',
  currentActivity: 'creating',
  startTime: new Date(),
  lastActivity: new Date(),
  pointsEarned: 150,
  challengesCompleted: 3,
  guessesSubmitted: 5,
  sessionDuration: 300000, // 5 minutes
  isActive: true
};

// Test PlayerProgression interface
const testPlayerProgression: PlayerProgression = {
  playerId: 'player-456',
  level: {
    currentLevel: 5,
    experiencePoints: 1250,
    experienceToNextLevel: 250,
    totalExperience: 1250
  },
  totalGamesPlayed: 25,
  challengesCreated: 8,
  challengesGuessed: 17,
  correctGuesses: 12,
  accuracyRate: 70.6,
  currentStreak: 3,
  longestStreak: 7,
  achievements: [],
  unlockedCosmetics: ['avatar_frame_001', 'celebration_confetti'],
  createdAt: new Date('2024-01-01'),
  lastUpdated: new Date()
};

// Test Achievement interface
const testAchievement: Achievement = {
  id: 'achievement-001',
  type: 'first_challenge',
  name: 'First Steps',
  description: 'Create your first challenge',
  iconUrl: '/icons/first-challenge.png',
  unlockedAt: new Date(),
  progress: 100,
  maxProgress: 100,
  isUnlocked: true
};

// Test VirtualCurrency interface
const testCurrency: VirtualCurrency = {
  type: 'coins',
  amount: 500,
  lastEarned: new Date(),
  totalEarned: 1200,
  totalSpent: 700
};

// Test CosmeticItem interface
const testCosmetic: CosmeticItem = {
  id: 'cosmetic-001',
  name: 'Golden Frame',
  description: 'A shiny golden avatar frame',
  type: 'avatar_frame',
  rarity: 'epic',
  cost: {
    currency: 'coins',
    amount: 250
  },
  previewUrl: '/previews/golden-frame.png',
  isOwned: true,
  isEquipped: false,
  unlockedAt: new Date()
};

// Test PlayerInventory interface
const testInventory: PlayerInventory = {
  playerId: 'player-456',
  currencies: [testCurrency],
  ownedCosmetics: [testCosmetic],
  equippedCosmetics: {
    avatar_frame: 'cosmetic-001'
  },
  lastUpdated: new Date()
};

// Test RewardCalculation interface
const testReward: RewardCalculation = {
  basePoints: 100,
  bonusMultiplier: 1.5,
  streakBonus: 25,
  difficultyBonus: 50,
  speedBonus: 10,
  totalPoints: 185,
  currencyRewards: [testCurrency],
  experienceGained: 75,
  achievementsUnlocked: [testAchievement]
};

// Test ChallengeCreation interface
const testChallengeCreation: ChallengeCreation = {
  creatorId: 'player-456',
  statements: [
    {
      id: 'stmt-1',
      text: 'I have climbed Mount Everest',
      isLie: true,
      confidence: 0.8
    },
    {
      id: 'stmt-2', 
      text: 'I speak three languages fluently',
      isLie: false,
      confidence: 0.9
    },
    {
      id: 'stmt-3',
      text: 'I have never broken a bone',
      isLie: false,
      confidence: 0.7
    }
  ],
  mediaData: [
    {
      type: 'video',
      url: '/media/challenge-video.mp4',
      duration: 30000,
      fileSize: 5242880,
      mimeType: 'video/mp4',
      thumbnail: '/media/challenge-thumb.jpg'
    }
  ],
  qualityScore: 85,
  estimatedDifficulty: 'medium',
  tags: ['personal', 'adventure'],
  isPublic: true
};

// Test GuessingSession interface
const testGuessingSession: GuessingSession = {
  sessionId: 'guess-session-789',
  playerId: 'player-456',
  challengeId: 'challenge-123',
  statements: [
    {
      id: 'stmt-1',
      text: 'I have climbed Mount Everest',
      isLie: true,
      confidence: 0.8,
      viewCount: 150,
      guessAccuracy: 65,
      averageConfidence: 0.75,
      popularGuess: true
    }
  ],
  playerGuess: 0,
  confidenceScores: [0.9, 0.6, 0.7],
  hintsUsed: 1,
  timeSpent: 45000,
  startTime: new Date(),
  isCompleted: true,
  wasCorrect: true
};

// Test GuessResult interface
const testGuessResult: GuessResult = {
  sessionId: 'guess-session-789',
  playerId: 'player-456',
  challengeId: 'challenge-123',
  guessedStatement: 0,
  correctStatement: 0,
  wasCorrect: true,
  pointsEarned: 100,
  timeBonus: 15,
  accuracyBonus: 25,
  streakBonus: 10,
  totalScore: 150,
  newAchievements: ['streak_master'],
  levelUp: {
    oldLevel: 4,
    newLevel: 5,
    rewardsUnlocked: ['cosmetic-002']
  }
};

// Validation function to ensure all interfaces compile correctly
export function validateInterfaces(): boolean {
  // This function exists to ensure TypeScript compilation succeeds
  // If any interface has issues, this file won't compile
  
  const interfaces = {
    gameSession: testGameSession,
    playerProgression: testPlayerProgression,
    achievement: testAchievement,
    currency: testCurrency,
    cosmetic: testCosmetic,
    inventory: testInventory,
    reward: testReward,
    challengeCreation: testChallengeCreation,
    guessingSession: testGuessingSession,
    guessResult: testGuessResult
  };
  
  // Verify all required properties exist
  console.log('All interfaces validated successfully');
  console.log(`Validated ${Object.keys(interfaces).length} interface types`);
  
  return true;
}

// Jest tests for interface validation
describe('Interface Validation', () => {
  test('should validate all interfaces compile correctly', () => {
    expect(validateInterfaces()).toBe(true);
  });

  test('should have valid GameSession structure', () => {
    expect(testGameSession.sessionId).toBeDefined();
    expect(testGameSession.playerId).toBeDefined();
    expect(testGameSession.currentActivity).toMatch(/creating|browsing|guessing|idle/);
    expect(testGameSession.isActive).toBe(true);
  });

  test('should have valid PlayerProgression structure', () => {
    expect(testPlayerProgression.level.currentLevel).toBeGreaterThan(0);
    expect(testPlayerProgression.accuracyRate).toBeGreaterThanOrEqual(0);
    expect(testPlayerProgression.accuracyRate).toBeLessThanOrEqual(100);
  });

  test('should have valid Achievement structure', () => {
    expect(testAchievement.progress).toBeLessThanOrEqual(testAchievement.maxProgress);
    expect(testAchievement.isUnlocked).toBe(true);
  });
});

// Export test data for use in other modules
export {
  testGameSession,
  testPlayerProgression,
  testAchievement,
  testCurrency,
  testCosmetic,
  testInventory,
  testReward,
  testChallengeCreation,
  testGuessingSession,
  testGuessResult
};