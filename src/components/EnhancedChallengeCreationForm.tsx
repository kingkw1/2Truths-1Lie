/**
 * Enhanced Challenge Creation Form Component
 * Integrates media recording with statement creation
 * Implements video, audio, and text-only recording with fallback mechanisms
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  startNewChallenge,
  updateStatement,
  setLieStatement,
  setStatementMedia,
  validateChallenge,
  enterPreviewMode,
  clearValidationErrors,
  startSubmission,
  completeSubmission,
} from '../store/slices/challengeCreationSlice';
import { Statement, MediaCapture } from '../types/challenge';
import StatementWithMedia from './StatementWithMedia';
import UploadProgress from './UploadProgress';
import { AnimatedFeedback } from './QualityFeedback';

interface EnhancedChallengeCreationFormProps {
  onSubmit?: () => void;
  onCancel?: () => void;
}

export const EnhancedChallengeCreationForm: React.FC<EnhancedChallengeCreationFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const dispatch = useDispatch();
  const {
    currentChallenge,
    validationErrors,
    isSubmitting,
    previewMode,
    mediaRecordingState,
    uploadState,
  } = useSelector((state: RootState) => state.challengeCreation);

  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [mediaSupport, setMediaSupport] = useState({
    video: false,
    audio: false,
    text: true,
  });
  const [uploadSessions, setUploadSessions] = useState<Array<{
    sessionId: string;
    filename: string;
    fileSize: number;
    statementIndex: number;
  }>>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  // Initialize challenge on component mount
  useEffect(() => {
    dispatch(startNewChallenge());
    checkMediaSupport();
  }, [dispatch]);

  // Check media device support - prioritize video with audio
  const checkMediaSupport = useCallback(async () => {
    const support = {
      video: false,
      audio: false, // Deprecated: standalone audio mode removed
      text: true,
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Test video with audio support (primary mode)
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoStream.getTracks().forEach(track => track.stop());
        support.video = true;
        support.audio = true; // Audio is included with video
      } catch {
        // Video with audio not supported, text fallback available
        console.log('Video recording not available, text mode will be used as fallback');
      }
    }

    setMediaSupport(support);
  }, []);

  // Sync lie selection with Redux store
  useEffect(() => {
    if (currentChallenge.statements && currentChallenge.statements.length > 0) {
      const lieIndex = currentChallenge.statements.findIndex(stmt => stmt.isLie);
      setSelectedLieIndex(lieIndex >= 0 ? lieIndex : null);
    }
  }, [currentChallenge.statements]);

  // Ensure we have 3 statement slots
  const statements = React.useMemo(() => {
    const baseStatements: Statement[] = [];
    
    for (let i = 0; i < 3; i++) {
      if (currentChallenge.statements && currentChallenge.statements[i]) {
        baseStatements.push(currentChallenge.statements[i]);
      } else {
        baseStatements.push({
          id: `stmt_${Date.now()}_${i}`,
          text: '',
          isLie: false,
          confidence: 0,
        });
      }
    }
    
    return baseStatements;
  }, [currentChallenge.statements]);

  // Handle statement changes
  const handleStatementChange = useCallback((index: number, statement: Statement) => {
    dispatch(updateStatement({ index, statement }));
    
    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      dispatch(clearValidationErrors());
      setShowValidation(false);
    }
  }, [dispatch, validationErrors]);

  // Handle media changes
  const handleMediaChange = useCallback((index: number, media: MediaCapture | null) => {
    dispatch(setStatementMedia({ index, media }));
  }, [dispatch]);

  // Handle lie selection
  const handleLieSelection = useCallback((index: number) => {
    setSelectedLieIndex(index);
    dispatch(setLieStatement(index));
    
    // Clear validation errors when lie is selected
    if (validationErrors.length > 0) {
      dispatch(clearValidationErrors());
      setShowValidation(false);
    }
  }, [dispatch, validationErrors]);

  // Validate and preview
  const handleValidateAndPreview = useCallback(() => {
    dispatch(validateChallenge());
    setShowValidation(true);
    
    // If no validation errors, enter preview mode
    if (validationErrors.length === 0) {
      dispatch(enterPreviewMode());
    }
  }, [dispatch, validationErrors]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    dispatch(validateChallenge());
    setShowValidation(true);
    
    if (validationErrors.length === 0) {
      dispatch(startSubmission());
      
      try {
        // Check if any uploads are still in progress
        const hasActiveUploads = Object.values(uploadState).some(state => state.isUploading);
        
        if (hasActiveUploads) {
          // Wait for uploads to complete
          setFeedbackMessage({
            message: 'Waiting for media uploads to complete...',
            type: 'info',
            visible: true,
          });
          
          // Poll for upload completion
          const checkUploads = () => {
            const stillUploading = Object.values(uploadState).some(state => state.isUploading);
            if (!stillUploading) {
              dispatch(completeSubmission({ success: true }));
              if (onSubmit) {
                onSubmit();
              }
            } else {
              setTimeout(checkUploads, 1000);
            }
          };
          
          setTimeout(checkUploads, 1000);
        } else {
          // Check if we have media files that need uploading
          const mediaFiles = currentChallenge.mediaData?.filter(media => 
            media && media.type !== 'text' && media.url && media.url.startsWith('blob:')
          ) || [];
          
          // Check for any media recording errors
          const hasMediaErrors = Object.values(mediaRecordingState).some(state => state.error !== null);
          
          if (mediaFiles.length > 0) {
            // Create upload sessions for media files that haven't been uploaded yet
            const sessions = mediaFiles.map((media, index) => ({
              sessionId: `challenge_${Date.now()}_${index}`,
              filename: `statement_${index}_${media.type}.${media.mimeType?.split('/')[1] || 'webm'}`,
              fileSize: media.fileSize || 0,
              statementIndex: index,
            }));
            
            setUploadSessions(sessions);
            
            // Note: In a real implementation, uploads would be handled by the Redux-connected hook
            // For now, we'll simulate the upload process
            setTimeout(() => {
              dispatch(completeSubmission({ success: true }));
              setUploadSessions([]);
              if (onSubmit) {
                onSubmit();
              }
            }, 3000);
          } else {
            // No media files to upload - this is fine, text serves as fallback
            if (hasMediaErrors) {
              setFeedbackMessage({
                message: 'Video recording failed, but your text statements will be used. Challenge created successfully!',
                type: 'info',
                visible: true,
              });
            }
            
            dispatch(completeSubmission({ success: true }));
            if (onSubmit) {
              onSubmit();
            }
          }
        }
      } catch (error) {
        console.error('Submission error:', error);
        dispatch(completeSubmission({ success: false }));
      }
    }
  }, [dispatch, validationErrors, currentChallenge.mediaData, uploadState, onSubmit]);

  // Check if form is valid - simplified to only require text and lie selection
  const isFormValid = useCallback(() => {
    return (
      statements.every(stmt => stmt.text.trim().length > 0) &&
      selectedLieIndex !== null &&
      statements.length === 3
    );
    // Note: Media recording is optional - text serves as fallback
  }, [statements, selectedLieIndex]);

  // Get available media types based on support - video-first approach
  const getAvailableMediaTypes = useCallback(() => {
    const types: ('video' | 'text')[] = ['text']; // Always have text fallback
    
    if (mediaSupport.video) {
      types.unshift('video'); // Video with audio is primary
    }
    
    return types;
  }, [mediaSupport]);

  // Dismiss feedback message
  const dismissFeedback = useCallback(() => {
    setFeedbackMessage(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Create Your Challenge</h2>
        <p style={styles.subtitle}>
          Write three statements about yourself. Two should be true, and one should be a lie.
          You can add video, audio, or keep it text-only for each statement!
        </p>
      </div>

      {/* Media Support Info */}
      <div style={styles.mediaSupportInfo}>
        <h4 style={styles.mediaSupportTitle}>Recording Options:</h4>
        <div style={styles.mediaSupportList}>
          {mediaSupport.video ? (
            <span style={styles.mediaSupportItem}>
              🎥 Video with Audio (Recommended)
            </span>
          ) : (
            <span style={styles.mediaSupportItemDisabled}>
              🎥 Video with Audio (Not Available)
            </span>
          )}
          <span style={styles.mediaSupportItem}>
            📝 Text Only (Always Available as Fallback)
          </span>
        </div>
        <p style={styles.mediaSupportNote}>
          💡 Text statements are required for all entries. Video recording is optional and will enhance your challenge, but if recording fails, your text will serve as the fallback.
        </p>
      </div>

      {/* Lie Selection Instructions */}
      <div style={styles.instructionsContainer}>
        <h4 style={styles.instructionsTitle}>Instructions:</h4>
        <ol style={styles.instructionsList}>
          <li>Write three statements about yourself (required)</li>
          <li>Optionally add video recordings to enhance your statements</li>
          <li>Make sure two statements are true and one is false</li>
          <li>Click "Mark as lie" on the statement that is false</li>
          <li>Preview your challenge before publishing</li>
        </ol>
        <div style={styles.instructionsNote}>
          <strong>Note:</strong> Text is always required as it serves as a fallback when video recording is unavailable or fails.
        </div>
      </div>

      {/* Statements with Media */}
      <div style={styles.statementsContainer}>
        {statements.map((statement, index) => (
          <div key={index} style={styles.statementWrapper}>
            <div style={styles.statementHeader}>
              <button
                type="button"
                onClick={() => handleLieSelection(index)}
                style={{
                  ...styles.lieButton,
                  ...(selectedLieIndex === index ? styles.lieButtonSelected : {}),
                }}
                disabled={isSubmitting}
              >
                {selectedLieIndex === index ? '✓ This is the lie' : 'Mark as lie'}
              </button>
            </div>
            
            <StatementWithMedia
              statementIndex={index}
              statement={statement}
              onStatementChange={handleStatementChange}
              onMediaChange={handleMediaChange}
              isLie={selectedLieIndex === index}
              disabled={isSubmitting}
              maxTextLength={280}
            />
          </div>
        ))}
      </div>

      {/* Validation Errors */}
      {showValidation && validationErrors.length > 0 && (
        <div style={styles.errorContainer}>
          <h4 style={styles.errorTitle}>Please fix the following issues:</h4>
          <ul style={styles.errorList}>
            {validationErrors.map((error, index) => (
              <li key={index} style={styles.errorItem}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Status */}
      <div style={styles.statusContainer}>
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Statements:</span>
          <span style={{
            ...styles.statusValue,
            color: statements.filter(s => s.text.trim()).length === 3 ? '#10B981' : '#EF4444'
          }}>
            {statements.filter(s => s.text.trim()).length}/3
          </span>
        </div>
        
        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Lie selected:</span>
          <span style={{
            ...styles.statusValue,
            color: selectedLieIndex !== null ? '#10B981' : '#EF4444'
          }}>
            {selectedLieIndex !== null ? 'Yes' : 'No'}
          </span>
        </div>

        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>Videos added:</span>
          <span style={{
            ...styles.statusValue,
            color: '#3B82F6'
          }}>
            {currentChallenge.mediaData?.filter(m => m.type === 'video').length || 0}/3
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.buttonContainer}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={styles.cancelButton}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        
        <button
          type="button"
          onClick={handleValidateAndPreview}
          style={{
            ...styles.previewButton,
            ...(isFormValid() ? {} : styles.buttonDisabled),
          }}
          disabled={!isFormValid() || isSubmitting}
        >
          {previewMode ? 'Update Preview' : 'Preview Challenge'}
        </button>
        
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            ...styles.submitButton,
            ...(isFormValid() ? {} : styles.buttonDisabled),
          }}
          disabled={!isFormValid() || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Challenge'}
        </button>
      </div>

      {/* Upload Progress */}
      {uploadSessions.length > 0 && (
        <div style={styles.uploadContainer}>
          <h4 style={styles.uploadTitle}>Uploading Media Files...</h4>
          {uploadSessions.map((session) => (
            <UploadProgress
              key={session.sessionId}
              sessionId={session.sessionId}
              filename={session.filename}
              fileSize={session.fileSize}
              onUploadComplete={(fileUrl) => {
                console.log(`Upload completed for statement ${session.statementIndex}:`, fileUrl);
                // Update the media URL in the Redux store
                const updatedMedia = currentChallenge.mediaData?.[session.statementIndex];
                if (updatedMedia) {
                  dispatch(setStatementMedia({ 
                    index: session.statementIndex, 
                    media: { ...updatedMedia, url: fileUrl } 
                  }));
                }
              }}
              onUploadError={(error) => {
                console.error(`Upload failed for statement ${session.statementIndex}:`, error);
              }}
              onUploadCancel={() => {
                console.log(`Upload cancelled for statement ${session.statementIndex}`);
                setUploadSessions(prev => prev.filter(s => s.sessionId !== session.sessionId));
              }}
              autoStart={true}
              showDetails={true}
              compact={false}
            />
          ))}
        </div>
      )}

      {/* Preview Mode Indicator */}
      {previewMode && (
        <div style={styles.previewIndicator}>
          <span>🔍 Preview mode active - review your challenge above</span>
        </div>
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
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  header: {
    marginBottom: '24px',
    textAlign: 'center' as const,
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

  mediaSupportInfo: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#EBF8FF',
    borderRadius: '8px',
    border: '1px solid #93C5FD',
  } as React.CSSProperties,

  mediaSupportTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: '8px',
  } as React.CSSProperties,

  mediaSupportList: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  mediaSupportItem: {
    fontSize: '14px',
    color: '#1E40AF',
    padding: '4px 8px',
    backgroundColor: '#DBEAFE',
    borderRadius: '4px',
  } as React.CSSProperties,

  mediaSupportItemDisabled: {
    fontSize: '14px',
    color: '#9CA3AF',
    padding: '4px 8px',
    backgroundColor: '#F3F4F6',
    borderRadius: '4px',
  } as React.CSSProperties,

  mediaSupportNote: {
    fontSize: '14px',
    color: '#1E40AF',
    marginTop: '12px',
    padding: '8px',
    backgroundColor: '#DBEAFE',
    borderRadius: '4px',
    lineHeight: '1.4',
  } as React.CSSProperties,

  instructionsContainer: {
    marginBottom: '32px',
    padding: '16px',
    backgroundColor: '#F0FDF4',
    borderRadius: '8px',
    border: '1px solid #BBF7D0',
  } as React.CSSProperties,

  instructionsTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: '8px',
  } as React.CSSProperties,

  instructionsList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#065F46',
  } as React.CSSProperties,

  instructionsNote: {
    marginTop: '12px',
    padding: '8px',
    backgroundColor: '#DBEAFE',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#1E40AF',
    lineHeight: '1.4',
  } as React.CSSProperties,

  statementsContainer: {
    marginBottom: '24px',
  } as React.CSSProperties,

  statementWrapper: {
    marginBottom: '24px',
  } as React.CSSProperties,

  statementHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '8px',
  } as React.CSSProperties,

  lieButton: {
    padding: '8px 16px',
    fontSize: '14px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#D1D5DB',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  lieButtonSelected: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    borderColor: '#EF4444',
  } as React.CSSProperties,

  errorContainer: {
    padding: '16px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '8px',
    marginBottom: '24px',
  } as React.CSSProperties,

  errorTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: '8px',
  } as React.CSSProperties,

  errorList: {
    margin: 0,
    paddingLeft: '20px',
  } as React.CSSProperties,

  errorItem: {
    color: '#DC2626',
    fontSize: '14px',
    marginBottom: '4px',
  } as React.CSSProperties,

  statusContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '16px',
    backgroundColor: '#F3F4F6',
    borderRadius: '8px',
    marginBottom: '24px',
  } as React.CSSProperties,

  statusItem: {
    textAlign: 'center' as const,
  } as React.CSSProperties,

  statusLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '4px',
  } as React.CSSProperties,

  statusValue: {
    fontSize: '16px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  buttonContainer: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  cancelButton: {
    padding: '12px 24px',
    fontSize: '16px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  previewButton: {
    padding: '12px 24px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  submitButton: {
    padding: '12px 24px',
    fontSize: '16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  uploadContainer: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#F0FDF4',
    border: '2px solid #BBF7D0',
    borderRadius: '8px',
  } as React.CSSProperties,

  uploadTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  previewIndicator: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#EBF8FF',
    border: '1px solid #93C5FD',
    borderRadius: '6px',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#1E40AF',
  } as React.CSSProperties,
};

export default EnhancedChallengeCreationForm;