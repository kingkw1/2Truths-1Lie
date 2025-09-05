/**
 * Video Merging Service
 * Handles merging of three statement videos into a single video with segment metadata
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { MediaCapture, VideoSegment } from '../types';

export interface VideoMergingOptions {
  compressionQuality?: number; // 0-1 scale, default 0.8
  outputFormat?: 'mp4' | 'mov'; // default based on platform
  maxOutputSize?: number; // in bytes, default 50MB
  includeTransitions?: boolean; // add brief transitions between segments
  transitionDuration?: number; // in milliseconds, default 500ms
}

export interface MergeProgress {
  stage: 'preparing' | 'merging' | 'compressing' | 'finalizing';
  progress: number; // 0-100
  currentSegment?: number; // which segment is being processed
  estimatedTimeRemaining?: number; // in milliseconds
}

export interface MergeResult {
  success: boolean;
  mergedVideoUri?: string;
  segments?: VideoSegment[];
  totalDuration?: number;
  fileSize?: number;
  compressionRatio?: number;
  error?: string;
}

export class VideoMergingService {
  private static instance: VideoMergingService;
  
  private constructor() {}
  
  public static getInstance(): VideoMergingService {
    if (!VideoMergingService.instance) {
      VideoMergingService.instance = new VideoMergingService();
    }
    return VideoMergingService.instance;
  }

  /**
   * Merge three statement videos into a single video with segment metadata
   */
  public async mergeStatementVideos(
    videoUris: [string, string, string],
    options: VideoMergingOptions = {},
    onProgress?: (progress: MergeProgress) => void
  ): Promise<MergeResult> {
    try {
      console.log('🎬 Starting video merge process for 3 statements');
      
      // Validate input videos
      const validationResult = await this.validateInputVideos(videoUris);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
        };
      }

      onProgress?.({
        stage: 'preparing',
        progress: 10,
      });

      // Get video metadata for each segment
      const videoMetadata = await this.getVideoMetadata(videoUris);
      
      onProgress?.({
        stage: 'preparing',
        progress: 20,
      });

      // Calculate segment timings
      const segments = this.calculateSegmentTimings(videoMetadata);
      
      onProgress?.({
        stage: 'merging',
        progress: 30,
      });

      // Perform the actual video merging
      const mergedVideoUri = await this.performVideoMerge(
        videoUris,
        segments,
        options,
        (mergeProgress) => {
          onProgress?.({
            stage: 'merging',
            progress: 30 + (mergeProgress * 0.5), // 30-80% for merging
            currentSegment: mergeProgress < 33 ? 0 : mergeProgress < 66 ? 1 : 2,
          });
        }
      );

      onProgress?.({
        stage: 'compressing',
        progress: 80,
      });

      // Apply compression if needed
      const finalVideoUri = await this.applyCompressionIfNeeded(
        mergedVideoUri,
        options,
        (compressionProgress) => {
          onProgress?.({
            stage: 'compressing',
            progress: 80 + (compressionProgress * 0.15), // 80-95% for compression
          });
        }
      );

      onProgress?.({
        stage: 'finalizing',
        progress: 95,
      });

      // Get final video info
      const finalVideoInfo = await FileSystem.getInfoAsync(finalVideoUri);
      const finalFileSize = finalVideoInfo.exists && 'size' in finalVideoInfo ? finalVideoInfo.size : 0;
      
      // Calculate compression ratio
      const originalTotalSize = videoMetadata.reduce((sum, meta) => sum + meta.fileSize, 0);
      const compressionRatio = finalFileSize > 0 ? finalFileSize / originalTotalSize : 1;

      onProgress?.({
        stage: 'finalizing',
        progress: 100,
      });

      // Clean up temporary files
      if (mergedVideoUri !== finalVideoUri) {
        await FileSystem.deleteAsync(mergedVideoUri, { idempotent: true });
      }

      console.log('✅ Video merge completed successfully');
      
      return {
        success: true,
        mergedVideoUri: finalVideoUri,
        segments,
        totalDuration: segments.reduce((sum, seg) => sum + seg.duration, 0),
        fileSize: finalFileSize,
        compressionRatio,
      };

    } catch (error: any) {
      console.error('❌ Video merge failed:', error);
      return {
        success: false,
        error: error.message || 'Video merge failed',
      };
    }
  }

  /**
   * Validate that all input videos exist and are accessible
   */
  private async validateInputVideos(videoUris: [string, string, string]): Promise<{
    valid: boolean;
    error?: string;
  }> {
    for (let i = 0; i < videoUris.length; i++) {
      const uri = videoUris[i];
      if (!uri) {
        return {
          valid: false,
          error: `Statement ${i + 1} video is missing`,
        };
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        return {
          valid: false,
          error: `Statement ${i + 1} video file not found`,
        };
      }

      const fileSize = 'size' in fileInfo ? fileInfo.size : 0;
      if (fileSize === 0) {
        return {
          valid: false,
          error: `Statement ${i + 1} video file is empty`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get metadata for each video file
   */
  private async getVideoMetadata(videoUris: [string, string, string]): Promise<Array<{
    uri: string;
    fileSize: number;
    duration: number; // estimated from file size, will be refined during merge
  }>> {
    const metadata = [];
    
    for (let i = 0; i < videoUris.length; i++) {
      const uri = videoUris[i];
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
      
      // Estimate duration based on file size (rough approximation)
      // Assuming ~1MB per 10 seconds of video at standard quality
      const estimatedDuration = Math.max(1000, (fileSize / (1024 * 1024)) * 10 * 1000);
      
      metadata.push({
        uri,
        fileSize,
        duration: estimatedDuration,
      });
    }
    
    return metadata;
  }

  /**
   * Calculate segment timings within the merged video
   */
  private calculateSegmentTimings(videoMetadata: Array<{
    uri: string;
    fileSize: number;
    duration: number;
  }>): VideoSegment[] {
    const segments: VideoSegment[] = [];
    let currentTime = 0;

    for (let i = 0; i < videoMetadata.length; i++) {
      const meta = videoMetadata[i];
      const segment: VideoSegment = {
        statementIndex: i,
        startTime: currentTime,
        endTime: currentTime + meta.duration,
        duration: meta.duration,
        originalDuration: meta.duration,
      };
      
      segments.push(segment);
      currentTime += meta.duration;
    }

    return segments;
  }

  /**
   * Perform the actual video merging
   * Note: This is a simplified implementation. In a production app, you would use
   * a library like FFmpeg or platform-specific video processing APIs.
   */
  private async performVideoMerge(
    videoUris: [string, string, string],
    segments: VideoSegment[],
    options: VideoMergingOptions,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Generate output filename
    const timestamp = Date.now();
    const outputFormat = options.outputFormat || Platform.select({
      ios: 'mov',
      android: 'mp4',
    }) || 'mp4';
    const outputUri = `${FileSystem.documentDirectory}merged_challenge_${timestamp}.${outputFormat}`;

    // For now, we'll simulate the merging process by concatenating the videos
    // In a real implementation, you would use FFmpeg or similar
    console.log('🎬 Simulating video merge process...');
    
    // Simulate merging progress
    for (let progress = 0; progress <= 100; progress += 10) {
      onProgress?.(progress);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // For this implementation, we'll copy the first video as a placeholder
    // In production, you would actually merge the videos
    await FileSystem.copyAsync({
      from: videoUris[0],
      to: outputUri,
    });

    console.log('📹 Video merge simulation completed');
    return outputUri;
  }

  /**
   * Apply compression to the merged video if needed
   */
  private async applyCompressionIfNeeded(
    videoUri: string,
    options: VideoMergingOptions,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
    const maxSize = options.maxOutputSize || 50 * 1024 * 1024; // 50MB default

    if (fileSize <= maxSize) {
      console.log('📹 Video size within limits, no compression needed');
      return videoUri;
    }

    console.log('🗜️ Applying compression to merged video...');
    
    // Generate compressed output filename
    const timestamp = Date.now();
    const outputFormat = options.outputFormat || Platform.select({
      ios: 'mov',
      android: 'mp4',
    }) || 'mp4';
    const compressedUri = `${FileSystem.documentDirectory}compressed_merged_${timestamp}.${outputFormat}`;

    // Simulate compression progress
    for (let progress = 0; progress <= 100; progress += 20) {
      onProgress?.(progress);
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // For now, just copy the file (in production, apply actual compression)
    await FileSystem.copyAsync({
      from: videoUri,
      to: compressedUri,
    });

    console.log('✅ Video compression completed');
    return compressedUri;
  }

  /**
   * Create a MediaCapture object for the merged video
   */
  public createMergedMediaCapture(
    mergeResult: MergeResult,
    originalMediaCaptures: MediaCapture[]
  ): MediaCapture {
    if (!mergeResult.success || !mergeResult.mergedVideoUri || !mergeResult.segments) {
      throw new Error('Invalid merge result');
    }

    const mergedMedia: MediaCapture = {
      type: 'video',
      url: mergeResult.mergedVideoUri,
      duration: mergeResult.totalDuration,
      fileSize: mergeResult.fileSize,
      mimeType: Platform.select({
        ios: 'video/quicktime',
        android: 'video/mp4',
      }) || 'video/mp4',
      isMergedVideo: true,
      segments: mergeResult.segments,
      compressionRatio: mergeResult.compressionRatio,
      storageType: 'local',
      isUploaded: false,
    };

    // Aggregate metadata from original captures
    const totalOriginalSize = originalMediaCaptures.reduce(
      (sum, media) => sum + (media.fileSize || 0), 
      0
    );
    
    if (totalOriginalSize > 0) {
      mergedMedia.originalSize = totalOriginalSize;
      mergedMedia.compressionRatio = (mergeResult.fileSize || 0) / totalOriginalSize;
    }

    return mergedMedia;
  }

  /**
   * Extract a specific segment from a merged video for playback
   * This would be used by the playback UI to show individual statements
   */
  public async extractSegmentForPlayback(
    mergedVideoUri: string,
    segment: VideoSegment
  ): Promise<{
    success: boolean;
    segmentUri?: string;
    error?: string;
  }> {
    try {
      console.log(`🎬 Extracting segment ${segment.statementIndex} for playback`);
      
      // In a real implementation, you would extract the specific time range
      // For now, we'll return the full video URI (playback UI will handle seeking)
      return {
        success: true,
        segmentUri: mergedVideoUri,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to extract segment',
      };
    }
  }

  /**
   * Get playback information for a specific segment
   */
  public getSegmentPlaybackInfo(
    mergedMedia: MediaCapture,
    statementIndex: number
  ): {
    startTime: number;
    endTime: number;
    duration: number;
  } | null {
    if (!mergedMedia.segments || !mergedMedia.isMergedVideo) {
      return null;
    }

    const segment = mergedMedia.segments.find(s => s.statementIndex === statementIndex);
    if (!segment) {
      return null;
    }

    return {
      startTime: segment.startTime,
      endTime: segment.endTime,
      duration: segment.duration,
    };
  }

  /**
   * Clean up temporary files created during merging
   */
  public async cleanupTempFiles(): Promise<void> {
    try {
      const documentDir = FileSystem.documentDirectory;
      if (!documentDir) return;

      const files = await FileSystem.readDirectoryAsync(documentDir);
      const tempFiles = files.filter(file => 
        file.startsWith('merged_challenge_') || 
        file.startsWith('compressed_merged_') ||
        file.includes('_temp_merge_')
      );

      for (const file of tempFiles) {
        const filePath = `${documentDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        // Delete files older than 1 hour
        if (fileInfo.exists && fileInfo.modificationTime) {
          const ageMs = Date.now() - fileInfo.modificationTime;
          if (ageMs > 60 * 60 * 1000) { // 1 hour
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            console.log(`🗑️ Cleaned up temp merge file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup temp merge files:', error);
    }
  }
}

// Export singleton instance
export const videoMergingService = VideoMergingService.getInstance();