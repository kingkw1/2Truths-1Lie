# Game Services

This directory contains core game services including WebSocket connections, session management, and real-time functionality for the Two Truths and a Lie game.

## Overview

The game services provide:
- **Session Management**: Complete game session lifecycle and state orchestration
- **Real-time Communication**: WebSocket connections for live game events
- **Activity Tracking**: Player behavior monitoring and idle detection
- **Persistence**: Auto-save and cross-device synchronization
- **Integration**: Seamless Redux store and React component integration

## Architecture

### Core Components

1. **GameSessionManager** (`gameSessionManager.ts`)
   - Central orchestrator for game session lifecycle
   - Activity state management and idle detection
   - Points tracking and reward calculation
   - Auto-save and session persistence
   - Event system for real-time updates

2. **WebSocketService** (`websocket.ts`)
   - Low-level WebSocket connection management
   - Handles connection, reconnection, and message routing
   - Provides heartbeat mechanism for connection health

3. **GameWebSocketManager** (`gameWebSocket.ts`)
   - Game-specific WebSocket functionality
   - Handles authentication and game events
   - Provides typed interfaces for game messages

4. **GameSessionIntegration** (`gameSessionIntegration.ts`)
   - Integration layer between GameSessionManager and Redux
   - Automatic state synchronization
   - React hooks for easy component integration

5. **WebSocket Middleware** (`../store/middleware/websocketMiddleware.ts`)
   - Redux integration for WebSocket events
   - Automatic state synchronization
   - Event handling and dispatch

6. **React Hooks** (`../hooks/useWebSocket.ts`)
   - Easy WebSocket integration for React components
   - Subscription management
   - Connection status monitoring

## Usage

### Game Session Management

```typescript
import { initializeGameSessionManager } from './services/gameSessionManager';

// Initialize session manager
const sessionManager = initializeGameSessionManager({
  playerId: 'player-123',
  autoSaveInterval: 5000,
  idleTimeout: 30000,
  enableWebSocket: true,
  webSocketConfig: {
    serverUrl: 'ws://localhost:8080/ws'
  }
});

// Initialize and start session
await sessionManager.initialize();
const session = await sessionManager.startGameSession();

// Update activity
sessionManager.updateActivity('creating');

// Add points
sessionManager.addPoints(100, 'correct_guess');

// Listen to events
sessionManager.addEventListener('points_earned', (event) => {
  console.log('Points earned:', event.data.points);
});
```

### WebSocket Setup

```typescript
import { initializeGameWebSocket } from './services/gameWebSocket';

// Initialize WebSocket connection
const wsManager = initializeGameWebSocket({
  serverUrl: 'ws://localhost:8080/ws',
  playerId: 'player-123',
  gameSessionId: 'session-456'
});

// Connect
await wsManager.connect();
```

### React Integration

```typescript
import { useGameSessionManager } from './services/gameSessionIntegration';
import { useAppDispatch } from '../store/hooks';

function GameComponent() {
  const dispatch = useAppDispatch();
  const sessionManager = getGameSessionManager();
  
  const {
    startSession,
    endSession,
    updateActivity,
    addPoints,
    isActive,
    getCurrentSession
  } = useGameSessionManager(sessionManager, dispatch);

  const handleStartGame = async () => {
    await startSession('player-123');
  };

  const handleCreateChallenge = () => {
    updateActivity('creating');
  };

  const session = getCurrentSession();

  return (
    <div>
      <button onClick={handleStartGame}>Start Game</button>
      <button onClick={handleCreateChallenge}>Create Challenge</button>
      <p>Status: {isActive() ? 'Active' : 'Inactive'}</p>
      <p>Points: {session?.pointsEarned || 0}</p>
    </div>
  );
}
```

### WebSocket Hooks

```typescript
import { useWebSocket, useLeaderboardUpdates } from '../hooks/useWebSocket';

function GameComponent() {
  const { isConnected, subscribe } = useWebSocket();
  const { subscribeToLeaderboard } = useLeaderboardUpdates();

  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard((data) => {
      console.log('Leaderboard updated:', data);
    });
    return unsubscribe;
  }, []);

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### Redux Integration

The WebSocket middleware automatically handles:
- Connection initialization when game session starts
- Event dispatching to Redux store
- State synchronization
- Error handling and notifications

## Message Types

### Outgoing Messages

- `authenticate` - Player authentication
- `guess_result` - Guess submission results
- `challenge_published` - New challenge notifications
- `player_activity` - Activity heartbeat
- `join_room` / `leave_room` - Room management
- `request_leaderboard` - Leaderboard refresh

### Incoming Messages

- `auth_success` / `auth_failed` - Authentication results
- `notification` - General game notifications
- `leaderboard_update` - Leaderboard changes
- `guess_result` - Other players' guess results
- `challenge_published` - New challenges available
- `player_joined` / `player_left` - Room events
- `system_message` - Server announcements

## Configuration

### Environment Variables

- `REACT_APP_WEBSOCKET_URL` - WebSocket server URL (default: `ws://localhost:8080/ws`)

### Connection Options

```typescript
interface WebSocketConfig {
  url: string;
  reconnectInterval?: number; // Default: 3000ms
  maxReconnectAttempts?: number; // Default: 5
  heartbeatInterval?: number; // Default: 30000ms
  protocols?: string[];
}
```

## Error Handling

The WebSocket implementation includes:
- Automatic reconnection with exponential backoff
- Message queuing during disconnection
- Graceful degradation when WebSocket unavailable
- User notifications for connection issues
- Fallback to offline mode

## Testing

Run WebSocket tests:
```bash
npm test -- --testPathPattern=websocket
```

The test suite includes:
- Connection management
- Message sending/receiving
- Reconnection logic
- Error handling
- Message queuing

## Security Considerations

- Authentication required for all game operations
- Rate limiting on message sending
- Input validation on all incoming messages
- Secure WebSocket (WSS) for production
- Player ID validation and session management

## Performance

- Connection pooling for multiple tabs
- Message batching for high-frequency events
- Automatic cleanup of event listeners
- Memory leak prevention
- Efficient JSON parsing and serialization

## Monitoring

The WebSocket service provides:
- Connection status indicators
- Performance metrics
- Error logging
- Reconnection statistics
- Message throughput tracking