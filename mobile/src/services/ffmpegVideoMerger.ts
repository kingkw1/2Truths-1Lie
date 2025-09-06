/**
 * FFmpeg-based Video Merging Service
 * Provides true video concatenation functionality using FFmpeg
 * This service handles the actual merging of multiple video files into a single seamless video
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { VideoSegment } from '../types';

// Conditional FFmpeg imports - only available if package is installed
let FFmpegKit: any = null;
let ReturnCode: any = null;
let FFmpegKitConfig: any = null;

try {
  const ffmpegModule = require('ffmpeg-kit-react-native');
  FFmpegKit = ffmpegModule.FFmpegKit;
  ReturnCode = ffmpegModule.ReturnCode;
  FFmpegKitConfig = ffmpegModule.FFmpegKitConfig;
  console.log('✅ FFmpeg module loaded successfully');
} catch (error) {
  console.warn('⚠️ FFmpeg module not available:', error);
}

export interface FFmpegMergeOptions {
  compressionQuality?: number; // 0-1 scale, default 0.8
  outputFormat?: 'mp4' | 'mov'; // default mp4
  maxOutputSize?: number; // in bytes, default 50MB
  targetBitrate?: string; // e.g., '2M' for 2 Mbps
  targetResolution?: string; // e.g., '1280x720'
  enableHardwareAcceleration?: boolean; // platform-specific
}

export interface FFmpegMergeProgress {
  stage: 'analyzing' | 'preparing' | 'merging' | 'compressing' | 'finalizing';
  progress: number; // 0-100
  currentSegment?: number;
  ffmpegProgress?: number; // FFmpeg-specific progress 0-100
  estimatedTimeRemaining?: number; // in milliseconds
  processingSpeed?: string; // e.g., '1.2x'
}

export interface FFmpegMergeResult {
  success: boolean;
  mergedVideoUri?: string;
  segments?: VideoSegment[];
  totalDuration?: number;
  fileSize?: number;
  compressionRatio?: number;
  actualBitrate?: string;
  resolution?: string;
  error?: string;
  ffmpegLogs?: string[];
}

export class FFmpegVideoMerger {
  private static instance: FFmpegVideoMerger;
  
  private constructor() {
    this.initializeFFmpeg();
  }
  
  public static getInstance(): FFmpegVideoMerger {
    if (!FFmpegVideoMerger.instance) {
      FFmpegVideoMerger.instance = new FFmpegVideoMerger();
    }
    return FFmpegVideoMerger.instance;
  }

  /**
   * Initialize FFmpeg configuration
   */
  private initializeFFmpeg(): void {
    try {
      if (!FFmpegKitConfig) {
        console.log('⚠️ FFmpeg not available, skipping initialization');
        return;
      }

      // Configure FFmpeg logging level
      FFmpegKitConfig.setLogLevel(30); // AV_LOG_INFO
      
      // Enable statistics for progress tracking
      FFmpegKitConfig.enableStatisticsCallback(() => {
        // Progress updates will be handled per session
      });

      console.log('🎬 FFmpeg initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FFmpeg:', error);
    }
  }

  /**
   * Create a concatenated video from three statement videos
   * This performs true video merging, not just copying the first video
   */
  public async createConcatenatedVideo(
    videoUris: [string, string, string],
    options: FFmpegMergeOptions = {},
    onProgress?: (progress: FFmpegMergeProgress) => void
  ): Promise<FFmpegMergeResult> {
    console.log('🎬 Starting FFmpeg video concatenation...');
    
    // Check if FFmpeg is available
    if (!FFmpegKit || !ReturnCode || !FFmpegKitConfig) {
      return {
        success: false,
        error: 'FFmpeg not available. Please install ffmpeg-kit-react-native package.',
      };
    }

    try {
      // Step 1: Analyze input videos
      onProgress?.({
        stage: 'analyzing',
        progress: 5,
      });

      const videoAnalysis = await this.analyzeInputVideos(videoUris);
      if (!videoAnalysis.success) {
        return {
          success: false,
          error: videoAnalysis.error,
        };
      }

      // Step 2: Prepare videos for concatenation
      onProgress?.({
        stage: 'preparing',
        progress: 15,
      });

      const preparedVideos = await this.prepareVideosForConcatenation(
        videoUris,
        videoAnalysis.videoInfo!,
        options
      );

      // Step 3: Create concatenation list file
      const concatListFile = await this.createConcatenationList(preparedVideos);

      // Step 4: Generate output path
      const timestamp = Date.now();
      const outputFormat = options.outputFormat || 'mp4';
      const outputUri = `${FileSystem.documentDirectory}merged_video_${timestamp}.${outputFormat}`;

      // Step 5: Execute FFmpeg concatenation
      onProgress?.({
        stage: 'merging',
        progress: 25,
      });

      const mergeResult = await this.executeConcatenation(
        concatListFile,
        outputUri,
        options,
        (ffmpegProgress) => {
          onProgress?.({
            stage: 'merging',
            progress: 25 + (ffmpegProgress * 0.5), // 25-75% for merging
            ffmpegProgress,
          });
        }
      );

      if (!mergeResult.success) {
        return mergeResult;
      }

      // Step 6: Post-process and compress if needed
      onProgress?.({
        stage: 'compressing',
        progress: 80,
      });

      const finalVideoUri = await this.postProcessVideo(
        outputUri,
        options,
        (compressionProgress) => {
          onProgress?.({
            stage: 'compressing',
            progress: 80 + (compressionProgress * 0.15), // 80-95%
          });
        }
      );

      // Step 7: Calculate final segments and metadata
      onProgress?.({
        stage: 'finalizing',
        progress: 95,
      });

      const finalSegments = this.calculateFinalSegments(videoAnalysis.durations!);
      const finalVideoInfo = await this.getFinalVideoInfo(finalVideoUri);

      // Cleanup temporary files
      await this.cleanupTempFiles([concatListFile, ...preparedVideos.map(v => v.uri)]);

      onProgress?.({
        stage: 'finalizing',
        progress: 100,
      });

      console.log('✅ FFmpeg video concatenation completed successfully');

      return {
        success: true,
        mergedVideoUri: finalVideoUri,
        segments: finalSegments,
        totalDuration: finalSegments.reduce((sum, seg) => sum + seg.duration, 0),
        fileSize: finalVideoInfo.fileSize,
        compressionRatio: finalVideoInfo.compressionRatio,
        actualBitrate: finalVideoInfo.bitrate,
        resolution: finalVideoInfo.resolution,
        ffmpegLogs: mergeResult.logs,
      };

    } catch (error: any) {
      console.error('❌ FFmpeg video concatenation failed:', error);
      return {
        success: false,
        error: error.message || 'Video concatenation failed',
      };
    }
  }

  /**
   * Analyze input videos to get detailed metadata
   */
  private async analyzeInputVideos(videoUris: [string, string, string]): Promise<{
    success: boolean;
    error?: string;
    videoInfo?: Array<{
      uri: string;
      duration: number;
      bitrate: string;
      resolution: string;
      codec: string;
      fps: number;
      fileSize: number;
    }>;
    durations?: number[];
  }> {
    try {
      const videoInfo = [];
      const durations = [];

      for (let i = 0; i < videoUris.length; i++) {
        const uri = videoUris[i];

        // Validate file exists
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          return {
            success: false,
            error: `Video ${i + 1} not found: ${uri}`,
          };
        }

        // Get video metadata using FFprobe
        if (FFmpegKit) {
          const probeCommand = `-v quiet -print_format json -show_format -show_streams "${uri}"`;
          const session = await FFmpegKit.execute(probeCommand);
          const returnCode = await session.getReturnCode();

          if (!ReturnCode.isSuccess(returnCode)) {
            // Fallback to Expo AV for basic duration
            try {
              const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false }
              );
              
              const status = await sound.getStatusAsync();
              const duration = status.isLoaded ? status.durationMillis || 0 : 0;
              await sound.unloadAsync();

              videoInfo.push({
                uri,
                duration,
                bitrate: 'unknown',
                resolution: 'unknown',
                codec: 'unknown',
                fps: 30, // default
                fileSize: 'size' in fileInfo ? fileInfo.size : 0,
              });
              durations.push(duration);
            } catch (audioError) {
              return {
                success: false,
                error: `Failed to analyze video ${i + 1}: ${audioError}`,
              };
            }
          } else {
            // Parse FFprobe output (in production, you would parse the JSON response)
            // For now, use Expo AV as fallback
            const { sound } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: false }
            );
            
            const status = await sound.getStatusAsync();
            const duration = status.isLoaded ? status.durationMillis || 0 : 0;
            await sound.unloadAsync();

            videoInfo.push({
              uri,
              duration,
              bitrate: '2000k', // estimated
              resolution: '1280x720', // estimated
              codec: 'h264',
              fps: 30,
              fileSize: 'size' in fileInfo ? fileInfo.size : 0,
            });
            durations.push(duration);
          }
        } else {
          // Fallback to Expo AV if FFmpeg not available
          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri },
              { shouldPlay: false }
            );
            
            const status = await sound.getStatusAsync();
            const duration = status.isLoaded ? status.durationMillis || 0 : 0;
            await sound.unloadAsync();

            videoInfo.push({
              uri,
              duration,
              bitrate: 'unknown',
              resolution: 'unknown',
              codec: 'unknown',
              fps: 30, // default
              fileSize: 'size' in fileInfo ? fileInfo.size : 0,
            });
            durations.push(duration);
          } catch (audioError) {
            return {
              success: false,
              error: `Failed to analyze video ${i + 1}: ${audioError}`,
            };
          }
        }
      }

      return {
        success: true,
        videoInfo,
        durations,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Video analysis failed: ${error.message}`,
      };
    }
  }

  /**
   * Prepare videos for concatenation (ensure compatible formats)
   */
  private async prepareVideosForConcatenation(
    videoUris: [string, string, string],
    videoInfo: Array<{ uri: string; duration: number; bitrate: string; resolution: string; codec: string; fps: number; fileSize: number; }>,
    options: FFmpegMergeOptions
  ): Promise<Array<{ uri: string; originalUri: string; }>> {
    const tempDir = `${FileSystem.documentDirectory}temp_concat_${Date.now()}/`;
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

    const preparedVideos = [];

    // Determine target specs for consistency
    const targetResolution = options.targetResolution || '1280x720';
    const targetBitrate = options.targetBitrate || '2M';
    const targetFps = 30;

    for (let i = 0; i < videoUris.length; i++) {
      const originalUri = videoUris[i];
      const preparedUri = `${tempDir}prepared_${i}.mp4`;

      // Create FFmpeg command to normalize video format
      const ffmpegCommand = [
        `-i "${originalUri}"`,
        `-c:v libx264`, // Use H.264 codec
        `-crf 23`, // Constant Rate Factor for quality
        `-preset fast`, // Encoding speed preset
        `-s ${targetResolution}`, // Scale to target resolution
        `-r ${targetFps}`, // Set frame rate
        `-c:a aac`, // Audio codec
        `-b:a 128k`, // Audio bitrate
        `-movflags +faststart`, // Optimize for streaming
        `-y`, // Overwrite output file
        `"${preparedUri}"`
      ].join(' ');

      console.log(`🔧 Preparing video ${i + 1} with command:`, ffmpegCommand);

      const session = await FFmpegKit.execute(ffmpegCommand);
      const returnCode = await session.getReturnCode();

      if (!ReturnCode.isSuccess(returnCode)) {
        // If processing fails, use original file
        console.warn(`⚠️ Failed to prepare video ${i + 1}, using original`);
        await FileSystem.copyAsync({
          from: originalUri,
          to: preparedUri,
        });
      }

      preparedVideos.push({
        uri: preparedUri,
        originalUri,
      });
    }

    return preparedVideos;
  }

  /**
   * Create FFmpeg concatenation list file
   */
  private async createConcatenationList(
    preparedVideos: Array<{ uri: string; originalUri: string; }>
  ): Promise<string> {
    const listContent = preparedVideos
      .map(video => `file '${video.uri}'`)
      .join('\n');

    const listFilePath = `${FileSystem.documentDirectory}concat_list_${Date.now()}.txt`;
    await FileSystem.writeAsStringAsync(listFilePath, listContent);

    console.log('📝 Created concatenation list file:', listFilePath);
    console.log('📝 List content:', listContent);

    return listFilePath;
  }

  /**
   * Execute FFmpeg concatenation
   */
  private async executeConcatenation(
    concatListFile: string,
    outputUri: string,
    options: FFmpegMergeOptions,
    onProgress?: (progress: number) => void
  ): Promise<{
    success: boolean;
    error?: string;
    logs?: string[];
  }> {
    try {
      // Build FFmpeg concatenation command
      const ffmpegCommand = [
        `-f concat`,
        `-safe 0`,
        `-i "${concatListFile}"`,
        `-c copy`, // Copy streams without re-encoding for speed
        `-avoid_negative_ts make_zero`, // Ensure proper timestamps
        `-y`, // Overwrite output file
        `"${outputUri}"`
      ].join(' ');

      console.log('🎬 Executing FFmpeg concatenation:', ffmpegCommand);

      // Track progress
      let progressValue = 0;
      const logs: string[] = [];

      // Configure statistics callback for this session
      FFmpegKitConfig.enableStatisticsCallback((statistics: any) => {
        const timeInMilliseconds = statistics.getTime();
        if (timeInMilliseconds > 0) {
          // Calculate progress based on time (this is approximate)
          progressValue = Math.min(100, (timeInMilliseconds / 1000) * 2); // Rough estimate
          onProgress?.(progressValue);
        }
      });

      // Execute the command
      const session = await FFmpegKit.execute(ffmpegCommand);
      const returnCode = await session.getReturnCode();
      const sessionLogs = await session.getAllLogs();

      // Collect logs
      for (const log of sessionLogs) {
        logs.push(await log.getMessage());
      }

      if (ReturnCode.isSuccess(returnCode)) {
        console.log('✅ FFmpeg concatenation completed successfully');
        onProgress?.(100);
        return {
          success: true,
          logs,
        };
      } else {
        console.error('❌ FFmpeg concatenation failed with return code:', returnCode);
        return {
          success: false,
          error: `FFmpeg failed with return code: ${returnCode}`,
          logs,
        };
      }
    } catch (error: any) {
      console.error('❌ FFmpeg execution error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Post-process video (compression, optimization)
   */
  private async postProcessVideo(
    inputUri: string,
    options: FFmpegMergeOptions,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    // Check if compression is needed
    const fileInfo = await FileSystem.getInfoAsync(inputUri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;
    const maxSize = options.maxOutputSize || 50 * 1024 * 1024; // 50MB

    if (fileSize <= maxSize) {
      console.log('📹 Video size within limits, no compression needed');
      onProgress?.(100);
      return inputUri;
    }

    console.log('🗜️ Applying compression to merged video...');

    const compressedUri = `${FileSystem.documentDirectory}compressed_${Date.now()}.mp4`;
    const quality = options.compressionQuality || 0.8;
    const crf = Math.round(23 + (1 - quality) * 28); // CRF 23-51 range

    const compressionCommand = [
      `-i "${inputUri}"`,
      `-c:v libx264`,
      `-crf ${crf}`,
      `-preset medium`,
      `-c:a aac`,
      `-b:a 128k`,
      `-movflags +faststart`,
      `-y`,
      `"${compressedUri}"`
    ].join(' ');

    const session = await FFmpegKit.execute(compressionCommand);
    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
      console.log('✅ Video compression completed');
      onProgress?.(100);
      
      // Delete the uncompressed version
      await FileSystem.deleteAsync(inputUri, { idempotent: true });
      
      return compressedUri;
    } else {
      console.warn('⚠️ Compression failed, using original video');
      onProgress?.(100);
      return inputUri;
    }
  }

  /**
   * Calculate final segment timings based on actual durations
   */
  private calculateFinalSegments(durations: number[]): VideoSegment[] {
    const segments: VideoSegment[] = [];
    let currentTime = 0;

    for (let i = 0; i < durations.length; i++) {
      const duration = durations[i];
      const segment: VideoSegment = {
        statementIndex: i,
        startTime: currentTime,
        endTime: currentTime + duration,
        duration: duration,
        originalDuration: duration,
      };
      
      segments.push(segment);
      currentTime += duration;
    }

    console.log('📊 Final segment timings:', segments);
    return segments;
  }

  /**
   * Get final video information
   */
  private async getFinalVideoInfo(videoUri: string): Promise<{
    fileSize: number;
    compressionRatio: number;
    bitrate: string;
    resolution: string;
  }> {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

    return {
      fileSize,
      compressionRatio: 1, // Would be calculated if we had original total size
      bitrate: '2M', // Would be extracted from FFprobe
      resolution: '1280x720', // Would be extracted from FFprobe
    };
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        console.log('🗑️ Cleaned up temp file:', filePath);
      } catch (error) {
        console.warn('⚠️ Failed to cleanup temp file:', filePath, error);
      }
    }
  }
}

// Export singleton instance
export const ffmpegVideoMerger = FFmpegVideoMerger.getInstance();
