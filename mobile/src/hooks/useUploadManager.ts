/**
 * Upload Manager Hook
 * Manages upload state, retry logic, and error handling
 */

import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
  cancelUpload,
  setUploadState,
} from '../store/slices/challengeCreationSlice';
import { videoUploadService, UploadProgress, UploadResult } from '../services/uploadService';

interface UseUploadManagerOptions {
  maxRetries?: number;
  autoRetryDelay?: number;
  compressionQuality?: number;
  maxFileSize?: number;
}

interface UploadManagerState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  retryCount: number;
  canRetry: boolean;
  canCancel: boolean;
}

export const useUploadManager = (
  statementIndex: number,
  options: UseUploadManagerOptions = {}
) => {
  const {
    maxRetries = 3,
    autoRetryDelay = 2000,
    compressionQuality = 0.8,
    maxFileSize = 50 * 1024 * 1024, // 50MB
  } = options;

  const dispatch = useAppDispatch();
  const uploadState = useAppSelector(
    (state) => state.challengeCreation.uploadState[statementIndex]
  );

  const [retryCount, setRetryCount] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const autoRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const state: UploadManagerState = {
    isUploading: uploadState?.isUploading || false,
    progress: uploadState?.uploadProgress || 0,
    error: uploadState?.uploadError || null,
    retryCount,
    canRetry: retryCount < maxRetries && !!uploadState?.uploadError,
    canCancel: uploadState?.isUploading || !!uploadState?.uploadError,
  };

  const startUploadProcess = useCallback(async (
    videoUri: string,
    filename: string,
    duration: number
  ): Promise<UploadResult> => {
    try {
      const sessionId = `session_${Date.now()}_${statementIndex}`;
      const startTime = Date.now();
      
      setUploadStartTime(startTime);
      setRetryCount(prev => prev + 1);
      
      // Clear any existing auto-retry timeout
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
        autoRetryTimeoutRef.current = null;
      }
      
      // Initialize upload state
      dispatch(startUpload({ statementIndex, sessionId }));

      // Start the actual upload
      const result = await videoUploadService.uploadVideo(
        videoUri,
        filename,
        duration,
        {
          compress: true,
          compressionQuality,
          maxFileSize,
          chunkSize: 1024 * 1024, // 1MB chunks
          retryAttempts: 2, // Internal retries per chunk
          timeout: 300000, // 5 minutes
        },
        (progress: UploadProgress) => {
          // Update Redux state with progress
          dispatch(updateUploadProgress({
            statementIndex,
            progress: progress.progress,
          }));

          // Update upload state with additional progress info
          dispatch(setUploadState({
            statementIndex,
            uploadState: {
              bytesUploaded: progress.bytesUploaded,
              totalBytes: progress.totalBytes,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
              startTime: progress.startTime || startTime,
            },
          }));
        }
      );

      if (result.success) {
        // Upload completed successfully
        dispatch(completeUpload({
          statementIndex,
          fileUrl: result.streamingUrl || result.mediaId || videoUri,
          mediaCapture: {
            type: 'video',
            url: result.streamingUrl || videoUri,
            streamingUrl: result.streamingUrl,
            cloudStorageKey: result.cloudStorageKey,
            storageType: result.storageType || 'cloud',
            duration,
            fileSize: result.fileSize,
            compressionRatio: result.compressionRatio,
            uploadTime: result.uploadTime,
            mimeType: 'video/mp4',
            isUploaded: true,
          },
        }));

        // Reset retry count on success
        setRetryCount(0);
        return result;
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      
      const errorMessage = getErrorMessage(error);
      dispatch(setUploadError({ statementIndex, error: errorMessage }));
      
      // Auto-retry for certain types of errors
      if (shouldAutoRetry(error) && retryCount < maxRetries) {
        console.log(`Auto-retrying upload in ${autoRetryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        autoRetryTimeoutRef.current = setTimeout(() => {
          startUploadProcess(videoUri, filename, duration);
        }, autoRetryDelay);
      }
      
      throw error;
    }
  }, [
    statementIndex,
    dispatch,
    retryCount,
    maxRetries,
    autoRetryDelay,
    compressionQuality,
    maxFileSize,
  ]);

  const retryUpload = useCallback((
    videoUri: string,
    filename: string,
    duration: number
  ) => {
    if (retryCount >= maxRetries) {
      Alert.alert(
        'Maximum Retries Reached',
        'The upload has failed multiple times. Please check your connection and try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    return startUploadProcess(videoUri, filename, duration);
  }, [retryCount, maxRetries, startUploadProcess]);

  const cancelUploadProcess = useCallback(() => {
    // Clear auto-retry timeout
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }

    // Cancel the upload
    dispatch(cancelUpload({ statementIndex }));
    videoUploadService.cancelUpload(`upload_${statementIndex}`);
    
    // Reset state
    setRetryCount(0);
    setUploadStartTime(null);
  }, [dispatch, statementIndex]);

  const resetUpload = useCallback(() => {
    cancelUploadProcess();
    setRetryCount(0);
  }, [cancelUploadProcess]);

  const getErrorMessage = (error: any): string => {
    const message = error.message || error.toString();
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (message.includes('timeout')) {
      return 'Upload timed out. Please try again with a better connection.';
    }
    if (message.includes('storage') || message.includes('space')) {
      return 'Insufficient storage space. Please free up some space and try again.';
    }
    if (message.includes('permission')) {
      return 'Permission denied. Please check your app permissions.';
    }
    if (message.includes('file') && message.includes('not found')) {
      return 'Video file not found. Please record again.';
    }
    if (message.includes('size') || message.includes('large')) {
      return 'File is too large. Please try recording a shorter video.';
    }
    
    return `Upload failed: ${message}`;
  };

  const shouldAutoRetry = (error: any): boolean => {
    const message = error.message || error.toString();
    
    // Auto-retry for network-related errors
    if (message.includes('network') || message.includes('connection')) {
      return true;
    }
    if (message.includes('timeout')) {
      return true;
    }
    if (message.includes('server') || message.includes('503') || message.includes('502')) {
      return true;
    }
    
    // Don't auto-retry for client errors
    if (message.includes('permission') || message.includes('file not found')) {
      return false;
    }
    if (message.includes('storage') || message.includes('space')) {
      return false;
    }
    
    return false;
  };

  return {
    state,
    startUpload: startUploadProcess,
    retryUpload,
    cancelUpload: cancelUploadProcess,
    resetUpload,
    uploadStartTime,
  };
};

export default useUploadManager;