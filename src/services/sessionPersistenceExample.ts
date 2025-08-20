/**
 * Example usage of enhanced session persistence and recovery mechanisms
 * Demonstrates local storage, server sync, and cross-device functionality
 */

import { GameSessionManager, initializeGameSessionManager } from './gameSessionManager';
import { GameSessionIntegration } from './gameSessionIntegration';

/**
 * Example: Initialize session manager with persistence
 */
export async function initializeGameWithPersistence(playerId: string, dispatch: any) {
  const sessionManager = initializeGameSessionManager({
    playerId,
    autoSaveInterval: 5000, // Save every 5 seconds
    idleTimeout: 30000, // 30 second idle timeout
    enableWebSocket: true,
    webSocketConfig: {
      serverUrl: 'wss://api.example.com/ws',
    },
    persistenceConfig: {
      serverUrl: 'https://api.example.com',
      enableServerSync: true,
      syncInterval: 30000, // Sync every 30 seconds
      maxRetries: 3,
      retryDelay: 5000, // 5 second retry delay
    },
  });

  // Initialize the session manager (this will attempt to restore previous session)
  await sessionManager.initialize();

  // Create integration with Redux
  const integration = new GameSessionIntegration({
    sessionManager,
    dispatch,
  });

  return { sessionManager, integration };
}

/**
 * Example: Start a new game session
 */
export async function startNewGameSession(integration: GameSessionIntegration) {
  try {
    await integration.startSession('player-123');
    console.log('Game session started successfully');
    
    // Session will be automatically saved to local storage every 5 seconds
    // and synced to server every 30 seconds
  } catch (error) {
    console.error('Failed to start game session:', error);
  }
}

/**
 * Example: Handle game activities with automatic persistence
 */
export function playGame(integration: GameSessionIntegration) {
  // Update activity - this will be automatically saved
  integration.updatePlayerActivity('creating');
  
  // Add points - this will be automatically saved
  integration.addSessionPoints(100, 'correct_guess');
  
  // Complete challenge - this will be automatically saved
  integration.completedChallenge();
  
  // All changes are automatically persisted locally and synced to server
}

/**
 * Example: Check sync status and handle offline scenarios
 */
export function checkSyncStatus(sessionManager: GameSessionManager) {
  const syncStatus = sessionManager.getSyncStatus();
  
  if (syncStatus) {
    console.log('Sync Status:', {
      lastLocalSave: syncStatus.lastLocalSave,
      lastServerSync: syncStatus.lastServerSync,
      pendingSync: syncStatus.pendingSync,
      syncError: syncStatus.syncError,
    });
    
    if (syncStatus.syncError) {
      console.warn('Sync error detected:', syncStatus.syncError);
      
      // Optionally force a sync retry
      sessionManager.forceSync().then(success => {
        if (success) {
          console.log('Force sync successful');
        } else {
          console.log('Force sync failed - may be offline');
        }
      });
    }
  }
}

/**
 * Example: Restore from backup (useful for recovery scenarios)
 */
export async function handleSessionRecovery(sessionManager: GameSessionManager) {
  // Get available backups
  const backups = sessionManager.getBackupSessions();
  
  if (backups.length > 0) {
    console.log('Available backup sessions:', backups.map(b => ({
      sessionId: b.sessionId,
      timestamp: b.timestamp,
      pointsEarned: b.gameState.pointsEarned,
      challengesCompleted: b.gameState.challengesCompleted,
    })));
    
    // Restore from most recent backup (index 0)
    const restored = await sessionManager.restoreFromBackup(0);
    
    if (restored) {
      console.log('Session restored from backup successfully');
    } else {
      console.log('Failed to restore from backup');
    }
  } else {
    console.log('No backup sessions available');
  }
}

/**
 * Example: Cross-device session continuity
 */
export async function demonstrateCrossDeviceSync(playerId: string) {
  // This would typically be called when a user logs in on a new device
  const sessionManager = initializeGameSessionManager({
    playerId,
    persistenceConfig: {
      serverUrl: 'https://api.example.com',
      enableServerSync: true,
    },
  });

  await sessionManager.initialize();
  
  // The initialize() call automatically:
  // 1. Checks local storage for recent sessions
  // 2. Fetches the latest session from server
  // 3. Compares timestamps and restores the most recent one
  // 4. Syncs the restored session across all storage locations
  
  const currentSession = sessionManager.getCurrentSession();
  
  if (currentSession) {
    console.log('Restored session from another device:', {
      sessionId: currentSession.sessionId,
      pointsEarned: currentSession.pointsEarned,
      lastActivity: currentSession.lastActivity,
    });
  } else {
    console.log('No previous session found, starting fresh');
  }
}

/**
 * Example: Cleanup when user logs out or app closes
 */
export async function cleanupSession(sessionManager: GameSessionManager, integration: GameSessionIntegration) {
  // End current session (this will save final state)
  await integration.endSession();
  
  // Cleanup integration
  integration.cleanup();
  
  // Cleanup session manager
  await sessionManager.cleanup();
  
  console.log('Session cleanup completed');
}

/**
 * Example: Handle network connectivity changes
 */
export function setupNetworkHandling(sessionManager: GameSessionManager) {
  // Listen for session events
  const unsubscribe = sessionManager.addEventListener('session_saved', (event) => {
    console.log('Session saved:', event.data);
  });

  // The persistence service automatically handles:
  // - Online/offline detection
  // - Retry logic with exponential backoff
  // - Queue pending changes when offline
  // - Sync when connection is restored

  // Cleanup listener when done
  return unsubscribe;
}

/**
 * Complete example usage
 */
export async function completeExample() {
  const playerId = 'player-123';
  const mockDispatch = (action: any) => console.log('Redux action:', action);

  try {
    // 1. Initialize with persistence
    const { sessionManager, integration } = await initializeGameWithPersistence(playerId, mockDispatch);

    // 2. Start playing
    await startNewGameSession(integration);
    playGame(integration);

    // 3. Monitor sync status
    checkSyncStatus(sessionManager);

    // 4. Setup network handling
    const unsubscribeNetworkHandler = setupNetworkHandling(sessionManager);

    // 5. Simulate some time passing...
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 6. Check for recovery options
    await handleSessionRecovery(sessionManager);

    // 7. Cleanup
    unsubscribeNetworkHandler();
    await cleanupSession(sessionManager, integration);

  } catch (error) {
    console.error('Example failed:', error);
  }
}