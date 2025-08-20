/**
 * Unit tests for SessionPersistenceService
 * Tests local storage, server sync, and cross-device functionality
 */

import { SessionPersistenceService, PersistenceConfig } from '../sessionPersistence';
import { GameSession } from '../../types/game';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock network events
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// Mock window object
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
});

describe('SessionPersistenceService', () => {
  let service: SessionPersistenceService;
  let config: PersistenceConfig;
  let mockSession: GameSession;

  beforeEach(() => {
    // Clear mocks before creating service
    jest.clearAllMocks();
    localStorageMock.clear();

    config = {
      playerId: 'test-player-123',
      serverUrl: 'https://api.example.com',
      enableServerSync: true,
      syncInterval: 1000,
      maxRetries: 2,
      retryDelay: 1000,
    };

    mockSession = {
      sessionId: 'session-123',
      playerId: 'test-player-123',
      currentActivity: 'creating',
      startTime: new Date('2023-01-01T10:00:00Z'),
      lastActivity: new Date('2023-01-01T10:30:00Z'),
      pointsEarned: 150,
      challengesCompleted: 3,
      guessesSubmitted: 5,
      sessionDuration: 1800000, // 30 minutes
      isActive: true,
    };

    service = new SessionPersistenceService(config);
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Local Storage Persistence', () => {
    test('should save session to local storage', async () => {
      await service.saveToLocal(mockSession);

      const savedData = localStorageMock.getItem('gameSession_test-player-123');
      expect(savedData).toBeDefined();

      const parsedData = JSON.parse(savedData!);
      expect(parsedData.sessionId).toBe('session-123');
      expect(parsedData.playerId).toBe('test-player-123');
      expect(parsedData.gameState.pointsEarned).toBe(150);
    });

    test('should load session from local storage', async () => {
      // Save session first
      await service.saveToLocal(mockSession);

      // Load it back
      const loadedSession = await service.loadFromLocal();

      expect(loadedSession).toBeDefined();
      expect(loadedSession!.sessionId).toBe('session-123');
      expect(loadedSession!.pointsEarned).toBe(150);
      expect(loadedSession!.startTime).toBeInstanceOf(Date);
    });

    test('should return null for non-existent session', async () => {
      const loadedSession = await service.loadFromLocal();
      expect(loadedSession).toBeNull();
    });

    test('should not load old inactive sessions', async () => {
      const oldSession = {
        ...mockSession,
        isActive: false,
      };

      await service.saveToLocal(oldSession);

      const loadedSession = await service.loadFromLocal();
      expect(loadedSession).toBeNull();
    });

    test('should not load sessions older than 4 hours', async () => {
      const oldSession = {
        ...mockSession,
        startTime: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000),
      };

      // Manually create old persistence data
      const persistenceData = {
        sessionId: oldSession.sessionId,
        playerId: config.playerId,
        gameState: oldSession,
        lastSaved: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        syncStatus: 'synced',
        deviceId: 'test-device',
      };

      localStorageMock.setItem('gameSession_test-player-123', JSON.stringify(persistenceData));

      const loadedSession = await service.loadFromLocal();
      expect(loadedSession).toBeNull();
    });

    test('should handle localStorage errors gracefully', async () => {
      const originalSetItem = localStorageMock.setItem;
      localStorageMock.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(service.saveToLocal(mockSession)).rejects.toThrow('Local save failed');

      localStorageMock.setItem = originalSetItem;
    });
  });

  describe('Backup Management', () => {
    test('should create backup sessions', async () => {
      await service.saveToLocal(mockSession);

      const backups = service.getBackupSessions();
      expect(backups).toHaveLength(1);
      expect(backups[0]?.sessionId).toBe('session-123');
    });

    test('should maintain up to 3 backup sessions', async () => {
      // Create 5 sessions to test rotation
      for (let i = 0; i < 5; i++) {
        const session = {
          ...mockSession,
          sessionId: `session-${i}`,
        };
        await service.saveToLocal(session);
      }

      const backups = service.getBackupSessions();
      expect(backups).toHaveLength(3);
      
      // Should have the 3 most recent sessions
      expect(backups[0]?.sessionId).toBe('session-4');
      expect(backups[1]?.sessionId).toBe('session-3');
      expect(backups[2]?.sessionId).toBe('session-2');
    });

    test('should restore session from backup', async () => {
      await service.saveToLocal(mockSession);

      const restoredSession = await service.restoreFromBackup(0);
      expect(restoredSession).toBeDefined();
      expect(restoredSession!.sessionId).toBe('session-123');
    });

    test('should return null for invalid backup index', async () => {
      const restoredSession = await service.restoreFromBackup(5);
      expect(restoredSession).toBeNull();
    });
  });

  describe('Server Sync', () => {
    test('should save session to server successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.saveToServer(mockSession);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/sessions/save',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('session-123'),
        })
      );
    });

    test('should handle server save errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.saveToServer(mockSession);

      expect(result).toBe(false);
      
      const syncStatus = service.getSyncStatus();
      expect(syncStatus.syncError).toContain('Server responded with 500');
    });

    test('should load session from server successfully', async () => {
      const serverSession = {
        sessionId: 'server-session-123',
        playerId: 'test-player-123',
        gameState: mockSession,
        lastSaved: new Date().toISOString(),
        syncStatus: 'synced',
        deviceId: 'other-device',
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: serverSession 
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const loadedSession = await service.loadFromServer();

      expect(loadedSession).toBeDefined();
      expect(loadedSession!.sessionId).toBe('session-123');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/sessions/load?playerId=test-player-123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    test('should handle server load 404 gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const loadedSession = await service.loadFromServer();
      expect(loadedSession).toBeNull();
    });

    test('should not sync when server sync is disabled', async () => {
      const configWithoutSync = {
        ...config,
        enableServerSync: false,
      };
      const serviceWithoutSync = new SessionPersistenceService(configWithoutSync);

      const result = await serviceWithoutSync.saveToServer(mockSession);
      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();

      serviceWithoutSync.cleanup();
    });
  });

  describe('Cross-Device Sync', () => {
    test('should sync and return most recent session', async () => {
      const localSession = {
        ...mockSession,
        sessionId: 'local-session',
        lastActivity: new Date('2023-01-01T10:00:00Z'),
      };

      const serverSession = {
        ...mockSession,
        sessionId: 'server-session',
        lastActivity: new Date('2023-01-01T11:00:00Z'), // More recent
      };

      // Mock local storage
      await service.saveToLocal(localSession);

      // Mock server response
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: {
            sessionId: 'server-session',
            playerId: 'test-player-123',
            gameState: serverSession,
            lastSaved: new Date().toISOString(),
            syncStatus: 'synced',
            deviceId: 'other-device',
          }
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const syncedSession = await service.syncSession();

      expect(syncedSession).toBeDefined();
      expect(syncedSession!.sessionId).toBe('server-session'); // Should pick the more recent one
    });

    test('should handle sync with current session', async () => {
      const currentSession = {
        ...mockSession,
        sessionId: 'current-session',
        lastActivity: new Date('2023-01-01T12:00:00Z'), // Most recent
      };

      // Mock server response with older session
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: {
            sessionId: 'server-session',
            playerId: 'test-player-123',
            gameState: {
              ...mockSession,
              sessionId: 'server-session',
              lastActivity: new Date('2023-01-01T10:00:00Z'),
            },
            lastSaved: new Date().toISOString(),
            syncStatus: 'synced',
            deviceId: 'other-device',
          }
        }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const syncedSession = await service.syncSession(currentSession);

      expect(syncedSession).toBeDefined();
      expect(syncedSession!.sessionId).toBe('current-session'); // Should keep the current one
    });
  });

  describe('Network Handling', () => {
    test('should setup network event listeners', () => {
      // The listeners are set up in the constructor
      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    test('should not sync when offline', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      const serviceOffline = new SessionPersistenceService(config);
      
      const loadedSession = await serviceOffline.loadFromServer();
      expect(loadedSession).toBeNull();
      expect(fetch).not.toHaveBeenCalled();

      serviceOffline.cleanup();
    });

    test('should force sync when requested', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Ensure we're online
      Object.defineProperty(navigator, 'onLine', { value: true });

      await service.initialize();
      const result = await service.forceSync(mockSession);
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalled();
    });

    test('should not force sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      const serviceOffline = new SessionPersistenceService(config);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await serviceOffline.forceSync(mockSession);
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Cannot force sync while offline');

      consoleSpy.mockRestore();
      serviceOffline.cleanup();
    });
  });

  describe('Data Management', () => {
    test('should clear all data', async () => {
      // Save some data first
      await service.saveToLocal(mockSession);
      
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Ensure we're online for server clear
      Object.defineProperty(navigator, 'onLine', { value: true });

      await service.initialize();
      await service.clearAllData();

      // Check local storage is cleared
      const savedData = localStorageMock.getItem('gameSession_test-player-123');
      expect(savedData).toBeNull();

      // Check server clear was called
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/sessions/clear',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    test('should get sync status', () => {
      const status = service.getSyncStatus();
      
      expect(status).toHaveProperty('lastLocalSave');
      expect(status).toHaveProperty('lastServerSync');
      expect(status).toHaveProperty('pendingSync');
      expect(status).toHaveProperty('syncError');
      expect(status).toHaveProperty('retryCount');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', () => {
      service.cleanup();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});