/**
 * Session Persistence Service
 * Handles local and server-side session persistence with sync capabilities
 * 
 * Relates to Requirements:
 * - Req 6: Auto-Save and Cross-Device Sync
 * - Req 1: Intuitive Core Game Loop (session continuity)
 */

import { GameSession, SessionPersistence, ApiResponse } from '../types/game';

export interface PersistenceConfig {
  playerId: string;
  serverUrl?: string;
  enableServerSync?: boolean;
  syncInterval?: number; // milliseconds
  maxRetries?: number;
  retryDelay?: number; // milliseconds
}

export interface SyncStatus {
  lastLocalSave: Date | null;
  lastServerSync: Date | null;
  pendingSync: boolean;
  syncError: string | null;
  retryCount: number;
}

export interface SessionBackup {
  sessionId: string;
  playerId: string;
  gameState: GameSession;
  timestamp: Date;
  deviceId: string;
  version: number;
}

/**
 * Manages session persistence across local storage and server
 */
export class SessionPersistenceService {
  private config: PersistenceConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private syncStatus: SyncStatus;
  private isOnline: boolean = navigator.onLine;

  constructor(config: PersistenceConfig) {
    this.config = {
      enableServerSync: true,
      syncInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      ...config,
    };

    this.syncStatus = {
      lastLocalSave: null,
      lastServerSync: null,
      pendingSync: false,
      syncError: null,
      retryCount: 0,
    };

    this.setupNetworkListeners();
  }

  /**
   * Initialize the persistence service
   */
  async initialize(): Promise<void> {
    if (this.config.enableServerSync && this.config.serverUrl) {
      this.startSyncTimer();
    }
  }

  /**
   * Save session to local storage
   */
  async saveToLocal(session: GameSession): Promise<void> {
    try {
      const deviceId = this.getDeviceId();
      const persistenceData: SessionPersistence = {
        sessionId: session.sessionId,
        playerId: this.config.playerId,
        gameState: { ...session },
        lastSaved: new Date(),
        syncStatus: this.syncStatus.lastServerSync ? 'synced' : 'pending',
        deviceId,
      };

      const key = this.getLocalStorageKey();
      localStorage.setItem(key, JSON.stringify(persistenceData));
      
      // Also save to backup slots (keep last 3 sessions)
      this.saveToBackupSlot(session, deviceId);
      
      this.syncStatus.lastLocalSave = new Date();
      
      // Trigger server sync if enabled and online
      if (this.config.enableServerSync && this.isOnline) {
        this.scheduleServerSync(session);
      }
    } catch (error) {
      console.error('Failed to save session to local storage:', error);
      throw new Error(`Local save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load session from local storage
   */
  async loadFromLocal(): Promise<GameSession | null> {
    try {
      const key = this.getLocalStorageKey();
      const savedData = localStorage.getItem(key);
      
      if (!savedData) {
        return null;
      }

      const persistenceData: SessionPersistence = JSON.parse(savedData);
      
      // Validate session data
      if (!this.isValidSessionData(persistenceData)) {
        console.warn('Invalid session data found, clearing local storage');
        localStorage.removeItem(key);
        return null;
      }

      // Check if session is recent (within last 4 hours)
      const lastSaved = new Date(persistenceData.lastSaved);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      if (lastSaved < fourHoursAgo || !persistenceData.gameState.isActive) {
        console.log('Session too old or inactive, not restoring');
        return null;
      }

      // Convert date strings back to Date objects
      const session: GameSession = {
        ...persistenceData.gameState,
        startTime: new Date(persistenceData.gameState.startTime),
        lastActivity: new Date(persistenceData.gameState.lastActivity),
      };

      this.syncStatus.lastLocalSave = lastSaved;
      
      return session;
    } catch (error) {
      console.error('Failed to load session from local storage:', error);
      return null;
    }
  }

  /**
   * Save session to server
   */
  async saveToServer(session: GameSession): Promise<boolean> {
    if (!this.config.serverUrl || !this.config.enableServerSync) {
      return false;
    }

    try {
      this.syncStatus.pendingSync = true;
      this.syncStatus.syncError = null;

      const payload = {
        sessionId: session.sessionId,
        playerId: this.config.playerId,
        gameState: session,
        deviceId: this.getDeviceId(),
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(`${this.config.serverUrl}/api/sessions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<any> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Server save failed');
      }

      this.syncStatus.lastServerSync = new Date();
      this.syncStatus.pendingSync = false;
      this.syncStatus.retryCount = 0;
      
      // Update local storage sync status
      this.updateLocalSyncStatus('synced');
      
      return true;
    } catch (error) {
      console.error('Failed to save session to server:', error);
      this.syncStatus.pendingSync = false;
      this.syncStatus.syncError = error instanceof Error ? error.message : 'Unknown error';
      
      // Schedule retry if we haven't exceeded max retries
      if (this.syncStatus.retryCount < (this.config.maxRetries || 3)) {
        this.scheduleRetry(session);
      }
      
      return false;
    }
  }

