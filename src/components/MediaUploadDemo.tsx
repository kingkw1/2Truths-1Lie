/**
 * Media Upload Demo Component
 * Demonstrates integration of MediaRecorder with UploadProgress
 * Shows complete workflow from recording to upload with progress tracking
 */

import React, { useState, useCallback } from 'react';
import { MediaRecorder } from './MediaRecorder';
import { UploadProgress } from './UploadProgress';
import { MediaCapture } from '../types/challenge';
import { useFileUpload } from '../hooks/useFileUpload';

interface MediaUploadDemoProps {
  onUploadComplete?: (fileUrl: string, mediaData: MediaCapture) => void;
  onUploadError?: (error: string) => void;
  maxDuration?: number;
  enableCompression?: boolean;
}

interface UploadItem {
  id: string;
  sessionId: string;
  filename: string;
  fileSize: number;
  mediaData: MediaCapture;
}

export const MediaUploadDemo: React.FC<MediaUploadDemoProps> = ({
  onUploadComplete,
  onUploadError,
  maxDuration = 30000,
  enableCompression = true,
}) => {
  const [recordedMedia, setRecordedMedia] = useState<MediaCapture | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [completedUploads, setCompletedUploads] = useState<{
    fileUrl: string;
    mediaData: MediaCapture;
  }[]>([]);

  // File upload hook for handling uploads
  const {
    startUpload,
    cancelUpload,
    retryUpload,
    resetUpload,
    isUploading,
    progress,
    result,
    error,
    sessionId,
  } = useFileUpload({
    chunkSize: 1024 * 1024, // 1MB chunks
    maxRetries: 3,
    onUploadComplete: (uploadResult) => {
      if (recordedMedia) {
        const completedUpload = {
          fileUrl: uploadResult.fileUrl,
          mediaData: recordedMedia,
        };
        
        setCompletedUploads(prev => [...prev, completedUpload]);
        
        if (onUploadComplete) {
          onUploadComplete(uploadResult.fileUrl, recordedMedia);
        }
        
        // Remove from upload queue
        setUploadQueue(prev => prev.filter(item => item.sessionId !== uploadResult.sessionId));
      }
    },
    onUploadError: (uploadError) => {
      if (onUploadError) {
        onUploadError(uploadError.message);
      }
    },
    onUploadCancel: () => {
      // Remove from upload queue when cancelled
      if (sessionId) {
        setUploadQueue(prev => prev.filter(item => item.sessionId !== sessionId));
      }
    },
  });

  // Convert MediaCapture to File for upload
  const mediaToFile = useCallback(async (mediaData: MediaCapture): Promise<File> => {
    if (mediaData.type === 'text' && mediaData.url) {
      // Convert text to file
      const textBlob = new Blob([atob(mediaData.url.split(',')[1])], { type: 'text/plain' });
      return new File([textBlob], `statement_${Date.now()}.txt`, { type: 'text/plain' });
    } else if (mediaData.url) {
      // Convert blob URL to file
      const response = await fetch(mediaData.url);
      const blob = await response.blob();
      
      const extension = mediaData.type === 'video' ? 'webm' : 
                       mediaData.type === 'audio' ? 'webm' : 'bin';
      
      return new File([blob], `recording_${Date.now()}.${extension}`, { 
        type: mediaData.mimeType || blob.type 
      });
    } else {
      // Fallback for missing URL
      throw new Error('Media URL is missing');
    }
  }, []);

  // Handle recording completion
  const handleRecordingComplete = useCallback(async (mediaData: MediaCapture) => {
    setRecordedMedia(mediaData);
    
    try {
      // Convert media to file
      const file = await mediaToFile(mediaData);
      
      // Start upload
      await startUpload(file);
      
      // Add to upload queue for tracking
      if (sessionId) {
        const uploadItem: UploadItem = {
          id: `upload_${Date.now()}`,
          sessionId,
          filename: file.name,
          fileSize: file.size,
          mediaData,
        };
        
        setUploadQueue(prev => [...prev, uploadItem]);
      }
    } catch (error) {
      console.error('Failed to start upload:', error);
      if (onUploadError) {
        onUploadError(error instanceof Error ? error.message : 'Failed to start upload');
      }
    }
  }, [mediaToFile, startUpload, sessionId, onUploadError]);

  // Handle recording error
  const handleRecordingError = useCallback((error: string) => {
    console.error('Recording error:', error);
    if (onUploadError) {
      onUploadError(`Recording failed: ${error}`);
    }
  }, [onUploadError]);

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setCompletedUploads([]);
  }, []);

  // Reset everything
  const resetAll = useCallback(() => {
    setRecordedMedia(null);
    setUploadQueue([]);
    setCompletedUploads([]);
    resetUpload();
  }, [resetUpload]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Media Recording & Upload Demo</h2>
        <p style={styles.subtitle}>
          Record your statement and watch it upload with real-time progress tracking
        </p>
      </div>

      {/* Media Recorder */}
      <div style={styles.section}>
        <MediaRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingError={handleRecordingError}
          maxDuration={maxDuration}
          enableCompression={enableCompression}
          disabled={isUploading}
        />
      </div>

      {/* Upload Progress */}
      {progress && sessionId && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Upload Progress</h3>
          <UploadProgress
            sessionId={sessionId}
            filename={uploadQueue.find(item => item.sessionId === sessionId)?.filename || 'recording'}
            fileSize={progress.totalBytes}
            onUploadComplete={(fileUrl) => {
              console.log('Upload completed:', fileUrl);
            }}
            onUploadError={(error) => {
              console.error('Upload error:', error);
            }}
            onUploadCancel={() => {
              console.log('Upload cancelled');
            }}
            showDetails={true}
            compact={false}
          />
        </div>
      )}

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Upload Queue</h3>
          <div style={styles.uploadList}>
            {uploadQueue.map((item) => (
              <div key={item.id} style={styles.uploadItem}>
                <div style={styles.uploadItemInfo}>
                  <span style={styles.uploadItemName}>{item.filename}</span>
                  <span style={styles.uploadItemSize}>
                    {formatFileSize(item.fileSize)} • {item.mediaData.type}
                  </span>
                </div>
                <div style={styles.uploadItemActions}>
                  {item.sessionId === sessionId && isUploading && (
                    <button onClick={cancelUpload} style={styles.cancelButton}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Uploads */}
      {completedUploads.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Completed Uploads</h3>
            <button onClick={clearCompleted} style={styles.clearButton}>
              Clear All
            </button>
          </div>
          
          <div style={styles.completedList}>
            {completedUploads.map((upload, index) => (
              <div key={index} style={styles.completedItem}>
                <div style={styles.completedItemInfo}>
                  <span style={styles.completedItemType}>
                    {upload.mediaData.type === 'video' ? '🎥' : 
                     upload.mediaData.type === 'audio' ? '🎤' : '📝'}
                  </span>
                  <div style={styles.completedItemDetails}>
                    <div style={styles.completedItemName}>
                      {upload.mediaData.type} recording
                    </div>
                    <div style={styles.completedItemMeta}>
                      Size: {formatFileSize(upload.mediaData.fileSize || 0)} • 
                      Duration: {formatDuration(upload.mediaData.duration || 0)}
                      {upload.mediaData.compressionRatio && (
                        <span> • Compressed {Math.round((1 - 1/upload.mediaData.compressionRatio) * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div style={styles.completedItemActions}>
                  <a 
                    href={upload.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={styles.viewButton}
                  >
                    View File
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.errorHeader}>
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorTitle}>Upload Error</span>
          </div>
          <div style={styles.errorMessage}>{error.message}</div>
          <div style={styles.errorActions}>
            <button onClick={retryUpload} style={styles.retryButton}>
              Retry Upload
            </button>
            <button onClick={resetUpload} style={styles.dismissButton}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        <button onClick={resetAll} style={styles.resetButton}>
          Reset All
        </button>
      </div>
    </div>
  );
};

// Helper functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  } as React.CSSProperties,

  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  } as React.CSSProperties,

  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '8px',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    lineHeight: '1.5',
  } as React.CSSProperties,

  section: {
    marginBottom: '32px',
  } as React.CSSProperties,

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '16px',
  } as React.CSSProperties,

  uploadList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  } as React.CSSProperties,

  uploadItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
  } as React.CSSProperties,

  uploadItemInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,

  uploadItemName: {
    fontSize: '14px',
    fontWeight: 'medium',
    color: '#1F2937',
  } as React.CSSProperties,

  uploadItemSize: {
    fontSize: '12px',
    color: '#6B7280',
  } as React.CSSProperties,

  uploadItemActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  completedList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  } as React.CSSProperties,

  completedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: '#F0FDF4',
    border: '1px solid #BBF7D0',
    borderRadius: '8px',
  } as React.CSSProperties,

  completedItemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as React.CSSProperties,

  completedItemType: {
    fontSize: '24px',
  } as React.CSSProperties,

  completedItemDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,

  completedItemName: {
    fontSize: '14px',
    fontWeight: 'medium',
    color: '#1F2937',
  } as React.CSSProperties,

  completedItemMeta: {
    fontSize: '12px',
    color: '#6B7280',
  } as React.CSSProperties,

  completedItemActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  errorContainer: {
    padding: '16px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    marginBottom: '16px',
  } as React.CSSProperties,

  errorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  } as React.CSSProperties,

  errorIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  errorTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#DC2626',
  } as React.CSSProperties,

  errorMessage: {
    fontSize: '14px',
    color: '#DC2626',
    marginBottom: '12px',
  } as React.CSSProperties,

  errorActions: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    paddingTop: '20px',
    borderTop: '1px solid #E5E7EB',
  } as React.CSSProperties,

  // Buttons
  cancelButton: {
    padding: '6px 12px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  } as React.CSSProperties,

  clearButton: {
    padding: '6px 12px',
    backgroundColor: '#6B7280',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  } as React.CSSProperties,

  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    textDecoration: 'none',
  } as React.CSSProperties,

  retryButton: {
    padding: '6px 12px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  } as React.CSSProperties,

  dismissButton: {
    padding: '6px 12px',
    backgroundColor: '#6B7280',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  } as React.CSSProperties,

  resetButton: {
    padding: '8px 16px',
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'medium',
  } as React.CSSProperties,
};

export default MediaUploadDemo;