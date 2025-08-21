/**
 * File Upload Hook
 * Provides easy integration between file uploads and progress tracking
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChunkedUploadService, UploadProgress, UploadResult, UploadOptions } from '../services/uploadService';

import { UploadError, UploadErrorType } from '../services/uploadService';

export interface UseFileUploadOptions extends Omit<UploadOptions, 'onProgress' | 'signal' | 'onRetry' | 'onNetworkError'> {
  autoStart?: boolean;
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: UploadError) => void;
  onUploadCancel?: () => void;
  onNetworkError?: (error: UploadError) => void;
  onRetryAttempt?: (attempt: number, error: UploadError, chunkNumber?: number) => void;
}

export interface FileUploadState {
  isUploading: boolean;
  progress: UploadProgress | null;
  result: UploadResult | null;
  error: UploadError | null;
  sessionId: string | null;
  retryCount: number;
  isRetrying: boolean;
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const {
    autoStart = false,
    onUploadComplete,
    onUploadError,
    onUploadCancel,
    onNetworkError,
    onRetryAttempt,
    ...uploadOptions
  } = options;

  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
    sessionId: null,
    retryCount: 0,
    isRetrying: false,
  });

  const uploadServiceRef = useRef<ChunkedUploadService>(new ChunkedUploadService());
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileRef = useRef<File | null>(null);

  // Start upload
  const startUpload = useCallback(async (file: File) => {
    // Cancel any existing upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    fileRef.current = file;

    // Reset state
    setState({
      isUploading: true,
      progress: null,
      result: null,
      error: null,
      sessionId: null,
      retryCount: 0,
      isRetrying: false,
    });

    try {
      const result = await uploadServiceRef.current.uploadFile(file, {
        ...uploadOptions,
        signal: abortControllerRef.current.signal,
        onProgress: (progress) => {
          setState(prev => ({
            ...prev,
            progress,
            sessionId: progress.sessionId,
            retryCount: progress.retryCount || 0,
            isRetrying: progress.status === 'retrying',
          }));
        },
        onChunkComplete: (chunkNumber, totalChunks) => {
          // Could add additional chunk-level callbacks here
        },
        onRetry: (attempt, error, chunkNumber) => {
          setState(prev => ({
            ...prev,
            isRetrying: true,
            retryCount: prev.retryCount + 1,
          }));
          
          if (onRetryAttempt) {
            const uploadError = error instanceof UploadError ? error : new UploadError(
              (error as Error).message || 'Upload failed',
              UploadErrorType.UNKNOWN_ERROR,
              { cause: error as Error }
            );
            onRetryAttempt(attempt, uploadError, chunkNumber);
          }
        },
        onNetworkError: (error) => {
          if (onNetworkError) {
            const uploadError = error instanceof UploadError ? error : new UploadError(
              (error as Error).message || 'Network error',
              UploadErrorType.NETWORK_ERROR,
              { cause: error as Error }
            );
            onNetworkError(uploadError);
          }
        },
      });

      setState(prev => ({
        ...prev,
        isUploading: false,
        isRetrying: false,
        result,
      }));

      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (error: unknown) {
      const uploadError = error instanceof UploadError ? error : new UploadError(
        (error as Error).message || 'Upload failed',
        UploadErrorType.UNKNOWN_ERROR,
        { cause: error as Error }
      );
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        isRetrying: false,
        error: uploadError,
      }));

      if (uploadError.type !== UploadErrorType.CANCELLED && onUploadError) {
        onUploadError(uploadError);
      }
    }
  }, [uploadOptions, onUploadComplete, onUploadError]);

  // Cancel upload
  const cancelUpload = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (state.sessionId) {
      try {
        await uploadServiceRef.current.cancelUpload(state.sessionId);
      } catch (error) {
        console.warn('Failed to cancel upload on server:', error);
      }
    }

    setState(prev => ({
      ...prev,
      isUploading: false,
      isRetrying: false,
      progress: prev.progress ? { ...prev.progress, status: 'cancelled' } : null,
    }));

    if (onUploadCancel) {
      onUploadCancel();
    }
  }, [state.sessionId, onUploadCancel]);

  // Retry upload
  const retryUpload = useCallback(() => {
    if (fileRef.current) {
      startUpload(fileRef.current);
    }
  }, [startUpload]);

  // Reset state
  const resetUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      isUploading: false,
      progress: null,
      result: null,
      error: null,
      sessionId: null,
      retryCount: 0,
      isRetrying: false,
    });

    fileRef.current = null;
  }, []);

  // Resume upload (if supported)
  const resumeUpload = useCallback(async () => {
    if (!fileRef.current || !state.sessionId) {
      throw new Error('No file or session to resume');
    }

    try {
      const result = await uploadServiceRef.current.resumeUpload(
        state.sessionId,
        fileRef.current,
        {
          ...uploadOptions,
          signal: abortControllerRef.current?.signal,
          onProgress: (progress) => {
            setState(prev => ({
              ...prev,
              progress,
            }));
          },
        }
      );

      setState(prev => ({
        ...prev,
        isUploading: false,
        result,
      }));

      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (error: unknown) {
      const uploadError = error instanceof UploadError ? error : new UploadError(
        (error as Error).message || 'Resume failed',
        UploadErrorType.UNKNOWN_ERROR,
        { cause: error as Error }
      );
      
      setState(prev => ({
        ...prev,
        isUploading: false,
        isRetrying: false,
        error: uploadError,
      }));

      if (onUploadError) {
        onUploadError(uploadError);
      }
    }
  }, [state.sessionId, uploadOptions, onUploadComplete, onUploadError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    startUpload,
    cancelUpload,
    retryUpload,
    resetUpload,
    resumeUpload,
    
    // Computed values
    canRetry: !state.isUploading && state.error !== null,
    canResume: !state.isUploading && state.sessionId !== null && state.progress?.status === 'failed',
    canCancel: state.isUploading,
    
    // Progress helpers
    progressPercent: state.progress?.progress || 0,
    uploadSpeed: state.progress?.uploadSpeed || 0,
    estimatedTimeRemaining: state.progress?.estimatedTimeRemaining || 0,
    uploadedBytes: state.progress?.uploadedBytes || 0,
    totalBytes: state.progress?.totalBytes || 0,
  };
};

export default useFileUpload;