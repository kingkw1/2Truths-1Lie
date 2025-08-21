/**
 * Upload Service
 * Handles chunked file uploads with progress tracking
 * Integrates with backend chunked upload API
 */

export interface UploadOptions {
  chunkSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  retryBackoffMultiplier?: number;
  networkTimeoutMs?: number;
  onProgress?: (progress: UploadProgress) => void;
  onChunkComplete?: (chunkNumber: number, totalChunks: number) => void;
  onRetry?: (attempt: number, error: Error, chunkNumber?: number) => void;
  onNetworkError?: (error: Error) => void;
  signal?: AbortSignal;
}

export interface UploadProgress {
  sessionId: string;
  progress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  uploadedChunks: number;
  totalChunks: number;
  uploadSpeed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  retryCount?: number;
  lastError?: string;
}

export interface UploadSession {
  sessionId: string;
  uploadUrl: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: Date;
}

export interface UploadResult {
  sessionId: string;
  fileUrl: string;
  fileSize: number;
  completedAt: Date;
}

export enum UploadErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  HASH_MISMATCH = 'HASH_MISMATCH',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  CANCELLED = 'CANCELLED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class UploadError extends Error {
  public readonly type: UploadErrorType;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly sessionId?: string;
  public readonly chunkNumber?: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    type: UploadErrorType,
    options: {
      statusCode?: number;
      retryable?: boolean;
      sessionId?: string;
      chunkNumber?: number;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'UploadError';
    this.type = type;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? this.isRetryableByDefault(type);
    this.sessionId = options.sessionId;
    this.chunkNumber = options.chunkNumber;
    
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  private isRetryableByDefault(type: UploadErrorType): boolean {
    switch (type) {
      case UploadErrorType.NETWORK_ERROR:
      case UploadErrorType.SERVER_ERROR:
      case UploadErrorType.TIMEOUT_ERROR:
        return true;
      case UploadErrorType.CLIENT_ERROR:
      case UploadErrorType.AUTHENTICATION_ERROR:
      case UploadErrorType.VALIDATION_ERROR:
      case UploadErrorType.QUOTA_EXCEEDED:
      case UploadErrorType.FILE_TOO_LARGE:
      case UploadErrorType.UNSUPPORTED_FORMAT:
      case UploadErrorType.HASH_MISMATCH:
      case UploadErrorType.SESSION_EXPIRED:
      case UploadErrorType.CANCELLED:
        return false;
      default:
        return false;
    }
  }
}

export class ChunkedUploadService {
  private baseUrl: string;
  private authToken: string | null;

  constructor(baseUrl: string = '/api/v1') {
    this.baseUrl = baseUrl;
    this.authToken = localStorage.getItem('authToken');
  }

  /**
   * Calculate SHA-256 hash of a file or blob
   */
  private async calculateFileHash(file: File | Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Calculate SHA-256 hash of chunk data
   */
  private async calculateChunkHash(chunk: Blob): Promise<string> {
    return this.calculateFileHash(chunk);
  }

  /**
   * Make authenticated API request with enhanced error handling
   */
  private async makeRequest(
    url: string, 
    options: RequestInit = {},
    timeoutMs: number = 30000
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Create timeout controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    // Combine timeout with existing signal
    const combinedSignal = options.signal 
      ? this.combineAbortSignals([options.signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw this.createUploadError(response.status, errorText, url);
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      
      if (error instanceof UploadError) {
        throw error;
      }

      // Handle different error types
      const err = error as Error;
      if (err.name === 'AbortError') {
        if (timeoutController.signal.aborted) {
          throw new UploadError(
            `Request timeout after ${timeoutMs}ms`,
            UploadErrorType.TIMEOUT_ERROR,
            { retryable: true, cause: err }
          );
        } else {
          throw new UploadError(
            'Request cancelled',
            UploadErrorType.CANCELLED,
            { retryable: false, cause: err }
          );
        }
      }

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new UploadError(
          'Network connection failed',
          UploadErrorType.NETWORK_ERROR,
          { retryable: true, cause: err }
        );
      }

      throw new UploadError(
        err.message || 'Unknown error occurred',
        UploadErrorType.UNKNOWN_ERROR,
        { retryable: false, cause: err }
      );
    }
  }

  /**
   * Combine multiple AbortSignals
   */
  private combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    
    return controller.signal;
  }

