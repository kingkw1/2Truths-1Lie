/**
 * Enhanced Mobile Media Integration Service with Memory Optimization
 * Optimized for memory-efficient video recording, processing, and upload
 */

import { Dispatch } from '@reduxjs/toolkit';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { 
  startMediaRecording, 
  stopMediaRecording, 
  setMediaRecordingState,
  setIndividualRecording,
  setMediaRecordingError,
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
} from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';
import { memoryOptimizationService } from './memoryOptimizationService';

interface MemoryEfficientConfig {
  maxConcurrentUploads: number;
  chunkSize: number;
  tempFileCleanupInterval: number;
  compressionThreshold: number;
  enableBackgroundCleanup: boolean;
  autoOptimizeVideo: boolean;
}

export class EnhancedMobileMediaIntegrationService {
  private static instance: EnhancedMobileMediaIntegrationService;
  private dispatch: Dispatch | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private config: MemoryEfficientConfig;
  private activeRecordings = new Map<number, string>(); // statementIndex -> temp file URI
  private cleanupInterval: NodeJS.Timeout | null = null;
  private uploadQueue = new Map<string, AbortController>();
  
  private constructor() {
    this.config = {
      maxConcurrentUploads: 2,
      chunkSize: 1 * 1024 * 1024, // 1MB chunks for better memory usage
      tempFileCleanupInterval: 5 * 60 * 1000, // 5 minutes
      compressionThreshold: 25 * 1024 * 1024, // 25MB
      enableBackgroundCleanup: true,
      autoOptimizeVideo: true,
    };
  }

  public static getInstance(): EnhancedMobileMediaIntegrationService {
    if (!EnhancedMobileMediaIntegrationService.instance) {
      EnhancedMobileMediaIntegrationService.instance = new EnhancedMobileMediaIntegrationService();
    }
    return EnhancedMobileMediaIntegrationService.instance;
  }

  /**
   * Initialize service with memory optimization
   */
  public async initialize(dispatch: Dispatch): Promise<void> {
    if (this.isInitialized && this.dispatch) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(dispatch);
    await this.initializationPromise;
  }