  /**
   * Load session from server
   */
  async loadFromServer(): Promise<GameSession | null> {
    if (!this.config.serverUrl || !this.config.enableServerSync || !this.isOnline) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.config.serverUrl}/api/sessions/load?playerId=${this.config.playerId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No session found on server
          return null;
        }
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result: ApiResponse<SessionPersistence> = await response.json();
      
      if (!result.success || !result.data) {
        return null;
      }

      const persistenceData = result.data;
      
      // Validate and convert session data
      if (!this.isValidSessionData(persistenceData)) {
        console.warn('Invalid session data from server');
        return null;
      }

      const session: GameSession = {
        ...persistenceData.gameState,
        startTime: new Date(persistenceData.gameState.startTime),
        lastActivity: new Date(persistenceData.gameState.lastActivity),
      };

      return session;
    } catch (error) {
      console.error('Failed to load session from server:', error);
      return null;
    }
  }

  /**
   * Sync session between local and server
   * Resolves conflicts by using the most recent version
   */
  async syncSession(currentSession?: GameSession): Promise<GameSession | null> {
    try {
      const [localSession, serverSession] = await Promise.all([
        this.loadFromLocal(),
        this.loadFromServer(),
      ]);

      // If we have a current session, include it in conflict resolution
      const sessions = [currentSession, localSession, serverSession].filter(Boolean) as GameSession[];
      
      if (sessions.length === 0) {
        return null;
      }

      // Find the most recent session based on lastActivity
      const mostRecentSession = sessions.reduce((latest, current) => {
        return current.lastActivity > latest.lastActivity ? current : latest;
      });

      // If the most recent session is different from current, save it everywhere
      if (currentSession && mostRecentSession.sessionId !== currentSession.sessionId) {
        await this.saveToLocal(mostRecentSession);
        if (this.isOnline) {
          await this.saveToServer(mostRecentSession);
        }
      }

      return mostRecentSession;
    } catch (error) {
      console.error('Failed to sync session:', error);
      return currentSession || null;
    }
  }

  /**
   * Get sync status information
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Force a sync operation
   */
  async forceSync(session: GameSession): Promise<boolean> {
    if (!navigator.onLine) {
      console.warn('Cannot force sync while offline');
      return false;
    }

    return await this.saveToServer(session);
  }

  /**
   * Clear all session data (local and server)
   */
  async clearAllData(): Promise<void> {
    // Clear local storage
    const key = this.getLocalStorageKey();
    localStorage.removeItem(key);
    
    // Clear backup slots
    for (let i = 0; i < 3; i++) {
      localStorage.removeItem(`${key}_backup_${i}`);
    }

    // Clear server data if online
    if (this.config.serverUrl && navigator.onLine) {
      try {
        await fetch(`${this.config.serverUrl}/api/sessions/clear`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ playerId: this.config.playerId }),
        });
      } catch (error) {
        console.error('Failed to clear server session data:', error);
      }
    }

    // Reset sync status
    this.syncStatus = {
      lastLocalSave: null,
      lastServerSync: null,
      pendingSync: false,
      syncError: null,
      retryCount: 0,
    };
  }

  /**
   * Get backup sessions from local storage
   */
  getBackupSessions(): SessionBackup[] {
    const backups: SessionBackup[] = [];
    const baseKey = this.getLocalStorageKey();
    
    for (let i = 0; i < 3; i++) {
      try {
        const backupData = localStorage.getItem(`${baseKey}_backup_${i}`);
        if (backupData) {
          const backup: SessionBackup = JSON.parse(backupData);
          backups.push(backup);
        }
      } catch (error) {
        console.error(`Failed to load backup session ${i}:`, error);
      }
    }
    
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Restore session from backup
   */
  async restoreFromBackup(backupIndex: number): Promise<GameSession | null> {
    const baseKey = this.getLocalStorageKey();
    
    try {
      const backupData = localStorage.getItem(`${baseKey}_backup_${backupIndex}`);
      if (!backupData) {
        return null;
      }

      const backup: SessionBackup = JSON.parse(backupData);
      
      // Convert to current session format
      const session: GameSession = {
        ...backup.gameState,
        startTime: new Date(backup.gameState.startTime),
        lastActivity: new Date(backup.gameState.lastActivity),
      };

      return session;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Remove network listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  // Private methods

  private getLocalStorageKey(): string {
    return `gameSession_${this.config.playerId}`;
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  private isValidSessionData(data: any): data is SessionPersistence {
    return (
      data &&
      typeof data.sessionId === 'string' &&
      typeof data.playerId === 'string' &&
      data.gameState &&
      typeof data.gameState.sessionId === 'string' &&
      data.lastSaved
    );
  }

  private saveToBackupSlot(session: GameSession, deviceId: string): void {
    try {
      const backup: SessionBackup = {
        sessionId: session.sessionId,
        playerId: this.config.playerId,
        gameState: { ...session },
        timestamp: new Date(),
        deviceId,
        version: 1,
      };

      const baseKey = this.getLocalStorageKey();
      
      // Shift existing backups
      for (let i = 2; i >= 0; i--) {
        const currentBackup = localStorage.getItem(`${baseKey}_backup_${i}`);
        if (currentBackup && i < 2) {
          localStorage.setItem(`${baseKey}_backup_${i + 1}`, currentBackup);
        }
      }
      
      // Save new backup in slot 0
      localStorage.setItem(`${baseKey}_backup_0`, JSON.stringify(backup));
    } catch (error) {
      console.error('Failed to save backup session:', error);
    }
  }

  private updateLocalSyncStatus(status: 'synced' | 'pending' | 'failed'): void {
    try {
      const key = this.getLocalStorageKey();
      const savedData = localStorage.getItem(key);
      
      if (savedData) {
        const persistenceData: SessionPersistence = JSON.parse(savedData);
        persistenceData.syncStatus = status;
        localStorage.setItem(key, JSON.stringify(persistenceData));
      }
    } catch (error) {
      console.error('Failed to update local sync status:', error);
    }
  }

  private scheduleServerSync(session: GameSession): void {
    // Debounce server sync to avoid too frequent calls
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    
    this.retryTimer = setTimeout(() => {
      this.saveToServer(session);
    }, 1000); // 1 second delay
  }

  private scheduleRetry(session: GameSession): void {
    this.syncStatus.retryCount++;
    
    const delay = this.config.retryDelay! * Math.pow(2, this.syncStatus.retryCount - 1); // Exponential backoff
    
    this.retryTimer = setTimeout(() => {
      this.saveToServer(session);
    }, delay);
  }

  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      // Periodic sync check - only sync if there are pending changes
      if (this.syncStatus.pendingSync && this.isOnline) {
        // This would need access to current session - handled by GameSessionManager
      }
    }, this.config.syncInterval);
  }

  private setupNetworkListeners(): void {
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    console.log('Network connection restored, enabling sync');
    
    // Reset retry count when coming back online
    this.syncStatus.retryCount = 0;
    this.syncStatus.syncError = null;
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    console.log('Network connection lost, disabling sync');
  };
}