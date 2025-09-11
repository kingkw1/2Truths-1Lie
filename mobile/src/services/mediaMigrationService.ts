/**
 * Mobile Media Migration Service
 * Handles migration of legacy blob URLs and local media references to persistent server URLs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { MediaCapture } from '../types';
import { videoUploadService } from './uploadService';
import { crossDeviceMediaService } from './crossDeviceMediaService';

export interface MigrationResult {
  totalItems: number;
  migrated: number;
  failed: number;
  skipped: number;
  results: Array<{
    id: string;
    status: 'migrated' | 'failed' | 'skipped' | 'no_migration_needed';
    originalUrl?: string;
    newUrl?: string;
    error?: string;
  }>;
}

export interface LegacyMediaItem {
  id: string;
  url: string;
  type: 'video' | 'audio';
  duration?: number;
  fileSize?: number;
  createdAt?: string;
  challengeId?: string;
  statementIndex?: number;
}

export class MediaMigrationService {
  private static instance: MediaMigrationService;
  private readonly STORAGE_KEYS = {
    LEGACY_MEDIA: 'legacy_media_items',
    MIGRATION_STATUS: 'migration_status',
    CHALLENGE_MEDIA: 'challenge_media_cache',
  };

  private constructor() {}

  public static getInstance(): MediaMigrationService {
    if (!MediaMigrationService.instance) {
      MediaMigrationService.instance = new MediaMigrationService();
    }
    return MediaMigrationService.instance;
  }

  /**
   * Discover legacy media items that need migration
   */
  public async discoverLegacyMedia(): Promise<LegacyMediaItem[]> {
    const legacyItems: LegacyMediaItem[] = [];

    try {
      // Check AsyncStorage for cached challenge data with blob URLs
      const challengeKeys = await AsyncStorage.getAllKeys();
      const challengeDataKeys = challengeKeys.filter(key => 
        key.startsWith('challenge_') || 
        key.startsWith('draft_challenge_') ||
        key.startsWith('media_cache_')
      );

      for (const key of challengeDataKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            const mediaItems = this.extractLegacyMediaFromData(parsedData, key);
            legacyItems.push(...mediaItems);
          }
        } catch (error) {
          console.warn(`Failed to parse data for key ${key}:`, error);
        }
      }

      // Check local file system for temporary media files
      const localMediaItems = await this.discoverLocalMediaFiles();
      legacyItems.push(...localMediaItems);

      console.log(`📱 Discovered ${legacyItems.length} legacy media items for migration`);
      return legacyItems;

    } catch (error) {
      console.error('Failed to discover legacy media:', error);
      return [];
    }
  }

  /**
   * Extract legacy media items from stored data
   */
  private extractLegacyMediaFromData(data: any, sourceKey: string): LegacyMediaItem[] {
    const items: LegacyMediaItem[] = [];

    try {
      // Check for mediaData array in challenge data
      if (data.mediaData && Array.isArray(data.mediaData)) {
        data.mediaData.forEach((media: any, index: number) => {
          if (this.isLegacyMediaUrl(media.url)) {
            items.push({
              id: `${sourceKey}_media_${index}`,
              url: media.url,
              type: media.type || 'video',
              duration: media.duration,
              fileSize: media.fileSize,
              createdAt: media.createdAt || new Date().toISOString(),
              challengeId: data.challengeId || sourceKey,
              statementIndex: index,
            });
          }
        });
      }

      // Check for individual media items
      if (data.url && this.isLegacyMediaUrl(data.url)) {
        items.push({
          id: sourceKey,
          url: data.url,
          type: data.type || 'video',
          duration: data.duration,
          fileSize: data.fileSize,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      }

      // Check nested objects recursively
      if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach(key => {
          if (typeof data[key] === 'object') {
            const nestedItems = this.extractLegacyMediaFromData(data[key], `${sourceKey}_${key}`);
            items.push(...nestedItems);
          }
        });
      }

    } catch (error) {
      console.warn(`Failed to extract media from data:`, error);
    }

    return items;
  }

  /**
   * Discover local media files that need migration
   */
  private async discoverLocalMediaFiles(): Promise<LegacyMediaItem[]> {
    const items: LegacyMediaItem[] = [];

    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return items;

      const files = await FileSystem.readDirectoryAsync(documentDir);
      
      for (const filename of files) {
        if (this.isMediaFile(filename)) {
          const filePath = `${documentDir}${filename}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists && 'size' in fileInfo) {
            items.push({
              id: `local_file_${filename}`,
              url: filePath,
              type: this.getMediaTypeFromFilename(filename),
              fileSize: fileInfo.size,
              createdAt: fileInfo.modificationTime ? new Date(fileInfo.modificationTime).toISOString() : new Date().toISOString(),
            });
          }
        }
      }

    } catch (error) {
      console.warn('Failed to discover local media files:', error);
    }

    return items;
  }

  /**
   * Check if a URL is a legacy format that needs migration
   */
  private isLegacyMediaUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;

    return (
      url.startsWith('blob:') ||
      url.startsWith('file://') ||
      url.startsWith('/api/v1/files/') ||
      url.includes('localhost') ||
      url.includes('127.0.0.1') ||
      (url.startsWith(FileSystem.documentDirectory || '') && !url.includes('/api/'))
    );
  }

  /**
   * Check if a filename represents a media file
   */
  private isMediaFile(filename: string): boolean {
    const mediaExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v', '.mp3', '.wav', '.m4a'];
    return mediaExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  /**
   * Get media type from filename
   */
  private getMediaTypeFromFilename(filename: string): 'video' | 'audio' {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v'];
    const audioExtensions = ['.mp3', '.wav', '.m4a'];
    
    const lowerFilename = filename.toLowerCase();
    
    if (videoExtensions.some(ext => lowerFilename.endsWith(ext))) {
      return 'video';
    } else if (audioExtensions.some(ext => lowerFilename.endsWith(ext))) {
      return 'audio';
    }
    
    return 'video'; // Default to video
  }

  /**
   * Migrate a single legacy media item
   */
  public async migrateLegacyMediaItem(
    item: LegacyMediaItem,
    userId: string,
    dryRun: boolean = false
  ): Promise<{
    id: string;
    status: 'migrated' | 'failed' | 'skipped' | 'no_migration_needed';
    originalUrl?: string;
    newUrl?: string;
    error?: string;
  }> {
    try {
      // Check if item needs migration
      if (!this.isLegacyMediaUrl(item.url)) {
        return {
          id: item.id,
          status: 'no_migration_needed',
          originalUrl: item.url,
        };
      }

      if (dryRun) {
        console.log(`🔍 DRY RUN: Would migrate ${item.id} from ${item.url}`);
        return {
          id: item.id,
          status: 'skipped',
          originalUrl: item.url,
        };
      }

      // Check if file exists locally
      if (item.url.startsWith('file://') || item.url.startsWith(FileSystem.documentDirectory || '')) {
        const fileInfo = await FileSystem.getInfoAsync(item.url);
        if (!fileInfo.exists) {
          return {
            id: item.id,
            status: 'failed',
            originalUrl: item.url,
            error: 'Local file no longer exists',
          };
        }
      }

      // For blob URLs, we can't migrate them directly as they're temporary
      if (item.url.startsWith('blob:')) {
        return {
          id: item.id,
          status: 'failed',
          originalUrl: item.url,
          error: 'Blob URLs cannot be migrated (temporary references)',
        };
      }

      // Upload local file to server
      if (item.url.startsWith('file://') || item.url.startsWith(FileSystem.documentDirectory || '')) {
        try {
          const filename = `migrated_${Date.now()}_${item.id.replace(/[^a-zA-Z0-9]/g, '_')}.${item.type === 'video' ? 'mp4' : 'mp3'}`;
          
          const uploadResult = await videoUploadService.uploadVideo(
            item.url,
            filename,
            (item.duration || 0) / 1000, // Convert to seconds
            {
              chunkSize: 1024 * 1024,
              maxFileSize: 50 * 1024 * 1024, // 50MB
              retryAttempts: 3,
            }
          );

          if (uploadResult.success && uploadResult.streamingUrl) {
            // Update stored references
            await this.updateStoredReferences(item, uploadResult.streamingUrl);
            
            return {
              id: item.id,
              status: 'migrated',
              originalUrl: item.url,
              newUrl: uploadResult.streamingUrl,
            };
          } else {
            return {
              id: item.id,
              status: 'failed',
              originalUrl: item.url,
              error: uploadResult.error || 'Upload failed',
            };
          }
        } catch (uploadError: any) {
          return {
            id: item.id,
            status: 'failed',
            originalUrl: item.url,
            error: `Upload failed: ${uploadError.message}`,
          };
        }
      }

      // For other legacy URLs, try to resolve them through the backend
      try {
        const resolvedUrl = await this.resolveServerUrl(item.url, userId);
        if (resolvedUrl) {
          await this.updateStoredReferences(item, resolvedUrl);
          return {
            id: item.id,
            status: 'migrated',
            originalUrl: item.url,
            newUrl: resolvedUrl,
          };
        } else {
          return {
            id: item.id,
            status: 'failed',
            originalUrl: item.url,
            error: 'Could not resolve server URL',
          };
        }
      } catch (resolveError: any) {
        return {
          id: item.id,
          status: 'failed',
          originalUrl: item.url,
          error: `URL resolution failed: ${resolveError.message}`,
        };
      }

    } catch (error: any) {
      return {
        id: item.id,
        status: 'failed',
        originalUrl: item.url,
        error: error.message,
      };
    }
  }

  /**
   * Resolve a legacy server URL to a current persistent URL
   */
  private async resolveServerUrl(legacyUrl: string, userId: string): Promise<string | null> {
    try {
      // Extract media ID from legacy URL patterns
      let mediaId: string | null = null;
      
      if (legacyUrl.includes('/api/v1/files/')) {
        // Extract from /api/v1/files/{mediaId}_{filename}
        const match = legacyUrl.match(/\/api\/v1\/files\/([^_]+)_/);
        mediaId = match ? match[1] : null;
      } else if (legacyUrl.includes('/media/')) {
        // Extract from other media URL patterns
        const match = legacyUrl.match(/\/media\/([^\/]+)/);
        mediaId = match ? match[1] : null;
      }

      if (!mediaId) {
        return null;
      }

      // Try to get current streaming URL from cross-device service
      const streamingUrl = await crossDeviceMediaService.getOptimizedStreamingUrl(mediaId);
      return streamingUrl;

    } catch (error) {
      console.warn('Failed to resolve server URL:', error);
      return null;
    }
  }

  /**
   * Update stored references to use new URL
   */
  private async updateStoredReferences(item: LegacyMediaItem, newUrl: string): Promise<void> {
    try {
      // Update AsyncStorage items that reference this media
      const keys = await AsyncStorage.getAllKeys();
      
      for (const key of keys) {
        if (key.startsWith('challenge_') || key.startsWith('draft_challenge_') || key.startsWith('media_cache_')) {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const parsedData = JSON.parse(data);
              let updated = false;

              // Update mediaData arrays
              if (parsedData.mediaData && Array.isArray(parsedData.mediaData)) {
                parsedData.mediaData.forEach((media: any, index: number) => {
                  if (media.url === item.url) {
                    media.url = newUrl;
                    media.streamingUrl = newUrl;
                    media.isUploaded = true;
                    updated = true;
                  }
                });
              }

              // Update individual media items
              if (parsedData.url === item.url) {
                parsedData.url = newUrl;
                parsedData.streamingUrl = newUrl;
                parsedData.isUploaded = true;
                updated = true;
              }

              if (updated) {
                await AsyncStorage.setItem(key, JSON.stringify(parsedData));
                console.log(`📱 Updated stored reference in ${key}`);
              }
            }
          } catch (error) {
            console.warn(`Failed to update stored reference in ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to update stored references:', error);
    }
  }

  /**
   * Migrate all legacy media items
   */
  public async migrateAllLegacyMedia(
    userId: string,
    dryRun: boolean = false,
    batchSize: number = 5
  ): Promise<MigrationResult> {
    console.log(`📱 Starting mobile media migration (dryRun=${dryRun})`);

    try {
      // Discover legacy media items
      const legacyItems = await this.discoverLegacyMedia();

      if (legacyItems.length === 0) {
        console.log('📱 No legacy media items found for migration');
        return {
          totalItems: 0,
          migrated: 0,
          failed: 0,
          skipped: 0,
          results: [],
        };
      }

      const results: MigrationResult['results'] = [];
      let migrated = 0;
      let failed = 0;
      let skipped = 0;

      // Process items in batches
      for (let i = 0; i < legacyItems.length; i += batchSize) {
        const batch = legacyItems.slice(i, i + batchSize);
        console.log(`📱 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(legacyItems.length / batchSize)}`);

        const batchPromises = batch.map(item => 
          this.migrateLegacyMediaItem(item, userId, dryRun)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
            
            switch (result.value.status) {
              case 'migrated':
                migrated++;
                break;
              case 'failed':
                failed++;
                break;
              case 'skipped':
              case 'no_migration_needed':
                skipped++;
                break;
            }
          } else {
            failed++;
            results.push({
              id: 'unknown',
              status: 'failed',
              error: result.reason?.message || 'Unknown error',
            });
          }
        }

        // Small delay between batches
        if (i + batchSize < legacyItems.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Save migration status
      const migrationStatus = {
        lastMigration: new Date().toISOString(),
        totalItems: legacyItems.length,
        migrated,
        failed,
        skipped,
        dryRun,
      };

      await AsyncStorage.setItem(this.STORAGE_KEYS.MIGRATION_STATUS, JSON.stringify(migrationStatus));

      const finalResult: MigrationResult = {
        totalItems: legacyItems.length,
        migrated,
        failed,
        skipped,
        results,
      };

      console.log('📱 Mobile media migration completed:', finalResult);
      return finalResult;

    } catch (error: any) {
      console.error('📱 Mobile media migration failed:', error);
      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Get migration status
   */
  public async getMigrationStatus(): Promise<{
    lastMigration?: string;
    totalItems: number;
    migrated: number;
    failed: number;
    skipped: number;
    dryRun?: boolean;
  } | null> {
    try {
      const statusData = await AsyncStorage.getItem(this.STORAGE_KEYS.MIGRATION_STATUS);
      return statusData ? JSON.parse(statusData) : null;
    } catch (error) {
      console.warn('Failed to get migration status:', error);
      return null;
    }
  }

  /**
   * Clear migration status
   */
  public async clearMigrationStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEYS.MIGRATION_STATUS);
    } catch (error) {
      console.warn('Failed to clear migration status:', error);
    }
  }

  /**
   * Clean up migrated local files
   */
  public async cleanupMigratedFiles(migrationResults: MigrationResult): Promise<void> {
    console.log('📱 Cleaning up migrated local files...');

    let cleanedCount = 0;

    for (const result of migrationResults.results) {
      if (result.status === 'migrated' && result.originalUrl) {
        try {
          // Only delete local files, not blob URLs or server URLs
          if (result.originalUrl.startsWith('file://') || 
              result.originalUrl.startsWith(FileSystem.documentDirectory || '')) {
            
            const fileInfo = await FileSystem.getInfoAsync(result.originalUrl);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(result.originalUrl, { idempotent: true });
              cleanedCount++;
              console.log(`🗑️ Cleaned up migrated file: ${result.originalUrl}`);
            }
          }
        } catch (error) {
          console.warn(`Failed to cleanup file ${result.originalUrl}:`, error);
        }
      }
    }

    console.log(`📱 Cleaned up ${cleanedCount} migrated files`);
  }

  /**
   * Verify migration results
   */
  public async verifyMigration(): Promise<{
    totalStoredItems: number;
    legacyItems: number;
    migratedItems: number;
    verificationPassed: boolean;
  }> {
    try {
      const currentLegacyItems = await this.discoverLegacyMedia();
      const migrationStatus = await this.getMigrationStatus();

      const verification = {
        totalStoredItems: migrationStatus?.totalItems || 0,
        legacyItems: currentLegacyItems.length,
        migratedItems: migrationStatus?.migrated || 0,
        verificationPassed: currentLegacyItems.length === 0,
      };

      console.log('📱 Migration verification:', verification);
      return verification;

    } catch (error) {
      console.error('Failed to verify migration:', error);
      return {
        totalStoredItems: 0,
        legacyItems: -1,
        migratedItems: 0,
        verificationPassed: false,
      };
    }
  }
}

// Export singleton instance
export const mediaMigrationService = MediaMigrationService.getInstance();