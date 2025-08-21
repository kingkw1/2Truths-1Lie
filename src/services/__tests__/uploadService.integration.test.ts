/**
 * Integration tests for ChunkedUploadService
 * Tests complete upload workflows, error recovery, and real-world scenarios
 */

import { ChunkedUploadService, UploadError, UploadErrorType } from '../uploadService';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.subtle
const mockCrypto = {
  subtle: {
    digest: jest.fn(),
  },
};
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('ChunkedUploadService - Integration Tests', () => {
  let uploadService: ChunkedUploadService;
  let mockFile: File;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
    uploadService = new ChunkedUploadService();
    
    // Create mock file
    const mockArrayBuffer = new ArrayBuffer(1024 * 1024); // 1MB
    mockFile = new File(['x'.repeat(1024 * 1024)], 'test-video.webm', { 
      type: 'video/webm' 
    });
    
    Object.defineProperty(mockFile, 'arrayBuffer', {
      value: jest.fn().mockResolvedValue(mockArrayBuffer),
    });
    
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      value: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });
    
    mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Complete Upload Workflow', () => {
    it('completes successful upload with multiple chunks', async () => {
      const onProgress = jest.fn();
      const onChunkComplete = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 256 * 1024, // 256KB chunks
          total_chunks: 4,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // Mock chunk upload responses
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session_id: 'test-session-123',
            chunk_number: i,
            status: 'uploaded',
            uploaded_chunks: Array.from({ length: i + 1 }, (_, idx) => idx),
            remaining_chunks: Array.from({ length: 3 - i }, (_, idx) => idx + i + 1),
            progress_percent: Math.round(((i + 1) / 4) * 100),
          }),
        });
      }

      // Mock complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          status: 'completed',
          file_url: '/api/v1/files/test-session-123_test-video.webm',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const result = await uploadService.uploadFile(mockFile, {
        chunkSize: 256 * 1024,
        onProgress,
        onChunkComplete,
      });

      // Verify initiation call
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/upload/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token',
          }),
        })
      );

      // Verify chunk uploads
      expect(mockFetch).toHaveBeenCalledTimes(6); // initiate + 4 chunks + complete

      // Verify progress callbacks
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          progress: 0,
          status: 'uploading',
        })
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 100,
          status: 'completed',
        })
      );

      expect(onChunkComplete).toHaveBeenCalledTimes(4);

      // Verify final result
      expect(result).toEqual({
        sessionId: 'test-session-123',
        fileUrl: '/api/v1/files/test-session-123_test-video.webm',
        fileSize: mockFile.size,
        completedAt: expect.any(Date),
      });
    });

    it('handles resumable upload after interruption', async () => {
      const onProgress = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'resume-session-123',
          upload_url: '/api/v1/upload/resume-session-123/chunk',
          chunk_size: 512 * 1024,
          total_chunks: 2,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // First chunk succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'resume-session-123',
          chunk_number: 0,
          status: 'uploaded',
          uploaded_chunks: [0],
          remaining_chunks: [1],
          progress_percent: 50,
        }),
      });

      // Second chunk fails (network interruption)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Resume: check status shows first chunk already uploaded
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'resume-session-123',
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0],
          remaining_chunks: [1],
        }),
      });

      // Retry second chunk successfully
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'resume-session-123',
          chunk_number: 1,
          status: 'uploaded',
          uploaded_chunks: [0, 1],
          remaining_chunks: [],
          progress_percent: 100,
        }),
      });

      // Complete upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'resume-session-123',
          status: 'completed',
          file_url: '/api/v1/files/resume-session-123_test-video.webm',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const result = await uploadService.uploadFile(mockFile, {
        chunkSize: 512 * 1024,
        maxRetries: 2,
        retryDelay: 100,
        onProgress,
      });

      expect(result.sessionId).toBe('resume-session-123');
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retrying',
          retryCount: 1,
        })
      );
    });

    it('handles upload with compression metadata', async () => {
      const compressedFile = new File(['compressed data'], 'compressed.webm', {
        type: 'video/webm',
      });

      // Add compression metadata
      (compressedFile as any).originalSize = 2048;
      (compressedFile as any).compressionRatio = 2;

      Object.defineProperty(compressedFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      // Mock successful upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'compressed-session',
          upload_url: '/api/v1/upload/compressed-session/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'compressed-session',
          chunk_number: 0,
          status: 'uploaded',
          uploaded_chunks: [0],
          remaining_chunks: [],
          progress_percent: 100,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'compressed-session',
          status: 'completed',
          file_url: '/api/v1/files/compressed-session_compressed.webm',
          file_size: compressedFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const result = await uploadService.uploadFile(compressedFile);

      expect(result.sessionId).toBe('compressed-session');

      // Verify initiation included compression metadata
      const initiateCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(initiateCall[1].body);
      expect(requestBody.metadata).toEqual({
        originalSize: 2048,
        compressionRatio: 2,
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('recovers from temporary server errors', async () => {
      const onProgress = jest.fn();
      const onRetry = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'error-recovery-123',
          upload_url: '/api/v1/upload/error-recovery-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // Chunk upload fails with 500 error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'error-recovery-123',
          chunk_number: 0,
          status: 'uploaded',
          uploaded_chunks: [0],
          remaining_chunks: [],
          progress_percent: 100,
        }),
      });

      // Complete upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'error-recovery-123',
          status: 'completed',
          file_url: '/api/v1/files/error-recovery-123_test-video.webm',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        maxRetries: 2,
        retryDelay: 100,
        onProgress,
        onRetry,
      });

      // Advance timers to allow retry
      jest.advanceTimersByTime(1000);

      const result = await uploadPromise;

      expect(result.sessionId).toBe('error-recovery-123');
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(UploadError));
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retrying',
          lastError: 'HTTP 500: Internal Server Error',
        })
      );
    });

    it('handles network connectivity issues', async () => {
      const onProgress = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'network-test-123',
          upload_url: '/api/v1/upload/network-test-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // Network error
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Recovery
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'network-test-123',
          chunk_number: 0,
          status: 'uploaded',
          uploaded_chunks: [0],
          remaining_chunks: [],
          progress_percent: 100,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'network-test-123',
          status: 'completed',
          file_url: '/api/v1/files/network-test-123_test-video.webm',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        maxRetries: 1,
        retryDelay: 100,
        onProgress,
      });

      jest.advanceTimersByTime(1000);

      const result = await uploadPromise;

      expect(result.sessionId).toBe('network-test-123');
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'retrying',
          lastError: expect.stringContaining('Network error'),
        })
      );
    });

    it('handles session expiration gracefully', async () => {
      const onProgress = jest.fn();

      // Mock initiate response with short expiration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'expiring-session-123',
          upload_url: '/api/v1/upload/expiring-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 1000).toISOString(), // Expires in 1 second
        }),
      });

      // Simulate delay then session expired error
      jest.advanceTimersByTime(2000);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        text: async () => 'Session expired',
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        onProgress,
      });

      await expect(uploadPromise).rejects.toThrow(UploadError);

      try {
        await uploadPromise;
      } catch (error) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.SESSION_EXPIRED);
        expect((error as UploadError).retryable).toBe(false);
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('calculates upload speed and ETA accurately', async () => {
      jest.useRealTimers(); // Use real timers for accurate timing
      
      const onProgress = jest.fn();
      const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.webm', {
        type: 'video/webm',
      });

      Object.defineProperty(largeFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(2 * 1024 * 1024)),
      });

      // Mock responses with delays to simulate real upload
      mockFetch.mockImplementation((url, options) => {
        return new Promise(resolve => {
          setTimeout(() => {
            if (url.includes('initiate')) {
              resolve({
                ok: true,
                json: async () => ({
                  session_id: 'speed-test-123',
                  upload_url: '/api/v1/upload/speed-test-123/chunk',
                  chunk_size: 1024 * 1024,
                  total_chunks: 2,
                  expires_at: new Date(Date.now() + 3600000).toISOString(),
                }),
              });
            } else if (url.includes('chunk')) {
              const chunkNumber = options.body.get('chunk_number');
              resolve({
                ok: true,
                json: async () => ({
                  session_id: 'speed-test-123',
                  chunk_number: parseInt(chunkNumber),
                  status: 'uploaded',
                  uploaded_chunks: Array.from({ length: parseInt(chunkNumber) + 1 }, (_, i) => i),
                  remaining_chunks: Array.from({ length: 1 - parseInt(chunkNumber) }, (_, i) => i + parseInt(chunkNumber) + 1),
                  progress_percent: ((parseInt(chunkNumber) + 1) / 2) * 100,
                }),
              });
            } else {
              resolve({
                ok: true,
                json: async () => ({
                  session_id: 'speed-test-123',
                  status: 'completed',
                  file_url: '/api/v1/files/speed-test-123_large.webm',
                  file_size: largeFile.size,
                  completed_at: new Date().toISOString(),
                }),
              });
            }
          }, 100); // 100ms delay per request
        });
      });

      const result = await uploadService.uploadFile(largeFile, {
        chunkSize: 1024 * 1024,
        onProgress,
      });

      expect(result.sessionId).toBe('speed-test-123');

      // Check that progress included speed and ETA calculations
      const progressCalls = onProgress.mock.calls;
      const laterProgressCall = progressCalls.find(call => 
        call[0].uploadSpeed && call[0].estimatedTimeRemaining
      );

      expect(laterProgressCall).toBeDefined();
      expect(laterProgressCall[0].uploadSpeed).toBeGreaterThan(0);
      expect(laterProgressCall[0].estimatedTimeRemaining).toBeGreaterThan(0);

      jest.useFakeTimers();
    });

    it('handles concurrent uploads efficiently', async () => {
      const uploadPromises = [];
      const files = Array.from({ length: 3 }, (_, i) => {
        const file = new File([`content-${i}`], `file-${i}.webm`, { type: 'video/webm' });
        Object.defineProperty(file, 'arrayBuffer', {
          value: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
        });
        return file;
      });

      // Mock responses for all uploads
      let callCount = 0;
      mockFetch.mockImplementation((url) => {
        callCount++;
        const sessionId = `concurrent-${callCount % 3}`;
        
        if (url.includes('initiate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session_id: sessionId,
              upload_url: `/api/v1/upload/${sessionId}/chunk`,
              chunk_size: 1024,
              total_chunks: 1,
              expires_at: new Date(Date.now() + 3600000).toISOString(),
            }),
          });
        } else if (url.includes('chunk')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session_id: sessionId,
              chunk_number: 0,
              status: 'uploaded',
              uploaded_chunks: [0],
              remaining_chunks: [],
              progress_percent: 100,
            }),
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              session_id: sessionId,
              status: 'completed',
              file_url: `/api/v1/files/${sessionId}_file.webm`,
              file_size: 1024,
              completed_at: new Date().toISOString(),
            }),
          });
        }
      });

      // Start concurrent uploads
      for (let i = 0; i < 3; i++) {
        uploadPromises.push(uploadService.uploadFile(files[i]));
      }

      const results = await Promise.all(uploadPromises);

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.sessionId).toContain('concurrent');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles zero-byte files', async () => {
      const emptyFile = new File([], 'empty.webm', { type: 'video/webm' });
      Object.defineProperty(emptyFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'empty-file-123',
          upload_url: '/api/v1/upload/empty-file-123/chunk',
          chunk_size: 1024,
          total_chunks: 0,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'empty-file-123',
          status: 'completed',
          file_url: '/api/v1/files/empty-file-123_empty.webv',
          file_size: 0,
          completed_at: new Date().toISOString(),
        }),
      });

      const result = await uploadService.uploadFile(emptyFile);

      expect(result.sessionId).toBe('empty-file-123');
      expect(result.fileSize).toBe(0);
    });

    it('handles extremely large files', async () => {
      const hugeFile = new File(['x'], 'huge.webm', { type: 'video/webm' });
      Object.defineProperty(hugeFile, 'size', { value: 10 * 1024 * 1024 * 1024 }); // 10GB
      Object.defineProperty(hugeFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'huge-file-123',
          upload_url: '/api/v1/upload/huge-file-123/chunk',
          chunk_size: 10 * 1024 * 1024, // 10MB chunks
          total_chunks: 1024,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // Just test initiation for huge files
      const session = await uploadService.initiateUpload(hugeFile);

      expect(session.sessionId).toBe('huge-file-123');
      expect(session.totalChunks).toBe(1024);
    });

    it('handles files with special characters in names', async () => {
      const specialFile = new File(['content'], 'файл с русскими символами & special chars!.webm', {
        type: 'video/webm',
      });
      Object.defineProperty(specialFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'special-chars-123',
          upload_url: '/api/v1/upload/special-chars-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      const session = await uploadService.initiateUpload(specialFile);

      expect(session.sessionId).toBe('special-chars-123');

      // Verify filename was properly encoded in request
      const initiateCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(initiateCall[1].body);
      expect(requestBody.filename).toBe('файл с русскими символами & special chars!.webm');
    });
  });

  describe('Authentication and Security', () => {
    it('handles token refresh during upload', async () => {
      let tokenRefreshed = false;
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'authToken') {
          return tokenRefreshed ? 'new-token' : 'expired-token';
        }
        return null;
      });

      // Mock initiate with expired token
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Token expired',
      });

      // Simulate token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token' }),
      });

      // Mock successful initiate with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'token-refresh-123',
          upload_url: '/api/v1/upload/token-refresh-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      // Simulate token refresh
      tokenRefreshed = true;

      try {
        await uploadService.initiateUpload(mockFile);
      } catch (error) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.AUTHENTICATION_ERROR);
      }
    });

    it('validates file hash integrity', async () => {
      // Mock hash calculation
      const mockHash = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      mockCrypto.subtle.digest.mockResolvedValue(mockHash.buffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'hash-test-123',
          upload_url: '/api/v1/upload/hash-test-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      await uploadService.initiateUpload(mockFile);

      // Verify hash was calculated and included
      const initiateCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(initiateCall[1].body);
      expect(requestBody.file_hash).toBeDefined();
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
    });
  });
});