  /**
   * Create appropriate UploadError based on HTTP status and response
   */
  private createUploadError(status: number, errorText: string, url: string): UploadError {
    let type: UploadErrorType;
    let retryable = false;

    if (status >= 500) {
      type = UploadErrorType.SERVER_ERROR;
      retryable = true;
    } else if (status === 429) {
      type = UploadErrorType.QUOTA_EXCEEDED;
      retryable = true; // Can retry after delay
    } else if (status === 413) {
      type = UploadErrorType.FILE_TOO_LARGE;
    } else if (status === 415) {
      type = UploadErrorType.UNSUPPORTED_FORMAT;
    } else if (status === 401 || status === 403) {
      type = UploadErrorType.AUTHENTICATION_ERROR;
    } else if (status === 400) {
      // Check if it's a validation error or hash mismatch
      if (errorText.toLowerCase().includes('hash')) {
        type = UploadErrorType.HASH_MISMATCH;
      } else {
        type = UploadErrorType.VALIDATION_ERROR;
      }
    } else if (status === 410) {
      type = UploadErrorType.SESSION_EXPIRED;
    } else {
      type = UploadErrorType.CLIENT_ERROR;
    }

    return new UploadError(
      `HTTP ${status}: ${errorText}`,
      type,
      { statusCode: status, retryable }
    );
  }

  /**
   * Initiate a new upload session
   */
  async initiateUpload(
    file: File,
    options: { chunkSize?: number; metadata?: Record<string, any> } = {}
  ): Promise<UploadSession> {
    const { chunkSize = 1024 * 1024, metadata = {} } = options; // 1MB default chunk size

    try {
      // Calculate file hash for integrity verification
      const fileHash = await this.calculateFileHash(file);

      const requestBody = {
        filename: file.name,
        file_size: file.size,
        chunk_size: chunkSize,
        file_hash: fileHash,
        mime_type: file.type,
        metadata,
      };

      const response = await this.makeRequest('/upload/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      return {
        sessionId: data.session_id,
        uploadUrl: data.upload_url,
        chunkSize: data.chunk_size,
        totalChunks: data.total_chunks,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error: unknown) {
      // Re-throw UploadError instances as-is
      if (error instanceof UploadError) {
        throw error;
      }
      
      // Convert other errors to UploadError
      const err = error as Error;
      throw new UploadError(
        err.message || 'Failed to initiate upload',
        UploadErrorType.UNKNOWN_ERROR,
        { retryable: true, cause: err }
      );
    }
  }

  /**
   * Upload a single chunk with robust retry logic
   */
  private async uploadChunk(
    sessionId: string,
    chunkNumber: number,
    chunkData: Blob,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      maxRetryDelay?: number;
      retryBackoffMultiplier?: number;
      networkTimeoutMs?: number;
      onRetry?: (attempt: number, error: UploadError) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<{ success: boolean; alreadyUploaded: boolean }> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      maxRetryDelay = 30000,
      retryBackoffMultiplier = 2,
      networkTimeoutMs = 30000,
      onRetry,
      signal
    } = options;

    let lastError: UploadError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check if request was cancelled
        if (signal?.aborted) {
          throw new UploadError(
            'Upload cancelled',
            UploadErrorType.CANCELLED,
            { sessionId, chunkNumber }
          );
        }

        // Calculate chunk hash for integrity verification
        const chunkHash = await this.calculateChunkHash(chunkData);

        // Prepare form data
        const formData = new FormData();
        formData.append('file', chunkData);
        formData.append('chunk_hash', chunkHash);

        const response = await this.makeRequest(
          `/upload/${sessionId}/chunk/${chunkNumber}`,
          {
            method: 'POST',
            body: formData,
            signal,
          },
          networkTimeoutMs
        );

        const result = await response.json();
        
        return {
          success: true,
          alreadyUploaded: result.status === 'already_exists',
        };
      } catch (error: unknown) {
        // Convert to UploadError if needed
        if (error instanceof UploadError) {
          lastError = error;
        } else {
          const err = error as Error;
          lastError = new UploadError(
            err.message || 'Unknown error',
            UploadErrorType.UNKNOWN_ERROR,
            { sessionId, chunkNumber, cause: err }
          );
        }

        // Don't retry if cancelled, not retryable, or if it's the last attempt
        if (
          lastError.type === UploadErrorType.CANCELLED ||
          !lastError.retryable ||
          attempt === maxRetries
        ) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = Math.min(
          retryDelay * Math.pow(retryBackoffMultiplier, attempt),
          maxRetryDelay
        );
        
        // Add jitter (±25% of base delay)
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.max(100, baseDelay + jitter);

        // Notify about retry
        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new UploadError(
      'Upload failed after retries',
      UploadErrorType.UNKNOWN_ERROR,
      { sessionId, chunkNumber }
    );
  }

