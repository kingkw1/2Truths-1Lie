/**
 * Mobile Media Integration Service
 * Ensures seamless integration between mobile media capture and Redux state
 * Handles cross-platform state synchronization and validation
 */

import { Dispatch } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  setMediaRecordingError,
  validateChallenge,
  startMediaRecording,
  stopMediaRecording,
  setMediaRecordingState,
  setMediaUploadProgress,
  setIndividualRecording,
} from '../store/slices/challengeCreationSlice';
import { MediaCapture, VideoSegment } from '../types';
import { videoUploadService, UploadProgress, UploadOptions } from './uploadService';
import { crossDeviceMediaService } from './crossDeviceMediaService';

export interface MobileMediaIntegrationConfig {
  maxFileSize: number; // in bytes
  maxDuration: number; // in milliseconds
  compressionThreshold: number; // in bytes
  supportedFormats: string[];
  qualitySettings: {
    video: {
      quality: '720p' | '1080p' | '480p';
      bitrate?: number;
    };
    audio: {
      quality: 'high' | 'medium' | 'low';
      sampleRate?: number;
    };
  };
}

export class MobileMediaIntegrationService {
  private static instance: MobileMediaIntegrationService;
  private config: MobileMediaIntegrationConfig;
  private dispatch: Dispatch | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;


