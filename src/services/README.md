# WebSocket Services

This directory contains the WebSocket connection utilities for real-time notifications and updates in the Two Truths and a Lie game.

## Overview

The WebSocket implementation provides:
- Real-time notifications for game events
- Leaderboard updates
- Player activity tracking
- Automatic reconnection with exponential backoff
- Message queuing for offline scenarios
- Integration with Redux store

## Architecture

### Core Components

1. **WebSocketService** (`websocket.ts`)
   - Low-level WebSocket connection management
   - Handles connection, reconnection, and message routing
   - Provides heartbeat mechanism for connection health

2. **GameWebSocketManager** (`gameWebSocket.ts`)
   - Game-specific WebSocket functionality
   - Handles authentication and game events
   - Provides typed interfaces for game messages

3. **WebSocket Middleware** (`../store/middleware/websocketMiddleware.ts`)
   - Redux integration for WebSocket events
   - Automatic state synchronization
   - Event handling and dispatch

4. **React Hooks** (`../hooks/useWebSocket.ts`)
   - Easy WebSocket integration for React components
   - Subscription management
   - Connection status monitoring

## Usage

### Basic Setup

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

### Using React Hooks

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