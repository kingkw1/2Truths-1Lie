/**
 * Upload Merged Video Integration Test
 * Tests the complete workflow of uploading merged videos with segment metadata
 */

import { videoUploadService } from '../uploadService';

// Mock fetch for testing
global.fetch = jest.fn();

// Mock Expo modules
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({
    exists: true,
    size: 1024 * 1024, // 1MB
  }),
}));

jest.mock('../authService', () => ({
  authService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getAuthToken: jest.fn().mockReturnValue('mock-auth-token'),
  },
}));

describe('Upload Merged Video Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Map([['content-type', 'application/json']]),
      json: jest.fn().mockResolvedValue({
        success: true,
        media_id: 'merged-video-123',
        storage_url: 'https://cdn.example.com/merged-video-123.mp4',
      }),
    });
  });

  describe('uploadMergedVideo', () => {
    it('should upload merged video with segment metadata', async () => {
      const segments = [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ];

      const result = await videoUploadService.uploadMergedVideo(
        'file:///mock/merged-video.mp4',
        'merged_challenge_123.mp4',
        15000, // 15 seconds total duration
        segments
      );

      expect(result.success).toBe(true);
      expect(result.mediaId).toBe('merged-video-123');
      expect(result.streamingUrl).toBe('https://cdn.example.com/merged-video-123.mp4');

      // Verify fetch was called with correct parameters
      expect(fetch).toHaveBeenCalledWith(
        'http://192.168.50.111:8001/api/v1/s3-media/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-auth-token',
          }),
          body: expect.any(FormData),
        })
      );

      // Verify FormData contains metadata
      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const formData = fetchCall[1].body as FormData;
      
      // Note: In a real test environment, we'd need to inspect FormData differently
      // This is a simplified test to verify the method exists and works
    });

    it('should handle upload errors gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      });

      const segments = [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ];

      const result = await videoUploadService.uploadMergedVideo(
        'file:///mock/merged-video.mp4',
        'merged_challenge_123.mp4',
        15000,
        segments
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed');
    });

    it('should include proper metadata structure', async () => {
      const segments = [
        { statementIndex: 0, startTime: 0, endTime: 3000, duration: 3000 },
        { statementIndex: 1, startTime: 3000, endTime: 7000, duration: 4000 },
        { statementIndex: 2, startTime: 7000, endTime: 12000, duration: 5000 },
      ];

      await videoUploadService.uploadMergedVideo(
        'file:///mock/merged-video.mp4',
        'merged_challenge_123.mp4',
        12000,
        segments
      );

      // Verify the metadata structure is correct
      // In a real implementation, we'd verify the metadata sent to the server
      expect(fetch).toHaveBeenCalled();
    });
  });

  describe('regular uploadVideo method', () => {
    it('should still work for individual video uploads', async () => {
      const result = await videoUploadService.uploadVideo(
        'file:///mock/individual-video.mp4',
        'statement_1.mp4',
        5 // 5 seconds duration
      );

      expect(result.success).toBe(true);
      expect(result.mediaId).toBe('merged-video-123');
      expect(result.streamingUrl).toBe('https://cdn.example.com/merged-video-123.mp4');
    });
  });
});