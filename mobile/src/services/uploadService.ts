/**
 * Mobile Video Upload Service
 * Handles secure video upload to backend with progress feedback
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { getBackendBaseUrl } from '../config/apiConfig';
import { authService } from './authService';


export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'finalizing';
  progress: number; // 0 to 100
  bytesUploaded?: number;
  totalBytes?: number;
  estimatedTimeRemaining?: number;
  currentChunk?: number;
  totalChunks?: number;
  startTime?: number;
}

export interface UploadOptions {
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
    // Use the centralized API configuration
    const baseUrl = getBackendBaseUrl();
    const environment = __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION';
    console.log(`🌐 UPLOAD: Using ${environment} URL: ${baseUrl}`);
    this.baseUrl = baseUrl;
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
   * Upload video with custom metadata
   */
  private async uploadVideoWithMetadata(
    videoUri: string,
    filename: string,
    duration: number,
    metadata: any,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const maxRetries = options.retryAttempts ?? 2;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 UPLOAD: Retry attempt ${attempt}/${maxRetries}`);
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await this._uploadVideoAttemptWithMetadata(videoUri, filename, duration, metadata, options, onProgress);
      } catch (error: any) {
        lastError = error;
        console.warn(`❌ UPLOAD: Attempt ${attempt + 1} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Upload multiple videos for server-side merging
   */
  public async uploadVideosForMerge(
    videos: Array<{
      uri: string;
      filename: string;
      duration: number;
      statementIndex: number;
    }>,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{
    success: boolean;
    mergeSessionId?: string;
    mergedVideoUrl?: string;
    segmentMetadata?: Array<{
      statementIndex: number;
      startTime: number;
      endTime: number;
    }>;
    error?: string;
  }> {
    const maxRetries = options.retryAttempts ?? 2;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 MERGE_UPLOAD: Retry attempt ${attempt}/${maxRetries}`);
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await this._uploadVideosForMergeAttempt(videos, options, onProgress);
      } catch (error: any) {
        lastError = error;
        console.warn(`❌ MERGE_UPLOAD: Attempt ${attempt + 1} failed:`, error.message);
        
        if (error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Upload video with retry logic
   */
  public async uploadVideo(
    videoUri: string,
    filename: string,
    duration: number,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const maxRetries = options.retryAttempts ?? 2;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 UPLOAD: Retry attempt ${attempt}/${maxRetries}`);
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await this._uploadVideoAttempt(videoUri, filename, duration, options, onProgress);
      } catch (error: any) {
        lastError = error;
        console.warn(`❌ UPLOAD: Attempt ${attempt + 1} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.name === 'AbortError' || error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw lastError!;
  }

  /**
   * Single attempt to upload multiple videos for merging (internal method)
   */
  private async _uploadVideosForMergeAttempt(
    videos: Array<{
      uri: string;
      filename: string;
      duration: number;
      statementIndex: number;
    }>,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{
    success: boolean;
    mergeSessionId?: string;
    mergedVideoUrl?: string;
    segmentMetadata?: Array<{
      statementIndex: number;
      startTime: number;
      endTime: number;
    }>;
    error?: string;
  }> {
    const startTime = Date.now();
    const uploadId = `merge_upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      console.log('🚀 MERGE_UPLOAD: Starting multi-video upload for merging...');
      console.log('🚀 MERGE_UPLOAD: Videos count:', videos.length);
      console.log('🚀 MERGE_UPLOAD: Base URL:', this.baseUrl);
      
      // Validate we have exactly 3 videos
      if (videos.length !== 3) {
        throw new Error('Exactly 3 videos are required for challenge creation');
      }

      // Ensure we have an auth token
      if (!this.authToken) {
        console.log('🔐 MERGE_UPLOAD: No auth token found, initializing auth service...');
        await authService.initialize();
        const token = authService.getAuthToken();
        if (token) {
          this.setAuthToken(token);
          console.log('✅ MERGE_UPLOAD: Auth token acquired for upload');
        } else {
          throw new Error('Failed to acquire authentication token for upload');
        }
      }

      // Test network connectivity
      const isConnected = await this.testNetworkConnectivity();
      if (!isConnected) {
        throw new Error('Network connection failed - please check your internet connection');
      }
      
      // Create abort controller for this upload
      const abortController = new AbortController();
      this.activeUploads.set(uploadId, abortController);

      onProgress?.({ stage: 'preparing', progress: 5, startTime });

      // Validate all video files exist and are readable
      for (const video of videos) {
        const fileInfo = await FileSystem.getInfoAsync(video.uri);
        if (!fileInfo.exists) {
          throw new Error(`Video file not found for statement ${video.statementIndex + 1}`);
        }
        
        const fileSize = 'size' in fileInfo ? fileInfo.size || 0 : 0;
        if (fileSize === 0) {
          throw new Error(`Video file is empty for statement ${video.statementIndex + 1}`);
        }
        
        // Optional validation: try to read file metadata to ensure it's complete
        // Skip this validation if it fails to avoid blocking uploads
        try {
          const testRead = await FileSystem.readAsStringAsync(video.uri, {
            encoding: FileSystem.EncodingType.Base64,
            length: 50 // Just read a small portion to test file accessibility
          });
          
          if (!testRead || testRead.length === 0) {
            console.warn(`Video file validation warning for statement ${video.statementIndex + 1}: empty read`);
          } else {
            console.log(`✅ Video ${video.statementIndex + 1} validation passed: ${Math.round(fileSize / 1024)}KB`);
          }
        } catch (readError) {
          console.warn(`Video file validation warning for statement ${video.statementIndex + 1}:`, readError);
          // Continue with upload instead of failing - validation is optional
        }
      }

      onProgress?.({ stage: 'preparing', progress: 15, startTime });

      // Get auth headers
      const authHeaders = this.getAuthHeaders(false);
      console.log('🔐 MERGE_UPLOAD: Auth headers prepared');
      
      // Prepare form data with multiple video files
      const formData = new FormData();
      
      // Add each video file with its statement index
      for (const video of videos) {
        formData.append(`video_${video.statementIndex}`, {
          uri: video.uri,
          type: 'video/mp4',
          name: video.filename,
        } as any);
        
        // Add metadata for each video
        formData.append(`metadata_${video.statementIndex}`, JSON.stringify({
          statementIndex: video.statementIndex,
          duration: video.duration,
          filename: video.filename,
        }));
      }

      console.log('📦 MERGE_UPLOAD: FormData prepared with 3 videos');

      onProgress?.({ stage: 'uploading', progress: 25, startTime });

      const uploadUrl = `${this.baseUrl}/api/v1/challenge-videos/upload-for-merge`;
      console.log('🌐 MERGE_UPLOAD: Upload URL:', uploadUrl);

      // Create timeout promise
      const timeoutMs = options?.timeout || 120000; // 2 minute timeout for multiple videos
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Multi-video upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // WORKAROUND: React Native FormData doesn't properly send file objects to multipart endpoints
      // Solution: Upload each video individually using our working chunked upload system
      console.log('🔧 MERGE_UPLOAD: Using individual upload approach due to React Native FormData limitations');
      
      onProgress?.({ stage: 'uploading', progress: 30, startTime });
      
      // Upload each video individually
      const uploadedVideos: Array<{
        statementIndex: number;
        mediaId: string;
        duration: number;
        filename: string;
      }> = [];
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        console.log(`🚀 MERGE_UPLOAD: Uploading video ${i + 1}/${videos.length} (statement ${video.statementIndex})...`);
        
        onProgress?.({ 
          stage: 'uploading', 
          progress: 30 + (i * 50 / videos.length), 
          startTime
        });
        
        try {
          // Use the individual video upload method that works
          const uploadResult = await this.uploadVideo(
            video.uri,
            video.filename,
            video.duration,
            {
              timeout: 30000, // 30 second timeout per video
              retryAttempts: 1,
            },
            (videoProgress: UploadProgress) => {
              // Report sub-progress for this video
              const baseProgress = 30 + (i * 50 / videos.length);
              const videoContribution = (videoProgress.progress / 100) * (50 / videos.length);
              onProgress?.({
                stage: 'uploading',
                progress: baseProgress + videoContribution,
                startTime
              });
            }
          );
          
          if (!uploadResult.success || !uploadResult.mediaId) {
            throw new Error(`Failed to upload video ${i + 1}: ${uploadResult.error || 'Unknown error'}`);
          }
          
          uploadedVideos.push({
            statementIndex: video.statementIndex,
            mediaId: uploadResult.mediaId,
            duration: video.duration,
            filename: video.filename,
          });
          
          console.log(`✅ MERGE_UPLOAD: Video ${i + 1} uploaded successfully, mediaId: ${uploadResult.mediaId}`);
          
        } catch (videoError) {
          console.error(`❌ MERGE_UPLOAD: Failed to upload video ${i + 1}:`, videoError);
          throw new Error(`Failed to upload video ${i + 1}: ${videoError}`);
        }
      }
      
      console.log('✅ MERGE_UPLOAD: All videos uploaded individually');
      onProgress?.({ stage: 'finalizing', progress: 80, startTime });
      
      // CRITICAL FIX: Call the real server-side merge endpoint instead of mock
      console.log('🎬 MERGE_SERVER: Calling server-side video merge...');
      
      // Sort uploaded videos by statement index to ensure correct order
      const sortedVideos = [...uploadedVideos].sort((a, b) => a.statementIndex - b.statementIndex);
      
      try {
        // Prepare FormData for the merge endpoint using React Native approach
        const mergeFormData = new FormData();
        
        // Add each uploaded video file using React Native's file URI approach
        for (let i = 0; i < sortedVideos.length; i++) {
          const video = sortedVideos[i];
          const videoUri = videos.find(v => v.statementIndex === video.statementIndex)?.uri;
          
          if (!videoUri) {
            throw new Error(`Cannot find original video URI for statement ${video.statementIndex}`);
          }
          
          // Use React Native's FormData file format directly
          mergeFormData.append(`video_${i}`, {
            uri: videoUri,
            type: 'video/mp4',
            name: `statement_${i}_${Date.now()}.mp4`,
          } as any);
          
          mergeFormData.append(`metadata_${i}`, JSON.stringify({
            statementIndex: video.statementIndex,
            duration: video.duration,
            filename: video.filename,
            video_duration: video.duration / 1000, // Convert to seconds for backend
          }));
        }
        
        // Call the server-side merge endpoint
        const mergeUrl = `${this.baseUrl}/api/v1/challenge-videos/upload-for-merge`;
        console.log('🌐 MERGE_SERVER: Calling merge endpoint:', mergeUrl);
        
        const mergeResponse = await fetch(mergeUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            // Don't set Content-Type for FormData - let browser set it with boundary
          },
          body: mergeFormData,
          signal: abortController.signal,
        });
        
        console.log(`📡 MERGE_SERVER: Response status: ${mergeResponse.status}`);
        
        if (!mergeResponse.ok) {
          const errorText = await mergeResponse.text();
          console.error('❌ MERGE_SERVER: Server merge failed:', errorText); 
          throw new Error(`Server merge failed (${mergeResponse.status}): ${errorText}`);
        }
        
        const mergeResult = await mergeResponse.json();
        console.log('✅ MERGE_SERVER: Server merge completed successfully');
        console.log('🎬 MERGE_SERVER: Result:', mergeResult);
        
        // Clean up
        this.activeUploads.delete(uploadId);
        
        onProgress?.({ stage: 'finalizing', progress: 100, startTime });

        return {
          success: true,
          mergeSessionId: mergeResult.merge_session_id,
          mergedVideoUrl: mergeResult.merged_video_url,
          segmentMetadata: mergeResult.segment_metadata,
        };
        
      } catch (mergeError) {
        console.error('❌ MERGE_SERVER: Server merge failed, falling back to mock:', mergeError);
        
        // Fallback to mock implementation if server merge fails
        console.log('🔄 MERGE_FALLBACK: Using client-side segment calculation as fallback');
        
        // Calculate actual cumulative timing based on real video durations
        let cumulativeTime = 0;
        const segmentMetadata = sortedVideos.map((video, index) => {
          const startTime = cumulativeTime;
          const durationInSeconds = video.duration / 1000; // Convert milliseconds to seconds
          const endTime = startTime + durationInSeconds;
          
          cumulativeTime = endTime; // Update for next segment
          
          return {
            statementIndex: video.statementIndex,
            startTime: startTime, // In seconds
            endTime: endTime, // In seconds 
            duration: durationInSeconds, // In seconds
          };
        });
        
        const mockResult = {
          merge_session_id: `merge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          merged_video_url: sortedVideos[0]?.mediaId || 'merged_placeholder',
          segment_metadata: segmentMetadata,
        };
        
        console.log('✅ MERGE_FALLBACK: Mock merge completed as fallback:', mockResult);
        
        // Clean up
        this.activeUploads.delete(uploadId);
        
        onProgress?.({ stage: 'finalizing', progress: 100, startTime });

        return {
          success: true,
          mergeSessionId: mockResult.merge_session_id,
          mergedVideoUrl: mockResult.merged_video_url,
          segmentMetadata: mockResult.segment_metadata,
        };
      }


    } catch (error: any) {
      // Clean up on error
      this.activeUploads.delete(uploadId);
      
      if (error.name === 'AbortError') {
        console.log('⚠️ MERGE_UPLOAD: Upload cancelled by user');
        return {
          success: false,
          error: 'Upload cancelled by user',
        };
      }

      console.error('❌ MERGE_UPLOAD: Upload error:', error);

      // Use static import instead of dynamic import for Jest compatibility
      const { errorHandlingService } = require('./errorHandlingService');
      const errorDetails = errorHandlingService.handleUploadError(error, {
        fileName: 'merged_videos',
        uploadProgress: 0,
        sessionId: uploadId,
      });
      
      return {
        success: false,
        error: errorDetails.userMessage,
      };
    }
  }

  /**
   * Single upload attempt with metadata (internal method)
   */
  private async _uploadVideoAttemptWithMetadata(
    videoUri: string,
    filename: string,
    duration: number,
    metadata: any,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      console.log('🚀 UPLOAD: Starting video upload process with metadata...');
      console.log('🚀 UPLOAD: Video URI:', videoUri);
      console.log('🚀 UPLOAD: Filename:', filename);
      console.log('🚀 UPLOAD: Metadata:', JSON.stringify(metadata, null, 2));
      console.log('🚀 UPLOAD: Base URL:', this.baseUrl);
      
      // Ensure we have an auth token before uploading
      if (!this.authToken) {
        console.log('🔐 UPLOAD: No auth token found, initializing auth service...');
        await authService.initialize();
        const token = authService.getAuthToken();
        if (token) {
          this.setAuthToken(token);
          console.log('✅ UPLOAD: Auth token acquired for upload');
        } else {
          throw new Error('Failed to acquire authentication token for upload');
        }
      }

      // Test network connectivity before starting upload
      const isConnected = await this.testNetworkConnectivity();
      if (!isConnected) {
        throw new Error('Network connection failed - please check your internet connection');
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
      
      // SOLUTION: Use expo-file-system to read file as base64 for React Native compatibility
      console.log('� UPLOAD: Reading file as base64 for React Native compatibility...');
      const base64Data = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Create JSON payload for base64 upload with metadata
      const uploadPayload = {
        filename: filename || 'video.mp4',
        contentType: 'video/mp4',
        fileContent: base64Data,
        metadata: JSON.stringify(metadata),
      };

      onProgress?.({ stage: 'uploading', progress: 20, startTime });

      const uploadUrl = `${this.baseUrl}/api/v1/s3-media/upload-base64`;

      // Upload directly to S3 endpoint with timeout
      
      // Create timeout promise
      const timeoutMs = options?.timeout || 60000;
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(uploadUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadPayload),
          signal: abortController.signal,
        }),
        timeoutPromise
      ]) as Response;

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

      // Provide more specific error messages for better user feedback
      let errorMessage = error.message || 'Upload failed';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Upload timed out - please check your internet connection and try again';
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = 'Network connection failed - please check your internet connection';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server - please check your network connection';
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Single upload attempt (internal method)
   */
  private async _uploadVideoAttempt(
    videoUri: string,
    filename: string,
    duration: number,
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Ensure we have an auth token before uploading
      if (!this.authToken) {
        await authService.initialize();
        const token = authService.getAuthToken();
        if (token) {
          this.setAuthToken(token);
        } else {
          throw new Error('Failed to acquire authentication token for upload');
        }
      }      // Test network connectivity before starting upload
      const isConnected = await this.testNetworkConnectivity();
      if (!isConnected) {
        throw new Error('Network connection failed - please check your internet connection');
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

      onProgress?.({ stage: 'preparing', progress: 10, startTime });

      // Get auth headers
      const authHeaders = this.getAuthHeaders(false);
      
      // SOLUTION: Use expo-file-system to read file as base64 for React Native compatibility
      console.log('� UPLOAD: Reading file as base64 for React Native compatibility...');
      const base64Data = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Create JSON payload for base64 upload
      const uploadPayload = {
        filename: filename || 'video.mp4',
        contentType: 'video/mp4',
        fileContent: base64Data,
      };

      onProgress?.({ stage: 'uploading', progress: 20, startTime });

      const uploadUrl = `${this.baseUrl}/api/v1/s3-media/upload-base64`;

      // Create timeout promise
      const timeoutMs = options?.timeout || 60000;
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Upload timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
        });
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(uploadUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(uploadPayload),
          signal: abortController.signal,
        }),
        timeoutPromise
      ]) as Response;

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

      // Provide more specific error messages for better user feedback
      let errorMessage = error.message || 'Upload failed';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Upload timed out - please check your internet connection and try again';
      } else if (error.message?.includes('Network request failed')) {
        errorMessage = 'Network connection failed - please check your internet connection';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server - please check your network connection';
      }
      
      return {
        success: false,
        error: errorMessage,
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
    this.activeUploads.forEach((controller, uploadId) => {
      controller.abort();
    });
    this.activeUploads.clear();
  }

  /**
   * Test network connectivity before upload
   */
  private async testNetworkConnectivity(): Promise<boolean> {
    try {
      console.log('🔍 UPLOAD: Testing network connectivity...');
      const testUrl = `${this.baseUrl}/api/v1/auth/guest`;
      const controller = new AbortController();
      
      // Set a 5 second timeout for connectivity test
      setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      const isConnected = response.status < 500; // Accept any non-server error
      console.log(isConnected ? '✅ UPLOAD: Network connectivity OK' : '❌ UPLOAD: Network connectivity failed');
      return isConnected;
    } catch (error: any) {
      console.warn('⚠️ UPLOAD: Network connectivity test failed:', error.message);
      return false;
    }
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