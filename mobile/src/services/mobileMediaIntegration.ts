/**
 * Mobile Media Integration Service
 * Ensures seamless integration between mobile media capture and Redux state
 * Handles cross-platform state synchronization and validation
 */

import { Dispatch } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import {
  setStatementMedia,
  setMediaRecordingError,
  setMediaCompression,
  validateChallenge,
  startMediaRecording,
  stopMediaRecording,
  updateRecordingDuration,
  setMediaRecordingState,
} from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

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
  public initialize(dispatch: Dispatch): void {
    this.dispatch = dispatch;
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

      // Process the recorded media
      const mediaCapture = await this.processRecordedMedia(
        recordingUri,
        duration,
        statementIndex
      );

      // Update Redux with the processed media
      this.dispatch(setStatementMedia({
        index: statementIndex,
        media: mediaCapture,
      }));

      // Validate the entire challenge
      this.dispatch(validateChallenge());

      console.log(`✅ Recording completed for statement ${statementIndex}`, mediaCapture);
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
   * Process recorded media with compression and validation
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
    let compressionMetadata = {};

    if (fileSize > this.config.compressionThreshold) {
      finalUri = await this.compressMedia(uri, statementIndex);
      
      // Get compressed file info
      const compressedInfo = await FileSystem.getInfoAsync(finalUri);
      compressionMetadata = {
        originalSize: fileSize,
        compressionRatio: compressedInfo.size ? compressedInfo.size / fileSize : 1,
        compressionTime: Date.now(), // Simplified - in real app would track actual time
        compressionQuality: 0.8,
      };
    }

    // Create MediaCapture object
    const mediaCapture: MediaCapture = {
      type: 'video',
      url: finalUri,
      duration,
      fileSize: fileSize,
      mimeType: this.getMimeType(),
      ...compressionMetadata,
    };

    return mediaCapture;
  }

  /**
   * Compress media if needed
   */
  private async compressMedia(uri: string, statementIndex: number): Promise<string> {
    if (!this.dispatch) throw new Error('Service not initialized');

    try {
      // Start compression in Redux
      this.dispatch(setMediaCompression({
        statementIndex,
        isCompressing: true,
        progress: 0,
      }));

      // Simulate compression progress (in real app, use actual compression library)
      for (let progress = 0; progress <= 100; progress += 20) {
        this.dispatch(setMediaCompression({
          statementIndex,
          isCompressing: true,
          progress,
        }));
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // In a real implementation, you would use a compression library here
      // For now, we'll just copy the file to simulate compression
      const compressedUri = `${FileSystem.documentDirectory}compressed_${Date.now()}.mp4`;
      await FileSystem.copyAsync({
        from: uri,
        to: compressedUri,
      });

      // Complete compression
      this.dispatch(setMediaCompression({
        statementIndex,
        isCompressing: false,
        progress: null,
      }));

      return compressedUri;
    } catch (error: any) {
      this.dispatch(setMediaCompression({
        statementIndex,
        isCompressing: false,
        progress: null,
      }));
      throw new Error(`Compression failed: ${error.message}`);
    }
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

    if (duration < 1000) {
      throw new Error('Recording too short. Minimum duration is 1 second.');
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
   * Get recording statistics for debugging
   */
  public getRecordingStats(): {
    platform: string;
    supportedFormats: string[];
    maxFileSize: string;
    maxDuration: string;
    compressionThreshold: string;
  } {
    return {
      platform: Platform.OS,
      supportedFormats: this.config.supportedFormats,
      maxFileSize: `${Math.round(this.config.maxFileSize / (1024 * 1024))}MB`,
      maxDuration: `${this.config.maxDuration / 1000}s`,
      compressionThreshold: `${Math.round(this.config.compressionThreshold / (1024 * 1024))}MB`,
    };
  }
}

// Export singleton instance
export const mobileMediaIntegration = MobileMediaIntegrationService.getInstance();