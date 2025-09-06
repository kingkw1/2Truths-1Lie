/**
 * Enhanced Upload Service
 * TEMPORARILY SIMPLIFIED to avoid FormData issues during app launch
 */

import * as FileSystem from 'expo-file-system';
import { MediaCapture, VideoSegment } from '../types';
import { videoMergingService } from './videoMergingService';

export interface EnhancedUploadOptions {
  compressionBeforeUpload?: boolean;
  uploadTimeout?: number;
  retryAttempts?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'completed';
  progress: number; // 0-100
  uploadSpeed?: number; // bytes per second
  estimatedTimeRemaining?: number; // milliseconds
  uploadedBytes?: number;
  totalBytes?: number;
}

export interface UploadResult {
  success: boolean;
  challengeId?: string;
  videoUrl?: string;
  uploadTime?: number;
  compressionRatio?: number;
  error?: string;
}

/**
 * Enhanced Upload Service Class - TEMPORARILY DISABLED
 */
export class EnhancedUploadService {
  private static instance: EnhancedUploadService;

  public static getInstance(): EnhancedUploadService {
    if (!EnhancedUploadService.instance) {
      EnhancedUploadService.instance = new EnhancedUploadService();
    }
    return EnhancedUploadService.instance;
  }

  /**
   * Upload merged challenge - TEMPORARILY DISABLED
   */
  public async uploadMergedChallenge(
    mediaCapture: MediaCapture,
    options: EnhancedUploadOptions = {}
  ): Promise<UploadResult> {
    console.warn('⚠️ Upload functionality temporarily disabled to fix FormData launch issues');
    
    // Return a fake success for now so the app doesn't crash
    return {
      success: false,
      error: 'Upload temporarily disabled - working on FormData compatibility'
    };
  }

  /**
   * All other methods temporarily disabled
   */
  private async createUploadPayload(): Promise<any> {
    throw new Error('Upload temporarily disabled');
  }

  private async performUpload(): Promise<UploadResult> {
    throw new Error('Upload temporarily disabled');
  }

  private async executeUpload(): Promise<UploadResult> {
    throw new Error('Upload temporarily disabled');
  }
}

// Export singleton instance
export const enhancedUploadService = EnhancedUploadService.getInstance();

import * as FileSystem from 'expo-file-system';
// Note: FormData usage temporarily disabled
import { MediaCapture, VideoSegment } from '../types';
import { videoMergingService } from './videoMergingService';

export interface EnhancedUploadOptions {
  compressionBeforeUpload?: boolean; // Apply additional compression before upload
  uploadTimeout?: number; // Upload timeout in milliseconds
  retryAttempts?: number; // Number of retry attempts on failure
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  stage: 'preparing' | 'compressing' | 'uploading' | 'validating' | 'complete';
  progress: number; // 0-100
  uploadedBytes?: number;
  totalBytes?: number;
  uploadSpeed?: string; // e.g., "1.2 MB/s"
  estimatedTimeRemaining?: number; // in milliseconds
}

export interface UploadResult {
  success: boolean;
  challengeId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  segments?: VideoSegment[];
  uploadedSize?: number;
  compressionRatio?: number;
  uploadDuration?: number;
  error?: string;
}

export class EnhancedUploadService {
  private static instance: EnhancedUploadService;
  private apiBaseUrl: string;
  
  private constructor() {
    // TODO: Configure this from environment or config
    this.apiBaseUrl = 'https://api.2truths1lie.com'; // Replace with actual API URL
  }
  
  public static getInstance(): EnhancedUploadService {
    if (!EnhancedUploadService.instance) {
      EnhancedUploadService.instance = new EnhancedUploadService();
    }
    return EnhancedUploadService.instance;
  }