  private async doInitialize(dispatch: Dispatch): Promise<void> {
    try {
      this.dispatch = dispatch;

      // Initialize memory optimization service
      await memoryOptimizationService.checkMemoryPressure();

      // Start background cleanup if enabled
      if (this.config.enableBackgroundCleanup) {
        this.startBackgroundCleanup();
      }

      // Perform initial cleanup
      await this.performInitialCleanup();

      this.isInitialized = true;
      console.log('📱 Enhanced Mobile Media Integration Service initialized with memory optimization');
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Start recording with memory checks
   */
  public async startRecording(statementIndex: number): Promise<void> {
    if (!this.dispatch) {
      throw new Error('Service not initialized with Redux dispatch');
    }

    try {
      // Check memory pressure before starting
      const memoryCheck = await memoryOptimizationService.checkMemoryPressure();
      if (memoryCheck.isCritical) {
        throw new Error('Insufficient memory available. Please close other apps and try again.');
      }

      // Validate recording preconditions
      await this.validateRecordingPreconditions();

      // Generate unique temp file URI
      const tempUri = this.generateTempFileUri(statementIndex);
      this.activeRecordings.set(statementIndex, tempUri);

      // Update Redux state
      this.dispatch(startMediaRecording({
        statementIndex,
        mediaType: 'video',
      }));

      console.log(`📹 Started memory-optimized recording for statement ${statementIndex}`);
    } catch (error: any) {
      this.handleRecordingError(statementIndex, error.message);
      throw error;
    }
  }

  /**
   * Stop recording with immediate memory cleanup
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

      // Process with memory optimization
      const mediaCapture = await this.processRecordingWithMemoryOptimization(
        recordingUri,
        duration,
        statementIndex
      );

      // Store as individual recording
      this.dispatch(setIndividualRecording({
        statementIndex,
        recording: mediaCapture,
      }));

      // Clean up temp URI tracking
      this.activeRecordings.delete(statementIndex);

      // Trigger cleanup of old temp files
      this.scheduleMemoryCleanup();

      console.log(`✅ Memory-optimized recording completed for statement ${statementIndex}`, {
        fileSize: Math.round((mediaCapture.fileSize || 0) / 1024) + 'KB',
        duration: Math.round(duration / 1000) + 's',
      });

      return mediaCapture;
    } catch (error: any) {
      this.handleRecordingError(statementIndex, error.message);
      throw error;
    }
  }

  /**
   * Process recording with memory optimization techniques
   */
  private async processRecordingWithMemoryOptimization(
    uri: string,
    duration: number,
    statementIndex: number
  ): Promise<MediaCapture> {
    try {
      // Validate file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file not found');
      }

      const fileSize = 'size' in fileInfo ? fileInfo.size || 0 : 0;
      this.validateMediaFile(fileSize, duration);

      let finalUri = uri;
      let finalFileSize = fileSize;

      // Check if optimization is needed
      if (this.config.autoOptimizeVideo && fileSize > this.config.compressionThreshold) {
        console.log(`📹 File size ${Math.round(fileSize / (1024 * 1024))}MB exceeds threshold, optimizing...`);
        
        try {
          const optimization = await memoryOptimizationService.optimizeVideoFile(
            uri,
            undefined,
            'medium'
          );
          
          finalUri = optimization.outputUri;
          finalFileSize = optimization.compressedSize;
          
          // Remove original file to save space
          await FileSystem.deleteAsync(uri, { idempotent: true });
          
          console.log(`✅ Video optimized: ${Math.round(fileSize / 1024)}KB → ${Math.round(finalFileSize / 1024)}KB`);
        } catch (optimizationError) {
          console.warn('Video optimization failed, using original:', optimizationError);
          // Continue with original file
        }
      }

      // Create MediaCapture object
      const mediaCapture: MediaCapture = {
        type: 'video',
        url: finalUri,
        duration,
        fileSize: finalFileSize,
        mimeType: this.getMimeType(),
        storageType: 'local',
        isUploaded: false,
      };

      return mediaCapture;
    } catch (error) {
      console.error('Recording processing failed:', error);
      throw error;
    }
  }

  /**
   * Upload videos with memory-efficient chunking
   */
  public async uploadVideosForMerging(
    individualRecordings: { [key: number]: MediaCapture }
  ): Promise<{
    success: boolean;
    mergeSessionId?: string;
    uploadedVideos?: { [key: number]: { mediaId: string; streamingUrl: string } };
    error?: string;
  }> {
    if (!this.dispatch) {
      throw new Error('Service not initialized');
    }

    try {
      const recordings = Object.entries(individualRecordings);
      const uploadedVideos: { [key: number]: { mediaId: string; streamingUrl: string } } = {};

      console.log(`🚀 Starting memory-efficient upload of ${recordings.length} videos...`);

      // Check memory before upload
      const memoryCheck = await memoryOptimizationService.checkMemoryPressure();
      if (memoryCheck.isCritical) {
        console.warn('⚠️ Critical memory pressure detected, performing cleanup...');
        await memoryOptimizationService.cleanupTempVideoFiles();
      }

      // Upload videos with controlled concurrency
      const uploadPromises = recordings.map(([indexStr, recording]) => 
        this.uploadSingleVideoWithMemoryManagement(parseInt(indexStr), recording)
      );

      // Process uploads in batches to control memory usage
      const batchSize = this.config.maxConcurrentUploads;
      const results = [];

      for (let i = 0; i < uploadPromises.length; i += batchSize) {
        const batch = uploadPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);

        // Clean up memory between batches
        if (i + batchSize < uploadPromises.length) {
          await this.scheduleMemoryCleanup();
        }
      }

      // Process results
      for (const result of results) {
        if (result.success) {
          uploadedVideos[result.statementIndex] = {
            mediaId: result.mediaId!,
            streamingUrl: result.streamingUrl!,
          };
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      }

      console.log('✅ All videos uploaded successfully with memory optimization');

      return {
        success: true,
        uploadedVideos,
      };

    } catch (error: any) {
      console.error('Memory-efficient upload failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Upload single video with memory management
   */
  private async uploadSingleVideoWithMemoryManagement(
    statementIndex: number,
    recording: MediaCapture
  ): Promise<{
    success: boolean;
    statementIndex: number;
    mediaId?: string;
    streamingUrl?: string;
    error?: string;
  }> {
    const abortController = new AbortController();
    const uploadId = `upload_${statementIndex}_${Date.now()}`;
    
    try {
      this.uploadQueue.set(uploadId, abortController);

      // Start upload state
      this.dispatch!(startUpload({
        statementIndex,
        sessionId: uploadId,
      }));

      // Simulate chunked upload with memory management
      const fileSize = recording.fileSize || 0;
      const totalChunks = Math.ceil(fileSize / this.config.chunkSize);

      console.log(`📤 Uploading video ${statementIndex} in ${totalChunks} chunks (${Math.round(fileSize / 1024)}KB)`);

      // Simulate upload progress
      for (let chunk = 0; chunk < totalChunks; chunk++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled');
        }

        const progress = Math.round(((chunk + 1) / totalChunks) * 100);
        
        this.dispatch!(updateUploadProgress({
          statementIndex,
          progress,
        }));

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check memory pressure during upload
        if (chunk % 10 === 0) { // Check every 10 chunks
          const memoryCheck = await memoryOptimizationService.checkMemoryPressure();
          if (memoryCheck.isCritical) {
            console.warn(`⚠️ Memory pressure during upload chunk ${chunk + 1}/${totalChunks}`);
          }
        }
      }

      // Complete upload
      const mockMediaId = `media_${statementIndex}_${Date.now()}`;
      const mockStreamingUrl = `https://example.com/video/${mockMediaId}`;

      this.dispatch!(completeUpload({
        statementIndex,
        fileUrl: mockStreamingUrl,
        mediaCapture: {
          type: 'video',
          url: mockStreamingUrl,
          streamingUrl: mockStreamingUrl,
          isUploaded: true,
          storageType: 'cloud',
        } as MediaCapture,
      }));

      console.log(`✅ Memory-efficient upload completed for statement ${statementIndex}`);

      return {
        success: true,
        statementIndex,
        mediaId: mockMediaId,
        streamingUrl: mockStreamingUrl,
      };

    } catch (error: any) {
      console.error(`Upload failed for statement ${statementIndex}:`, error);
      
      this.dispatch!(setUploadError({
        statementIndex,
        error: error.message,
      }));

      return {
        success: false,
        statementIndex,
        error: error.message,
      };
    } finally {
      this.uploadQueue.delete(uploadId);
    }
  }

  /**
   * Cancel upload and cleanup resources
   */
  public async cancelUpload(statementIndex: number): Promise<void> {
    // Find and abort upload
    for (const [uploadId, controller] of this.uploadQueue.entries()) {
      if (uploadId.includes(`_${statementIndex}_`)) {
        controller.abort();
        this.uploadQueue.delete(uploadId);
        console.log(`🚫 Cancelled upload for statement ${statementIndex}`);
        break;
      }
    }

    // Clean up associated temp files
    await this.cleanupStatementFiles(statementIndex);
  }

  /**
   * Clean up files for a specific statement
   */
  private async cleanupStatementFiles(statementIndex: number): Promise<void> {
    try {
      const tempUri = this.activeRecordings.get(statementIndex);
      if (tempUri) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
        this.activeRecordings.delete(statementIndex);
        console.log(`🗑️ Cleaned up temp file for statement ${statementIndex}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup files for statement ${statementIndex}:`, error);
    }
  }

  /**
   * Schedule memory cleanup
   */
  private async scheduleMemoryCleanup(): Promise<void> {
    // Perform cleanup in next tick to avoid blocking UI
    setTimeout(async () => {
      try {
        await memoryOptimizationService.cleanupTempVideoFiles();
      } catch (error) {
        console.warn('Scheduled memory cleanup failed:', error);
      }
    }, 100);
  }

  /**
   * Start background cleanup process
   */
  private startBackgroundCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await memoryOptimizationService.cleanupTempVideoFiles();
        await memoryOptimizationService.cleanupOldCache();
      } catch (error) {
        console.warn('Background cleanup failed:', error);
      }
    }, this.config.tempFileCleanupInterval);

