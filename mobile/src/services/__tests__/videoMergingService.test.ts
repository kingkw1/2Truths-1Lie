/**
 * Video Merging Service Unit Tests
 * Tests the core video merging functionality and segment metadata tracking
 */

import { videoMergingService } from '../videoMergingService';
import { MediaCapture, VideoSegment } from '../../types';
import * as FileSystem from 'expo-file-system';

// Mock FileSystem
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  documentDirectory: 'mock://documents/',
}));

describe('VideoMergingService', () => {
  const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      size: 1024 * 1024, // 1MB
      modificationTime: Date.now(),
    } as any);
    
    mockFileSystem.copyAsync.mockResolvedValue(undefined);
    mockFileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  describe('mergeStatementVideos', () => {
    const mockVideoUris: [string, string, string] = [
      'mock://video1.mp4',
      'mock://video2.mp4',
      'mock://video3.mp4',
    ];

    it('should successfully merge three videos with segment metadata', async () => {
      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(true);
      expect(result.mergedVideoUri).toBeDefined();
      expect(result.segments).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should create proper segment timings', async () => {
      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(true);
      expect(result.segments).toBeDefined();

      const segments = result.segments!;
      expect(segments).toHaveLength(3);

      // Check segment structure
      segments.forEach((segment, index) => {
        expect(segment.statementIndex).toBe(index);
        expect(segment.startTime).toBeGreaterThanOrEqual(0);
        expect(segment.endTime).toBeGreaterThan(segment.startTime);
        expect(segment.duration).toBe(segment.endTime - segment.startTime);
      });

      // Check segments are sequential
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i].startTime).toBe(segments[i - 1].endTime);
      }
    });

    it('should handle missing video files', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Statement 1 video file not found');
    });

    it('should handle empty video files', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 0,
      } as any);

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Statement 1 video file is empty');
    });

    it('should call progress callback during merge', async () => {
      const progressCallback = jest.fn();

      await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 },
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'preparing',
          progress: expect.any(Number),
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'merging',
          progress: expect.any(Number),
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'finalizing',
          progress: 100,
        })
      );
    });

    it('should apply compression when file size exceeds threshold', async () => {
      // Mock large file size
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 100 * 1024 * 1024, // 100MB
        modificationTime: Date.now(),
      } as any);

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { 
          compressionQuality: 0.8,
          maxOutputSize: 50 * 1024 * 1024, // 50MB limit
        }
      );

      expect(result.success).toBe(true);
      expect(result.compressionRatio).toBeDefined();
      expect(result.compressionRatio).toBeLessThan(1);
    });
  });

  describe('createMergedMediaCapture', () => {
    it('should create proper MediaCapture for merged video', () => {
      const mockMergeResult = {
        success: true,
        mergedVideoUri: 'mock://merged.mp4',
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ] as VideoSegment[],
        totalDuration: 15000,
        fileSize: 3 * 1024 * 1024,
        compressionRatio: 0.8,
      };

      const originalMediaCaptures: MediaCapture[] = [
        { type: 'video', url: 'mock://1.mp4', fileSize: 1024 * 1024 },
        { type: 'video', url: 'mock://2.mp4', fileSize: 1024 * 1024 },
        { type: 'video', url: 'mock://3.mp4', fileSize: 1024 * 1024 },
      ];

      const mergedMedia = videoMergingService.createMergedMediaCapture(
        mockMergeResult,
        originalMediaCaptures
      );

      expect(mergedMedia.type).toBe('video');
      expect(mergedMedia.url).toBe('mock://merged.mp4');
      expect(mergedMedia.duration).toBe(15000);
      expect(mergedMedia.fileSize).toBe(3 * 1024 * 1024);
      expect(mergedMedia.isMergedVideo).toBe(true);
      expect(mergedMedia.segments).toHaveLength(3);
      expect(mergedMedia.storageType).toBe('local');
      expect(mergedMedia.isUploaded).toBe(false);
    });

    it('should calculate compression ratio from original files', () => {
      const mockMergeResult = {
        success: true,
        mergedVideoUri: 'mock://merged.mp4',
        segments: [] as VideoSegment[],
        totalDuration: 15000,
        fileSize: 2 * 1024 * 1024, // 2MB merged
        compressionRatio: 0.67,
      };

      const originalMediaCaptures: MediaCapture[] = [
        { type: 'video', url: 'mock://1.mp4', fileSize: 1024 * 1024 }, // 1MB each
        { type: 'video', url: 'mock://2.mp4', fileSize: 1024 * 1024 },
        { type: 'video', url: 'mock://3.mp4', fileSize: 1024 * 1024 },
      ];

      const mergedMedia = videoMergingService.createMergedMediaCapture(
        mockMergeResult,
        originalMediaCaptures
      );

      expect(mergedMedia.originalSize).toBe(3 * 1024 * 1024); // 3MB total
      expect(mergedMedia.compressionRatio).toBeCloseTo(0.67, 2);
    });
  });

  describe('getSegmentPlaybackInfo', () => {
    it('should return correct playback info for a segment', () => {
      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(
        mockMergedMedia,
        1
      );

      expect(playbackInfo).toEqual({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });
    });

    it('should return null for non-merged video', () => {
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'mock://single.mp4',
        isMergedVideo: false,
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(
        mockMedia,
        0
      );

      expect(playbackInfo).toBeNull();
    });

    it('should return null for invalid statement index', () => {
      const mockMergedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        ],
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(
        mockMergedMedia,
        5 // Invalid index
      );

      expect(playbackInfo).toBeNull();
    });
  });

  describe('extractSegmentForPlayback', () => {
    it('should return success for valid segment extraction', async () => {
      const mockSegment: VideoSegment = {
        statementIndex: 1,
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      };

      const result = await videoMergingService.extractSegmentForPlayback(
        'mock://merged.mp4',
        mockSegment
      );

      expect(result.success).toBe(true);
      expect(result.segmentUri).toBe('mock://merged.mp4');
    });
  });

  describe('cleanupTempFiles', () => {
    it('should clean up old temporary files', async () => {
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      mockFileSystem.readDirectoryAsync.mockResolvedValue([
        'merged_challenge_123.mp4',
        'compressed_merged_456.mp4',
        'regular_file.txt',
      ]);

      mockFileSystem.getInfoAsync.mockImplementation((path) => {
        if (path.includes('merged_challenge') || path.includes('compressed_merged')) {
          return Promise.resolve({
            exists: true,
            modificationTime: oldTimestamp,
          } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      await videoMergingService.cleanupTempFiles();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        'mock://documents/merged_challenge_123.mp4',
        { idempotent: true }
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        'mock://documents/compressed_merged_456.mp4',
        { idempotent: true }
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    });

    it('should not delete recent files', async () => {
      const recentTimestamp = Date.now() - (30 * 60 * 1000); // 30 minutes ago
      
      mockFileSystem.readDirectoryAsync.mockResolvedValue([
        'merged_challenge_recent.mp4',
      ]);

      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        modificationTime: recentTimestamp,
      } as any);

      await videoMergingService.cleanupTempFiles();

      expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
    });
  });
});