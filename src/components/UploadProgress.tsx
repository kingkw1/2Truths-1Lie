/**
 * Upload Progress Component
 * Shows real-time upload progress with cancel functionality
 * Integrates with chunked upload backend API
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface UploadProgressProps {
  sessionId: string;
  filename: string;
  fileSize: number;
  onUploadComplete?: (fileUrl: string) => void;
  onUploadError?: (error: string) => void;
  onUploadCancel?: () => void;
  autoStart?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export interface UploadState {
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  uploadedChunks: number[];
  remainingChunks: number[];
  uploadSpeed: number; // bytes per second
  estimatedTimeRemaining: number; // seconds
  error: string | null;
  fileUrl: string | null;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  sessionId,
  filename,
  fileSize,
  onUploadComplete,
  onUploadError,
  onUploadCancel,
  autoStart = true,
  showDetails = true,
  compact = false,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'pending',
    progress: 0,
    uploadedChunks: [],
    remainingChunks: [],
    uploadSpeed: 0,
    estimatedTimeRemaining: 0,
    error: null,
    fileUrl: null,
  });

  const [isVisible, setIsVisible] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const uploadedBytesRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  // Format time duration
  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }, []);

  // Calculate upload speed and ETA
  const updateSpeedAndETA = useCallback((uploadedBytes: number) => {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - startTimeRef.current) / 1000; // seconds
    
    if (elapsedTime > 0) {
      const speed = uploadedBytes / elapsedTime;
      const remainingBytes = fileSize - uploadedBytes;
      const eta = remainingBytes / speed;
      
      setUploadState(prev => ({
        ...prev,
        uploadSpeed: speed,
        estimatedTimeRemaining: eta,
      }));
    }
  }, [fileSize]);

  // Poll upload status
  const pollUploadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/upload/${sessionId}/status`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const statusData = await response.json();
      
      const totalChunks = statusData.uploaded_chunks.length + statusData.remaining_chunks.length;
      const uploadedBytes = totalChunks > 0 ? (statusData.uploaded_chunks.length / totalChunks) * fileSize : 0;
      uploadedBytesRef.current = uploadedBytes;
      
      setUploadState(prev => ({
        ...prev,
        status: statusData.status === 'completed' ? 'completed' : 
               statusData.status === 'failed' ? 'failed' :
               statusData.status === 'cancelled' ? 'cancelled' : 'uploading',
        progress: statusData.progress_percent,
        uploadedChunks: statusData.uploaded_chunks,
        remainingChunks: statusData.remaining_chunks,
      }));

      // Update speed and ETA
      updateSpeedAndETA(uploadedBytes);

      // Handle completion
      if (statusData.status === 'completed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        // Get file URL
        const fileUrl = `/api/v1/files/${sessionId}_${filename}`;
        setUploadState(prev => ({ ...prev, fileUrl }));
        
        if (onUploadComplete) {
          onUploadComplete(fileUrl);
        }
      } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        
        if (statusData.status === 'failed' && onUploadError) {
          onUploadError(statusData.error_message || 'Upload failed');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Status polling error:', error);
        setUploadState(prev => ({
          ...prev,
          error: error.message,
        }));
      }
    }
  }, [sessionId, filename, fileSize, onUploadComplete, onUploadError, updateSpeedAndETA]);

  // Start upload monitoring
  const startMonitoring = useCallback(() => {
    if (uploadState.status === 'pending') {
      startTimeRef.current = Date.now();
      uploadedBytesRef.current = 0;
      
      setUploadState(prev => ({ ...prev, status: 'uploading' }));
      
      // Start polling
      pollUploadStatus(); // Initial poll
      pollIntervalRef.current = setInterval(pollUploadStatus, 1000); // Poll every second
    }
  }, [uploadState.status, pollUploadStatus]);

  // Cancel upload
  const cancelUpload = useCallback(async () => {
    try {
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Stop polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      // Call backend cancel endpoint
      const response = await fetch(`/api/v1/upload/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to cancel upload on server:', response.statusText);
      }

      setUploadState(prev => ({
        ...prev,
        status: 'cancelled',
        error: null,
      }));

      if (onUploadCancel) {
        onUploadCancel();
      }
    } catch (error) {
      console.error('Cancel upload error:', error);
      // Still mark as cancelled locally
      setUploadState(prev => ({
        ...prev,
        status: 'cancelled',
      }));
      
      if (onUploadCancel) {
        onUploadCancel();
      }
    }
  }, [sessionId, onUploadCancel]);

  // Retry upload
  const retryUpload = useCallback(() => {
    setUploadState(prev => ({
      ...prev,
      status: 'pending',
      error: null,
      progress: 0,
    }));
    
    // Restart monitoring
    setTimeout(startMonitoring, 100);
  }, [startMonitoring]);

  // Dismiss component
  const dismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Auto-start monitoring
  useEffect(() => {
    if (autoStart && uploadState.status === 'pending') {
      startMonitoring();
    }
  }, [autoStart, uploadState.status, startMonitoring]);

  // Setup abort controller
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  const { status, progress, uploadSpeed, estimatedTimeRemaining, error } = uploadState;
  const uploadedSize = (progress / 100) * fileSize;

  return (
    <div style={compact ? styles.containerCompact : styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.fileInfo}>
          <span style={styles.filename}>{filename}</span>
          <span style={styles.fileSize}>({formatFileSize(fileSize)})</span>
        </div>
        
        <div style={styles.headerActions}>
          {status === 'uploading' && (
            <button
              onClick={cancelUpload}
              style={styles.cancelButton}
              title="Cancel upload"
            >
              ✕
            </button>
          )}
          
          {(status === 'completed' || status === 'cancelled') && (
            <button
              onClick={dismiss}
              style={styles.dismissButton}
              title="Dismiss"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div 
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
              backgroundColor: 
                status === 'completed' ? '#10B981' :
                status === 'failed' ? '#EF4444' :
                status === 'cancelled' ? '#6B7280' : '#3B82F6'
            }}
          />
        </div>
        
        <div style={styles.progressText}>
          <span>{Math.round(progress)}%</span>
          {status === 'uploading' && showDetails && (
            <span style={styles.progressDetails}>
              {formatFileSize(uploadedSize)} / {formatFileSize(fileSize)}
            </span>
          )}
        </div>
      </div>

      {/* Status and Details */}
      <div style={styles.statusContainer}>
        <div style={styles.statusText}>
          {status === 'pending' && (
            <span style={styles.statusPending}>Preparing upload...</span>
          )}
          {status === 'uploading' && (
            <span style={styles.statusUploading}>
              Uploading... 
              {showDetails && uploadSpeed > 0 && (
                <span style={styles.speedInfo}>
                  {formatFileSize(uploadSpeed)}/s
                  {estimatedTimeRemaining > 0 && estimatedTimeRemaining < 3600 && (
                    <span> • {formatTime(estimatedTimeRemaining)} remaining</span>
                  )}
                </span>
              )}
            </span>
          )}
          {status === 'completed' && (
            <span style={styles.statusCompleted}>✓ Upload completed</span>
          )}
          {status === 'failed' && (
            <span style={styles.statusFailed}>✗ Upload failed</span>
          )}
          {status === 'cancelled' && (
            <span style={styles.statusCancelled}>Upload cancelled</span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={styles.actions}>
          {status === 'failed' && (
            <button onClick={retryUpload} style={styles.retryButton}>
              Retry Upload
            </button>
          )}
          
          {status === 'pending' && !autoStart && (
            <button onClick={startMonitoring} style={styles.startButton}>
              Start Upload
            </button>
          )}
        </div>
      </div>

      {/* Detailed Progress (non-compact mode) */}
      {!compact && showDetails && status === 'uploading' && (
        <div style={styles.detailsContainer}>
          <div style={styles.chunkInfo}>
            <span>Chunks: {uploadState.uploadedChunks.length} / {uploadState.uploadedChunks.length + uploadState.remainingChunks.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#FFFFFF',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  containerCompact: {
    padding: '12px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    marginBottom: '8px',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,

  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  filename: {
    fontWeight: 'bold',
    color: '#1F2937',
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  fileSize: {
    color: '#6B7280',
    fontSize: '12px',
    flexShrink: 0,
  } as React.CSSProperties,

  headerActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  cancelButton: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  dismissButton: {
    width: '24px',
    height: '24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#6B7280',
    color: '#FFFFFF',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  progressContainer: {
    marginBottom: '12px',
  } as React.CSSProperties,

  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#E5E7EB',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  } as React.CSSProperties,

  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6B7280',
  } as React.CSSProperties,

  progressDetails: {
    fontSize: '11px',
  } as React.CSSProperties,

  statusContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  } as React.CSSProperties,

  statusText: {
    fontSize: '13px',
    fontWeight: 'medium',
  } as React.CSSProperties,

  statusPending: {
    color: '#F59E0B',
  } as React.CSSProperties,

  statusUploading: {
    color: '#3B82F6',
  } as React.CSSProperties,

  statusCompleted: {
    color: '#10B981',
  } as React.CSSProperties,

  statusFailed: {
    color: '#EF4444',
  } as React.CSSProperties,

  statusCancelled: {
    color: '#6B7280',
  } as React.CSSProperties,

  speedInfo: {
    fontSize: '11px',
    color: '#6B7280',
    marginLeft: '8px',
  } as React.CSSProperties,

  errorMessage: {
    padding: '8px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '4px',
    color: '#DC2626',
    fontSize: '12px',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  retryButton: {
    padding: '6px 12px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'medium',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  startButton: {
    padding: '6px 12px',
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'medium',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  detailsContainer: {
    marginTop: '12px',
    padding: '8px',
    backgroundColor: '#F9FAFB',
    borderRadius: '4px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  chunkInfo: {
    fontSize: '11px',
    color: '#6B7280',
  } as React.CSSProperties,
};

export default UploadProgress;