/**
 * Mobile Video Upload Service
 * Handles secure video upload to backend with progress feedback and compression
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { mediaCompressor, CompressionOptions, CompressionProgress } from '../utils/mediaCompression.mobile';

export interface UploadProgress {
  stage: 'preparing' | 'compressing' | 'uploading' | 'finalizing';
  progress: number; // 0 to 100
  bytesUploaded?: number;
  totalBytes?: number;
  estimatedTimeRemaining?: number;
  currentChunk?: number;
  totalChunks?: number;
  startTime?: number;
}

export interface UploadOptions {
  compress?: boolean;
  compressionQuality?: number;
  maxFileSize?: number;
  chunkSize?: number;
  retryAttempts?: number;
  timeout?: number;
}

export interface UploadResult {
  success: boolean;
  mediaId?: string;
  streamingUrl?: string;
  cloudStorageKey?: string;
  storageType?: 'local' | 'cloud' | 'cloud_fallback';
  fileSize?: number;
  compressionRatio?: number;
  uploadTime?: number;
  error?: string;
}

export interface UploadSession {
  sessionId: string;
  uploadUrl: string;
  chunkSize: number;
  totalChunks: number;
  expiresAt: string;
}

export class VideoUploadService {
  private static instance: VideoUploadService;
  private baseUrl: string;
  private authToken: string | null = null;
  private activeUploads: Map<string, AbortController> = new Map();

  private constructor() {
    // In production, this would come from your app config
    this.baseUrl = __DEV__ 
      ? 'http://localhost:8000' 
      : 'https://your-production-api.com';
  }

  public static getInstance(): VideoUploadService {
    if (!VideoUploadService.instance) {
      VideoUploadService.instance = new VideoUploadService();
    }
    return VideoUploadService.instance;
  }

  /**
   * Set authentication token for API requests
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Initialize service with auth token from auth service
   */
  public async initialize(): Promise<void> {
    try {
      const { authService } = await import('./authService');
      await authService.initialize();
      
      const token = authService.getAuthToken();
      if (token) {
        this.setAuthToken(token);
      }
    } catch (error) {
      console.warn('Failed to initialize upload service with auth:', error);
    }
  }

  /**
   * Check if user has upload permission
   */
  public async checkUploadPermission(): Promise<boolean> {
    try {
      const { authService } = await import('./authService');
      return await authService.hasPermission('media:upload');
    } catch (error) {
      console.warn('Failed to check upload permission:', error);
      return false;
    }
  }

  /**
   * Generate signed URL for media access
   */
  public async generateSignedUrl(
    mediaId: string,
    expiresIn: number = 3600
  ): Promise<{
    signedUrl: string;
    expiresIn: number;
    expiresAt: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/media/generate-signed-url/${mediaId}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ expires_in: expiresIn }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to generate signed URL: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to generate signed URL:', error);
      throw error;
    }
  }

  /**
   * Get user's media library for cross-device access
   */
  public async getUserMediaLibrary(
    page: number = 1,
    limit: number = 50
  ): Promise<{
    media: Array<{
      mediaId: string;
      filename: string;
      streamingUrl: string;
      fileSize: number;
      duration: number;
      uploadedAt: string;
      deviceInfo?: string;
      storageType: string;
    }>;
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/media/library?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to fetch media library: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Failed to fetch user media library:', error);
      throw error;
    }
  }

  /**
   * Verify media accessibility across devices
   */
  public async verifyMediaAccess(mediaId: string): Promise<{
    accessible: boolean;
    streamingUrl?: string;
    deviceCompatible: boolean;
    requiresAuth: boolean;
    expiresAt?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/media/verify/${mediaId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Media verification failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Add device compatibility check
      result.deviceCompatible = this.isDeviceCompatible(result.mimeType);
      
      return result;
    } catch (error: any) {
      console.error('Media access verification failed:', error);
      return {
        accessible: false,
        deviceCompatible: false,
        requiresAuth: true,
      };
    }
  }

  /**
   * Sync media state across devices
   */
  public async syncMediaState(localMediaIds: string[]): Promise<{
    syncedMedia: Array<{
      mediaId: string;
      streamingUrl: string;
      lastModified: string;
      needsUpdate: boolean;
    }>;
    deletedMedia: string[];
    newMedia: Array<{
      mediaId: string;
      streamingUrl: string;
      uploadedAt: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/media/sync`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          localMediaIds,
          deviceInfo: {
            platform: Platform.OS,
            deviceId: await this.getDeviceId(),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Media sync failed: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Media sync failed:', error);
      throw error;
    }
  }

  /**
   * Check if media format is compatible with current device
   */
  private isDeviceCompatible(mimeType: string): boolean {
    const supportedFormats = Platform.select({
      ios: ['video/mp4', 'video/quicktime', 'video/x-m4v'],
      android: ['video/mp4', 'video/3gpp', 'video/webm'],
    }) || ['video/mp4'];

    return supportedFormats.includes(mimeType);
  }

  /**
   * Get device identifier for cross-device tracking
   */
  private async getDeviceId(): Promise<string> {
    try {
      // In a real app, you'd use a proper device ID library
      // For now, we'll create a simple identifier
      const deviceInfo = `${Platform.OS}_${Platform.Version}`;
      return deviceInfo;
    } catch (error) {
      console.warn('Failed to get device ID:', error);
      return `unknown_${Date.now()}`;
    }
  }

  /**
   * Upload video with compression and progress tracking
   */
  public async uploadVideo(
    videoUri: string,
    filename: string,
    duration: number,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    // Check upload permission before starting
    const hasPermission = await this.checkUploadPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Insufficient permissions for upload',
      };
    }
    const startTime = Date.now();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    let finalUri: string = videoUri;
    let finalFileSize = 0;
    let compressionRatio = 1;
    
    try {
      // Create abort controller for this upload
      const abortController = new AbortController();
      this.activeUploads.set(uploadId, abortController);

      onProgress?.({ stage: 'preparing', progress: 5, startTime });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found');
      }

      // Handle file size safely
      if ('size' in fileInfo) {
        finalFileSize = fileInfo.size || 0;
      } else {
        // Fallback for when size is not available
        finalFileSize = 0;
      }

      finalUri = videoUri;

      // Perform client-side validation before processing
      const clientValidation = this.validateVideoFile(filename, finalFileSize, duration);
      if (!clientValidation.valid) {
        throw new Error(clientValidation.error);
      }

      // Validate with server before upload
      const serverValidation = await this.validateWithServer(filename, finalFileSize, duration);
      if (!serverValidation.valid) {
        throw new Error(serverValidation.error);
      }

      // Compress video if needed
      if (options.compress !== false && finalFileSize > (options.maxFileSize || 25 * 1024 * 1024)) {
        onProgress?.({ stage: 'compressing', progress: 10, startTime });

        const compressionOptions: CompressionOptions = {
          quality: options.compressionQuality || 0.8,
          maxFileSize: options.maxFileSize || 50 * 1024 * 1024,
        };

        const compressionResult = await mediaCompressor.compressVideo(
          videoUri,
          compressionOptions,
          (compProgress: CompressionProgress) => {
            const overallProgress = 10 + (compProgress.progress * 0.3); // 10-40% for compression
            onProgress?.({ 
              stage: 'compressing', 
              progress: overallProgress,
              estimatedTimeRemaining: compProgress.estimatedTimeRemaining,
              startTime
            });
          }
        );

        finalUri = compressionResult.uri;
        finalFileSize = compressionResult.compressedSize;
        compressionRatio = compressionResult.compressionRatio;
      }

      onProgress?.({ stage: 'uploading', progress: 45, startTime });

      // Calculate file hash for integrity check
      const fileHash = await this.calculateFileHash(finalUri);

      // Initiate upload session
      const session = await this.initiateUpload(
        filename,
        finalFileSize,
        duration,
        this.getMimeType(filename),
        fileHash,
        abortController.signal
      );

      onProgress?.({ 
        stage: 'uploading', 
        progress: 50,
        totalChunks: session.totalChunks 
      });

      // Upload file in chunks
      await this.uploadInChunks(
        finalUri,
        session,
        fileHash,
        abortController.signal,
        (chunkProgress) => {
          const overallProgress = 50 + (chunkProgress * 0.4); // 50-90% for upload
          onProgress?.({
            stage: 'uploading',
            progress: overallProgress,
            bytesUploaded: Math.floor(chunkProgress * finalFileSize / 100),
            totalBytes: finalFileSize,
            currentChunk: Math.floor(chunkProgress * session.totalChunks / 100),
            totalChunks: session.totalChunks,
            startTime
          });
        }
      );

      onProgress?.({ stage: 'finalizing', progress: 95, startTime });

      // Complete upload and get streaming URL
      const completionResult = await this.completeUpload(
        session.sessionId,
        fileHash,
        abortController.signal
      );

      onProgress?.({ stage: 'finalizing', progress: 100, startTime });

      // Clean up temporary compressed file if created
      if (finalUri !== videoUri) {
        try {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        } catch (error) {
          console.warn('Failed to clean up compressed file:', error);
        }
      }

      const uploadTime = Date.now() - startTime;

      return {
        success: true,
        mediaId: completionResult.media_id,
        streamingUrl: completionResult.streaming_url,
        cloudStorageKey: completionResult.cloud_key,
        storageType: completionResult.storage_type,
        fileSize: finalFileSize,
        compressionRatio,
        uploadTime,
      };

    } catch (error: any) {
      console.error('Video upload failed:', error);
      
      // Clean up on error
      if (typeof finalUri !== 'undefined' && finalUri !== videoUri) {
        try {
          await FileSystem.deleteAsync(finalUri, { idempotent: true });
        } catch (cleanupError) {
          console.warn('Failed to clean up on error:', cleanupError);
        }
      }

      return {
        success: false,
        error: error.message || 'Upload failed',
      };
    } finally {
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Cancel an active upload
   */
  public cancelUpload(uploadId: string): boolean {
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active uploads
   */
  public cancelAllUploads(): void {
    for (const [uploadId, controller] of this.activeUploads) {
      controller.abort();
    }
    this.activeUploads.clear();
  }

  /**
   * Initiate upload session with backend
   */
  private async initiateUpload(
    filename: string,
    fileSize: number,
    duration: number,
    mimeType: string,
    fileHash: string,
    signal: AbortSignal
  ): Promise<UploadSession> {
    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('file_size', fileSize.toString());
    formData.append('duration_seconds', duration.toString());
    formData.append('mime_type', mimeType);
    formData.append('file_hash', fileHash);

    const response = await fetch(`${this.baseUrl}/api/v1/media/upload/initiate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload initiation failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      sessionId: data.session_id,
      uploadUrl: data.upload_url,
      chunkSize: data.chunk_size,
      totalChunks: data.total_chunks,
      expiresAt: data.expires_at,
    };
  }

  /**
   * Upload file in chunks with progress tracking
   */
  private async uploadInChunks(
    fileUri: string,
    session: UploadSession,
    fileHash: string,
    signal: AbortSignal,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    let fileSize = 0;
    if ('size' in fileInfo) {
      fileSize = fileInfo.size || 0;
    }
    
    let uploadedBytes = 0;

    for (let chunkNumber = 0; chunkNumber < session.totalChunks; chunkNumber++) {
      if (signal.aborted) {
        throw new Error('Upload cancelled');
      }

      const start = chunkNumber * session.chunkSize;
      const end = Math.min(start + session.chunkSize, fileSize);
      const chunkSize = end - start;

      // Read chunk data
      const chunkData = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: start,
        length: chunkSize,
      });

      // Convert base64 to blob for upload
      const chunkBlob = this.base64ToBlob(chunkData);
      
      // Calculate chunk hash
      const chunkHash = await this.calculateChunkHash(chunkData);

      // Upload chunk
      await this.uploadChunk(
        session.sessionId,
        chunkNumber,
        chunkBlob,
        chunkHash,
        signal
      );

      uploadedBytes += chunkSize;
      const progress = (uploadedBytes / fileSize) * 100;
      onProgress(progress);
    }
  }

  /**
   * Upload individual chunk
   */
  private async uploadChunk(
    sessionId: string,
    chunkNumber: number,
    chunkData: Blob,
    chunkHash: string,
    signal: AbortSignal
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', chunkData);
    formData.append('chunk_hash', chunkHash);

    const response = await fetch(
      `${this.baseUrl}/api/v1/media/upload/${sessionId}/chunk/${chunkNumber}`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(false), // Don't set Content-Type for FormData
        body: formData,
        signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Chunk upload failed: ${response.status}`);
    }
  }

  /**
   * Complete upload and get streaming URL
   */
  private async completeUpload(
    sessionId: string,
    fileHash: string,
    signal: AbortSignal
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file_hash', fileHash);

    const response = await fetch(
      `${this.baseUrl}/api/v1/media/upload/${sessionId}/complete`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(false),
        body: formData,
        signal,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload completion failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Calculate file hash for integrity verification
   */
  private async calculateFileHash(fileUri: string): Promise<string> {
    try {
      // For mobile, we'll use a simple hash based on file info
      // In production, you might want to use a proper hash library
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      let hashInput = fileUri;
      if ('size' in fileInfo) {
        hashInput += `_${fileInfo.size}`;
      }
      if ('modificationTime' in fileInfo) {
        hashInput += `_${fileInfo.modificationTime}`;
      }
      
      // Simple hash function (in production, use crypto library)
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(16);
    } catch (error) {
      console.warn('Failed to calculate file hash:', error);
      return Date.now().toString(16); // Fallback hash
    }
  }

  /**
   * Calculate chunk hash
   */
  private async calculateChunkHash(chunkData: string): Promise<string> {
    // Simple hash for chunk data
    let hash = 0;
    for (let i = 0; i < chunkData.length; i++) {
      const char = chunkData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64Data: string): Blob {
    // For React Native, we need to create a proper Blob
    // This is a simplified implementation
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'video/mp4' });
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      case 'avi':
        return 'video/x-msvideo';
      default:
        return Platform.select({
          ios: 'video/quicktime',
          android: 'video/mp4',
        }) || 'video/mp4';
    }
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(includeContentType: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    // Add user agent for mobile
    headers['User-Agent'] = `TwoTruthsLie-Mobile/${Platform.OS}`;
    
    return headers;
  }

  /**
   * Client-side video file validation
   */
  public validateVideoFile(filename: string, fileSize: number, duration: number): { valid: boolean; error?: string; errorCode?: string } {
    // File size limits
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const MIN_FILE_SIZE = 100 * 1024; // 100KB
    
    // Duration limits
    const MIN_DURATION = 3; // 3 seconds
    const MAX_DURATION = 60; // 60 seconds
    
    // Allowed extensions
    const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
    
    // Check filename
    if (!filename || filename.trim().length === 0) {
      return { valid: false, error: 'Filename is required', errorCode: 'MISSING_FILENAME' };
    }
    
    if (filename.length > 255) {
      return { valid: false, error: 'Filename too long (max 255 characters)', errorCode: 'FILENAME_TOO_LONG' };
    }
    
    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return { valid: false, error: 'Filename contains invalid characters', errorCode: 'INVALID_FILENAME_CHARS' };
    }
    
    // Check for path traversal attempts
    if (filename.includes('..') || filename.startsWith('/') || filename.includes('\\')) {
      return { valid: false, error: 'Filename contains path traversal patterns', errorCode: 'INVALID_FILENAME_CHARS' };
    }
    
    // Check for dangerous extensions (executable files)
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(extension)) {
      return { valid: false, error: 'Dangerous file extension detected', errorCode: 'INVALID_EXTENSION' };
    }
    
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return { 
        valid: false, 
        error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`, 
        errorCode: 'INVALID_EXTENSION' 
      };
    }
    
    // Check file size
    if (fileSize > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File too large (${Math.round(fileSize / 1024 / 1024)}MB). Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`, 
        errorCode: 'FILE_TOO_LARGE' 
      };
    }
    
    if (fileSize < MIN_FILE_SIZE) {
      return { 
        valid: false, 
        error: `File too small (${Math.round(fileSize / 1024)}KB). Min size: ${MIN_FILE_SIZE / 1024}KB`, 
        errorCode: 'FILE_TOO_SMALL' 
      };
    }
    
    // Check duration
    if (duration < MIN_DURATION) {
      return { 
        valid: false, 
        error: `Video too short (${duration}s). Minimum: ${MIN_DURATION}s`, 
        errorCode: 'DURATION_TOO_SHORT' 
      };
    }
    
    if (duration > MAX_DURATION) {
      return { 
        valid: false, 
        error: `Video too long (${duration}s). Maximum: ${MAX_DURATION}s`, 
        errorCode: 'DURATION_TOO_LONG' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate file with server before upload
   */
  private async validateWithServer(
    filename: string, 
    fileSize: number, 
    duration: number
  ): Promise<{ valid: boolean; error?: string; errorCode?: string }> {
    try {
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('file_size', fileSize.toString());
      formData.append('duration_seconds', duration.toString());
      formData.append('mime_type', this.getMimeType(filename));

      const response = await fetch(`${this.baseUrl}/api/v1/media/validate`, {
        method: 'POST',
        headers: this.getAuthHeaders(false),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: errorData.detail || `Server validation failed: ${response.status}`,
          errorCode: errorData.error_code || 'SERVER_VALIDATION_FAILED'
        };
      }

      const validation = await response.json();
      
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error,
          errorCode: validation.error_code || 'VALIDATION_FAILED'
        };
      }

      return { valid: true };

    } catch (error: any) {
      console.warn('Server validation failed, proceeding with client validation only:', error);
      // Don't fail upload if server validation is unavailable
      return { valid: true };
    }
  }

  /**
   * Get upload statistics
   */
  public getUploadStats(): {
    activeUploads: number;
    platform: string;
    baseUrl: string;
  } {
    return {
      activeUploads: this.activeUploads.size,
      platform: Platform.OS,
      baseUrl: this.baseUrl,
    };
  }
}

// Export singleton instance
export const videoUploadService = VideoUploadService.getInstance();