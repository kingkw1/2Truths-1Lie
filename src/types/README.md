# TypeScript Interfaces Documentation

This directory contains all TypeScript interfaces for the Two Truths and a Lie game, organized by functionality and designed to support the core gameplay requirements.

## Files Overview

### `game.ts`
Core game session, player progression, and rewards interfaces that support:
- **Requirement 1**: Intuitive Core Game Loop
- **Requirement 5**: Resource Earning and Monetization  
- **Requirement 6**: Auto-Save and Cross-Device Sync

Key interfaces:
- `GameSession` - Tracks active gameplay sessions
- `PlayerProgression` - Manages player levels, achievements, and statistics
- `PlayerInventory` - Handles virtual currencies and cosmetic items
- `RewardCalculation` - Calculates points and rewards for gameplay actions

### `challenge.ts`
Challenge creation, gameplay, and analysis interfaces that support the social guessing mechanics:

Key interfaces:
- `ChallengeCreation` - Structure for creating new challenges
- `EnhancedChallenge` - Challenge data with analytics and metadata
- `GuessingSession` - Tracks player guessing attempts
- `GuessResult` - Results and rewards from guess submissions

### `index.ts`
Central export file for easy importing of all types across the application.

## Usage Examples

### Basic Game Session
```typescript
import { GameSession } from './types';

const session: GameSession = {
  sessionId: 'session-123',
  playerId: 'player-456', 
  currentActivity: 'creating',
  startTime: new Date(),
  lastActivity: new Date(),
  pointsEarned: 150,
  challengesCompleted: 3,
  guessesSubmitted: 5,
  sessionDuration: 300000,
  isActive: true
};
```

### Player Progression Tracking
```typescript
import { PlayerProgression, Achievement } from './types';

const progression: PlayerProgression = {
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
  unlockedCosmetics: ['avatar_frame_001'],
  createdAt: new Date('2024-01-01'),
  lastUpdated: new Date()
};
```

### Challenge Creation
```typescript
import { ChallengeCreation, Statement } from './types';

const challenge: ChallengeCreation = {
  creatorId: 'player-456',
  statements: [
    {
      id: 'stmt-1',
      text: 'I have climbed Mount Everest',
      isLie: true,
      confidence: 0.8
    }
    // ... more statements
  ],
  mediaData: [{
    type: 'video',
    url: '/media/challenge-video.mp4',
    duration: 30000
  }],
  qualityScore: 85,
  estimatedDifficulty: 'medium',
  isPublic: true
};
```

## Design Principles

### Type Safety
All interfaces use strict TypeScript typing with:
- Required vs optional properties clearly defined
- Union types for controlled enumerations
- Generic types where appropriate for reusability

### Requirement Alignment
Each interface directly supports specific game requirements:
- **Game Sessions** → Requirement 1 (Core Game Loop) & 6 (Auto-Save)
- **Progression** → Requirement 2 (Progress Feedback) & 5 (Monetization)
- **Challenges** → Requirement 3 (Difficulty) & 4 (Social Interaction)

### Extensibility
Interfaces are designed for future expansion:
- Optional properties for new features
- Flexible data structures for different game modes
- Modular organization for easy maintenance

### Performance Considerations
- Efficient data structures for real-time gameplay
- Minimal nesting to reduce serialization overhead
- Clear separation between client and server data models

## Validation

The `validation.test.ts` file contains comprehensive test data demonstrating proper usage of all interfaces. Run type checking with:

```bash
npm run type-check
```

This ensures all interfaces compile correctly and maintain type safety across the application.