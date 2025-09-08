/**
 * Tests for multi-video upload functionality
 */

import { VideoUploadService } from '../uploadService';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

jest.mock('../authService', () => ({
  authService: {
    initialize: jest.fn(),
    getAuthToken: jest.fn(() => 'mock-token'),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('VideoUploadService - Multi-Video Upload', () => {
  let uploadService: VideoUploadService;

  beforeEach(() => {
    uploadService = VideoUploadService.getInstance();
    uploadService.setAuthToken('test-token');
    jest.clearAllMocks();
  });

  describe('uploadVideosForMerge', () => {
    it('should validate that exactly 3 videos are provided', async () => {
      const videos = [
        {
          uri: 'file://video1.mp4',
          filename: 'video1.mp4',
          duration: 5000,
          statementIndex: 0,
        },
        {
          uri: 'file://video2.mp4',
          filename: 'video2.mp4',
          duration: 6000,
          statementIndex: 1,
        },
      ];

      const result = await uploadService.uploadVideosForMerge(videos);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Exactly 3 videos are required');
    });

    it('should prepare correct FormData for multi-video upload', async () => {
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock network connectivity check (first call)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        } as any)
        // Mock actual upload request (second call)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            merged_video_url: 'https://example.com/merged.mp4',
            segment_metadata: [
              { statementIndex: 0, startTime: 0, endTime: 5000 },
              { statementIndex: 1, startTime: 5000, endTime: 11000 },
              { statementIndex: 2, startTime: 11000, endTime: 16000 },
            ],
          }),
          headers: new Map(),
        } as any);

      const videos = [
        {
          uri: 'file://video1.mp4',
          filename: 'video1.mp4',
          duration: 5000,
          statementIndex: 0,
        },
        {
          uri: 'file://video2.mp4',
          filename: 'video2.mp4',
          duration: 6000,
          statementIndex: 1,
        },
        {
          uri: 'file://video3.mp4',
          filename: 'video3.mp4',
          duration: 5000,
          statementIndex: 2,
        },
      ];

      const result = await uploadService.uploadVideosForMerge(videos);

      expect(result.success).toBe(true);
      expect(result.mergedVideoUrl).toBe('https://example.com/merged.mp4');
      expect(result.segmentMetadata).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/challenge-videos/upload-for-merge'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 });

      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      // Mock network connectivity check failure
      mockFetch.mockRejectedValue(new Error('Network request failed'));

      const videos = [
        {
          uri: 'file://video1.mp4',
          filename: 'video1.mp4',
          duration: 5000,
          statementIndex: 0,
        },
        {
          uri: 'file://video2.mp4',
          filename: 'video2.mp4',
          duration: 6000,
          statementIndex: 1,
        },
        {
          uri: 'file://video3.mp4',
          filename: 'video3.mp4',
          duration: 5000,
          statementIndex: 2,
        },
      ];

      const result = await uploadService.uploadVideosForMerge(videos);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
    });
  });
});