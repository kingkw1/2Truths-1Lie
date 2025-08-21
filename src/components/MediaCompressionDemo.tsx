/**
 * Demo component to test media compression functionality
 * Shows compression in action with real media files
 */

import React, { useState } from 'react';
import { MediaRecorder } from './MediaRecorder';
import { MediaCapture } from '../types/challenge';
import { MediaCompressor } from '../utils/mediaCompression';

export const MediaCompressionDemo: React.FC = () => {
  const [recordedMedia, setRecordedMedia] = useState<MediaCapture | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    processingTime: number;
  } | null>(null);

  const handleRecordingComplete = (mediaData: MediaCapture) => {
    setRecordedMedia(mediaData);
    
    if (mediaData.originalSize && mediaData.compressionRatio) {
      setCompressionStats({
        originalSize: mediaData.originalSize,
        compressedSize: mediaData.fileSize || 0,
        compressionRatio: mediaData.compressionRatio,
        processingTime: mediaData.compressionTime || 0,
      });
    }
  };

  const handleRecordingError = (error: string) => {
    console.error('Recording error:', error);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number): string => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Media Compression Demo</h2>
        <p style={styles.subtitle}>
          Record media to see client-side compression in action
        </p>
      </div>

      <MediaRecorder
        onRecordingComplete={handleRecordingComplete}
        onRecordingError={handleRecordingError}
        maxDuration={30000}
        allowedTypes={['video', 'audio', 'text']}
        enableCompression={true}
        compressionOptions={{
          quality: 0.8,
          maxWidth: 640,
          maxHeight: 480,
          videoBitrate: 1000,
          audioBitrate: 128,
        }}
      />

      {recordedMedia && (
        <div style={styles.results}>
          <h3 style={styles.resultsTitle}>Recording Results</h3>
          
          <div style={styles.mediaInfo}>
            <div style={styles.infoRow}>
              <span style={styles.label}>Type:</span>
              <span style={styles.value}>{recordedMedia.type}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>Duration:</span>
              <span style={styles.value}>
                {recordedMedia.duration ? formatTime(recordedMedia.duration) : 'N/A'}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>File Size:</span>
              <span style={styles.value}>
                {recordedMedia.fileSize ? formatFileSize(recordedMedia.fileSize) : 'N/A'}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.label}>MIME Type:</span>
              <span style={styles.value}>{recordedMedia.mimeType || 'N/A'}</span>
            </div>
          </div>

          {compressionStats && (
            <div style={styles.compressionStats}>
              <h4 style={styles.statsTitle}>Compression Statistics</h4>
              
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Original Size</div>
                  <div style={styles.statValue}>
                    {formatFileSize(compressionStats.originalSize)}
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Compressed Size</div>
                  <div style={styles.statValue}>
                    {formatFileSize(compressionStats.compressedSize)}
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Compression Ratio</div>
                  <div style={styles.statValue}>
                    {compressionStats.compressionRatio.toFixed(2)}x
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Processing Time</div>
                  <div style={styles.statValue}>
                    {formatTime(compressionStats.processingTime)}
                  </div>
                </div>
                
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Size Reduction</div>
                  <div style={styles.statValue}>
                    {Math.round((1 - 1/compressionStats.compressionRatio) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {recordedMedia.url && recordedMedia.type !== 'text' && (
            <div style={styles.preview}>
              <h4 style={styles.previewTitle}>Media Preview</h4>
              {recordedMedia.type === 'video' ? (
                <video 
                  src={recordedMedia.url} 
                  controls 
                  style={styles.videoPreview}
                />
              ) : (
                <audio 
                  src={recordedMedia.url} 
                  controls 
                  style={styles.audioPreview}
                />
              )}
            </div>
          )}

          {recordedMedia.type === 'text' && recordedMedia.url && (
            <div style={styles.textPreview}>
              <h4 style={styles.previewTitle}>Text Content</h4>
              <div style={styles.textContent}>
                {atob(recordedMedia.url.split(',')[1])}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={styles.info}>
        <h3 style={styles.infoTitle}>About Compression</h3>
        <ul style={styles.infoList}>
          <li>Video and audio files are automatically compressed before upload</li>
          <li>Compression reduces file size while maintaining acceptable quality</li>
          <li>Smaller files mean faster uploads and reduced bandwidth usage</li>
          <li>Text content doesn't require compression</li>
          <li>Compression happens entirely in your browser - no server processing needed</li>
        </ul>
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
    marginBottom: '8px',
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    lineHeight: '1.5',
  } as React.CSSProperties,

  results: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  resultsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '16px',
  } as React.CSSProperties,

  mediaInfo: {
    marginBottom: '20px',
  } as React.CSSProperties,

  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #E5E7EB',
  } as React.CSSProperties,

  label: {
    fontWeight: 'bold',
    color: '#374151',
  } as React.CSSProperties,

  value: {
    color: '#6B7280',
  } as React.CSSProperties,

  compressionStats: {
    marginBottom: '20px',
  } as React.CSSProperties,

  statsTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '12px',
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
  } as React.CSSProperties,

  statCard: {
    padding: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  statLabel: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '4px',
  } as React.CSSProperties,

  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1F2937',
  } as React.CSSProperties,

  preview: {
    marginBottom: '20px',
  } as React.CSSProperties,

  previewTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '12px',
  } as React.CSSProperties,

  videoPreview: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    borderRadius: '6px',
  } as React.CSSProperties,

  audioPreview: {
    width: '100%',
    maxWidth: '400px',
  } as React.CSSProperties,

  textPreview: {
    marginBottom: '20px',
  } as React.CSSProperties,

  textContent: {
    padding: '12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#374151',
    whiteSpace: 'pre-wrap' as const,
  } as React.CSSProperties,

  info: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#EBF8FF',
    borderRadius: '8px',
    border: '1px solid #BFDBFE',
  } as React.CSSProperties,

  infoTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: '12px',
  } as React.CSSProperties,

  infoList: {
    color: '#1E40AF',
    lineHeight: '1.6',
  } as React.CSSProperties,
};

export default MediaCompressionDemo;