  /**
   * Upload file with enhanced progress tracking and error handling
   */
  async uploadFile(
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      chunkSize = 1024 * 1024, // 1MB default
      maxRetries = 3,
      retryDelay = 1000,
      maxRetryDelay = 30000,
      retryBackoffMultiplier = 2,
      networkTimeoutMs = 30000,
      onProgress,
      onChunkComplete,
      onRetry,
      onNetworkError,
      signal,
    } = options;

    let session: UploadSession;
    let totalRetryCount = 0;

    try {
      // Initiate upload session with retry logic
      session = await this.initiateUploadWithRetry(file, { chunkSize }, {
        maxRetries,
        retryDelay,
        maxRetryDelay,
        retryBackoffMultiplier,
        networkTimeoutMs,
        onRetry,
        signal
      });
    } catch (error) {
      if (onNetworkError && error instanceof UploadError) {
        onNetworkError(error);
      }
      throw error;
    }
    
    const startTime = Date.now();
    let uploadedBytes = 0;
    let uploadedChunks = 0;

    // Helper to report progress
    const reportProgress = (status: UploadProgress['status'] = 'uploading', lastError?: string) => {
      const elapsedTime = (Date.now() - startTime) / 1000; // seconds
      const uploadSpeed = elapsedTime > 0 ? uploadedBytes / elapsedTime : 0;
      const remainingBytes = file.size - uploadedBytes;
      const estimatedTimeRemaining = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0;

      const progress: UploadProgress = {
        sessionId: session.sessionId,
        progress: (uploadedBytes / file.size) * 100,
        uploadedBytes,
        totalBytes: file.size,
        uploadedChunks,
        totalChunks: session.totalChunks,
        uploadSpeed,
        estimatedTimeRemaining,
        status,
        retryCount: totalRetryCount,
        lastError,
      };

      if (onProgress) {
        onProgress(progress);
      }
    };

