/**
 * Tests for ChunkedUploadService
 */

import { ChunkedUploadService } from '../uploadService';

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

describe('ChunkedUploadService', () => {
  let uploadService: ChunkedUploadService;
  let mockFile: File;

  beforeEach(() => {
    jest.clearAllMocks();
    
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

  describe('initiateUpload', () => {
    it('initiates upload session successfully', async () => {
      const mockResponse = {
        session_id: 'test-session-123',
        upload_url: '/api/v1/upload/test-session-123/chunk',
        chunk_size: 1024 * 1024,
        total_chunks: 1,
        expires_at: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const session = await uploadService.initiateUpload(mockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/upload/initiate',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token',
          },
          body: expect.stringContaining('"filename":"test.txt"'),
        })
      );

      expect(session).toEqual({
        sessionId: 'test-session-123',
        uploadUrl: '/api/v1/upload/test-session-123/chunk',
        chunkSize: 1024 * 1024,
        totalChunks: 1,
        expiresAt: expect.any(Date),
      });
    });

    it('includes file hash in initiation request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024 * 1024,
          total_chunks: 1,
          expires_at: new Date().toISOString(),
        }),
      });

      await uploadService.initiateUpload(mockFile);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.file_hash).toBeDefined();
      expect(requestBody.mime_type).toBe('text/plain');
      expect(requestBody.file_size).toBe(mockFile.size);
    });

    it('handles initiation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'File too large',
      });

      await expect(uploadService.initiateUpload(mockFile)).rejects.toThrow(
        'HTTP 400: File too large'
      );
    });
  });

  describe('uploadFile', () => {
    it('uploads file successfully with progress tracking', async () => {
      const onProgress = jest.fn();
      const onChunkComplete = jest.fn();

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

      // Mock chunk upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          chunk_number: 0,
          status: 'uploaded',
          uploaded_chunks: [0],
          remaining_chunks: [],
          progress_percent: 100,
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

      const result = await uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        onProgress,
        onChunkComplete,
      });

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

      expect(onChunkComplete).toHaveBeenCalledWith(0, 1);

      expect(result).toEqual({
        sessionId: 'test-session-123',
        fileUrl: '/api/v1/files/test-session-123_test.txt',
        fileSize: mockFile.size,
        completedAt: expect.any(Date),
      });
    });

    it('handles chunk upload failures with retry', async () => {
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
            uploaded_chunks: [0],
            remaining_chunks: [],
            progress_percent: 100,
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

      const result = await uploadService.uploadFile(mockFile, {
        chunkSize: 1024,
        maxRetries: 1,
        retryDelay: 10, // Short delay for testing
        onProgress,
      });

      expect(result.sessionId).toBe('test-session-123');
      expect(mockFetch).toHaveBeenCalledTimes(4); // initiate + 2 chunk attempts + complete
    });

    it('handles upload cancellation', async () => {
      const abortController = new AbortController();
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

      // Mock chunk upload to be aborted
      mockFetch.mockImplementationOnce(() => {
        // Simulate aborted fetch request
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      // Cancel immediately
      setTimeout(() => abortController.abort(), 10);

      await expect(
        uploadService.uploadFile(mockFile, {
          chunkSize: 1024,
          signal: abortController.signal,
          onProgress,
        })
      ).rejects.toThrow('Request cancelled');

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
        })
      );
    });

    it('calculates upload speed and ETA', async () => {
      jest.useFakeTimers();
      const onProgress = jest.fn();

      // Create larger file for meaningful speed calculation
      const largeFile = new File(['x'.repeat(2048)], 'large.txt', { type: 'text/plain' });

      // Mock initiate response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          upload_url: '/api/v1/upload/test-session-123/chunk',
          chunk_size: 1024,
          total_chunks: 2,
          expires_at: new Date().toISOString(),
        }),
      });

      // Mock chunk uploads
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session_id: 'test-session-123',
            chunk_number: 0,
            status: 'uploaded',
            uploaded_chunks: [0],
            remaining_chunks: [1],
            progress_percent: 50,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            session_id: 'test-session-123',
            chunk_number: 1,
            status: 'uploaded',
            uploaded_chunks: [0, 1],
            remaining_chunks: [],
            progress_percent: 100,
          }),
        });

      // Mock complete response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session-123',
          status: 'completed',
          file_url: '/api/v1/files/test-session-123_large.txt',
          file_size: largeFile.size,
          completed_at: new Date().toISOString(),
        }),
      });

      const uploadPromise = uploadService.uploadFile(largeFile, {
        chunkSize: 1024,
        onProgress,
      });

      // Advance time to simulate upload duration
      jest.advanceTimersByTime(1000);

      await uploadPromise;

      // Should have called onProgress with speed and ETA calculations
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadSpeed: expect.any(Number),
          estimatedTimeRemaining: expect.any(Number),
        })
      );

      jest.useRealTimers();
    });
  });

  describe('cancelUpload', () => {
    it('cancels upload session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Upload cancelled' }),
      });

      await uploadService.cancelUpload('test-session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/upload/test-session-123',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer mock-auth-token',
          },
        })
      );
    });

    it('handles cancel errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Session not found',
      });

      // Should not throw error
      await expect(uploadService.cancelUpload('test-session-123')).resolves.toBeUndefined();
    });
  });

  describe('getUploadStatus', () => {
    it('retrieves upload status', async () => {
      const mockStatus = {
        session_id: 'test-session-123',
        status: 'in_progress',
        progress_percent: 50,
        uploaded_chunks: [0, 1],
        remaining_chunks: [2, 3],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      });

      const status = await uploadService.getUploadStatus('test-session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/upload/test-session-123/status',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-auth-token',
          },
        })
      );

      expect(status).toEqual(mockStatus);
    });
  });

  describe('Hash Calculation', () => {
    it('calculates file hash correctly', async () => {
      // Mock ArrayBuffer and Uint8Array for hash calculation
      const mockArrayBuffer = new ArrayBuffer(32);
      const mockUint8Array = new Uint8Array(mockArrayBuffer);
      mockUint8Array.fill(255); // Fill with 0xFF for predictable hash

      mockCrypto.subtle.digest.mockResolvedValueOnce(mockArrayBuffer);

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

      await uploadService.initiateUpload(mockFile);

      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
      expect(mockFile.arrayBuffer).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('includes auth token in requests when available', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-token-123');
      
      const newService = new ChunkedUploadService();
      
      // Create new mock file for this test
      const newMockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(newMockFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(12)),
      });
      
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

      await newService.initiateUpload(newMockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/upload/initiate',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
          }),
        })
      );
    });

    it('works without auth token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const newService = new ChunkedUploadService();
      
      // Create new mock file for this test
      const newMockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(newMockFile, 'arrayBuffer', {
        value: jest.fn().mockResolvedValue(new ArrayBuffer(12)),
      });
      
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

      await newService.initiateUpload(newMockFile);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });
});