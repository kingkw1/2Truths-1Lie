/**
 * Video Merging Integration Tests
 * Tests the integration between video merging service and mobile media integration
 */

import { mobileMediaIntegration } from '../mobileMediaIntegration';
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

// Mock other services
jest.mock('../uploadService', () => ({
  videoUploadService: {
    uploadVideo: jest.fn().mockResolvedValue({
      success: true,
      streamingUrl: 'https://mock-cdn.com/merged-video.mp4',
      mediaId: 'mock-media-id',
      cloudStorageKey: 'mock-storage-key',
      storageType: 'cloud',
      uploadTime: 5000,
    }),
  },
}));

jest.mock('../crossDeviceMediaService', () => ({
  crossDeviceMediaService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    verifyMediaAccessibility: jest.fn().mockResolvedValue({
      accessible: true,
      deviceCompatible: true,
      streamingUrl: 'https://mock-cdn.com/optimized-video.mp4',
    }),
  },
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockAudio = Audio as jest.Mocked<typeof Audio>;

describe('Video Merging Integration', () => {
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

  describe('mergeStatementVideos integration', () => {
    it('should merge three individual recordings and upload the result', async () => {
      // Mock Redux dispatch
      const mockDispatch = jest.fn();
      await mobileMediaIntegration.initialize(mockDispatch);

      // Create mock individual recordings
      const individualRecordings = {
        0: {
          type: 'video' as const,
          url: 'file:///mock/video1.mp4',
          duration: 5000,
          fileSize: 1024 * 1024,
          mimeType: 'video/mp4',
          storageType: 'local' as const,
          isUploaded: false,
        },
        1: {
          type: 'video' as const,
          url: 'file:///mock/video2.mp4',
          duration: 5000,
          fileSize: 1024 * 1024,
          mimeType: 'video/mp4',
          storageType: 'local' as const,
          isUploaded: false,
        },
        2: {
          type: 'video' as const,
          url: 'file:///mock/video3.mp4',
          duration: 5000,
          fileSize: 1024 * 1024,
          mimeType: 'video/mp4',
          storageType: 'local' as const,
          isUploaded: false,
        },
      };

      // Test the merge process
      const mergedVideo = await mobileMediaIntegration.mergeStatementVideos(individualRecordings);

      // Verify the result
      expect(mergedVideo).toBeDefined();
      expect(mergedVideo.isMergedVideo).toBe(true);
      expect(mergedVideo.segments).toHaveLength(3);
      expect(mergedVideo.isUploaded).toBe(true);
      expect(mergedVideo.streamingUrl).toBeDefined();

      // Verify Redux actions were dispatched
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('startVideoMerging'),
        })
      );
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('completeVideoMerging'),
        })
      );
    });

    it('should handle merge errors gracefully', async () => {
      // Mock Redux dispatch
      const mockDispatch = jest.fn();
      await mobileMediaIntegration.initialize(mockDispatch);

      // Create incomplete individual recordings (missing one)
      const incompleteRecordings = {
        0: {
          type: 'video' as const,
          url: 'file:///mock/video1.mp4',
          duration: 5000,
          fileSize: 1024 * 1024,
          mimeType: 'video/mp4',
          storageType: 'local' as const,
          isUploaded: false,
        },
        1: {
          type: 'video' as const,
          url: 'file:///mock/video2.mp4',
          duration: 5000,
          fileSize: 1024 * 1024,
          mimeType: 'video/mp4',
          storageType: 'local' as const,
          isUploaded: false,
        },
        // Missing recording 2
      };

      // Test error handling
      await expect(
        mobileMediaIntegration.mergeStatementVideos(incompleteRecordings)
      ).rejects.toThrow('All three statement recordings are required');

      // Verify error action was dispatched
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('setVideoMergingError'),
        })
      );
    });
  });

  describe('hasAllStatementRecordings', () => {
    it('should return true when all three recordings are present', () => {
      const completeRecordings = {
        0: { type: 'video' as const, url: 'file:///video1.mp4' },
        1: { type: 'video' as const, url: 'file:///video2.mp4' },
        2: { type: 'video' as const, url: 'file:///video3.mp4' },
      };

      const result = mobileMediaIntegration.hasAllStatementRecordings(completeRecordings);
      expect(result).toBe(true);
    });

    it('should return false when recordings are missing', () => {
      const incompleteRecordings = {
        0: { type: 'video' as const, url: 'file:///video1.mp4' },
        1: { type: 'video' as const, url: 'file:///video2.mp4' },
        // Missing recording 2
      };

      const result = mobileMediaIntegration.hasAllStatementRecordings(incompleteRecordings);
      expect(result).toBe(false);
    });
  });

  describe('getSegmentPlaybackInfo', () => {
    it('should return correct segment info for merged videos', () => {
      const mergedVideo = {
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

      const segmentInfo = mobileMediaIntegration.getSegmentPlaybackInfo(mergedVideo, 1);

      expect(segmentInfo).toEqual({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });
    });
  });
});