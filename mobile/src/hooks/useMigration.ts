/**
 * React Hook for Mobile Media Migration
 * Provides migration functionality with React state management
 */

import { useState, useEffect, useCallback } from 'react';
import { mediaMigrationService, MigrationResult, LegacyMediaItem } from '../services/mediaMigrationService';
import { useAppSelector } from '../store/hooks';

export interface MigrationState {
  isDiscovering: boolean;
  isMigrating: boolean;
  isVerifying: boolean;
  legacyItems: LegacyMediaItem[];
  migrationResult: MigrationResult | null;
  migrationStatus: {
    lastMigration?: string;
    totalItems: number;
    migrated: number;
    failed: number;
    skipped: number;
    dryRun?: boolean;
  } | null;
  error: string | null;
  verificationResult: {
    totalStoredItems: number;
    legacyItems: number;
    migratedItems: number;
    verificationPassed: boolean;
  } | null;
}

export interface MigrationActions {
  discoverLegacyMedia: () => Promise<void>;
  runMigration: (options: {
    dryRun?: boolean;
    batchSize?: number;
    cleanup?: boolean;
  }) => Promise<boolean>;
  verifyMigration: () => Promise<boolean>;
  clearMigrationStatus: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useMigration(): MigrationState & MigrationActions {
  const [state, setState] = useState<MigrationState>({
    isDiscovering: false,
    isMigrating: false,
    isVerifying: false,
    legacyItems: [],
    migrationResult: null,
    migrationStatus: null,
    error: null,
    verificationResult: null,
  });

  // Get current user ID from auth state
  const userId = useAppSelector(state => state.auth?.user?.id || 'unknown');

  /**
   * Discover legacy media items
   */
  const discoverLegacyMedia = useCallback(async () => {
    setState(prev => ({ ...prev, isDiscovering: true, error: null }));

    try {
      const legacyItems = await mediaMigrationService.discoverLegacyMedia();
      setState(prev => ({
        ...prev,
        legacyItems,
        isDiscovering: false,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isDiscovering: false,
      }));
    }
  }, []);

  /**
   * Run migration
   */
  const runMigration = useCallback(async (options: {
    dryRun?: boolean;
    batchSize?: number;
    cleanup?: boolean;
  } = {}): Promise<boolean> => {
    const { dryRun = false, batchSize = 5, cleanup = false } = options;

    setState(prev => ({ ...prev, isMigrating: true, error: null }));

    try {
      const result = await mediaMigrationService.migrateAllLegacyMedia(
        userId,
        dryRun,
        batchSize
      );

      // Cleanup if requested and not dry run
      if (cleanup && !dryRun && result.migrated > 0) {
        await mediaMigrationService.cleanupMigratedFiles(result);
      }

      // Refresh status after migration
      const status = await mediaMigrationService.getMigrationStatus();

      setState(prev => ({
        ...prev,
        migrationResult: result,
        migrationStatus: status,
        isMigrating: false,
      }));

      // Refresh legacy items discovery
      await discoverLegacyMedia();

      return result.failed === 0;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isMigrating: false,
      }));
      return false;
    }
  }, [userId, discoverLegacyMedia]);

  /**
   * Verify migration
   */
  const verifyMigration = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));

    try {
      const verificationResult = await mediaMigrationService.verifyMigration();
      
      setState(prev => ({
        ...prev,
        verificationResult,
        isVerifying: false,
      }));

      return verificationResult.verificationPassed;

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isVerifying: false,
      }));
      return false;
    }
  }, []);

  /**
   * Clear migration status
   */
  const clearMigrationStatus = useCallback(async () => {
    try {
      await mediaMigrationService.clearMigrationStatus();
      setState(prev => ({
        ...prev,
        migrationStatus: null,
        migrationResult: null,
        verificationResult: null,
      }));
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, []);

  /**
   * Refresh migration status
   */
  const refreshStatus = useCallback(async () => {
    try {
      const [status, verification] = await Promise.all([
        mediaMigrationService.getMigrationStatus(),
        mediaMigrationService.verifyMigration(),
      ]);

      setState(prev => ({
        ...prev,
        migrationStatus: status,
        verificationResult: verification,
      }));

      // Also refresh legacy items
      await discoverLegacyMedia();

    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
    }
  }, [discoverLegacyMedia]);

  /**
   * Load initial status on mount
   */
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    ...state,
    discoverLegacyMedia,
    runMigration,
    verifyMigration,
    clearMigrationStatus,
    refreshStatus,
  };
}

