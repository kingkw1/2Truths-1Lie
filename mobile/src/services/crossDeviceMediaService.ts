/**
 * Cross-Device Media Service
 * Handles media synchronization and accessibility across iOS/Android devices and multi-login scenarios
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { videoUploadService } from './uploadService';
import { authService } from './authService';

export interface CrossDeviceMediaItem {
  mediaId: string;
  filename: string;
  streamingUrl: string;
  fileSize: number;
  duration: number;
  uploadedAt: string;
  deviceInfo?: string;
  storageType: 'local' | 'cloud' | 'cloud_fallback';
  mimeType?: string;
  isAccessible: boolean;
  lastSyncedAt?: string;
}

export interface MediaSyncResult {
  syncedCount: number;
  newMediaCount: number;
  deletedCount: number;
  errors: string[];
  lastSyncAt: string;
}

export class CrossDeviceMediaService {
  private static instance: CrossDeviceMediaService;
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;

  private constructor() {}

  public static getInstance(): CrossDeviceMediaService {
    if (!CrossDeviceMediaService.instance) {
      CrossDeviceMediaService.instance = new CrossDeviceMediaService();
    }
    return CrossDeviceMediaService.instance;
  }

  /**
   * Initialize cross-device media service
   */
  public async initialize(): Promise<void> {
    try {
      // Load last sync time
      const lastSync = await AsyncStorage.getItem('lastMediaSync');
      if (lastSync) {
        this.lastSyncTime = new Date(lastSync);
      }

      // Note: We don't perform initial sync here anymore
      // Let authentication complete first, then sync will be triggered
      // by auth state changes in the middleware or components
      
      console.log('📱 Cross-device media service initialized');
    } catch (error) {
      console.error('Failed to initialize cross-device media service:', error);
    }
  }

  /**
   * Sync media library across devices
   */
  public async syncMediaLibrary(): Promise<MediaSyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    let syncedCount = 0;
    let newMediaCount = 0;
    let deletedCount = 0;

    try {
      console.log('🔄 Starting media library sync...');

      // Get local media IDs
      const localMediaIds = await this.getLocalMediaIds();

      // Sync with server
      const syncResult = await videoUploadService.syncMediaState(localMediaIds);

      // Process new media from server
      for (const newMedia of syncResult.newMedia) {
        try {
          await this.cacheMediaInfo(newMedia);
          newMediaCount++;
        } catch (error) {
          errors.push(`Failed to cache new media ${newMedia.mediaId}: ${error}`);
        }
      }

      // Process deleted media
      for (const deletedMediaId of syncResult.deletedMedia) {
        try {
          await this.removeLocalMediaInfo(deletedMediaId);
          deletedCount++;
        } catch (error) {
          errors.push(`Failed to remove deleted media ${deletedMediaId}: ${error}`);
        }
      }

      // Update synced media info
      for (const syncedMedia of syncResult.syncedMedia) {
        try {
          await this.updateLocalMediaInfo(syncedMedia);
          syncedCount++;
        } catch (error) {
          errors.push(`Failed to update synced media ${syncedMedia.mediaId}: ${error}`);
        }
      }

      // Update last sync time
      this.lastSyncTime = new Date();
      await AsyncStorage.setItem('lastMediaSync', this.lastSyncTime.toISOString());

      const result: MediaSyncResult = {
        syncedCount,
        newMediaCount,
        deletedCount,
        errors,
        lastSyncAt: this.lastSyncTime.toISOString(),
      };

      console.log('✅ Media sync completed:', result);
      return result;

    } catch (error: any) {
      errors.push(`Sync failed: ${error.message}`);
      throw new Error(`Media sync failed: ${error.message}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get user's complete media library
   */
  public async getMediaLibrary(page: number = 1, limit: number = 50): Promise<{
    media: CrossDeviceMediaItem[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // Get from server
      const serverLibrary = await videoUploadService.getUserMediaLibrary(page, limit);

      // Enhance with local accessibility info
      const enhancedMedia: CrossDeviceMediaItem[] = [];
      
      for (const item of serverLibrary.media) {
        const accessibility = await this.checkMediaAccessibility(item.mediaId);
        
        enhancedMedia.push({
          mediaId: item.mediaId,
          filename: item.filename,
          streamingUrl: item.streamingUrl,
          fileSize: item.fileSize,
          duration: item.duration,
          uploadedAt: item.uploadedAt,
          deviceInfo: item.deviceInfo,
          storageType: item.storageType as 'local' | 'cloud' | 'cloud_fallback',
          mimeType: this.inferMimeTypeFromFilename(item.filename),
          isAccessible: accessibility.accessible,
          lastSyncedAt: new Date().toISOString(),
        });
      }

      return {
        media: enhancedMedia,
        totalCount: serverLibrary.totalCount,
        hasMore: serverLibrary.hasMore,
      };

    } catch (error: any) {
      console.error('Failed to get media library:', error);
      
      // Fallback to local cache
      return this.getLocalMediaLibrary();
    }
  }

  /**
   * Verify media accessibility for current device
   */
  public async verifyMediaAccessibility(mediaId: string): Promise<{
    accessible: boolean;
    streamingUrl?: string;
    deviceCompatible: boolean;
    requiresAuth: boolean;
    expiresAt?: string;
    error?: string;
  }> {
    try {
      return await videoUploadService.verifyMediaAccess(mediaId);
    } catch (error: any) {
      console.error(`Media verification failed for ${mediaId}:`, error);
      return {
        accessible: false,
        deviceCompatible: false,
        requiresAuth: true,
        error: error.message,
      };
    }
  }

  /**
   * Get optimized streaming URL for current device
   */
  public async getOptimizedStreamingUrl(mediaId: string): Promise<string | null> {
    try {
      const verification = await this.verifyMediaAccessibility(mediaId);
      
      if (!verification.accessible) {
        throw new Error('Media not accessible');
      }

      if (!verification.deviceCompatible) {
        console.warn(`Media ${mediaId} may not be compatible with ${Platform.OS}`);
      }

      return verification.streamingUrl || null;

    } catch (error: any) {
      console.error(`Failed to get streaming URL for ${mediaId}:`, error);
      return null;
    }
  }

  /**
   * Check if device supports media format
   */
  public isFormatSupported(mimeType: string): boolean {
    const supportedFormats = Platform.select({
      ios: [
        'video/mp4',
        'video/quicktime',
        'video/x-m4v',
        'video/3gpp',
      ],
      android: [
        'video/mp4',
        'video/3gpp',
        'video/webm',
        'video/x-msvideo',
      ],
    }) || ['video/mp4'];

    return supportedFormats.includes(mimeType);
  }

  /**
   * Get device-specific media preferences
   */
  public getDeviceMediaPreferences(): {
    preferredFormat: string;
    maxResolution: string;
    supportsHardwareDecoding: boolean;
  } {
    return Platform.select({
      ios: {
        preferredFormat: 'video/mp4',
        maxResolution: '1920x1080',
        supportsHardwareDecoding: true,
      },
      android: {
        preferredFormat: 'video/mp4',
        maxResolution: '1920x1080',
        supportsHardwareDecoding: true,
      },
    }) || {
      preferredFormat: 'video/mp4',
      maxResolution: '1280x720',
      supportsHardwareDecoding: false,
    };
  }

  /**
   * Handle user login - sync media for new session
   */
  public async onUserLogin(): Promise<void> {
    try {
      console.log('👤 User logged in, syncing media...');
      await this.syncMediaLibrary();
    } catch (error) {
      console.error('Failed to sync media on login:', error);
    }
  }

  /**
   * Handle user logout - clear sensitive media cache
   */
  public async onUserLogout(): Promise<void> {
    try {
      console.log('👤 User logged out, clearing media cache...');
      await AsyncStorage.removeItem('mediaLibraryCache');
      await AsyncStorage.removeItem('lastMediaSync');
      this.lastSyncTime = null;
    } catch (error) {
      console.error('Failed to clear media cache on logout:', error);
    }
  }

  /**
   * Get local media IDs from cache
   */
  private async getLocalMediaIds(): Promise<string[]> {
    try {
      const cache = await AsyncStorage.getItem('mediaLibraryCache');
      if (cache) {
        const mediaLibrary = JSON.parse(cache);
        return mediaLibrary.map((item: any) => item.mediaId);
      }
      return [];
    } catch (error) {
      console.error('Failed to get local media IDs:', error);
      return [];
    }
  }

  /**
   * Cache media info locally
   */
  private async cacheMediaInfo(mediaInfo: any): Promise<void> {
    try {
      const cache = await AsyncStorage.getItem('mediaLibraryCache');
      let mediaLibrary = cache ? JSON.parse(cache) : [];

      // Add or update media info
      const existingIndex = mediaLibrary.findIndex((item: any) => item.mediaId === mediaInfo.mediaId);
      if (existingIndex >= 0) {
        mediaLibrary[existingIndex] = { ...mediaLibrary[existingIndex], ...mediaInfo };
      } else {
        mediaLibrary.push(mediaInfo);
      }

      await AsyncStorage.setItem('mediaLibraryCache', JSON.stringify(mediaLibrary));
    } catch (error) {
      console.error('Failed to cache media info:', error);
    }
  }

  /**
   * Remove local media info
   */
  private async removeLocalMediaInfo(mediaId: string): Promise<void> {
    try {
      const cache = await AsyncStorage.getItem('mediaLibraryCache');
      if (cache) {
        let mediaLibrary = JSON.parse(cache);
        mediaLibrary = mediaLibrary.filter((item: any) => item.mediaId !== mediaId);
        await AsyncStorage.setItem('mediaLibraryCache', JSON.stringify(mediaLibrary));
      }
    } catch (error) {
      console.error('Failed to remove local media info:', error);
    }
  }

  /**
   * Update local media info
   */
  private async updateLocalMediaInfo(mediaInfo: any): Promise<void> {
    await this.cacheMediaInfo(mediaInfo);
  }

  /**
   * Check media accessibility from local cache
   */
  private async checkMediaAccessibility(mediaId: string): Promise<{ accessible: boolean }> {
    try {
      // Simple check - in production, this would be more sophisticated
      const cache = await AsyncStorage.getItem('mediaLibraryCache');
      if (cache) {
        const mediaLibrary = JSON.parse(cache);
        const mediaItem = mediaLibrary.find((item: any) => item.mediaId === mediaId);
        return { accessible: !!mediaItem };
      }
      return { accessible: false };
    } catch (error) {
      return { accessible: false };
    }
  }

  /**
   * Get local media library as fallback
   */
  private async getLocalMediaLibrary(): Promise<{
    media: CrossDeviceMediaItem[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const cache = await AsyncStorage.getItem('mediaLibraryCache');
      if (cache) {
        const mediaLibrary = JSON.parse(cache);
        return {
          media: mediaLibrary,
          totalCount: mediaLibrary.length,
          hasMore: false,
        };
      }
    } catch (error) {
      console.error('Failed to get local media library:', error);
    }

    return {
      media: [],
      totalCount: 0,
      hasMore: false,
    };
  }

  /**
   * Get sync status
   */
  public getSyncStatus(): {
    lastSyncTime: Date | null;
    syncInProgress: boolean;
  } {
    return {
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Infer MIME type from filename
   */
  private inferMimeTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case '3gp':
        return 'video/3gpp';
      case 'webm':
        return 'video/webm';
      default:
        return 'video/mp4'; // Default fallback
    }
  }
}

// Export singleton instance
export const crossDeviceMediaService = CrossDeviceMediaService.getInstance();