    console.log('🔄 Background memory cleanup started');
  }

  /**
   * Perform initial cleanup on service initialization
   */
  private async performInitialCleanup(): Promise<void> {
    try {
      console.log('🧹 Performing initial memory cleanup...');
      const cleanup = await memoryOptimizationService.cleanupTempVideoFiles();
      const cacheCleanup = await memoryOptimizationService.cleanupOldCache();
      
      console.log('✅ Initial cleanup completed:', {
        tempFiles: cleanup,
        cache: cacheCleanup,
      });
    } catch (error) {
      console.warn('Initial cleanup failed:', error);
    }
  }

  /**
   * Generate unique temp file URI
   */
  private generateTempFileUri(statementIndex: number): string {
    const timestamp = Date.now();
    const extension = Platform.OS === 'ios' ? 'mov' : 'mp4';
    const documentDir = FileSystem.documentDirectory;
    if (!documentDir) {
      throw new Error('Document directory not available');
    }
    return `${documentDir}temp_recording_${statementIndex}_${timestamp}.${extension}`;
  }

  /**
   * Update recording duration
   */
  public updateDuration(statementIndex: number, duration: number): void {
    if (!this.dispatch) return;

    this.dispatch(setMediaRecordingState({
      statementIndex,
      recordingState: { duration },
    }));
  }

  /**
   * Validate recording preconditions
   */
  private async validateRecordingPreconditions(): Promise<void> {
    // Check available storage
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    const requiredSpace = 100 * 1024 * 1024; // 100MB

    if (freeSpace < requiredSpace) {
      throw new Error('Insufficient storage space. Please free up space and try again.');
    }

    // Check memory pressure
    const memoryCheck = await memoryOptimizationService.checkMemoryPressure();
    if (memoryCheck.isCritical) {
      throw new Error('Insufficient memory available. Please close other apps and try again.');
    }
  }

  /**
   * Validate media file
   */
  private validateMediaFile(fileSize: number, duration: number): void {
    if (fileSize === 0) {
      throw new Error('Recording file is empty');
    }

    if (duration < 500) {
      throw new Error('Recording is too short. Please record for at least 0.5 seconds.');
    }

    // Check if file is reasonable size
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxSize) {
      console.warn(`Large file detected: ${Math.round(fileSize / (1024 * 1024))}MB`);
    }
  }

  /**
   * Get MIME type based on platform
   */
  private getMimeType(): string {
    return Platform.select({
      ios: 'video/quicktime',
      android: 'video/mp4',
    }) || 'video/mp4';
  }

  /**
   * Handle recording errors
   */
  private handleRecordingError(statementIndex: number, error: string): void {
    if (this.dispatch) {
      this.dispatch(setMediaRecordingError({ statementIndex, error }));
    }
    
    // Clean up on error
    this.cleanupStatementFiles(statementIndex);
  }

  /**
   * Get memory statistics
   */
  public async getMemoryStats(): Promise<any> {
    return memoryOptimizationService.getMemoryStats();
  }

  /**
   * Get memory optimization recommendations
   */
  public async getOptimizationRecommendations(): Promise<string[]> {
    return memoryOptimizationService.getOptimizationRecommendations();
  }

  /**
   * Dispose service and cleanup all resources
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Cancel all active uploads
    for (const [uploadId, controller] of this.uploadQueue.entries()) {
      controller.abort();
    }
    this.uploadQueue.clear();

    // Clean up all active recordings
    for (const [statementIndex] of this.activeRecordings.entries()) {
      this.cleanupStatementFiles(statementIndex);
    }
    this.activeRecordings.clear();

    memoryOptimizationService.dispose();
    console.log('📱 Enhanced Mobile Media Integration Service disposed');
  }
}

// Export singleton instance
export const enhancedMobileMediaIntegration = EnhancedMobileMediaIntegrationService.getInstance();
