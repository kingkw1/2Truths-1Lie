/**
 * Demo component showcasing the enhanced MediaRecorder with full controls
 * Demonstrates start, pause, resume, and cancel functionality
 */

import React, { useState } from 'react';
import MediaRecorder from './MediaRecorder';
import { MediaCapture, MediaType } from '../types/challenge';

interface RecordingResult {
  media: MediaCapture;
  timestamp: Date;
}

export const EnhancedMediaRecorderDemo: React.FC = () => {
  const [recordings, setRecordings] = useState<RecordingResult[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isRecorderDisabled, setIsRecorderDisabled] = useState(false);

  const handleRecordingComplete = (mediaData: MediaCapture) => {
    const result: RecordingResult = {
      media: mediaData,
      timestamp: new Date(),
    };
    
    setRecordings(prev => [...prev, result]);
    setLastError(null);
    
    console.log('Recording completed:', mediaData);
  };

  const handleRecordingError = (error: string) => {
    setLastError(error);
    console.error('Recording error:', error);
  };

  const clearRecordings = () => {
    setRecordings([]);
    setLastError(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Enhanced Media Recorder Demo</h2>
        <p style={styles.subtitle}>
          Test the full recording controls: start, pause, resume, and cancel functionality
        </p>
      </div>

      <div style={styles.controls}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={isRecorderDisabled}
            onChange={(e) => setIsRecorderDisabled(e.target.checked)}
            style={styles.checkbox}
          />
          Disable recorder (test disabled state)
        </label>
        
        <button onClick={clearRecordings} style={styles.clearButton}>
          Clear All Recordings
        </button>
      </div>

      <div style={styles.recorderContainer}>
        <MediaRecorder
          onRecordingComplete={handleRecordingComplete}
          onRecordingError={handleRecordingError}
          maxDuration={60000} // 1 minute
          allowedTypes={['video', 'audio', 'text'] as MediaType[]}
          disabled={isRecorderDisabled}
        />
      </div>

      {lastError && (
        <div style={styles.errorContainer}>
          <h4 style={styles.errorTitle}>Last Error:</h4>
          <p style={styles.errorMessage}>{lastError}</p>
        </div>
      )}

      <div style={styles.resultsContainer}>
        <h3 style={styles.resultsTitle}>
          Recorded Media ({recordings.length})
        </h3>
        
        {recordings.length === 0 ? (
          <p style={styles.noRecordings}>
            No recordings yet. Try recording something above!
          </p>
        ) : (
          <div style={styles.recordingsList}>
            {recordings.map((result, index) => (
              <div key={index} style={styles.recordingItem}>
                <div style={styles.recordingHeader}>
                  <span style={styles.recordingType}>
                    {result.media.type.toUpperCase()}
                  </span>
                  <span style={styles.recordingTime}>
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                <div style={styles.recordingDetails}>
                  <div style={styles.recordingMeta}>
                    <span>Duration: {formatDuration(result.media.duration || 0)}</span>
                    <span>Size: {formatFileSize(result.media.fileSize || 0)}</span>
                    <span>Format: {result.media.mimeType}</span>
                  </div>
                  
                  {result.media.type === 'text' && result.media.url && (
                    <div style={styles.textPreview}>
                      <strong>Content:</strong>
                      <p style={styles.textContent}>
                        {atob(result.media.url.split(',')[1])}
                      </p>
                    </div>
                  )}
                  
                  {(result.media.type === 'video' || result.media.type === 'audio') && result.media.url && (
                    <div style={styles.mediaPreview}>
                      {result.media.type === 'video' ? (
                        <video
                          src={result.media.url}
                          controls
                          style={styles.videoPreview}
                        />
                      ) : (
                        <audio
                          src={result.media.url}
                          controls
                          style={styles.audioPreview}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  } as React.CSSProperties,

  header: {
    textAlign: 'center' as const,
    marginBottom: '30px',
  } as React.CSSProperties,

  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '10px',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    lineHeight: '1.5',
  } as React.CSSProperties,

  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
  } as React.CSSProperties,

  checkbox: {
    width: '16px',
    height: '16px',
  } as React.CSSProperties,

  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  } as React.CSSProperties,

  recorderContainer: {
    marginBottom: '30px',
  } as React.CSSProperties,

  errorContainer: {
    padding: '15px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    marginBottom: '20px',
  } as React.CSSProperties,

  errorTitle: {
    color: '#DC2626',
    fontSize: '16px',
    marginBottom: '5px',
  } as React.CSSProperties,

  errorMessage: {
    color: '#DC2626',
    fontSize: '14px',
    margin: '0',
  } as React.CSSProperties,

  resultsContainer: {
    marginTop: '30px',
  } as React.CSSProperties,

  resultsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '15px',
  } as React.CSSProperties,

  noRecordings: {
    textAlign: 'center' as const,
    color: '#6B7280',
    fontSize: '16px',
    padding: '40px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  recordingsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  } as React.CSSProperties,

  recordingItem: {
    padding: '20px',
    backgroundColor: '#FFFFFF',
    border: '2px solid #E5E7EB',
    borderRadius: '12px',
  } as React.CSSProperties,

  recordingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  } as React.CSSProperties,

  recordingType: {
    padding: '4px 12px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  recordingTime: {
    fontSize: '14px',
    color: '#6B7280',
  } as React.CSSProperties,

  recordingDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,

  recordingMeta: {
    display: 'flex',
    gap: '20px',
    fontSize: '14px',
    color: '#374151',
  } as React.CSSProperties,

  textPreview: {
    padding: '15px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
  } as React.CSSProperties,

  textContent: {
    margin: '5px 0 0 0',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#1F2937',
  } as React.CSSProperties,

  mediaPreview: {
    textAlign: 'center' as const,
  } as React.CSSProperties,

  videoPreview: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '8px',
  } as React.CSSProperties,

  audioPreview: {
    width: '100%',
  } as React.CSSProperties,
};

export default EnhancedMediaRecorderDemo;