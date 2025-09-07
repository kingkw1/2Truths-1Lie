/**
 * Mobile Media Integration Service
 * Ensures seamless integration between mobile media capture and Redux state
 * Handles cross-platform state synchronization and validation
 */

import { Dispatch } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
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
    this.dispatch = dispatch;

    // Initialize cross-device media service
    await crossDeviceMediaService.initialize();

    console.log('📱 Mobile Media Integration Service initialized');
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

      // Process and upload the recorded media directly (skip merging approach)
      // Process the recorded media (without upload for now - we'll upload the merged video)
      const mediaCapture = await this.processRecordedMediaForMerging(
        recordingUri,
        duration,
        statementIndex
      );

      // Store as individual recording
      this.dispatch(setIndividualRecording({
        statementIndex,
        recording: mediaCapture,
      }));

      console.log(`✅ Individual recording completed and uploaded for statement ${statementIndex}`, mediaCapture);
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

    // Configure upload options
    const uploadOptions: UploadOptions = {
      maxFileSize: this.config.maxFileSize,
      retryAttempts: 3,
      timeout: 60000, // 60 seconds
    };

    // Upload video with progress tracking
    const uploadResult = await videoUploadService.uploadVideo(
      uri,
      filename,
      duration / 1000, // Convert to seconds
      uploadOptions,
      (progress: UploadProgress) => {
        if (this.dispatch) {
          this.dispatch(setMediaUploadProgress({
            statementIndex,
            progress: {
              stage: progress.stage,
              progress: progress.progress,
              bytesUploaded: progress.bytesUploaded,
              totalBytes: progress.totalBytes,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
            },
          }));
        }
      }
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    // Verify cross-device accessibility
    let optimizedStreamingUrl = uploadResult.streamingUrl!;
    if (uploadResult.mediaId) {
      try {
        const accessibilityCheck = await crossDeviceMediaService.verifyMediaAccessibility(uploadResult.mediaId);
        if (accessibilityCheck.accessible && accessibilityCheck.streamingUrl) {
          optimizedStreamingUrl = accessibilityCheck.streamingUrl;
        }
      } catch (error) {
        console.warn('Failed to verify media accessibility:', error);
      }
    }

    // Create MediaCapture object with server URL and cross-device compatibility
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: optimizedStreamingUrl, // Keep for backward compatibility
      streamingUrl: optimizedStreamingUrl,
      duration,
      fileSize: uploadResult.fileSize || fileSize,
      mimeType: this.getMimeType(),
      mediaId: uploadResult.mediaId,
      cloudStorageKey: uploadResult.cloudStorageKey,
      storageType: uploadResult.storageType || 'cloud',
      isUploaded: true,
      uploadTime: uploadResult.uploadTime,
    };

    // Clear upload progress
    if (this.dispatch) {
      this.dispatch(setMediaUploadProgress({
        statementIndex,
        progress: undefined,
      }));
    }

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
   * Process recorded media for merging (without upload)
   */
  private async processRecordedMediaForMerging(
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

    // Create MediaCapture object for individual recording
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: uri,
      duration,
      fileSize: fileSize,
      mimeType: this.getMimeType(),
      storageType: 'local',
      isUploaded: false,
    };

    return mediaCapture;
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