    try {
      // Report initial progress
      reportProgress('uploading');

      // Upload chunks sequentially
      for (let chunkNumber = 0; chunkNumber < session.totalChunks; chunkNumber++) {
        // Check if cancelled
        if (signal?.aborted) {
          throw new UploadError(
            'Upload cancelled',
            UploadErrorType.CANCELLED,
            { sessionId: session.sessionId }
          );
        }

        // Calculate chunk boundaries
        const start = chunkNumber * session.chunkSize;
        const end = Math.min(start + session.chunkSize, file.size);
        const chunkData = file.slice(start, end);

        // Upload chunk with enhanced retry logic
        const result = await this.uploadChunk(
          session.sessionId,
          chunkNumber,
          chunkData,
          {
            maxRetries,
            retryDelay,
            maxRetryDelay,
            retryBackoffMultiplier,
            networkTimeoutMs,
            onRetry: (attempt, error) => {
              totalRetryCount++;
              reportProgress('retrying', error.message);
              if (onRetry) {
                onRetry(attempt, error, chunkNumber);
              }
            },
            signal
          }
        );

        // Update progress
        if (!result.alreadyUploaded) {
          uploadedBytes += chunkData.size;
        } else {
          // If chunk was already uploaded, count it towards progress
          uploadedBytes += chunkData.size;
        }
        
        uploadedChunks++;

        // Report progress
        reportProgress('uploading');

        // Notify chunk completion
        if (onChunkComplete) {
          onChunkComplete(chunkNumber, session.totalChunks);
        }
      }

      // Complete the upload with retry logic
      const completeData = await this.completeUploadWithRetry(session.sessionId, file, {
        maxRetries,
        retryDelay,
        maxRetryDelay,
        retryBackoffMultiplier,
        networkTimeoutMs,
        onRetry,
        signal
      });

      // Report final progress
      reportProgress('completed');

      return {
        sessionId: session.sessionId,
        fileUrl: completeData.file_url,
        fileSize: completeData.file_size,
        completedAt: new Date(completeData.completed_at),
      };
    } catch (error: unknown) {
      const err = error as Error;
      const uploadError = error instanceof UploadError ? error : new UploadError(
        err.message || 'Unknown error',
        UploadErrorType.UNKNOWN_ERROR,
        { sessionId: session?.sessionId, cause: err }
      );

      // Report error progress
      reportProgress(
        uploadError.type === UploadErrorType.CANCELLED ? 'cancelled' : 'failed',
        uploadError.message
      );

      if (onNetworkError && uploadError.type === UploadErrorType.NETWORK_ERROR) {
        onNetworkError(uploadError);
      }

      throw uploadError;
    }
  }

  /**
   * Initiate upload with retry logic
   */
  private async initiateUploadWithRetry(
    file: File,
    uploadOptions: { chunkSize?: number; metadata?: Record<string, any> },
    retryOptions: {
      maxRetries: number;
      retryDelay: number;
      maxRetryDelay: number;
      retryBackoffMultiplier: number;
      networkTimeoutMs: number;
      onRetry?: (attempt: number, error: UploadError) => void;
      signal?: AbortSignal;
    }
  ): Promise<UploadSession> {
    const { maxRetries, retryDelay, maxRetryDelay, retryBackoffMultiplier, networkTimeoutMs, onRetry, signal } = retryOptions;
    let lastError: UploadError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.initiateUpload(file, uploadOptions);
      } catch (error: unknown) {
        if (error instanceof UploadError) {
          lastError = error;
        } else {
          const err = error as Error;
          lastError = new UploadError(
            err.message || 'Failed to initiate upload',
            UploadErrorType.UNKNOWN_ERROR,
            { cause: err }
          );
        }

        if (
          lastError.type === UploadErrorType.CANCELLED ||
          !lastError.retryable ||
          attempt === maxRetries
        ) {
          break;
        }

        const baseDelay = Math.min(
          retryDelay * Math.pow(retryBackoffMultiplier, attempt),
          maxRetryDelay
        );
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.max(100, baseDelay + jitter);

        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new UploadError(
      'Failed to initiate upload after retries',
      UploadErrorType.UNKNOWN_ERROR
    );
  }

  /**
   * Complete upload with retry logic
   */
  private async completeUploadWithRetry(
    sessionId: string,
    file: File,
    retryOptions: {
      maxRetries: number;
      retryDelay: number;
      maxRetryDelay: number;
      retryBackoffMultiplier: number;
      networkTimeoutMs: number;
      onRetry?: (attempt: number, error: UploadError) => void;
      signal?: AbortSignal;
    }
  ): Promise<any> {
    const { maxRetries, retryDelay, maxRetryDelay, retryBackoffMultiplier, networkTimeoutMs, onRetry, signal } = retryOptions;
    let lastError: UploadError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const fileHash = await this.calculateFileHash(file);
        const completeResponse = await this.makeRequest(
          `/upload/${sessionId}/complete`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              session_id: sessionId,
              file_hash: fileHash,
            }),
            signal,
          },
          networkTimeoutMs
        );

        return await completeResponse.json();
      } catch (error: unknown) {
        if (error instanceof UploadError) {
          lastError = error;
        } else {
          const err = error as Error;
          lastError = new UploadError(
            err.message || 'Failed to complete upload',
            UploadErrorType.UNKNOWN_ERROR,
            { sessionId, cause: err }
          );
        }

        if (
          lastError.type === UploadErrorType.CANCELLED ||
          !lastError.retryable ||
          attempt === maxRetries
        ) {
          break;
        }

        const baseDelay = Math.min(
          retryDelay * Math.pow(retryBackoffMultiplier, attempt),
          maxRetryDelay
        );
        const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
        const delay = Math.max(100, baseDelay + jitter);

        if (onRetry) {
          onRetry(attempt + 1, lastError);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new UploadError(
      'Failed to complete upload after retries',
      UploadErrorType.UNKNOWN_ERROR,
      { sessionId }
    );
  }

  /**
   * Cancel an upload session
   */
  async cancelUpload(sessionId: string): Promise<void> {
    try {
      await this.makeRequest(`/upload/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      // Log error but don't throw - cancellation should always succeed locally
      console.warn('Failed to cancel upload on server:', error);
    }
  }

  /**
   * Get upload status
   */
  async getUploadStatus(sessionId: string): Promise<any> {
    const response = await this.makeRequest(`/upload/${sessionId}/status`);
    return response.json();
  }

  /**
   * Resume an interrupted upload
   */
  async resumeUpload(
    sessionId: string,
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Get current status
    const status = await this.getUploadStatus(sessionId);
    
    if (status.status === 'completed') {
      throw new Error('Upload already completed');
    }

    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error('Cannot resume failed or cancelled upload');
    }

    // Continue upload from where it left off
    // This would require modifying uploadFile to support resuming
    // For now, we'll restart the upload
    return this.uploadFile(file, options);
  }
}

// Export singleton instance
export const uploadService = new ChunkedUploadService();

export default uploadService;