  private constructor() {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxDuration: 60 * 1000, // 60 seconds
      compressionThreshold: 25 * 1024 * 1024, // 25MB
      supportedFormats: Platform.select({
        ios: ['video/quicktime', 'video/mp4'],
        android: ['video/mp4', 'video/3gpp'],
      }) || ['video/mp4'],
      qualitySettings: {
        video: {
          quality: '720p',
          bitrate: Platform.select({
            ios: 2000000, // 2Mbps
            android: 1500000, // 1.5Mbps
          }),
        },
        audio: {
          quality: 'high',
          sampleRate: 44100,
        },
      },
    };
  }

  public static getInstance(): MobileMediaIntegrationService {
    if (!MobileMediaIntegrationService.instance) {
      MobileMediaIntegrationService.instance = new MobileMediaIntegrationService();
    }
    return MobileMediaIntegrationService.instance;
  }

  /**
   * Initialize the service with Redux dispatch
   */
  public async initialize(dispatch: Dispatch): Promise<void> {
    // If already initialized, just update dispatch and return
    if (this.isInitialized) {
      this.dispatch = dispatch;
      console.log('📱 Mobile Media Integration Service already initialized, updated dispatch');
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log('📱 Mobile Media Integration Service initialization in progress, waiting...');
      await this.initializationPromise;
      this.dispatch = dispatch;
      return;
    }

    // Start new initialization
    this.initializationPromise = this.doInitialize(dispatch);
    await this.initializationPromise;
  }

  private async doInitialize(dispatch: Dispatch): Promise<void> {
    try {
      this.dispatch = dispatch;

      // Initialize cross-device media service
      await crossDeviceMediaService.initialize();

      this.isInitialized = true;
      console.log('📱 Mobile Media Integration Service initialized');
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Start recording with full Redux integration
   */
  public async startRecording(statementIndex: number): Promise<void> {
    if (!this.dispatch) {
      throw new Error('Service not initialized with Redux dispatch');
    }

    try {
      // Check permissions and storage
      await this.validateRecordingPreconditions();

      // Update Redux state
      this.dispatch(startMediaRecording({
        statementIndex,
        mediaType: 'video',
      }));

      console.log(`📹 Started recording for statement ${statementIndex}`);
    } catch (error: any) {
      this.handleRecordingError(statementIndex, error.message);
      throw error;
    }
  }

  /**
   * Stop recording and process media with Redux integration
   */
  public async stopRecording(
    statementIndex: number,
    recordingUri: string,
    duration: number
  ): Promise<MediaCapture> {
    if (!this.dispatch) {
      throw new Error('Service not initialized with Redux dispatch');
    }

    try {
      // Stop recording in Redux
      this.dispatch(stopMediaRecording({ statementIndex }));

      // Process the recorded media for later server-side merging
      // Store locally for now, upload all three together later
      const mediaCapture = await this.processRecordedMediaForServerMerging(
        recordingUri,
        duration,
        statementIndex
      );

      // Store as individual recording
      this.dispatch(setIndividualRecording({
        statementIndex,
        recording: mediaCapture,
      }));

      console.log(`✅ Individual recording completed for statement ${statementIndex}`, mediaCapture);
      return mediaCapture;
    } catch (error: any) {
      this.handleRecordingError(statementIndex, error.message);
      throw error;
    }
  }

  /**
   * Update recording duration in Redux
   */
  public updateDuration(statementIndex: number, duration: number): void {
    if (!this.dispatch) return;

    // Ensure the recording state exists before updating duration
    this.dispatch(setMediaRecordingState({
      statementIndex,
      recordingState: { duration },
    }));
  }

  /**
   * Process recorded media with upload to backend
   */
  private async processRecordedMediaWithUpload(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    try {
      console.log('🚀 UPLOAD: Starting upload for statement', statementIndex);
      console.log('📁 UPLOAD: File URI:', uri);
      console.log('⏱️ UPLOAD: Duration:', duration, 'ms');

      // Generate filename for upload
      const filename = `statement_${statementIndex}_${Date.now()}.mp4`;

      // Upload to backend
      const uploadResult = await videoUploadService.uploadVideo(
        uri,
        filename,
        duration,
        {
          maxFileSize: this.config.maxFileSize,
          chunkSize: 1024 * 1024, // 1MB chunks
          retryAttempts: 3
        }
      );

      if (uploadResult.success && uploadResult.mediaId) {
        console.log('✅ UPLOAD: Upload successful!');
        console.log('🆔 UPLOAD: Media ID:', uploadResult.mediaId);
        console.log('� UPLOAD: Streaming URL:', uploadResult.streamingUrl);

        return {
          type: 'video',
          url: uploadResult.streamingUrl || uri,
          duration,
          fileSize: await this.getFileSize(uri),
          mimeType: 'video/mp4',
          storageType: uploadResult.storageType || 'cloud',
          isUploaded: true
        };
      } else {
        console.warn('⚠️ UPLOAD: Upload failed, falling back to local processing');
        console.warn('❌ UPLOAD: Error:', uploadResult.error);
        return this.processRecordedMediaLocally(uri, duration, statementIndex);
      }
    } catch (error) {
      console.error('❌ UPLOAD: Upload error, falling back to local processing:', error);
      return this.processRecordedMediaLocally(uri, duration, statementIndex);
    }
  }

  /**
   * Get file size for a given URI
   */
  private async getFileSize(uri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      return fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
    } catch (error) {
      console.warn('Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * Process recorded media locally (no upload)
   */
  private async processRecordedMediaLocally(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    // Validate file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    const fileSize = fileInfo.size || 0;

    // Validate file size and duration
    this.validateMediaFile(fileSize, duration);

    // Generate filename
    const timestamp = Date.now();
    const filename = `statement_${statementIndex}_${timestamp}.mp4`;

    // Create MediaCapture object for local use (no upload)
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: uri, // Local file URI
      streamingUrl: uri,
      duration,
      fileSize,
      mimeType: this.getMimeType(),
      mediaId: `local_${timestamp}`,
      cloudStorageKey: undefined,
      storageType: 'local',
      isUploaded: false,
      uploadTime: undefined,
    };

    return mediaCapture;
  }

  /**
   * Process recorded media with compression and validation (legacy method for local storage)
   */
  private async processRecordedMedia(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    // Validate file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    const fileSize = fileInfo.size || 0;

    // Validate file size and duration
    this.validateMediaFile(fileSize, duration);

    // Determine if compression is needed
    let finalUri = uri;

    // Create MediaCapture object
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: finalUri,
      duration,
      fileSize: fileSize,
      mimeType: this.getMimeType(),
    };

    return mediaCapture;
  }



  /**
   * Validate recording preconditions
   */
  private async validateRecordingPreconditions(): Promise<void> {
    // Check storage space
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    const minRequiredSpace = 100 * 1024 * 1024; // 100MB

    if (freeSpace < minRequiredSpace) {
      throw new Error('Insufficient storage space for recording');
    }

    // Check permissions (this would be handled by the camera component)
    // Additional platform-specific checks could go here
  }

  /**
   * Validate media file meets requirements
   */
  private validateMediaFile(fileSize: number, duration: number): void {
    if (fileSize === 0) {
      throw new Error('Recording file is empty');
    }

    if (fileSize > this.config.maxFileSize) {
      throw new Error(`File size (${Math.round(fileSize / (1024 * 1024))}MB) exceeds maximum allowed (${Math.round(this.config.maxFileSize / (1024 * 1024))}MB)`);
    }

    if (duration < 500) { // Reduced to 0.5 seconds for more lenient validation
      throw new Error('Recording too short. Minimum duration is 0.5 seconds.');
    }

    if (duration > this.config.maxDuration) {
      throw new Error(`Recording too long. Maximum duration is ${this.config.maxDuration / 1000} seconds.`);
    }
  }

  /**
   * Handle recording errors with Redux integration
   */
  private handleRecordingError(statementIndex: number, error: string): void {
    if (!this.dispatch) return;

    console.error(`📱 Recording error for statement ${statementIndex}:`, error);

    this.dispatch(setMediaRecordingError({
      statementIndex,
      error,
    }));
  }

  /**
   * Get appropriate MIME type for the platform
   */
  private getMimeType(): string {
    return Platform.select({
      ios: 'video/quicktime',
      android: 'video/mp4',
    }) || 'video/mp4';
  }

  /**
   * Clean up temporary files
   */
  public async cleanupTempFiles(): Promise<void> {
    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return;

      const files = await FileSystem.readDirectoryAsync(documentDir);
      const tempFiles = files.filter(file =>
        file.startsWith('compressed_') ||
        file.startsWith('temp_recording_')
      );

      for (const file of tempFiles) {
        const filePath = `${documentDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);

        // Delete files older than 1 hour
        if (fileInfo.exists && fileInfo.modificationTime) {
          const ageMs = Date.now() - fileInfo.modificationTime;
          if (ageMs > 60 * 60 * 1000) { // 1 hour
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            console.log(`🗑️ Cleaned up temp file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): MobileMediaIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<MobileMediaIntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('📱 Mobile media integration config updated', updates);
  }

  /**
   * Sync media library across devices
   */
  public async syncMediaLibrary(): Promise<void> {
    try {
      console.log('🔄 Syncing media library across devices...');
      await crossDeviceMediaService.syncMediaLibrary();
    } catch (error) {
      console.error('Failed to sync media library:', error);
    }
  }

  /**
   * Get user's media library with cross-device access
   */
  public async getMediaLibrary(page: number = 1, limit: number = 50) {
    try {
      return await crossDeviceMediaService.getMediaLibrary(page, limit);
    } catch (error) {
      console.error('Failed to get media library:', error);
      throw error;
    }
  }

  /**
   * Verify media accessibility for playback
   */
  public async verifyMediaForPlayback(mediaId: string): Promise<{
    canPlay: boolean;
    streamingUrl?: string;
    error?: string;
  }> {
    try {
      const verification = await crossDeviceMediaService.verifyMediaAccessibility(mediaId);

      if (!verification.accessible) {
        return {
          canPlay: false,
          error: 'Media not accessible on this device',
        };
      }

      if (!verification.deviceCompatible) {
        return {
          canPlay: false,
          error: `Media format not supported on ${Platform.OS}`,
        };
      }

      const streamingUrl = await crossDeviceMediaService.getOptimizedStreamingUrl(mediaId);

      return {
        canPlay: !!streamingUrl,
        streamingUrl: streamingUrl || undefined,
        error: streamingUrl ? undefined : 'Failed to get streaming URL',
      };

    } catch (error: any) {
      return {
        canPlay: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle user authentication changes
   */
  public async onUserLogin(): Promise<void> {
    await crossDeviceMediaService.onUserLogin();
  }

  public async onUserLogout(): Promise<void> {
    await crossDeviceMediaService.onUserLogout();
  }

  /**
   * Get device compatibility info
   */
  public getDeviceCompatibilityInfo(): {
    platform: string;
    supportedFormats: string[];
    preferences: any;
  } {
    return {
      platform: Platform.OS,
      supportedFormats: this.config.supportedFormats,
      preferences: crossDeviceMediaService.getDeviceMediaPreferences(),
    };
  }

  /**
   * Process recorded media for server-side merging (store locally until all three are ready)
   */
  private async processRecordedMediaForServerMerging(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    // Validate file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    const fileSize = fileInfo.size || 0;

    // Validate file size and duration
    this.validateMediaFile(fileSize, duration);

    // Create MediaCapture object for local storage (will be uploaded later with all three videos)
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: uri, // Keep local URI for now
      duration,
      fileSize: fileSize,
      mimeType: this.getMimeType(),
      storageType: 'local', // Mark as local until uploaded for merging
      isUploaded: false, // Will be uploaded as part of the merge process
    };

    console.log(`📹 Prepared video ${statementIndex + 1} for server-side merging:`, {
      duration: Math.round(duration / 1000),
      fileSize: Math.round(fileSize / (1024 * 1024) * 100) / 100,
      uri: uri.substring(uri.lastIndexOf('/') + 1),
    });

    return mediaCapture;
  }

  /**
   * Process recorded media for merging (upload individual videos for server-side merging)
   * @deprecated Use processRecordedMediaForServerMerging instead
   */
  private async processRecordedMediaForMerging(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    // Use the upload-enabled processing
    console.log('� MERGE: Processing video for server-side merging with upload');
    return this.processRecordedMediaWithUpload(uri, duration, statementIndex);
  }

  /**
   * Upload all three videos for server-side merging with progress tracking
   */
  public async uploadVideosForMerging(
    individualRecordings: { [key: number]: MediaCapture }
  ): Promise<{
    success: boolean;
    mergeSessionId?: string;
    mergedVideoUrl?: string;
    segmentMetadata?: Array<{
      statementIndex: number;
      startTime: number; // in milliseconds
      endTime: number; // in milliseconds
    }>;
    error?: string;
  }> {
    try {
      // Validate we have all three recordings
      if (!this.hasAllStatementRecordings(individualRecordings)) {
        throw new Error('All three statement recordings are required for merging');
      }

      // Prepare videos array for upload
      const videos = [0, 1, 2].map(index => {
        const recording = individualRecordings[index];
        if (!recording || !recording.url) {
          throw new Error(`Missing recording for statement ${index + 1}`);
        }

        return {
          uri: recording.url,
          filename: `statement_${index}_${Date.now()}.mp4`,
          duration: recording.duration || 0,
          statementIndex: index,
        };
      });

      console.log('🎬 MERGE: Uploading 3 videos for server-side merging...');

      // Initialize merge status service
      const { mergeStatusService } = await import('./mergeStatusService');
      if (this.dispatch) {
        await mergeStatusService.initialize(this.dispatch);
      }

      // Upload videos for server-side merging
      console.log('🚀 MERGE: Starting upload of 3 videos for server-side merging...');
      
      try {
        // Use the dedicated upload-for-merge method
        const mergeResult = await videoUploadService.uploadVideosForMerge(
          videos,
          {
            maxFileSize: this.config.maxFileSize,
            chunkSize: 1024 * 1024, // 1MB chunks
            retryAttempts: 3
          }
        );
        
        if (mergeResult.success) {
          console.log('✅ MERGE: Upload and server-side merging completed!');
          console.log('🔗 MERGE: Merged video URL:', mergeResult.mergedVideoUrl);
          console.log('🆔 MERGE: Merge session ID:', mergeResult.mergeSessionId);
          
          return {
            success: true,
            mergedVideoUrl: mergeResult.mergedVideoUrl,
            mergeSessionId: mergeResult.mergeSessionId || `merge_${Date.now()}`,
            segmentMetadata: mergeResult.segmentMetadata?.map((segment, index) => ({
              id: `segment_${index}`,
              statementIndex: segment.statementIndex,
              startTime: segment.startTime,
              endTime: segment.endTime,
              duration: videos[index].duration || 1000,
              url: mergeResult.mergedVideoUrl || videos[index].uri,
            })) || videos.map((video, index) => {
              const videoDurationSeconds = (video.duration || 1000) / 1000;
              const previousSegmentsDuration = videos.slice(0, index).reduce((sum, v) => 
                sum + ((v.duration || 1000) / 1000), 0);
              
              return {
                id: `segment_${index}`,
                statementIndex: index,
                startTime: previousSegmentsDuration,
                endTime: previousSegmentsDuration + videoDurationSeconds,
                duration: video.duration || 1000,
                url: mergeResult.mergedVideoUrl || video.uri,
              };
            }),
            error: undefined,
          };
        } else {
          throw new Error(`Upload/merge failed: ${mergeResult.error}`);
        }
        
      } catch (uploadError) {
        console.error('❌ MERGE: Upload/merge failed:', uploadError);
        
        // Don't fall back to local paths - let the error propagate
        // This ensures the user sees the real error instead of creating a challenge
        // with local file paths that will fail when trying to generate S3 URLs
        return {
          success: false,
          error: uploadError instanceof Error ? uploadError.message : 'Failed to upload and merge videos on server',
        };
      }

    } catch (error: any) {
      console.error('❌ MERGE: Failed to upload videos for merging:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload videos for merging',
      };
    }
  }

  /**
   * Start monitoring merge progress for a session
   */
  public async startMergeProgressMonitoring(
    mergeSessionId: string,
    onProgress?: (progress: { stage: string; progress: number; currentStep?: string; estimatedTimeRemaining?: number }) => void,
    onComplete?: (result: { success: boolean; mergedVideoUrl?: string; segmentMetadata?: any; mergeSessionId?: string; error?: string }) => void
  ): Promise<void> {
    try {
      const { mergeStatusService } = await import('./mergeStatusService');
      
      if (this.dispatch) {
        await mergeStatusService.initialize(this.dispatch);
      }

      // Start polling for merge status
      mergeStatusService.startPolling(mergeSessionId, {
        pollInterval: 2000, // Poll every 2 seconds
        maxDuration: 300000, // 5 minute timeout
        onProgress: (progress) => {
          console.log(`🔄 MERGE_MONITOR: ${progress.stage} - ${progress.progress}%`);
          onProgress?.({
            stage: progress.stage,
            progress: progress.progress,
            currentStep: progress.currentStep,
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
          });
        },
        onComplete: (result) => {
          console.log(`🏁 MERGE_MONITOR: Complete - Success: ${result.success}`);
          onComplete?.({
            ...result,
            mergeSessionId: mergeSessionId,
          });
        },
      });

    } catch (error: any) {
      console.error('❌ MERGE_MONITOR: Failed to start monitoring:', error);
      onComplete?.({
        success: false,
        error: error.message || 'Failed to monitor merge progress',
        mergeSessionId: mergeSessionId,
      });
    }
  }

  /**
   * Stop monitoring merge progress
   */
  public stopMergeProgressMonitoring(mergeSessionId: string): void {
    try {
      const { mergeStatusService } = require('./mergeStatusService');
      mergeStatusService.stopPolling(mergeSessionId);
    } catch (error) {
      console.warn('Failed to stop merge monitoring:', error);
    }
  }

  /**
   * Check if FFmpeg Kit is available for video processing
   */
  private async isFFmpegAvailable(): Promise<boolean> {
    try {
      // Check if FFmpeg Kit is available (for development/production builds)
      const FFmpegKit = require('ffmpeg-kit-react-native');
      console.log('🔥 FFmpeg Kit module loaded:', typeof FFmpegKit);
      
      // Test if FFmpeg Kit is functional by checking version
      if (FFmpegKit.FFmpegKitConfig) {
        console.log('✅ FFmpeg Kit is available - development/production build detected');
        return true;
      }
      
      console.log('⚠️ FFmpeg Kit not functional');
      return false;
    } catch (error: any) {
      console.warn('⚠️ FFmpeg Kit module not available:', error?.message);
      console.log('⚠️ Running in Expo Go - FFmpeg not available');
      return false;
    }
  }

  /**
   * Check if all three statements have been recorded
   */
  public hasAllStatementRecordings(individualRecordings: { [key: number]: MediaCapture }): boolean {
    return [0, 1, 2].every(index =>
      individualRecordings[index] &&
      individualRecordings[index].url
    );
  }



  /**
   * Get recording statistics for debugging
   */
  public getRecordingStats(): {
    platform: string;
    supportedFormats: string[];
    maxFileSize: string;
    maxDuration: string;
    compressionThreshold: string;
    crossDeviceSync: any;
  } {
    return {
      platform: Platform.OS,
      supportedFormats: this.config.supportedFormats,
      maxFileSize: `${Math.round(this.config.maxFileSize / (1024 * 1024))}MB`,
      maxDuration: `${this.config.maxDuration / 1000}s`,
      compressionThreshold: `${Math.round(this.config.compressionThreshold / (1024 * 1024))}MB`,
      crossDeviceSync: crossDeviceMediaService.getSyncStatus(),
    };
  }
}

// Export singleton instance
export const mobileMediaIntegration = MobileMediaIntegrationService.getInstance();