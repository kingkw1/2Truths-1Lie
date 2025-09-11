/**
 * Enhanced Upload Service - SIMPLIFIED VERSION
 * Temporarily disabled FormData usage to fix launch issues
 */

import * as FileSystem from 'expo-file-system/legacy';
import { MediaCapture, VideoSegment } from '../types';

export interface EnhancedUploadOptions {
  compressionBeforeUpload?: boolean;
  uploadTimeout?: number;
  retryAttempts?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export interface UploadProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'completed';
  progress: number; // 0-100
  uploadSpeed?: number;
  estimatedTimeRemaining?: number;
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
 * Enhanced Upload Service Class - TEMPORARILY SIMPLIFIED
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
    
    // Simulate some progress for UI consistency
    options.onProgress?.({ stage: 'preparing', progress: 10 });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    options.onProgress?.({ stage: 'uploading', progress: 50 });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    options.onProgress?.({ stage: 'completed', progress: 100 });
    
    // Return a mock result for now
    return {
      success: false,
      error: 'Upload temporarily disabled - working on FormData compatibility issues. App functionality otherwise preserved.'
    };
  }
}

// Export singleton instance
export const enhancedUploadService = EnhancedUploadService.getInstance();
