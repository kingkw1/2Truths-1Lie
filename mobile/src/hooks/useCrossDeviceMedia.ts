/**
 * Cross-Device Media Hook
 * React hook for managing media accessibility across iOS/Android and multi-login scenarios
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { crossDeviceMediaService, CrossDeviceMediaItem, MediaSyncResult } from '../services/crossDeviceMediaService';
import { authService } from '../services/authService';

export interface UseCrossDeviceMediaReturn {
  // Media library state
  mediaLibrary: CrossDeviceMediaItem[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;

  // Sync state
  syncStatus: {
    lastSyncTime: Date | null;
    syncInProgress: boolean;
  };
  lastSyncResult: MediaSyncResult | null;

  // Actions
  loadMediaLibrary: (page?: number, limit?: number) => Promise<void>;
  syncMediaLibrary: () => Promise<MediaSyncResult>;
  verifyMediaAccess: (mediaId: string) => Promise<{
    accessible: boolean;
    streamingUrl?: string;
    deviceCompatible: boolean;
    error?: string;
  }>;
  getOptimizedStreamingUrl: (mediaId: string) => Promise<string | null>;
  refreshLibrary: () => Promise<void>;

  // Device compatibility
  isFormatSupported: (mimeType: string) => boolean;
  devicePreferences: {
    preferredFormat: string;
    maxResolution: string;
    supportsHardwareDecoding: boolean;
  };
}

export const useCrossDeviceMedia = (): UseCrossDeviceMediaReturn => {
  // State
  const [mediaLibrary, setMediaLibrary] = useState<CrossDeviceMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<MediaSyncResult | null>(null);

  // Get sync status
  const syncStatus = crossDeviceMediaService.getSyncStatus();

  // Load media library
  const loadMediaLibrary = useCallback(async (page: number = 1, limit: number = 50) => {
    if (!authService.isAuthenticated()) {
      setError('User not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await crossDeviceMediaService.getMediaLibrary(page, limit);
      
      if (page === 1) {
        setMediaLibrary(result.media);
      } else {
        setMediaLibrary(prev => [...prev, ...result.media]);
      }
      
      setHasMore(result.hasMore);
      setTotalCount(result.totalCount);

    } catch (err: any) {
      setError(err.message || 'Failed to load media library');
      console.error('Failed to load media library:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync media library
  const syncMediaLibrary = useCallback(async (): Promise<MediaSyncResult> => {
    if (!authService.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    setError(null);

    try {
      const result = await crossDeviceMediaService.syncMediaLibrary();
      setLastSyncResult(result);
      
      // Refresh library after sync
      await loadMediaLibrary(1, 50);
      
      return result;

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sync media library';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [loadMediaLibrary]);

  // Verify media access
  const verifyMediaAccess = useCallback(async (mediaId: string) => {
    try {
      return await crossDeviceMediaService.verifyMediaAccessibility(mediaId);
    } catch (err: any) {
      return {
        accessible: false,
        deviceCompatible: false,
        error: err.message || 'Failed to verify media access',
      };
    }
  }, []);

  // Get optimized streaming URL
  const getOptimizedStreamingUrl = useCallback(async (mediaId: string): Promise<string | null> => {
    try {
      return await crossDeviceMediaService.getOptimizedStreamingUrl(mediaId);
    } catch (err: any) {
      console.error(`Failed to get streaming URL for ${mediaId}:`, err);
      return null;
    }
  }, []);

  // Refresh library
  const refreshLibrary = useCallback(async () => {
    await loadMediaLibrary(1, 50);
  }, [loadMediaLibrary]);

  // Check format support
  const isFormatSupported = useCallback((mimeType: string): boolean => {
    return crossDeviceMediaService.isFormatSupported(mimeType);
  }, []);

  // Get device preferences
  const devicePreferences = crossDeviceMediaService.getDeviceMediaPreferences();

  // Initialize on mount
  useEffect(() => {
    if (authService.isAuthenticated()) {
      loadMediaLibrary(1, 50);
    }
  }, [loadMediaLibrary]);

  // Handle authentication changes
  useEffect(() => {
    const handleAuthChange = async () => {
      if (authService.isAuthenticated()) {
        await crossDeviceMediaService.onUserLogin();
        await loadMediaLibrary(1, 50);
      } else {
        await crossDeviceMediaService.onUserLogout();
        setMediaLibrary([]);
        setTotalCount(0);
        setHasMore(false);
        setLastSyncResult(null);
      }
    };

    // In a real app, you'd listen to auth state changes
    // For now, we'll just check on component mount
    handleAuthChange();
  }, [loadMediaLibrary]);

  return {
    // State
    mediaLibrary,
    isLoading,
    error,
    hasMore,
    totalCount,
    syncStatus,
    lastSyncResult,

    // Actions
    loadMediaLibrary,
    syncMediaLibrary,
    verifyMediaAccess,
    getOptimizedStreamingUrl,
    refreshLibrary,

    // Device compatibility
    isFormatSupported,
    devicePreferences,
  };
};

export default useCrossDeviceMedia;