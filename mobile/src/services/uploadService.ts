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
    // Force development URL for now
    console.log('🌐 UPLOAD: Using development URL');
    this.baseUrl = 'http://192.168.50.111:8001';
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
   * Upload video directly to S3 endpoint
   */
  public async uploadVideo(
    videoUri: string,
    filename: string,
    duration: number,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      console.log('🚀 UPLOAD: Starting video upload process...');
      console.log('🚀 UPLOAD: Video URI:', videoUri);
      console.log('🚀 UPLOAD: Filename:', filename);
      console.log('🚀 UPLOAD: Base URL:', this.baseUrl);
      
      // Ensure we have an auth token before uploading
      if (!this.authToken) {
        console.log('🔐 UPLOAD: No auth token found, initializing auth service...');
        const { authService } = await import('./authService');
        await authService.initialize();
        const token = authService.getAuthToken();
        if (token) {
          this.setAuthToken(token);
          console.log('✅ UPLOAD: Auth token acquired for upload');
        } else {
          throw new Error('Failed to acquire authentication token for upload');
        }
      }
      
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
      let fileSize = 0;
      if ('size' in fileInfo) {
        fileSize = fileInfo.size || 0;
      }

      console.log('📁 UPLOAD: File info:', { exists: fileInfo.exists, size: fileSize });

      onProgress?.({ stage: 'preparing', progress: 10, startTime });

      // Get auth headers
      const authHeaders = this.getAuthHeaders(false);
      console.log('🔐 UPLOAD: Auth headers:', Object.keys(authHeaders));
      console.log('🔐 UPLOAD: Has Authorization?', !!authHeaders.Authorization);
      
      // Prepare file for upload
      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: filename || 'video.mp4',
      } as any);

      console.log('📦 UPLOAD: FormData prepared');

      onProgress?.({ stage: 'uploading', progress: 20, startTime });

      const uploadUrl = `${this.baseUrl}/api/v1/s3-media/upload`;
      console.log('🌐 UPLOAD: Upload URL:', uploadUrl);

      // Upload directly to S3 endpoint
      console.log('🌐 UPLOAD: Making fetch request...');
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        signal: abortController.signal,
      });

      console.log('📡 UPLOAD: Response received - Status:', response.status);
      console.log('📡 UPLOAD: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ UPLOAD: Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ UPLOAD: Upload successful:', result);
      
      onProgress?.({ stage: 'finalizing', progress: 90, startTime });

      // Clean up
      this.activeUploads.delete(uploadId);
      
      onProgress?.({ stage: 'finalizing', progress: 100, startTime });

      return {
        success: true,
        mediaId: result.media_id,
        streamingUrl: result.storage_url,
        cloudStorageKey: result.media_id,
        storageType: 'cloud' as const,
        fileSize: fileSize,
        compressionRatio: 1,
        uploadTime: Date.now() - startTime,
      };

    } catch (error: any) {
      // Clean up on error
      this.activeUploads.delete(uploadId);
      
      if (error.name === 'AbortError') {
        console.log('⚠️ UPLOAD: Upload cancelled by user');
        return {
          success: false,
          error: 'Upload cancelled by user',
        };
      }

      console.error('❌ UPLOAD: Upload error:', error);
      console.error('❌ UPLOAD: Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message || 'Upload failed',
      };
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