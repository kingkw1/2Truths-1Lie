/**
 * Statement with Media Component
 * Combines text statement input with optional media recording
 * Implements fallback from video -> audio -> text only
 * Enhanced with real-time quality feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import { MediaCapture, Statement } from '../types/challenge';
import MediaRecorder from './MediaRecorder';
import { StatementQualityFeedback, RealTimeQualityIndicator, AnimatedFeedback } from './QualityFeedback';
import { 
  analyzeStatementQuality, 
  createDebouncedQualityAnalyzer, 
  StatementQuality 
} from '../utils/qualityAssessment';

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
  const [recordedMedia, setRecordedMedia] = useState<MediaCapture | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
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
    setRecordedMedia(mediaData);
    onMediaChange(statementIndex, mediaData);
    setShowMediaRecorder(false);
    setMediaError(null);
    
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

  // Handle media recording errors
  const handleMediaError = useCallback((error: string) => {
    setMediaError(error);
    console.warn('Media recording error:', error);
  }, []);

  // Remove recorded media
  const handleRemoveMedia = useCallback(() => {
    if (recordedMedia?.url && recordedMedia.url.startsWith('blob:')) {
      URL.revokeObjectURL(recordedMedia.url);
    }
    setRecordedMedia(null);
    onMediaChange(statementIndex, null);
    setMediaError(null);
  }, [recordedMedia, statementIndex, onMediaChange]);

  // Toggle media recorder
  const toggleMediaRecorder = useCallback(() => {
    setShowMediaRecorder(!showMediaRecorder);
    setMediaError(null);
  }, [showMediaRecorder]);

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
      "Enter your first statement (this could be true or false)...",
      "Enter your second statement (this could be true or false)...",
      "Enter your third statement (this could be true or false)..."
    ];
    return placeholders[statementIndex] || "Enter your statement...";
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
            {recordedMedia ? '🎬 Edit Media' : '📹 Add Media'}
          </button>
        </div>
      </div>

      {/* Media Recording Section */}
      {showMediaRecorder && (
        <div style={styles.mediaSection}>
          <MediaRecorder
            onRecordingComplete={handleMediaComplete}
            onRecordingError={handleMediaError}
            maxDuration={30000} // 30 seconds
            allowedTypes={['video', 'audio', 'text']}
            disabled={disabled}
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
      {mediaError && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{mediaError}</span>
        </div>
      )}

      {/* Recorded Media Display */}
      {recordedMedia && !showMediaRecorder && (
        <div style={styles.mediaPreview}>
          <div style={styles.mediaInfo}>
            <div style={styles.mediaHeader}>
              <span style={styles.mediaIcon}>
                {getMediaTypeIcon(recordedMedia.type)}
              </span>
              <span style={styles.mediaType}>
                {recordedMedia.type.charAt(0).toUpperCase() + recordedMedia.type.slice(1)} Recording
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
              {recordedMedia.duration && recordedMedia.duration > 0 && (
                <span style={styles.mediaDetail}>
                  Duration: {formatDuration(recordedMedia.duration)}
                </span>
              )}
              {recordedMedia.fileSize && (
                <span style={styles.mediaDetail}>
                  Size: {formatFileSize(recordedMedia.fileSize)}
                </span>
              )}
            </div>
          </div>

          {/* Media Preview */}
          {recordedMedia.type === 'video' && recordedMedia.url && (
            <video
              src={recordedMedia.url}
              controls
              style={styles.videoPreview}
              preload="metadata"
            />
          )}
          
          {recordedMedia.type === 'audio' && recordedMedia.url && (
            <audio
              src={recordedMedia.url}
              controls
              style={styles.audioPreview}
              preload="metadata"
            />
          )}
          
          {recordedMedia.type === 'text' && (
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
    border: '2px solid #E5E7EB',
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
    border: '2px solid #D1D5DB',
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
};

export default StatementWithMedia;