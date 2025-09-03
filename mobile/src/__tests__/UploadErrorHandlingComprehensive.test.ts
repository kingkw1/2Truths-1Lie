/**
 * Comprehensive Upload Error Handling Tests
 * Tests all error scenarios and recovery mechanisms
 */

import { VideoUploadService } from '../services/uploadService';
import { Alert } from 'react-native';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  documentDirectory: 'mock://documents/',
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Upload Error Handling - Comprehensive Tests', () => {
  let uploadService: VideoUploadService;

  beforeEach(() => {
    uploadService = VideoUploadService.getInstance();
    uploadService.setAuthToken('test-token');
    jest.clearAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should handle network timeout errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock network timeout
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network request timed out')), 100);
        })
      );

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false, timeout: 5000 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.errorCode).toBe('NETWORK_TIMEOUT');
    });

    it('should handle connection refused errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock connection refused
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should handle DNS resolution errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock DNS error
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('network');
      expect(result.errorCode).toBe('NETWORK_ERROR');
    });

    it('should handle intermittent network failures with retry', async () => {
      const mockFileInfo = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Successful initiate
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              session_id: 'retry-session-123',
              upload_url: '/api/upload/retry-session-123',
              chunk_size: 1024 * 1024,
              total_chunks: 2,
            }),
            headers: new Map([['X-Upload-Session-ID', 'retry-session-123']]),
          });
        } else if (callCount === 2) {
          // First chunk fails
          return Promise.reject(new Error('Network error'));
        } else if (callCount === 3) {
          // Retry first chunk succeeds
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chunk_uploaded: true,
              progress: 50,
            }),
          });
        } else if (callCount === 4) {
          // Second chunk succeeds
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chunk_uploaded: true,
              progress: 100,
              media_url: '/api/media/stream/retry-video-id',
              media_id: 'retry-video-id',
            }),
          });
        }
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false, maxRetries: 3 }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/retry-video-id');
      expect(callCount).toBe(4); // initiate + failed chunk + retry chunk + second chunk
    });
  });

  describe('Server Error Handling', () => {
    it('should handle 400 Bad Request errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock 400 error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          detail: 'Invalid file format',
          error_code: 'INVALID_FORMAT',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file format');
      expect(result.errorCode).toBe('INVALID_FORMAT');
    });

    it('should handle 401 Unauthorized errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock 401 error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: 'Authentication token expired',
          error_code: 'TOKEN_EXPIRED',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication token expired');
      expect(result.errorCode).toBe('TOKEN_EXPIRED');
    });

    it('should handle 413 Payload Too Large errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 100 * 1024 * 1024, // 100MB
        uri: 'mock://large-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock 413 error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: () => Promise.resolve({
          detail: 'File size exceeds maximum allowed size',
          error_code: 'FILE_TOO_LARGE',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://large-video.mp4',
        'large-video.mp4',
        300000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds maximum');
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should handle 429 Rate Limit errors with backoff', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First two calls hit rate limit
          return Promise.resolve({
            ok: false,
            status: 429,
            headers: new Map([['Retry-After', '2']]),
            json: () => Promise.resolve({
              detail: 'Rate limit exceeded',
              error_code: 'RATE_LIMITED',
            }),
          });
        } else {
          // Third call succeeds
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              session_id: 'rate-limit-session-123',
              upload_url: '/api/upload/rate-limit-session-123',
              chunk_size: 1024 * 1024,
              total_chunks: 1,
            }),
            headers: new Map([['X-Upload-Session-ID', 'rate-limit-session-123']]),
          });
        }
      });

      const startTime = Date.now();
      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: false, respectRateLimit: true }
      );

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThan(2000); // Should have waited for rate limit
      expect(callCount).toBe(3);
    });

    it('should handle 500 Internal Server Error', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock 500 error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error',
          error_code: 'SERVER_ERROR',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('server error');
      expect(result.errorCode).toBe('SERVER_ERROR');
    });
  });

  describe('File System Error Handling', () => {
    it('should handle file not found errors', async () => {
      // Mock file not found
      require('expo-file-system').getInfoAsync.mockResolvedValue({
        exists: false,
      });

      const result = await uploadService.uploadVideo(
        'mock://nonexistent.mp4',
        'nonexistent.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
      expect(result.errorCode).toBe('FILE_NOT_FOUND');
    });

    it('should handle file read permission errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://protected-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await uploadService.uploadVideo(
        'mock://protected-video.mp4',
        'protected-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      expect(result.errorCode).toBe('PERMISSION_DENIED');
    });

    it('should handle corrupted file errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://corrupted-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockRejectedValue(
        new Error('File is corrupted or unreadable')
      );

      const result = await uploadService.uploadVideo(
        'mock://corrupted-video.mp4',
        'corrupted-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('corrupted');
      expect(result.errorCode).toBe('FILE_CORRUPTED');
    });

    it('should handle insufficient storage space errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockRejectedValue(
        new Error('No space left on device')
      );

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('storage space');
      expect(result.errorCode).toBe('INSUFFICIENT_STORAGE');
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle invalid file extension errors', async () => {
      const result = await uploadService.uploadVideo(
        'mock://document.pdf',
        'document.pdf',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file extension');
      expect(result.errorCode).toBe('INVALID_EXTENSION');
    });

    it('should handle file too large errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 100 * 1024 * 1024, // 100MB
        uri: 'mock://huge-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      const result = await uploadService.uploadVideo(
        'mock://huge-video.mp4',
        'huge-video.mp4',
        600000, // 10 minutes
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should handle video too long errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 10 * 1024 * 1024,
        uri: 'mock://long-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      const result = await uploadService.uploadVideo(
        'mock://long-video.mp4',
        'long-video.mp4',
        300000, // 5 minutes - too long
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Video too long');
      expect(result.errorCode).toBe('DURATION_TOO_LONG');
    });

    it('should handle video too short errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 500 * 1024, // 500KB
        uri: 'mock://short-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      const result = await uploadService.uploadVideo(
        'mock://short-video.mp4',
        'short-video.mp4',
        1000, // 1 second - too short
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Video too short');
      expect(result.errorCode).toBe('DURATION_TOO_SHORT');
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle out of memory errors during compression', async () => {
      const mockFileInfo = {
        exists: true,
        size: 50 * 1024 * 1024, // 50MB
        uri: 'mock://large-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockRejectedValue(
        new Error('Out of memory')
      );

      const result = await uploadService.uploadVideo(
        'mock://large-video.mp4',
        'large-video.mp4',
        120000,
        { compress: true }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('memory');
      expect(result.errorCode).toBe('OUT_OF_MEMORY');
    });

    it('should handle resource cleanup on errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 5 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock initiate success then chunk failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'cleanup-session-123',
            upload_url: '/api/upload/cleanup-session-123',
            chunk_size: 1024 * 1024,
            total_chunks: 5,
          }),
          headers: new Map([['X-Upload-Session-ID', 'cleanup-session-123']]),
        })
        .mockRejectedValue(new Error('Chunk upload failed'));

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);

      // Verify cleanup was performed
      const stats = uploadService.getUploadStats();
      expect(stats.activeUploads).toBe(0);
    });
  });

  describe('Concurrent Upload Error Handling', () => {
    it('should handle errors in one upload without affecting others', async () => {
      const mockFileInfo1 = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://video1.mp4',
      };

      const mockFileInfo2 = {
        exists: true,
        size: 3 * 1024 * 1024,
        uri: 'mock://video2.mp4',
      };

      require('expo-file-system').getInfoAsync
        .mockResolvedValueOnce(mockFileInfo1)
        .mockResolvedValueOnce(mockFileInfo2);

      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First upload initiate - success
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              session_id: 'session-1',
              upload_url: '/api/upload/session-1',
              chunk_size: 1024 * 1024,
              total_chunks: 2,
            }),
            headers: new Map([['X-Upload-Session-ID', 'session-1']]),
          });
        } else if (callCount === 2) {
          // Second upload initiate - fails
          return Promise.reject(new Error('Server error'));
        } else {
          // First upload chunks - success
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              chunk_uploaded: true,
              progress: 50,
            }),
          });
        }
      });

      // Start both uploads concurrently
      const upload1Promise = uploadService.uploadVideo(
        'mock://video1.mp4',
        'video1.mp4',
        30000,
        { compress: false }
      );

      const upload2Promise = uploadService.uploadVideo(
        'mock://video2.mp4',
        'video2.mp4',
        35000,
        { compress: false }
      );

      const [result1, result2] = await Promise.all([upload1Promise, upload2Promise]);

      // First upload should succeed, second should fail
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Server error');
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      let callCount = 0;
      const callTimes: number[] = [];

      mockFetch.mockImplementation(() => {
        callTimes.push(Date.now());
        callCount++;
        
        if (callCount <= 3) {
          // First 3 calls fail
          return Promise.reject(new Error('Temporary server error'));
        } else {
          // 4th call succeeds
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              session_id: 'backoff-session-123',
              upload_url: '/api/upload/backoff-session-123',
              chunk_size: 1024 * 1024,
              total_chunks: 1,
            }),
            headers: new Map([['X-Upload-Session-ID', 'backoff-session-123']]),
          });
        }
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { 
          compress: false, 
          maxRetries: 5,
          useExponentialBackoff: true 
        }
      );

      expect(result.success).toBe(true);
      expect(callCount).toBe(4);

      // Verify exponential backoff timing
      if (callTimes.length >= 3) {
        const delay1 = callTimes[1] - callTimes[0];
        const delay2 = callTimes[2] - callTimes[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it('should respect maximum retry limits', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Always fail
      mockFetch.mockRejectedValue(new Error('Persistent server error'));

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { 
          compress: false, 
          maxRetries: 3 
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent server error');
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('User Experience Error Handling', () => {
    it('should provide user-friendly error messages', async () => {
      const testCases = [
        {
          systemError: 'Network request failed',
          expectedUserMessage: 'Please check your internet connection and try again',
          expectedCode: 'NETWORK_ERROR'
        },
        {
          systemError: 'File size exceeds maximum allowed size',
          expectedUserMessage: 'Video file is too large. Please use a smaller file',
          expectedCode: 'FILE_TOO_LARGE'
        },
        {
          systemError: 'Authentication token expired',
          expectedUserMessage: 'Your session has expired. Please log in again',
          expectedCode: 'TOKEN_EXPIRED'
        },
        {
          systemError: 'Rate limit exceeded',
          expectedUserMessage: 'Too many uploads. Please wait a moment and try again',
          expectedCode: 'RATE_LIMITED'
        }
      ];

      for (const testCase of testCases) {
        const mockFileInfo = {
          exists: true,
          size: 1 * 1024 * 1024,
          uri: 'mock://video.mp4',
        };

        require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
        mockFetch.mockRejectedValue(new Error(testCase.systemError));

        const result = await uploadService.uploadVideo(
          'mock://video.mp4',
          'test-video.mp4',
          25000,
          { compress: false }
        );

        expect(result.success).toBe(false);
        expect(result.userFriendlyMessage).toContain(testCase.expectedUserMessage);
        expect(result.errorCode).toBe(testCase.expectedCode);
      }
    });

    it('should track error analytics for debugging', async () => {
      const mockFileInfo = {
        exists: true,
        size: 1 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      mockFetch.mockRejectedValue(new Error('Test error for analytics'));

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.errorDetails).toBeDefined();
      expect(result.errorDetails.timestamp).toBeDefined();
      expect(result.errorDetails.userAgent).toBeDefined();
      expect(result.errorDetails.platform).toBe('ios');
    });
  });
});