/**
 * Hook for migration status only (lighter weight)
 */
export function useMigrationStatus() {
  const [status, setStatus] = useState<{
    hasLegacyItems: boolean;
    legacyCount: number;
    lastMigration?: string;
    migrationNeeded: boolean;
    loading: boolean;
    error: string | null;
  }>({
    hasLegacyItems: false,
    legacyCount: 0,
    migrationNeeded: false,
    loading: true,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    setStatus(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [legacyItems, migrationStatus] = await Promise.all([
        mediaMigrationService.discoverLegacyMedia(),
        mediaMigrationService.getMigrationStatus(),
      ]);

      setStatus({
        hasLegacyItems: legacyItems.length > 0,
        legacyCount: legacyItems.length,
        lastMigration: migrationStatus?.lastMigration,
        migrationNeeded: legacyItems.length > 0,
        loading: false,
        error: null,
      });

    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message,
      }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    ...status,
    refresh: checkStatus,
  };
}

/**
 * Hook for automatic migration on app startup
 */
export function useAutoMigration(options: {
  enabled?: boolean;
  dryRunFirst?: boolean;
  autoCleanup?: boolean;
} = {}) {
  const { enabled = true, dryRunFirst = true, autoCleanup = false } = options;
  const [autoMigrationState, setAutoMigrationState] = useState<{
    hasRun: boolean;
    isRunning: boolean;
    success: boolean | null;
    error: string | null;
  }>({
    hasRun: false,
    isRunning: false,
    success: null,
    error: null,
  });

  const userId = useAppSelector(state => state.auth?.user?.id || 'unknown');

  const runAutoMigration = useCallback(async () => {
    if (!enabled || autoMigrationState.hasRun || autoMigrationState.isRunning) {
      return;
    }

    setAutoMigrationState(prev => ({ ...prev, isRunning: true }));

    try {
      // Check if migration is needed
      const legacyItems = await mediaMigrationService.discoverLegacyMedia();
      
      if (legacyItems.length === 0) {
        setAutoMigrationState({
          hasRun: true,
          isRunning: false,
          success: true,
          error: null,
        });
        return;
      }

      console.log(`📱 Auto-migration: Found ${legacyItems.length} legacy items`);

      // Run dry run first if requested
      if (dryRunFirst) {
        console.log('📱 Auto-migration: Running dry run first...');
        await mediaMigrationService.migrateAllLegacyMedia(userId, true, 3);
      }

      // Run actual migration
      console.log('📱 Auto-migration: Running actual migration...');
      const result = await mediaMigrationService.migrateAllLegacyMedia(
        userId,
        false,
        3
      );

      // Cleanup if requested
      if (autoCleanup && result.migrated > 0) {
        console.log('📱 Auto-migration: Cleaning up migrated files...');
        await mediaMigrationService.cleanupMigratedFiles(result);
      }

      const success = result.failed === 0;
      
      setAutoMigrationState({
        hasRun: true,
        isRunning: false,
        success,
        error: success ? null : `${result.failed} items failed to migrate`,
      });

      console.log(`📱 Auto-migration completed: ${result.migrated} migrated, ${result.failed} failed`);

    } catch (error: any) {
      setAutoMigrationState({
        hasRun: true,
        isRunning: false,
        success: false,
        error: error.message,
      });
      console.error('📱 Auto-migration failed:', error);
    }
  }, [enabled, autoMigrationState.hasRun, autoMigrationState.isRunning, dryRunFirst, autoCleanup, userId]);

  useEffect(() => {
    // Run auto-migration after a short delay to allow app to initialize
    const timer = setTimeout(runAutoMigration, 2000);
    return () => clearTimeout(timer);
  }, [runAutoMigration]);

  return autoMigrationState;
}