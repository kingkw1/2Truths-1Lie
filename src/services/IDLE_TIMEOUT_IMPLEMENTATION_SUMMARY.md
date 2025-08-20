# Idle Timeout and Hint Triggers Implementation Summary

## Overview

This implementation adds comprehensive idle timeout handling and hint trigger functionality to the GameSessionManager, fulfilling the requirements for engaging players when they become inactive and providing assistance when they struggle with challenges.

## Key Features Implemented

### 1. Enhanced Idle Timeout Handling (Requirement 1.5)

- **30-second idle detection**: Automatically detects when players are idle for more than 30 seconds
- **Configurable idle hints**: Shows subtle hints and animations to encourage engagement
- **Progressive hint system**: Multiple hints with cooldown periods and maximum limits
- **Idle state tracking**: Comprehensive tracking of idle duration, hints shown, and engagement prompts

### 2. Struggle Hint System (Requirement 3.3)

- **Failure tracking**: Records incorrect attempts and triggers hints after configurable threshold
- **Contextual hints**: Provides relevant assistance based on the type of challenge
- **Adaptive difficulty**: Offers optional assistance when players struggle
- **Success reset**: Automatically resets failure count on successful activities

### 3. Hint Management System

- **Multiple hint types**: 
  - `idle_engagement`: Encourages activity when idle
  - `struggle_assistance`: Helps with difficult challenges
  - `progress_encouragement`: Motivates continued play
  - `feature_discovery`: Introduces new features
- **Priority system**: High, medium, and low priority hints
- **Animation support**: Each hint type has associated animations
- **Active hint tracking**: Manage multiple active hints simultaneously
- **Dismissal system**: Players can dismiss hints with proper event tracking

## Configuration Options

```typescript
hintConfig: {
  enableIdleHints: boolean;        // Enable/disable idle hints (default: true)
  idleHintDelay: number;          // Delay after idle timeout (default: 5000ms)
  maxIdleHints: number;           // Max hints per idle period (default: 3)
  hintCooldown: number;           // Time between hints (default: 10000ms)
  enableStruggleHints: boolean;   // Enable struggle assistance (default: true)
  failureThreshold: number;       // Failures before hint (default: 2)
}
```

## New Events

- `hint_triggered`: Fired when any hint is shown
- `hint_dismissed`: Fired when a hint is dismissed
- `engagement_prompt`: Fired for engagement-specific prompts
- Enhanced `idle_timeout`: Now includes idle state information

## API Methods

### Hint Management
- `recordFailure(challengeId?)`: Record a failed attempt
- `resetFailureCount()`: Reset failure tracking on success
- `dismissHint(hintId)`: Dismiss a specific hint
- `getActiveHints()`: Get all currently active hints
- `getIdleState()`: Get current idle state information
- `triggerEngagementPrompt()`: Manually trigger engagement

### State Tracking
- Enhanced idle state with duration, hints shown, and timing
- Failure count tracking with context
- Active hint management with priorities

## Implementation Details

### Idle Flow
1. Player becomes idle after 30 seconds of inactivity
2. System waits additional 5 seconds (configurable)
3. Shows first hint with appropriate animation
4. Continues showing hints with cooldown until max reached
5. Resets all state when player resumes activity

### Struggle Flow
1. Track failed attempts per challenge/activity
2. After threshold reached (default: 2 failures), show assistance hint
3. Provide contextual help based on activity type
4. Reset counter on successful activity or explicit reset

### Hint Prioritization
- **High priority**: Struggle assistance (immediate attention needed)
- **Medium priority**: Progress encouragement, feature discovery
- **Low priority**: Idle engagement (subtle nudges)

## Testing

Comprehensive test suite covering:
- Idle timeout triggering and hint display
- Maximum hint limits and cooldown periods
- Idle state reset on activity changes
- Struggle hint triggering after failures
- Failure count reset on success
- Active hint management and dismissal
- Event emission for all hint-related actions

## Usage Example

```typescript
const sessionManager = new GameSessionManager({
  playerId: 'player-123',
  idleTimeout: 30000, // 30 seconds
  hintConfig: {
    enableIdleHints: true,
    idleHintDelay: 5000,
    maxIdleHints: 3,
    hintCooldown: 10000,
    enableStruggleHints: true,
    failureThreshold: 2,
  }
});

// Listen for hints
sessionManager.addEventListener('hint_triggered', (event) => {
  const hint = event.data.hint;
  showHintInUI(hint.message, hint.animation, hint.priority);
});

// Record failures to trigger struggle hints
sessionManager.recordFailure('challenge-123');
sessionManager.recordFailure('challenge-123'); // Triggers hint

// Reset on success
sessionManager.resetFailureCount();
```

## Requirements Fulfilled

✅ **Requirement 1.5**: "IF a player is idle for more than 30 seconds THEN the system SHALL provide subtle hints or animations to encourage engagement"

✅ **Requirement 3.3**: "WHEN a player struggles with current difficulty THEN the system SHALL offer optional assistance or hints"

## Files Modified/Created

- `src/services/gameSessionManager.ts`: Enhanced with hint functionality
- `src/services/__tests__/gameSessionManager.test.ts`: Added comprehensive tests
- `src/services/idleTimeoutExample.ts`: Usage example and demonstration
- `src/services/IDLE_TIMEOUT_IMPLEMENTATION_SUMMARY.md`: This documentation

The implementation provides a robust, configurable system for player engagement through intelligent hint delivery while maintaining the core game experience.