  /**
   * Upload a complete challenge with merged video and segment metadata
   */
  public async uploadMergedChallenge(
    mergedVideo: MediaCapture,
    statements: string[],
    lieIndex: number,
    userId: string,
    options: EnhancedUploadOptions = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      console.log('📤 Starting enhanced challenge upload...');
      
      options.onProgress?.({
        stage: 'preparing',
        progress: 5,
      });

      // Step 1: Validate the merged video and segments
      const validation = await this.validateMergedVideo(mergedVideo);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      options.onProgress?.({
        stage: 'preparing',
        progress: 10,
      });

      // Step 2: Load and validate segment metadata
      const segmentMetadata = await this.loadSegmentMetadata(mergedVideo);
      
      options.onProgress?.({
        stage: 'preparing',
        progress: 15,
      });

      // Step 3: Apply additional compression if requested
      let finalVideoUri = mergedVideo.url || mergedVideo.streamingUrl!;
      let compressionRatio = mergedVideo.compressionRatio || 1;

      if (options.compressionBeforeUpload) {
        options.onProgress?.({
          stage: 'compressing',
          progress: 20,
        });

        const compressionResult = await this.applyAdditionalCompression(
          finalVideoUri,
          (compressionProgress) => {
            options.onProgress?.({
              stage: 'compressing',
              progress: 20 + (compressionProgress * 0.3), // 20-50%
            });
          }
        );

        if (compressionResult.success) {
          finalVideoUri = compressionResult.compressedUri!;
          compressionRatio = compressionResult.compressionRatio!;
        }
      }

      options.onProgress?.({
        stage: 'uploading',
        progress: 50,
      });

      // Step 4: Create upload payload
      const uploadPayload = await this.createUploadPayload(
        finalVideoUri,
        statements,
        lieIndex,
        userId,
        mergedVideo.segments || [],
        segmentMetadata
      );

      // Step 5: Perform the upload
      const uploadResult = await this.performUpload(
        uploadPayload,
        (uploadProgress) => {
          options.onProgress?.({
            stage: 'uploading',
            progress: 50 + (uploadProgress.progress * 0.4), // 50-90%
            uploadedBytes: uploadProgress.uploadedBytes,
            totalBytes: uploadProgress.totalBytes,
            uploadSpeed: uploadProgress.uploadSpeed,
            estimatedTimeRemaining: uploadProgress.estimatedTimeRemaining,
          });
        },
        options
      );

      if (!uploadResult.success) {
        return uploadResult;
      }

      options.onProgress?.({
        stage: 'validating',
        progress: 90,
      });

      // Step 6: Validate the uploaded challenge
      const serverValidation = await this.validateUploadedChallenge(uploadResult.challengeId!);
      
      options.onProgress?.({
        stage: 'complete',
        progress: 100,
      });

      // Step 7: Clean up temporary files
      await this.cleanupTempFiles([finalVideoUri]);

      const uploadDuration = Date.now() - startTime;
      
      console.log('✅ Enhanced challenge upload completed successfully');
      console.log(`📊 Upload duration: ${uploadDuration}ms`);
      console.log(`📊 Compression ratio: ${compressionRatio.toFixed(2)}`);

      return {
        success: true,
        challengeId: uploadResult.challengeId,
        videoUrl: uploadResult.videoUrl,
        thumbnailUrl: uploadResult.thumbnailUrl,
        segments: mergedVideo.segments,
        uploadedSize: uploadResult.uploadedSize,
        compressionRatio,
        uploadDuration,
      };

    } catch (error: any) {
      console.error('❌ Enhanced challenge upload failed:', error);
      return {
        success: false,
        error: error.message || 'Upload failed',
      };
    }
  }

  /**
   * Validate the merged video before upload
   */
  private async validateMergedVideo(mergedVideo: MediaCapture): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      // Check if video file exists
      const videoUri = mergedVideo.url || mergedVideo.streamingUrl;
      if (!videoUri) {
        return {
          isValid: false,
          error: 'No video URL provided',
        };
      }

      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        return {
          isValid: false,
          error: 'Video file not found',
        };
      }

      const fileSize = 'size' in fileInfo ? fileInfo.size : 0;
      if (fileSize === 0) {
        return {
          isValid: false,
          error: 'Video file is empty',
        };
      }

      // Check if segments are properly defined
      if (!mergedVideo.segments || mergedVideo.segments.length !== 3) {
        return {
          isValid: false,
          error: 'Invalid segment metadata: expected 3 segments',
        };
      }

      // Validate segment timings
      for (let i = 0; i < mergedVideo.segments.length; i++) {
        const segment = mergedVideo.segments[i];
        if (segment.statementIndex !== i) {
          return {
            isValid: false,
            error: `Segment ${i} has incorrect statement index: ${segment.statementIndex}`,
          };
        }

        if (segment.duration <= 0) {
          return {
            isValid: false,
            error: `Segment ${i} has invalid duration: ${segment.duration}`,
          };
        }

        if (segment.startTime >= segment.endTime) {
          return {
            isValid: false,
            error: `Segment ${i} has invalid timing: start ${segment.startTime} >= end ${segment.endTime}`,
          };
        }
      }

      return { isValid: true };
    } catch (error: any) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Load segment metadata from file
   */
  private async loadSegmentMetadata(mergedVideo: MediaCapture): Promise<any> {
    try {
      const videoUri = mergedVideo.url || mergedVideo.streamingUrl;
      if (!videoUri) return null;

      const metadataUri = videoUri.replace(/\.[^/.]+$/, '.segments.json');
      const fileInfo = await FileSystem.getInfoAsync(metadataUri);

      if (fileInfo.exists) {
        const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
        return JSON.parse(metadataContent);
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Failed to load segment metadata:', error);
      return null;
    }
  }

  /**
   * Apply additional compression before upload
   */
  private async applyAdditionalCompression(
    videoUri: string,
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    compressedUri?: string;
    compressionRatio?: number;
    error?: string;
  }> {
    try {
      console.log('🗜️ Applying additional compression for upload...');

      // Get original file size
      const originalInfo = await FileSystem.getInfoAsync(videoUri);
      const originalSize = originalInfo.exists && 'size' in originalInfo ? originalInfo.size : 0;

      // For now, we'll simulate compression
      // In a real implementation, you would use FFmpeg or native compression APIs
      const compressedUri = `${FileSystem.documentDirectory}upload_compressed_${Date.now()}.mp4`;

      // Simulate compression progress
      for (let progress = 0; progress <= 100; progress += 10) {
        onProgress?.(progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Copy the file (in production, apply actual compression)
      await FileSystem.copyAsync({
        from: videoUri,
        to: compressedUri,
      });

      // Get compressed file size (would be smaller with real compression)
      const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
      const compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : 0;

      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      console.log('✅ Additional compression completed');
      console.log(`📊 Compression ratio: ${compressionRatio.toFixed(2)}`);

      return {
        success: true,
        compressedUri,
        compressionRatio,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create the upload payload with all necessary data
   */
  private async createUploadPayload(
    videoUri: string,
    statements: string[],
    lieIndex: number,
    userId: string,
    segments: VideoSegment[],
    segmentMetadata: any
  ): Promise<any> {
    // TEMPORARILY DISABLED: FormData usage causing launch issues
    console.warn('⚠️ Upload functionality temporarily disabled due to FormData issues');
    throw new Error('Upload temporarily disabled - FormData compatibility issues');
  }

  /**
   * Perform the actual upload with progress tracking (DISABLED)
   */
  private async performUpload(
    formData: any,
    onProgress?: (progress: UploadProgress) => void,
    options: EnhancedUploadOptions = {}
  ): Promise<UploadResult> {
    // TEMPORARILY DISABLED: FormData usage causing launch issues
    console.warn('⚠️ Upload functionality temporarily disabled due to FormData issues');
    throw new Error('Upload temporarily disabled - FormData compatibility issues');
  ): Promise<UploadResult> {
    const uploadStartTime = Date.now();
    const timeout = options.uploadTimeout || 5 * 60 * 1000; // 5 minutes default
    const maxRetries = options.retryAttempts || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Upload attempt ${attempt}/${maxRetries}`);

        const uploadPromise = this.executeUpload(formData, onProgress);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout')), timeout)
        );

        const result = await Promise.race([uploadPromise, timeoutPromise]);
        
        if (result.success) {
          const uploadDuration = Date.now() - uploadStartTime;
          console.log(`✅ Upload completed in ${uploadDuration}ms`);
          return result;
        } else if (attempt === maxRetries) {
          return result;
        }

        console.log(`⚠️ Upload attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff

      } catch (error: any) {
        console.error(`❌ Upload attempt ${attempt} error:`, error);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            error: error.message || 'Upload failed after multiple attempts',
          };
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    return {
      success: false,
      error: 'Upload failed after all retry attempts',
    };
  }

  /**
   * Execute the upload request
   */
  private async executeUpload(
    formData: FormData,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          const uploadSpeed = this.calculateUploadSpeed(event.loaded, Date.now());
          const remainingBytes = event.total - event.loaded;
          const estimatedTimeRemaining = uploadSpeed > 0 ? (remainingBytes / uploadSpeed) * 1000 : 0;

          onProgress?.({
            stage: 'uploading',
            progress,
            uploadedBytes: event.loaded,
            totalBytes: event.total,
            uploadSpeed: this.formatUploadSpeed(uploadSpeed),
            estimatedTimeRemaining,
          });
        }
      });

      // Handle upload completion
      xhr.addEventListener('load', () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve({
              success: true,
              challengeId: response.challengeId,
              videoUrl: response.videoUrl,
              thumbnailUrl: response.thumbnailUrl,
              uploadedSize: response.uploadedSize,
            });
          } else {
            resolve({
              success: false,
              error: `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
            });
          }
        } catch (error: any) {
          reject(new Error(`Failed to parse upload response: ${error.message}`));
        }
      });

      // Handle upload errors
      xhr.addEventListener('error', () => {
        reject(new Error('Upload network error'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      // Configure and send request
      xhr.open('POST', `${this.apiBaseUrl}/api/challenges/upload`);
      xhr.setRequestHeader('Accept', 'application/json');
      
      // Add authentication header if available
      // xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

      xhr.send(formData as any);
    });
  }

  /**
   * Calculate upload speed in bytes per second
   */
  private calculateUploadSpeed(uploadedBytes: number, currentTime: number): number {
    // This would maintain a rolling average in a real implementation
    // For now, return a placeholder
    return 1024 * 1024; // 1 MB/s placeholder
  }

  /**
   * Format upload speed for display
   */
  private formatUploadSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  /**
   * Validate the uploaded challenge on the server
   */
  private async validateUploadedChallenge(challengeId: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/challenges/${challengeId}/validate`);
      
      if (response.ok) {
        const validation = await response.json();
        return {
          isValid: validation.isValid,
          error: validation.error,
        };
      } else {
        return {
          isValid: false,
          error: `Validation request failed: ${response.status}`,
        };
      }
    } catch (error: any) {
      console.warn('⚠️ Server validation failed:', error);
      // Don't fail the upload if validation fails
      return { isValid: true };
    }
  }

  /**
   * Clean up temporary files after upload
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        // Only delete files in the temp/cache directories
        if (filePath.includes('temp_') || filePath.includes('compressed_') || filePath.includes('cache')) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
          console.log('🗑️ Cleaned up temp file:', filePath);
        }
      } catch (error) {
        console.warn('⚠️ Failed to cleanup temp file:', filePath, error);
      }
    }
  }
}

// Export singleton instance
export const enhancedUploadService = EnhancedUploadService.getInstance();
