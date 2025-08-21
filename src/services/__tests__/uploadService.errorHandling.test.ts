/**
 * Tests for enhanced error handling and retry logic in ChunkedUploadService
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

describe('ChunkedUploadService - Error Handling', () => {
  let uploadService: ChunkedUploadService;
  let mockFile: File;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock localStorage first
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
    
    // Create service after localStorage is mocked
    uploadService = new ChunkedUploadService();
    
    // Mock file with arrayBuffer method
    const mockArrayBuffer = new ArrayBuffer(12);
    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // Mock arrayBuffer for both File and Blob prototypes
    const mockArrayBufferMethod = jest.fn().mockResolvedValue(mockArrayBuffer);
    Object.defineProperty(mockFile, 'arrayBuffer', {
      value: mockArrayBufferMethod,
      writable: true,
      configurable: true,
    });
    
    // Mock Blob.prototype.arrayBuffer for sliced chunks
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      value: mockArrayBufferMethod,
      writable: true,
      configurable: true,
    });
    
    // Mock crypto.subtle.digest
    mockCrypto.subtle.digest.mockResolvedValue(
      new ArrayBuffer(32) // Mock SHA-256 hash
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Network Error Handling', () => {
    it('handles network connection failures', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(uploadService.initiateUpload(mockFile)).rejects.toThrow(UploadError);
      
      try {
        await uploadService.initiateUpload(mockFile);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.NETWORK_ERROR);
        expect((error as UploadError).retryable).toBe(true);
      }
    });

    it('handles request timeouts', async () => {
      jest.setTimeout(10000); // Increase timeout for this test
      
      // Mock a request that never resolves
      mockFetch.mockImplementationOnce(() => new Promise(() => {}));

      const uploadPromise = uploadService.initiateUpload(mockFile);
      
      // Fast-forward past the timeout
      jest.advanceTimersByTime(31000);

      await expect(uploadPromise).rejects.toThrow(UploadError);
      
      try {
        await uploadPromise;
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.TIMEOUT_ERROR);
        expect((error as UploadError).retryable).toBe(true);
      }
    }, 10000);

    it('handles abort signals correctly', async () => {
      const abortController = new AbortController();
      
      mockFetch.mockImplementationOnce(() => {
        abortController.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      await expect(
        uploadService.initiateUpload(mockFile)
      ).rejects.toThrow(UploadError);
      
      try {
        await uploadService.initiateUpload(mockFile);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.CANCELLED);
        expect((error as UploadError).retryable).toBe(false);
      }
    });
  });

  describe('HTTP Error Handling', () => {
    it('handles 500 server errors as retryable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      try {
        await uploadService.initiateUpload(mockFile);
        fail('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.SERVER_ERROR);
        expect((error as UploadError).retryable).toBe(true);
        expect((error as UploadError).statusCode).toBe(500);
      }
    });

    it('handles 413 file too large errors as non-retryable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: async () => 'File too large',
      });

      try {
        await uploadService.initiateUpload(mockFile);
        fail('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.FILE_TOO_LARGE);
        expect((error as UploadError).retryable).toBe(false);
        expect((error as UploadError).statusCode).toBe(413);
      }
    });

    it('handles 429 rate limiting as retryable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      });

      try {
        await uploadService.initiateUpload(mockFile);
        fail('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.QUOTA_EXCEEDED);
        expect((error as UploadError).retryable).toBe(true);
        expect((error as UploadError).statusCode).toBe(429);
      }
    });

    it('handles 401 authentication errors as non-retryable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      try {
        await uploadService.initiateUpload(mockFile);
        fail('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.AUTHENTICATION_ERROR);
        expect((error as UploadError).retryable).toBe(false);
        expect((error as UploadError).statusCode).toBe(401);
      }
    });

    it('handles hash mismatch errors correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Hash mismatch detected',
      });

      try {
        await uploadService.initiateUpload(mockFile);
        fail('Expected error to be thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(UploadError);
        expect((error as UploadError).type).toBe(UploadErrorType.HASH_MISMATCH);
        expect((error as UploadError).retryable).toBe(false);
      }
    });
  });

  describe('Retry Logic', () => {
    it('retries failed requests with exponential backoff', async () => {
      const onRetry = jest.fn();
      
      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload failures then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session_id: 'test-session-123',
            chunk_number: 0,
            status: 'uploaded',
          }),
        });

      // Mock complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          status: 'completed',
          file_url: '/api/v1/files/test-session-123_test.txt',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 2,
        retryDelay: 100,
        onRetry,
      });

      // Advance timers to allow retries
      jest.advanceTimersByTime(5000);

      const result = await uploadPromise;

      expect(result.sessionId).toBe('test-session-123');
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledTimes(5); // initiate + 3 chunk attempts + complete
    });

    it('respects maximum retry attempts', async () => {
      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload failures
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 2,
        retryDelay: 10,
      });

      // Advance timers to allow retries
      jest.advanceTimersByTime(5000);

      await expect(uploadPromise).rejects.toThrow(UploadError);
      
      // Should have made: initiate + 1 initial attempt + 2 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('uses exponential backoff with jitter', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;
      
      global.setTimeout = jest.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0);
      }) as any;

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload failures
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 3,
        retryDelay: 1000,
        retryBackoffMultiplier: 2,
      });

      await expect(uploadPromise).rejects.toThrow(UploadError);

      // Check that delays increase (with some tolerance for jitter)
      expect(delays.length).toBeGreaterThan(0);
      if (delays.length > 1) {
        expect(delays[1]).toBeGreaterThan(delays[0] * 0.75); // Account for jitter
      }

      global.setTimeout = originalSetTimeout;
    });

    it('does not retry non-retryable errors', async () => {
      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload with non-retryable error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        uploadService.uploadFile(mockFile, {
          chunkSize: 1024,
          maxRetries: 3,
          retryDelay: 10,
        })
      ).rejects.toThrow(UploadError);

      // Should not retry authentication errors
      expect(mockFetch).toHaveBeenCalledTimes(2); // initiate + 1 chunk attempt
    });
  });

  describe('Progress Reporting During Errors', () => {
    it('reports retry status in progress updates', async () => {
      const onProgress = jest.fn();
      const onRetry = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload failure then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session_id: 'test-session-123',
            chunk_number: 0,
            status: 'uploaded',
          }),
        });

      // Mock complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          status: 'completed',
          file_url: '/api/v1/files/test-session-123_test.txt',
          file_size: mockFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 1,
        retryDelay: 10,
        onProgress,
        onRetry,
      });

      jest.advanceTimersByTime(1000);
      await uploadPromise;

      // Check that progress was reported with retry status
      const retryingProgress = onProgress.mock.calls.find(
        call => call[0].status === 'retrying'
      );
      expect(retryingProgress).toBeDefined();
      expect(retryingProgress[0].lastError).toContain('Server error');
      expect(retryingProgress[0].retryCount).toBeGreaterThan(0);
    });

    it('reports final error status on failure', async () => {
      const onProgress = jest.fn();

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk upload failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const uploadPromise = uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 1,
        retryDelay: 10,
        onProgress,
      });

      jest.advanceTimersByTime(1000);
      await expect(uploadPromise).rejects.toThrow(UploadError);

      // Check that final progress shows failed status
      const lastProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastProgress.status).toBe('failed');
      expect(lastProgress.lastError).toContain('Server error');
    });
  });
});