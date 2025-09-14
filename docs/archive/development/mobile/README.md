# Redux Store Implementation

This directory contains the complete Redux store implementation for the Two Truths and a Lie game, providing centralized state management for all game functionality.

## Architecture Overview

The store is built using Redux Toolkit and follows a modular slice-based architecture:

```
src/store/
├── index.ts              # Store configuration and setup
├── hooks.ts              # Typed Redux hooks
├── selectors.ts          # Memoized state selectors
├── utils.ts              # Utility functions for common operations
├── StoreProvider.tsx     # React Provider component
├── middleware/
│   └── gameMiddleware.ts # Custom middleware for game logic
└── slices/
    ├── gameSessionSlice.ts      # Game session management
    ├── playerProgressionSlice.ts # Player progression and achievements
    ├── challengeCreationSlice.ts # Challenge creation workflow
    ├── guessingGameSlice.ts     # Guessing game state
    └── uiSlice.ts               # UI state and notifications
```

## Store Slices

### 1. Game Session Slice (`gameSessionSlice.ts`)
Manages the current game session lifecycle:
- Session creation and termination
- Activity tracking (creating, browsing, guessing, idle)
- Points accumulation
- Session history

**Key Actions:**
- `startGameSession` - Initialize new session
- `updateActivity` - Track current player activity
- `addPoints` - Award points to player
- `endGameSession` - Terminate current session

### 2. Player Progression Slice (`playerProgressionSlice.ts`)
Handles player advancement and achievements:
- Experience points and leveling
- Achievement tracking
- Cosmetic unlocks
- Game statistics

**Key Actions:**
- `addExperience` - Award XP and handle level-ups
- `updateGameStats` - Update accuracy, games played, streaks
- `addAchievement` - Unlock new achievements
- `unlockCosmetic` - Grant cosmetic rewards

### 3. Challenge Creation Slice (`challengeCreationSlice.ts`)
Manages the challenge creation workflow:
- Statement input and validation
- Media recording state
- Lie selection
- Submission process

**Key Actions:**
- `startNewChallenge` - Begin creation workflow
- `updateStatement` - Modify challenge statements
- `setLieStatement` - Select which statement is the lie
- `validateChallenge` - Check challenge validity

### 4. Guessing Game Slice (`guessingGameSlice.ts`)
Controls the guessing gameplay:
- Challenge browsing and filtering
- Guess submission
- Hint system
- Results display

**Key Actions:**
- `startGuessingSession` - Begin guessing a challenge
- `submitGuess` - Submit player's guess
- `useHint` - Reveal hints to player
- `setGuessResult` - Display guess results

### 5. UI Slice (`uiSlice.ts`)
Manages general UI state:
- Notifications and alerts
- Modal dialogs
- Navigation state
- User preferences

**Key Actions:**
- `showNotification` - Display user notifications
- `openModal` - Show modal dialogs
- `navigateToScreen` - Handle navigation
- `updateSettings` - Modify user preferences

## Middleware

### Game Middleware (`gameMiddleware.ts`)
Custom middleware that handles:
- **Auto-save**: Automatically saves game state to localStorage
- **Session timeout**: Manages idle detection and session cleanup
- **Achievement triggers**: Automatically awards achievements based on actions
- **Experience calculation**: Computes XP rewards with bonuses

## Selectors (`selectors.ts`)
Memoized selectors for computed state values:
- `selectSessionDuration` - Calculate current session length
- `selectXPToNextLevel` - XP needed for next level
- `selectLevelProgress` - Progress percentage to next level
- `selectChallengeIsValid` - Whether current challenge can be submitted

## Usage Examples

### Basic Setup
```typescript
import { StoreProvider } from './store/StoreProvider';
import { useAppSelector, useAppDispatch } from './store/hooks';

// Wrap your app
function App() {
  return (
    <StoreProvider>
      <GameComponent />
    </StoreProvider>
  );
}
```

### Using in Components
```typescript
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { startGameSession, updateActivity } from '../store/slices/gameSessionSlice';
import { selectPlayerLevel, selectCurrentSession } from '../store/selectors';

function GameComponent() {
  const dispatch = useAppDispatch();
  const playerLevel = useAppSelector(selectPlayerLevel);
  const currentSession = useAppSelector(selectCurrentSession);
  
  const handleStartGame = () => {
    dispatch(startGameSession({ playerId: 'player123' }));
    dispatch(updateActivity('creating'));
  };
  
  return (
    <div>
      <h1>Level {playerLevel}</h1>
      {currentSession && <p>Session Active</p>}
      <button onClick={handleStartGame}>Start Game</button>
    </div>
  );
}
```

### Utility Functions
```typescript
import { 
  initializeGameSession, 
  beginChallengeCreation, 
  getGameStatistics 
} from '../store/utils';

// Start new session
initializeGameSession('player123');

// Begin challenge creation
beginChallengeCreation();

// Get current stats
const stats = getGameStatistics();
console.log(`Level ${stats.currentLevel}, XP: ${stats.totalXP}`);
```

## State Persistence

The store automatically saves critical game state to localStorage:
- Player progression (level, XP, achievements)
- Current session data
- User preferences

State is restored on app initialization and expires after 7 days of inactivity.

## Performance Considerations

- **Memoized Selectors**: All computed values use `createSelector` for optimal re-rendering
- **Middleware Optimization**: Game middleware batches related updates
- **Serialization**: Non-serializable values (like Dates) are handled appropriately
- **State Normalization**: Complex nested data is kept flat for efficient updates

## Testing

The store is designed to be easily testable:
- Pure reducer functions
- Isolated action creators
- Mockable middleware
- Deterministic state updates

## Future Enhancements

Planned improvements:
- WebSocket integration for real-time multiplayer
- Offline queue for actions when disconnected
- State migration for schema changes
- Performance monitoring and analytics