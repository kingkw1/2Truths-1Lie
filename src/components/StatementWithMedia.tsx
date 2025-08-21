/**
 * Statement with Media Component
 * Combines text statement input with optional media recording
 * Implements fallback from video -> audio -> text only
 * Enhanced with real-time quality feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import { MediaCapture, Statement } from '../types/challenge';
import MediaRecorder from './MediaRecorder';
import MediaPreview from './MediaPreview';
import { StatementQualityFeedback, RealTimeQualityIndicator, AnimatedFeedback } from './QualityFeedback';
import { 
  analyzeStatementQuality, 
  createDebouncedQualityAnalyzer, 
  StatementQuality 
} from '../utils/qualityAssessment';
import { useReduxMediaRecording } from '../hooks/useReduxMediaRecording';

interface StatementWithMediaProps {
  statementIndex: number;
  statement: Statement;
  onStatementChange: (index: number, statement: Statement) => void;
  onMediaChange: (index: number, media: MediaCapture | null) => void;
  isLie?: boolean;
  disabled?: boolean;
  maxTextLength?: number;
}

export const StatementWithMedia: React.FC<StatementWithMediaProps> = ({
  statementIndex,
  statement,
  onStatementChange,
  onMediaChange,
  isLie = false,
  disabled = false,
  maxTextLength = 280,
}) => {
  const [showMediaRecorder, setShowMediaRecorder] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  
  // Use Redux-connected media recording hook with video-first approach
  const mediaRecording = useReduxMediaRecording({
    statementIndex,
    maxDuration: 30000,
    allowedTypes: ['video', 'text'], // Video-first with text fallback
    onRecordingComplete: (mediaData) => {
      onMediaChange(statementIndex, mediaData);
      setShowMediaRecorder(false);
      setShowMediaPreview(true);
    },
    onRecordingError: (error) => {
      console.warn('Media recording error:', error);
    },
    enableCompression: true,
  });
  const [statementQuality, setStatementQuality] = useState<StatementQuality | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showQualityFeedback, setShowQualityFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  // Create debounced quality analyzer
  const debouncedAnalyzer = useCallback(
    createDebouncedQualityAnalyzer((quality: StatementQuality) => {
      setStatementQuality(quality);
      setIsAnalyzing(false);
      
      // Show feedback message for significant quality changes
      if (quality.score >= 80) {
        setFeedbackMessage({
          message: 'Excellent statement! This will make a great challenge.',
          type: 'success',
          visible: true,
        });
      } else if (quality.score < 40) {
        setFeedbackMessage({
          message: 'Consider improving this statement for better engagement.',
          type: 'warning',
          visible: true,
        });
      }
    }, 800),
    []
  );

  // Handle text statement changes
  const handleTextChange = useCallback((text: string) => {
    const limitedText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
    
    const updatedStatement: Statement = {
      ...statement,
      text: limitedText,
    };
    
    onStatementChange(statementIndex, updatedStatement);
    
    // Trigger quality analysis
    if (limitedText.trim().length > 0) {
      setIsAnalyzing(true);
      debouncedAnalyzer(limitedText.trim());
      setShowQualityFeedback(true);
    } else {
      setStatementQuality(null);
      setShowQualityFeedback(false);
      setIsAnalyzing(false);
    }
  }, [statement, statementIndex, onStatementChange, maxTextLength, debouncedAnalyzer]);

  // Handle media recording completion
  const handleMediaComplete = useCallback((mediaData: MediaCapture) => {
    onMediaChange(statementIndex, mediaData);
    setShowMediaRecorder(false);
    setShowMediaPreview(true);
    
    // If it's a text recording, also update the statement text
    if (mediaData.type === 'text' && mediaData.url && mediaData.url.startsWith('data:text/plain;base64,')) {
      try {
        const base64Data = mediaData.url.split(',')[1];
        const decodedText = atob(base64Data);
        handleTextChange(decodedText);
      } catch (error) {
        console.warn('Failed to decode text from media data:', error);
      }
    }
  }, [statementIndex, onMediaChange, handleTextChange]);

  // Remove recorded media
  const handleRemoveMedia = useCallback(() => {
    if (mediaRecording.recordedMedia?.url && mediaRecording.recordedMedia.url.startsWith('blob:')) {
      URL.revokeObjectURL(mediaRecording.recordedMedia.url);
    }
    mediaRecording.resetRecording();
    onMediaChange(statementIndex, null);
    setShowMediaPreview(false);
  }, [mediaRecording, statementIndex, onMediaChange]);

  // Handle re-recording
  const handleReRecord = useCallback(() => {
    setShowMediaPreview(false);
    setShowMediaRecorder(true);
  }, []);

  // Handle media confirmation
  const handleConfirmMedia = useCallback(() => {
    setShowMediaPreview(false);
  }, []);

  // Toggle media recorder
  const toggleMediaRecorder = useCallback(() => {
    if (mediaRecording.recordedMedia && !showMediaRecorder) {
      // If we have recorded media, show preview instead
      setShowMediaPreview(true);
    } else {
      setShowMediaRecorder(!showMediaRecorder);
      setShowMediaPreview(false);
    }
  }, [showMediaRecorder, mediaRecording.recordedMedia]);

  // Initialize quality analysis for existing text
  useEffect(() => {
    if (statement.text.trim().length > 0) {
      const quality = analyzeStatementQuality(statement.text.trim());
      setStatementQuality(quality);
      setShowQualityFeedback(true);
    }
  }, [statement.text]);

  // Dismiss feedback message
  const dismissFeedback = useCallback(() => {
    setFeedbackMessage(prev => ({ ...prev, visible: false }));
  }, []);

  const getStatementPlaceholder = () => {
    const placeholders = [
      "Enter your first statement (required - serves as fallback if video fails)...",
      "Enter your second statement (required - serves as fallback if video fails)...",
      "Enter your third statement (required - serves as fallback if video fails)..."
    ];
    return placeholders[statementIndex] || "Enter your statement (required)...";
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥';
      case 'audio': return '🎤';
      case 'text': return '📝';
      default: return '📎';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div style={{
      ...styles.container,
      ...(isLie ? styles.containerLie : {}),
    }}>
      <div style={styles.header}>
        <span style={styles.statementNumber}>Statement {statementIndex + 1}</span>
        {isLie && (
          <span style={styles.lieIndicator}>
            🎭 This is the lie
          </span>
        )}
      </div>

      {/* Text Input */}
      <div style={styles.textSection}>
        <textarea
          value={statement.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={getStatementPlaceholder()}
          style={{
            ...styles.textInput,
            ...(isLie ? styles.textInputLie : {}),
          }}
          disabled={disabled}
          maxLength={maxTextLength}
          required
        />
        
        <div style={styles.textFooter}>
          <div style={styles.textFooterLeft}>
            <span style={styles.characterCount}>
              {statement.text.length}/{maxTextLength} characters
            </span>
            {statement.text.trim().length > 0 && (
              <RealTimeQualityIndicator
                score={statementQuality?.score || 0}
                isAnalyzing={isAnalyzing}
                showLabel={false}
              />
            )}
          </div>
          
          <button
            type="button"
            onClick={toggleMediaRecorder}
            style={{
              ...styles.mediaButton,
              ...(showMediaRecorder ? styles.mediaButtonActive : {}),
            }}
            disabled={disabled}
          >
            {mediaRecording.recordedMedia ? (showMediaPreview ? '🎬 Edit Video' : '👁️ View Video') : '🎥 Add Video (Optional)'}
          </button>
        </div>
      </div>

      {/* Media Recording Section */}
      {showMediaRecorder && (
        <div style={styles.mediaSection}>
          <MediaRecorder
            onRecordingComplete={handleMediaComplete}
            onRecordingError={(error) => console.warn('Media recording error:', error)}
            maxDuration={30000} // 30 seconds
            allowedTypes={['video', 'text']} // Video-first with text fallback
            disabled={disabled}
          />
        </div>
      )}

      {/* Media Preview Section */}
      {showMediaPreview && mediaRecording.recordedMedia && (
        <div style={styles.mediaSection}>
          <MediaPreview
            mediaData={mediaRecording.recordedMedia}
            onReRecord={handleReRecord}
            onConfirm={handleConfirmMedia}
            showControls={true}
            autoPlay={false}
          />
        </div>
      )}

      {/* Quality Feedback */}
      {showQualityFeedback && (
        <StatementQualityFeedback
          quality={statementQuality}
          isVisible={showQualityFeedback}
          compact={true}
        />
      )}

      {/* Animated Feedback Messages */}
      <AnimatedFeedback
        message={feedbackMessage.message}
        type={feedbackMessage.type}
        isVisible={feedbackMessage.visible}
        onDismiss={dismissFeedback}
        autoHide={true}
        duration={4000}
      />

      {/* Media Error Display */}
      {mediaRecording.error && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{mediaRecording.error}</span>
        </div>
      )}

      {/* Upload Progress Display */}
      {mediaRecording.uploadState.isUploading && (
        <div style={styles.uploadContainer}>
          <div style={styles.uploadHeader}>
            <span style={styles.uploadIcon}>⬆️</span>
            <span>Uploading media...</span>
          </div>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${mediaRecording.uploadState.uploadProgress}%`
              }}
            />
          </div>
          <div style={styles.uploadDetails}>
            <span>{Math.round(mediaRecording.uploadState.uploadProgress)}% complete</span>
          </div>
        </div>
      )}

      {/* Upload Error Display */}
      {mediaRecording.uploadState.uploadError && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>Upload failed: {mediaRecording.uploadState.uploadError}</span>
        </div>
      )}

      {/* Compression Progress Display */}
      {mediaRecording.isCompressing && (
        <div style={styles.compressionContainer}>
          <div style={styles.compressionHeader}>
            <span style={styles.compressionIcon}>⚙️</span>
            <span>Compressing media...</span>
          </div>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${mediaRecording.compressionProgress || 0}%`
              }}
            />
          </div>
          <div style={styles.compressionDetails}>
            <span>{Math.round(mediaRecording.compressionProgress || 0)}% complete</span>
          </div>
        </div>
      )}

      {/* Recorded Media Display */}
      {mediaRecording.recordedMedia && !showMediaRecorder && (
        <div style={styles.mediaPreview}>
          <div style={styles.mediaInfo}>
            <div style={styles.mediaHeader}>
              <span style={styles.mediaIcon}>
                {getMediaTypeIcon(mediaRecording.recordedMedia.type)}
              </span>
              <span style={styles.mediaType}>
                {mediaRecording.recordedMedia.type.charAt(0).toUpperCase() + mediaRecording.recordedMedia.type.slice(1)} Recording
              </span>
              <button
                type="button"
                onClick={handleRemoveMedia}
                style={styles.removeButton}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
            
            <div style={styles.mediaDetails}>
              {mediaRecording.recordedMedia.duration && mediaRecording.recordedMedia.duration > 0 && (
                <span style={styles.mediaDetail}>
                  Duration: {formatDuration(mediaRecording.recordedMedia.duration)}
                </span>
              )}
              {mediaRecording.recordedMedia.fileSize && (
                <span style={styles.mediaDetail}>
                  Size: {formatFileSize(mediaRecording.recordedMedia.fileSize)}
                </span>
              )}
              {mediaRecording.recordedMedia.compressionRatio && mediaRecording.recordedMedia.compressionRatio > 1 && (
                <span style={styles.mediaDetail}>
                  Compressed: {Math.round((1 - 1/mediaRecording.recordedMedia.compressionRatio) * 100)}% smaller
                </span>
              )}
            </div>
          </div>

          {/* Media Preview */}
          {mediaRecording.recordedMedia.type === 'video' && mediaRecording.recordedMedia.url && (
            <video
              src={mediaRecording.recordedMedia.url}
              controls
              style={styles.videoPreview}
              preload="metadata"
            />
          )}
          
          {mediaRecording.recordedMedia.type === 'audio' && mediaRecording.recordedMedia.url && (
            <audio
              src={mediaRecording.recordedMedia.url}
              controls
              style={styles.audioPreview}
              preload="metadata"
            />
          )}
          
          {mediaRecording.recordedMedia.type === 'text' && (
            <div style={styles.textPreview}>
              <span style={styles.textPreviewLabel}>Recorded Text:</span>
              <p style={styles.textPreviewContent}>"{statement.text}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: '20px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
    borderRadius: '12px',
    backgroundColor: '#F9FAFB',
    marginBottom: '20px',
  } as React.CSSProperties,

  containerLie: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,

  statementNumber: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#374151',
  } as React.CSSProperties,

  lieIndicator: {
    fontSize: '14px',
    color: '#EF4444',
    fontWeight: 'bold',
    padding: '4px 8px',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #EF4444',
  } as React.CSSProperties,

  textSection: {
    marginBottom: '16px',
  } as React.CSSProperties,

  textInput: {
    width: '100%',
    minHeight: '100px',
    padding: '16px',
    fontSize: '16px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#D1D5DB',
    borderRadius: '8px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    marginBottom: '12px',
  } as React.CSSProperties,

  textInputLie: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  } as React.CSSProperties,

  textFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,

  textFooterLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  characterCount: {
    fontSize: '12px',
    color: '#9CA3AF',
  } as React.CSSProperties,

  mediaButton: {
    padding: '8px 16px',
    fontSize: '14px',
    border: '2px solid #3B82F6',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    color: '#3B82F6',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  mediaButtonActive: {
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
  } as React.CSSProperties,

  mediaSection: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
  } as React.CSSProperties,

  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '6px',
    color: '#DC2626',
    fontSize: '14px',
    marginTop: '12px',
  } as React.CSSProperties,

  errorIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  mediaPreview: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    border: '2px solid #10B981',
  } as React.CSSProperties,

  mediaInfo: {
    marginBottom: '12px',
  } as React.CSSProperties,

  mediaHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  } as React.CSSProperties,

  mediaIcon: {
    fontSize: '20px',
  } as React.CSSProperties,

  mediaType: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#10B981',
    flex: 1,
  } as React.CSSProperties,

  removeButton: {
    padding: '4px 8px',
    fontSize: '14px',
    border: '1px solid #EF4444',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    color: '#EF4444',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  mediaDetails: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6B7280',
  } as React.CSSProperties,

  mediaDetail: {
    // No specific styles needed
  } as React.CSSProperties,

  videoPreview: {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    borderRadius: '6px',
  } as React.CSSProperties,

  audioPreview: {
    width: '100%',
  } as React.CSSProperties,

  textPreview: {
    padding: '12px',
    backgroundColor: '#F3F4F6',
    borderRadius: '6px',
  } as React.CSSProperties,

  textPreviewLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 'bold',
    display: 'block',
    marginBottom: '4px',
  } as React.CSSProperties,

  textPreviewContent: {
    fontSize: '14px',
    color: '#374151',
    fontStyle: 'italic',
    margin: 0,
  } as React.CSSProperties,

  uploadContainer: {
    padding: '12px',
    backgroundColor: '#EBF8FF',
    border: '2px solid #93C5FD',
    borderRadius: '6px',
    marginTop: '12px',
  } as React.CSSProperties,

  uploadHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1E40AF',
  } as React.CSSProperties,

  uploadIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  uploadDetails: {
    fontSize: '12px',
    color: '#1E40AF',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  compressionContainer: {
    padding: '12px',
    backgroundColor: '#F0FDF4',
    border: '2px solid #BBF7D0',
    borderRadius: '6px',
    marginTop: '12px',
  } as React.CSSProperties,

  compressionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#065F46',
  } as React.CSSProperties,

  compressionIcon: {
    fontSize: '16px',
    animation: 'spin 2s linear infinite',
  } as React.CSSProperties,

  compressionDetails: {
    fontSize: '12px',
    color: '#065F46',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#E5E7EB',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    transition: 'width 0.3s ease',
  } as React.CSSProperties,
};

export default StatementWithMedia;