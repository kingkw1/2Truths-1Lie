/**
 * Tests for Mobile Media Migration Service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { MediaMigrationService, LegacyMediaItem } from '../mediaMigrationService';
import { videoUploadService } from '../uploadService';
import { crossDeviceMediaService } from '../crossDeviceMediaService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-file-system');
jest.mock('../uploadService');
jest.mock('../crossDeviceMediaService');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockUploadService = videoUploadService as jest.Mocked<typeof videoUploadService>;
const mockCrossDeviceService = crossDeviceMediaService as jest.Mocked<typeof crossDeviceMediaService>;

describe('MediaMigrationService', () => {
  let migrationService: MediaMigrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    migrationService = MediaMigrationService.getInstance();
    
    // Setup default mocks
    Object.defineProperty(mockFileSystem, 'documentDirectory', {
      value: 'file:///documents/',
      writable: true,
      configurable: true,
    });
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
  });

  describe('discoverLegacyMedia', () => {
    it('should discover legacy blob URLs in AsyncStorage', async () => {
      // Setup mock data with legacy blob URLs
      const challengeData = {
        challengeId: 'test-challenge',
        mediaData: [
          {
            type: 'video',
            url: 'blob:http://localhost:3000/abc123',
            duration: 5000,
            fileSize: 1024000,
          },
          {
            type: 'video',
            url: 'https://server.com/api/media/stream/media-123', // Not legacy
            duration: 3000,
          },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test', 'other_key']);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'challenge_test') {
          return Promise.resolve(JSON.stringify(challengeData));
        }
        return Promise.resolve(null);
      });

      const legacyItems = await migrationService.discoverLegacyMedia();

      expect(legacyItems).toHaveLength(1);
      expect(legacyItems[0]).toMatchObject({
        id: 'challenge_test_media_0',
        url: 'blob:http://localhost:3000/abc123',
        type: 'video',
        duration: 5000,
        fileSize: 1024000,
        challengeId: 'test-challenge',
        statementIndex: 0,
      });
    });

    it('should discover legacy file URLs', async () => {
      const challengeData = {
        mediaData: [
          {
            type: 'video',
            url: '/api/v1/files/upload-session-1_video.mp4',
            duration: 8000,
          },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['draft_challenge_1']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(challengeData));

      const legacyItems = await migrationService.discoverLegacyMedia();

      expect(legacyItems).toHaveLength(1);
      expect(legacyItems[0].url).toBe('/api/v1/files/upload-session-1_video.mp4');
    });

    it('should discover local media files', async () => {
      mockFileSystem.readDirectoryAsync.mockResolvedValue([
        'video1.mp4',
        'audio1.mp3',
        'document.pdf', // Should be ignored
      ]);

      mockFileSystem.getInfoAsync.mockImplementation((path) => {
        if (path.includes('video1.mp4')) {
          return Promise.resolve({
            exists: true,
            size: 2048000,
            modificationTime: Date.now(),
          } as any);
        }
        if (path.includes('audio1.mp3')) {
          return Promise.resolve({
            exists: true,
            size: 512000,
            modificationTime: Date.now(),
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      const legacyItems = await migrationService.discoverLegacyMedia();

      expect(legacyItems).toHaveLength(2);
      expect(legacyItems.find(item => item.url.includes('video1.mp4'))).toBeDefined();
      expect(legacyItems.find(item => item.url.includes('audio1.mp3'))).toBeDefined();
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      const legacyItems = await migrationService.discoverLegacyMedia();

      expect(legacyItems).toHaveLength(0);
    });
  });

  describe('migrateLegacyMediaItem', () => {
    const mockLegacyItem: LegacyMediaItem = {
      id: 'test-item',
      url: 'file:///documents/video.mp4',
      type: 'video',
      duration: 5000,
      fileSize: 1024000,
    };

    it('should skip items that do not need migration', async () => {
      const modernItem: LegacyMediaItem = {
        ...mockLegacyItem,
        url: 'https://server.com/api/media/stream/media-123',
      };

      const result = await migrationService.migrateLegacyMediaItem(modernItem, 'user-123');

      expect(result.status).toBe('no_migration_needed');
      expect(result.originalUrl).toBe(modernItem.url);
    });

    it('should return skipped status for dry run', async () => {
      const result = await migrationService.migrateLegacyMediaItem(mockLegacyItem, 'user-123', true);

      expect(result.status).toBe('skipped');
      expect(result.originalUrl).toBe(mockLegacyItem.url);
    });

    it('should fail for blob URLs', async () => {
      const blobItem: LegacyMediaItem = {
        ...mockLegacyItem,
        url: 'blob:http://localhost:3000/abc123',
      };

      const result = await migrationService.migrateLegacyMediaItem(blobItem, 'user-123');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Blob URLs cannot be migrated');
    });

    it('should fail if local file does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

      const result = await migrationService.migrateLegacyMediaItem(mockLegacyItem, 'user-123');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Local file no longer exists');
    });

    it('should successfully migrate local file', async () => {
      // Mock file exists
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);

      // Mock successful upload
      mockUploadService.uploadVideo.mockResolvedValue({
        success: true,
        streamingUrl: 'https://server.com/api/media/stream/new-media-123',
        mediaId: 'new-media-123',
        fileSize: 1024000,
      });

      const result = await migrationService.migrateLegacyMediaItem(mockLegacyItem, 'user-123');

      expect(result.status).toBe('migrated');
      expect(result.originalUrl).toBe(mockLegacyItem.url);
      expect(result.newUrl).toBe('https://server.com/api/media/stream/new-media-123');
      expect(mockUploadService.uploadVideo).toHaveBeenCalledWith(
        mockLegacyItem.url,
        expect.stringContaining('migrated_'),
        5, // duration in seconds
        expect.objectContaining({
          compress: true,
          compressionQuality: 0.8,
        })
      );
    });

    it('should handle upload failures', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockUploadService.uploadVideo.mockResolvedValue({
        success: false,
        error: 'Upload failed',
      });

      const result = await migrationService.migrateLegacyMediaItem(mockLegacyItem, 'user-123');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Upload failed');
    });

    it('should resolve legacy server URLs', async () => {
      const legacyServerItem: LegacyMediaItem = {
        ...mockLegacyItem,
        url: '/api/v1/files/upload-session-123_video.mp4',
      };

      mockCrossDeviceService.getOptimizedStreamingUrl.mockResolvedValue(
        'https://server.com/api/media/stream/upload-session-123'
      );

      const result = await migrationService.migrateLegacyMediaItem(legacyServerItem, 'user-123');

      expect(result.status).toBe('migrated');
      expect(result.newUrl).toBe('https://server.com/api/media/stream/upload-session-123');
      expect(mockCrossDeviceService.getOptimizedStreamingUrl).toHaveBeenCalledWith('upload-session-123');
    });
  });

  describe('migrateAllLegacyMedia', () => {
    it('should return early if no legacy items found', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);

      const result = await migrationService.migrateAllLegacyMedia('user-123');

      expect(result.totalItems).toBe(0);
      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should process multiple items in batches', async () => {
      // Setup multiple legacy items
      const challengeData = {
        mediaData: [
          { type: 'video', url: 'file:///documents/video1.mp4', duration: 5000 },
          { type: 'video', url: 'file:///documents/video2.mp4', duration: 3000 },
          { type: 'video', url: 'file:///documents/video3.mp4', duration: 4000 },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(challengeData));
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      
      // Mock successful uploads
      mockUploadService.uploadVideo.mockResolvedValue({
        success: true,
        streamingUrl: 'https://server.com/api/media/stream/migrated',
        mediaId: 'migrated-123',
      });

      const result = await migrationService.migrateAllLegacyMedia('user-123', false, 2);

      expect(result.totalItems).toBe(3);
      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockUploadService.uploadVideo).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure results', async () => {
      const challengeData = {
        mediaData: [
          { type: 'video', url: 'file:///documents/good.mp4', duration: 5000 },
          { type: 'video', url: 'blob:http://localhost/bad', duration: 3000 },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(challengeData));
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockUploadService.uploadVideo.mockResolvedValue({
        success: true,
        streamingUrl: 'https://server.com/migrated',
      });

      const result = await migrationService.migrateAllLegacyMedia('user-123');

      expect(result.totalItems).toBe(2);
      expect(result.migrated).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should save migration status', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);

      await migrationService.migrateAllLegacyMedia('user-123');

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'migration_status',
        expect.stringContaining('"totalItems":0')
      );
    });
  });

  describe('getMigrationStatus', () => {
    it('should return null if no status stored', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const status = await migrationService.getMigrationStatus();

      expect(status).toBeNull();
    });

    it('should return parsed status data', async () => {
      const statusData = {
        lastMigration: '2023-01-01T00:00:00.000Z',
        totalItems: 5,
        migrated: 4,
        failed: 1,
        skipped: 0,
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(statusData));

      const status = await migrationService.getMigrationStatus();

      expect(status).toEqual(statusData);
    });
  });

  describe('verifyMigration', () => {
    it('should return verification results', async () => {
      // Mock current legacy items (should be empty after migration)
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);
      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);

      // Mock migration status
      const statusData = {
        totalItems: 3,
        migrated: 3,
        failed: 0,
        skipped: 0,
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(statusData));

      const verification = await migrationService.verifyMigration();

      expect(verification.totalStoredItems).toBe(3);
      expect(verification.legacyItems).toBe(0);
      expect(verification.migratedItems).toBe(3);
      expect(verification.verificationPassed).toBe(true);
    });

    it('should fail verification if legacy items remain', async () => {
      // Mock remaining legacy items
      const challengeData = {
        mediaData: [{ type: 'video', url: 'blob:http://localhost/remaining' }],
      };
      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'challenge_test') {
          return Promise.resolve(JSON.stringify(challengeData));
        }
        if (key === 'migration_status') {
          return Promise.resolve(JSON.stringify({ migrated: 2 }));
        }
        return Promise.resolve(null);
      });

      const verification = await migrationService.verifyMigration();

      expect(verification.legacyItems).toBe(1);
      expect(verification.verificationPassed).toBe(false);
    });
  });

  describe('cleanupMigratedFiles', () => {
    it('should delete successfully migrated local files', async () => {
      const migrationResults = {
        totalItems: 2,
        migrated: 1,
        failed: 1,
        skipped: 0,
        results: [
          {
            id: 'item1',
            status: 'migrated' as const,
            originalUrl: 'file:///documents/video1.mp4',
            newUrl: 'https://server.com/migrated1',
          },
          {
            id: 'item2',
            status: 'failed' as const,
            originalUrl: 'file:///documents/video2.mp4',
            error: 'Upload failed',
          },
        ],
      };

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockFileSystem.deleteAsync.mockResolvedValue();

      await migrationService.cleanupMigratedFiles(migrationResults);

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        'file:///documents/video1.mp4',
        { idempotent: true }
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    });

    it('should not delete blob URLs or server URLs', async () => {
      const migrationResults = {
        totalItems: 1,
        migrated: 1,
        failed: 0,
        skipped: 0,
        results: [
          {
            id: 'item1',
            status: 'migrated' as const,
            originalUrl: 'blob:http://localhost/video',
            newUrl: 'https://server.com/migrated',
          },
        ],
      };

      await migrationService.cleanupMigratedFiles(migrationResults);

      expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });
});