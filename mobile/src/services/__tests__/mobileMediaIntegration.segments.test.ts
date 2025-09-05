/**
 * Mobile Media Integration - Segment Recording Tests
 * Tests the integration between individual recording and video merging
 */

import { mobileMediaIntegration } from '../mobileMediaIntegration';
import { videoMergingService } from '../videoMergingService';
import { MediaCapture, VideoSegment } from '../../types';
import * as FileSystem from 'expo-file-system';

// Mock dependencies
jest.mock('../videoMergingService');
jest.mock('../uploadService');
jest.mock('../crossDeviceMediaService');
jest.mock('expo-file-system');

describe('MobileMediaIntegration - Segment Recording', () => {
  let mockVideoMergingService: jest.Mocked<typeof videoMergingService>;
  let mockFileSystem: jest.Mocked<typeof FileSystem>;
  let mockDispatch: jest.Mock;

  beforeEach(() => {
    mockVideoMergingService = videoMergingService as jest.Mocked<typeof videoMergingService>;
    mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
    mockDispatch = jest.fn();

    // Setup default mocks
    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      size: 1024 * 1024, // 1MB
    } as any);

    mockVideoMergingService.mergeStatementVideos.mockResolvedValue({
      success: true,
      mergedVideoUri: 'mock://merged.mp4',
      segments: [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ] as VideoSegment[],
      totalDuration: 15000,
      fileSize: 3 * 1024 * 1024,
    });

    mockVideoMergingService.createMergedMediaCapture.mockReturnValue({
      type: 'video',
      url: 'mock://merged.mp4',
      duration: 15000,
      fileSize: 3 * 1024 * 1024,
      mimeType: 'video/mp4',
      isMergedVideo: true,
      segments: [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ],
      storageType: 'local',
      isUploaded: false,
    });

    mockVideoMergingService.getSegmentPlaybackInfo.mockImplementation(
      (mergedVideo, statementIndex) => {
        const segment = mergedVideo.segments?.find(s => s.statementIndex === statementIndex);
        return segment ? {
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration: segment.duration,
        } : null;
      }
    );

    jest.clearAllMocks();
  });

  describe('Individual Recording Processing', () => {
    beforeEach(async () => {
      await mobileMediaIntegration.initialize(mockDispatch);
    });

    it('should process individual recordings for merging', async () => {
      const recordingUri = 'mock://recording_0.mp4';
      const duration = 5000;
      const statementIndex = 0;

      const result = await mobileMediaIntegration.stopRecording(
        statementIndex,
        recordingUri,
        duration
      );

      expect(result.type).toBe('video');
      expect(result.url).toBe(recordingUri);
      expect(result.duration).toBe(duration);
      expect(result.storageType).toBe('local');
      expect(result.isUploaded).toBe(false);

      // Should dispatch individual recording action
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/setIndividualRecording',
          payload: {
            statementIndex,
            recording: result,
          },
        })
      );
    });

    it('should validate file exists before processing', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);

      await expect(
        mobileMediaIntegration.stopRecording(0, 'mock://missing.mp4', 5000)
      ).rejects.toThrow('Recording file not found');
    });

    it('should validate file size and duration', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 0, // Empty file
      } as any);

      await expect(
        mobileMediaIntegration.stopRecording(0, 'mock://empty.mp4', 5000)
      ).rejects.toThrow('Recording file is empty');
    });
  });

  describe('Video Merging Integration', () => {
    beforeEach(async () => {
      await mobileMediaIntegration.initialize(mockDispatch);
    });

    it('should check if all statement recordings are complete', () => {
      const completeRecordings = {
        0: { type: 'video', url: 'mock://0.mp4' } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4' } as MediaCapture,
        2: { type: 'video', url: 'mock://2.mp4' } as MediaCapture,
      };

      const incompleteRecordings = {
        0: { type: 'video', url: 'mock://0.mp4' } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4' } as MediaCapture,
        // Missing recording 2
      };

      expect(mobileMediaIntegration.hasAllStatementRecordings(completeRecordings)).toBe(true);
      expect(mobileMediaIntegration.hasAllStatementRecordings(incompleteRecordings)).toBe(false);
    });

    it('should merge statement videos successfully', async () => {
      const individualRecordings = {
        0: { type: 'video', url: 'mock://0.mp4', duration: 5000 } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4', duration: 5000 } as MediaCapture,
        2: { type: 'video', url: 'mock://2.mp4', duration: 5000 } as MediaCapture,
      };

      // Mock upload service for merged video
      const mockUploadService = require('../uploadService');
      mockUploadService.videoUploadService = {
        uploadVideo: jest.fn().mockResolvedValue({
          success: true,
          streamingUrl: 'https://cdn.example.com/merged.mp4',
          mediaId: 'merged_123',
          cloudStorageKey: 'challenges/merged_123.mp4',
          storageType: 'cloud',
          uploadTime: 5000,
        }),
      };

      const result = await mobileMediaIntegration.mergeStatementVideos(individualRecordings);

      expect(result.type).toBe('video');
      expect(result.isMergedVideo).toBe(true);
      expect(result.segments).toHaveLength(3);
      expect(result.isUploaded).toBe(true);
      expect(result.streamingUrl).toBe('https://cdn.example.com/merged.mp4');

      // Should dispatch merging actions
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/startVideoMerging',
        })
      );

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/completeVideoMerging',
          payload: {
            mergedVideo: result,
          },
        })
      );

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/validateChallenge',
        })
      );
    });

    it('should handle merging errors', async () => {
      const individualRecordings = {
        0: { type: 'video', url: 'mock://0.mp4' } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4' } as MediaCapture,
        2: { type: 'video', url: 'mock://2.mp4' } as MediaCapture,
      };

      mockVideoMergingService.mergeStatementVideos.mockResolvedValueOnce({
        success: false,
        error: 'Merge failed',
      });

      await expect(
        mobileMediaIntegration.mergeStatementVideos(individualRecordings)
      ).rejects.toThrow('Merge failed');

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/setVideoMergingError',
          payload: { error: 'Merge failed' },
        })
      );
    });

    it('should require all three recordings for merging', async () => {
      const incompleteRecordings = {
        0: { type: 'video', url: 'mock://0.mp4' } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4' } as MediaCapture,
        // Missing recording 2
      };

      await expect(
        mobileMediaIntegration.mergeStatementVideos(incompleteRecordings)
      ).rejects.toThrow('All three statement recordings are required for merging');
    });
  });

  describe('Segment Playback Information', () => {
    it('should provide segment playback information', () => {
      const mergedVideo: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
      };

      const playbackInfo = mobileMediaIntegration.getSegmentPlaybackInfo(
        mergedVideo,
        1
      );

      expect(playbackInfo).toEqual({
        startTime: 5000,
        endTime: 10000,
        duration: 5000,
      });

      expect(mockVideoMergingService.getSegmentPlaybackInfo).toHaveBeenCalledWith(
        mergedVideo,
        1
      );
    });

    it('should return null for invalid segment', () => {
      const mergedVideo: MediaCapture = {
        type: 'video',
        url: 'mock://merged.mp4',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        ],
      };

      const playbackInfo = mobileMediaIntegration.getSegmentPlaybackInfo(
        mergedVideo,
        5 // Invalid index
      );

      expect(playbackInfo).toBeNull();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await mobileMediaIntegration.initialize(mockDispatch);
    });

    it('should track merging progress through Redux', async () => {
      const individualRecordings = {
        0: { type: 'video', url: 'mock://0.mp4' } as MediaCapture,
        1: { type: 'video', url: 'mock://1.mp4' } as MediaCapture,
        2: { type: 'video', url: 'mock://2.mp4' } as MediaCapture,
      };

      // Mock upload service
      const mockUploadService = require('../uploadService');
      mockUploadService.videoUploadService = {
        uploadVideo: jest.fn().mockResolvedValue({
          success: true,
          streamingUrl: 'https://cdn.example.com/merged.mp4',
        }),
      };

      // Mock progress callback
      let progressCallback: any;
      mockVideoMergingService.mergeStatementVideos.mockImplementation(
        async (videoUris, options, onProgress) => {
          progressCallback = onProgress;
          
          // Simulate progress updates
          onProgress?.({ stage: 'preparing', progress: 10 });
          onProgress?.({ stage: 'merging', progress: 50, currentSegment: 1 });
          onProgress?.({ stage: 'compressing', progress: 80 });
          onProgress?.({ stage: 'finalizing', progress: 100 });

          return {
            success: true,
            mergedVideoUri: 'mock://merged.mp4',
            segments: [],
            totalDuration: 15000,
            fileSize: 3 * 1024 * 1024,
          };
        }
      );

      await mobileMediaIntegration.mergeStatementVideos(individualRecordings);

      // Verify progress updates were dispatched
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/updateVideoMergingProgress',
          payload: {
            progress: 10,
            stage: 'preparing',
          },
        })
      );

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/updateVideoMergingProgress',
          payload: {
            progress: 50,
            stage: 'merging',
            currentSegment: 1,
          },
        })
      );

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'challengeCreation/updateVideoMergingProgress',
          payload: {
            progress: 80,
            stage: 'compressing',
          },
        })
      );
    });
  });
});