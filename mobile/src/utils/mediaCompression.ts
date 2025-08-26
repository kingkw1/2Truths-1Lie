/**
 * Platform-agnostic Media Compression abstraction
 * Automatically uses the correct implementation based on platform
 * - React Native: Simplified file operations with Expo
 * - Web: Full canvas/video compression (for future web implementation)
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface CompressionOptions {
  quality?: number; // 0.1 to 1.0, default 0.8
  maxWidth?: number; // For video, default 640
  maxHeight?: number; // For video, default 480
  maxFileSize?: number; // In bytes, default 5MB
  format?: 'webm' | 'mp4' | 'm4a'; // Output format
  audioBitrate?: number; // In kbps, default 128
  videoBitrate?: number; // In kbps, default 1000
}

export interface CompressionResult {
  compressedUri?: string; // For mobile (file URI)
  compressedBlob?: Blob; // For web (blob data)
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
  quality: number;
}

export interface CompressionProgress {
  stage: 'analyzing' | 'compressing' | 'finalizing';
  progress: number; // 0 to 100
  estimatedTimeRemaining?: number; // in milliseconds
}

// Mobile implementation (current)
class MobileMediaCompressor {
  /**
   * Mobile compression using Expo FileSystem
   * For now, this is a simplified implementation that focuses on file management
   * Real compression would require native modules or server-side processing
   */
  async compressMedia(
    fileUri: string,
    options: CompressionOptions = {},
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<CompressionResult> {
    const startTime = Date.now();

    onProgress?.({
      stage: 'analyzing',
      progress: 10,
    });

    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const originalSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      onProgress?.({
        stage: 'compressing',
        progress: 50,
      });

      // For mobile, we'll simulate compression by copying the file
      // In a real implementation, you'd use a native module for compression
      const compressedUri = await this.simulateCompression(fileUri, options, onProgress);

      const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
      const compressedSize = compressedInfo.exists && 'size' in compressedInfo ? compressedInfo.size : originalSize;

      onProgress?.({
        stage: 'finalizing',
        progress: 100,
      });

      const processingTime = Date.now() - startTime;
      const compressionRatio = originalSize / compressedSize;

      return {
        compressedUri,
        originalSize,
        compressedSize,
        compressionRatio,
        processingTime,
        quality: options.quality || 0.8,
      };
    } catch (error) {
      throw new Error(`Mobile compression failed: ${error}`);
    }
  }

  private async simulateCompression(
    sourceUri: string,
    options: CompressionOptions,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<string> {
    // Create a compressed copy with a new filename
    const timestamp = Date.now();
    const extension = sourceUri.split('.').pop() || 'mp4';
    const compressedUri = `${FileSystem.documentDirectory}compressed_${timestamp}.${extension}`;

    onProgress?.({
      stage: 'compressing',
      progress: 75,
    });

    // Copy file (in real implementation, this would be actual compression)
    await FileSystem.copyAsync({
      from: sourceUri,
      to: compressedUri,
    });

    return compressedUri;
  }

  dispose() {
    // No cleanup needed for mobile implementation
  }
}

// Platform-specific exports
export const createMediaCompressor = () => {
  if (Platform.OS === 'web') {
    // Only define WebMediaCompressor on web platform
    class WebMediaCompressor {
      private canvas: HTMLCanvasElement;
      private ctx: CanvasRenderingContext2D;
      private audioContext: AudioContext | null = null;

      constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
      }

      async compressMedia(
        blob: Blob,
        options: CompressionOptions = {},
        onProgress?: (progress: CompressionProgress) => void
      ): Promise<CompressionResult> {
        // Web implementation with full compression capabilities
        throw new Error('Web compression not implemented yet');
      }

      dispose() {
        if (this.audioContext && this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
      }
    }
    return new WebMediaCompressor();
  } else {
    return new MobileMediaCompressor();
  }
};

// Type guard for compression results
export const isWebResult = (result: CompressionResult): result is CompressionResult & { compressedBlob: Blob } => {
  return 'compressedBlob' in result && result.compressedBlob !== undefined;
};

export const isMobileResult = (result: CompressionResult): result is CompressionResult & { compressedUri: string } => {
  return 'compressedUri' in result && result.compressedUri !== undefined;
};

// Default export for convenience
export default createMediaCompressor;
