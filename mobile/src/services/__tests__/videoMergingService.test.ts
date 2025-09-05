/**
 * Video Merging Service Tests
 * Tests the video merging functionality for three statement videos
 */

import { videoMergingService } from '../videoMergingService';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

// Mock Expo modules
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  documentDirectory: 'file:///mock/documents/',
  copyAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
}));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockAudio = Audio as jest.Mocked<typeof Audio>;

describe('VideoMergingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock FileSystem methods
    (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 1024 * 1024, // 1MB
      modificationTime: Date.now(),
    });
    
    (mockFileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
    (mockFileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
    (mockFileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('mock-base64-data');
    (mockFileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
    (mockFileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
    (mockFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([]);
    
    // Mock Audio for duration detection
    const mockSound = {
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: true,
        durationMillis: 5000, // 5 seconds
      }),
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };
    
    (mockAudio.Sound.createAsync as jest.Mock).mockResolvedValue({
      sound: mockSound,
    });
  });

  describe('mergeStatementVideos', () => {
    const mockVideoUris: [string, string, string] = [
      'file:///mock/video1.mp4',
      'file:///mock/video2.mp4',
      'file:///mock/video3.mp4',
    ];

    it('should successfully merge three statement videos', async () => {
      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(true);
      expect(result.mergedVideoUri).toBeDefined();
      expect(result.segments).toHaveLength(3);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should track progress during merge', async () => {
      const progressCallback = jest.fn();
      
      await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 },
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          progress: expect.any(Number),
        })
      );
    });

    it('should handle missing video files', async () => {
      (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
        exists: false,
      });

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('video file not found');
    });

    it('should handle empty video files', async () => {
      (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({
        exists: true,
        size: 0,
      });

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('video file is empty');
    });

    it('should create proper segment timings', async () => {
      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { compressionQuality: 0.8 }
      );

      expect(result.success).toBe(true);
      expect(result.segments).toHaveLength(3);
      
      // Check that segments are sequential
      const segments = result.segments!;
      expect(segments[0].startTime).toBe(0);
      expect(segments[0].endTime).toBe(segments[0].duration);
      expect(segments[1].startTime).toBe(segments[0].endTime);
      expect(segments[2].startTime).toBe(segments[1].endTime);
    });

    it('should apply compression when file size exceeds limit', async () => {
      const largeFileSize = 100 * 1024 * 1024; // 100MB
      (mockFileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: largeFileSize,
        modificationTime: Date.now(),
      });

      const result = await videoMergingService.mergeStatementVideos(
        mockVideoUris,
        { 
          compressionQuality: 0.8,
          maxOutputSize: 50 * 1024 * 1024, // 50MB limit
        }
      );

      expect(result.success).toBe(true);
      expect(result.compressionRatio).toBeDefined();
    });
  });

  describe('createMergedMediaCapture', () => {
    it('should create proper MediaCapture object', () => {
      const mockMergeResult = {
        success: true,
        mergedVideoUri: 'file:///mock/merged.mp4',
        segments: [
          {
            statementIndex: 0,
            startTime: 0,
            endTime: 5000,
            duration: 5000,
          },
          {
            statementIndex: 1,
            startTime: 5000,
            endTime: 10000,
            duration: 5000,
          },
          {
            statementIndex: 2,
            startTime: 10000,
            endTime: 15000,
            duration: 5000,
          },
        ],
        totalDuration: 15000,
        fileSize: 1024 * 1024,
        compressionRatio: 0.8,
      };

      const originalCaptures = [
        { type: 'video' as const, fileSize: 500 * 1024 },
        { type: 'video' as const, fileSize: 600 * 1024 },
        { type: 'video' as const, fileSize: 400 * 1024 },
      ];

      const mergedCapture = videoMergingService.createMergedMediaCapture(
        mockMergeResult,
        originalCaptures
      );

      expect(mergedCapture.type).toBe('video');
      expect(mergedCapture.url).toBe(mockMergeResult.mergedVideoUri);
      expect(mergedCapture.isMergedVideo).toBe(true);
      expect(mergedCapture.segments).toHaveLength(3);
      expect(mergedCapture.duration).toBe(15000);
    });
  });

  describe('getSegmentPlaybackInfo', () => {
    it('should return correct playback info for segments', () => {
      const mergedMedia = {
        type: 'video' as const,
        isMergedVideo: true,
        segments: [
          {
            statementIndex: 0,
            startTime: 0,
            endTime: 5000,
            duration: 5000,
          },
          {
            statementIndex: 1,
            startTime: 5000,
            endTime: 10000,
            duration: 5000,
          },
          {
            statementIndex: 2,
            startTime: 10000,
            endTime: 15000,
            duration: 5000,
          },
        ],
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(mergedMedia, 1);

      expect(playbackInfo).toEqual({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });
    });

    it('should return null for non-merged videos', () => {
      const regularMedia = {
        type: 'video' as const,
        isMergedVideo: false,
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(regularMedia, 0);

      expect(playbackInfo).toBeNull();
    });

    it('should return null for invalid statement index', () => {
      const mergedMedia = {
        type: 'video' as const,
        isMergedVideo: true,
        segments: [
          {
            statementIndex: 0,
            startTime: 0,
            endTime: 5000,
            duration: 5000,
          },
        ],
      };

      const playbackInfo = videoMergingService.getSegmentPlaybackInfo(mergedMedia, 5);

      expect(playbackInfo).toBeNull();
    });
  });

  describe('cleanupTempFiles', () => {
    it('should clean up old temporary files', async () => {
      const oldTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      
      (mockFileSystem.readDirectoryAsync as jest.Mock).mockResolvedValue([
        'merged_challenge_123.mp4',
        'temp_merge_456.mp4',
        'regular_file.txt',
      ]);
      
      (mockFileSystem.getInfoAsync as jest.Mock).mockImplementation((path) => {
        if (path.includes('merged_challenge') || path.includes('temp_merge')) {
          return Promise.resolve({
            exists: true,
            modificationTime: oldTimestamp,
          });
        }
        return Promise.resolve({ exists: false });
      });

      await videoMergingService.cleanupTempFiles();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        expect.stringContaining('merged_challenge_123.mp4'),
        { idempotent: true }
      );
      // Note: Only one file is being cleaned up in this test run
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(1);
    });
  });
});