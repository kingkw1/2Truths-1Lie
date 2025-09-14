/**
 * Enhanced Challenge Creation Component
 * Manages the complete workflow of recording individual statements and merging them
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { MobileCameraRecorder } from './MobileCameraRecorder';
import MergeProgressIndicator from './MergeProgressIndicator';
import UploadErrorHandler from './UploadErrorHandler';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';
import { useErrorHandling } from '../hooks/useErrorHandling';
import { errorHandlingService } from '../services/errorHandlingService';
import { realChallengeAPI } from '../services/realChallengeAPI';
import {
  startNewChallenge,
  updateStatement,
  setLieStatement,
  initiateMerge,
} from '../store/slices/challengeCreationSlice';



interface EnhancedChallengeCreationProps {
  onChallengeComplete?: (challengeData: any) => void;
  onCancel?: () => void;
}

type CreationStep = 'statements' | 'recording' | 'merging' | 'preview' | 'complete';

export const EnhancedChallengeCreation: React.FC<EnhancedChallengeCreationProps> = ({
  onChallengeComplete,
  onCancel,
}) => {
  // Safety check for React Native environment
  if (typeof Platform === 'undefined') {
    console.error('EnhancedChallengeCreation: Platform is undefined - not in React Native environment');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error: Component not supported in this environment</Text>
      </View>
    );
  }

  const dispatch = useAppDispatch();

  // Redux state with error handling
  const challengeState = useAppSelector(state => {
    try {
      return state.challengeCreation;
    } catch (error) {
      console.error('Error accessing challenge creation state:', error);
      return {
        currentChallenge: {},
        individualRecordings: {} as { [statementIndex: number]: MediaCapture | null },
        validationErrors: [] as string[],
      };
    }
  });

  const {
    currentChallenge = {},
    individualRecordings = {} as { [statementIndex: number]: MediaCapture | null },
    validationErrors = [] as string[]
  } = challengeState;

  // Local state
  const [currentStep, setCurrentStep] = useState<CreationStep>('statements');
  const [currentRecordingIndex, setCurrentRecordingIndex] = useState<number | null>(null);
  const [statementTexts, setStatementTexts] = useState<string[]>(['', '', '']);
  const [selectedLieIndex, setSelectedLieIndex] = useState<number | null>(null);
  // Merge progress state
  const [mergeSessionId, setMergeSessionId] = useState<string | null>(null);
  const [mergeProgress, setMergeProgress] = useState({
    stage: 'pending' as 'pending' | 'processing' | 'completed' | 'failed',
    progress: 0,
    currentStep: '',
    estimatedTimeRemaining: undefined as number | undefined,
    error: undefined as string | undefined,
  });
  const [mergeResult, setMergeResult] = useState<{
    mergedVideoUrl?: string;
    segmentMetadata?: any;
    mergeSessionId?: string;
  } | null>(null);

  // Enhanced error handling for upload and merge operations
  const {
    error: uploadError,
    isRetrying: isUploadRetrying,
    retryCount: uploadRetryCount,
    handleError: handleUploadError,
    clearError: clearUploadError,
    retry: retryUpload,
    canRetry: canRetryUpload,
  } = useErrorHandling(
    undefined, // No automatic retry function, we'll handle manually
    {
      showAlert: false, // We'll use custom error display
      autoRetry: false,
      maxRetries: 3,
      onError: (error) => {
        console.error('🎬 UPLOAD_ERROR:', error);
      },
    }
  );

  // Initialize challenge and services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize mobile media integration service
        await mobileMediaIntegration.initialize(dispatch);

        // Initialize challenge
        dispatch(startNewChallenge());
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };

    initializeServices();

    return () => {
      // Cleanup merge monitoring on unmount
      if (mergeSessionId) {
        mobileMediaIntegration.stopMergeProgressMonitoring(mergeSessionId);
      }
    };
  }, [dispatch, mergeSessionId]);

  // Start merge process when entering merging step
  useEffect(() => {
    if (currentStep === 'merging') {
      startMergeProcess();
    }
  }, [currentStep]);

  // Helper function to convert Redux state to service expected format
  const getValidRecordings = React.useMemo((): { [key: number]: MediaCapture } => {
    try {
      const validRecordings: { [key: number]: MediaCapture } = {};
      const recordings = individualRecordings || {};
      
      for (const [indexStr, recording] of Object.entries(recordings)) {
        if (recording !== null && recording !== undefined && recording.type) {
          const index = parseInt(indexStr, 10);
          validRecordings[index] = recording as MediaCapture;
        }
      }
      return validRecordings;
    } catch (error) {
      console.error('Error processing individual recordings:', error);
      return {};
    }
  }, [individualRecordings]);

  // Check if we can proceed to merging
  const canProceedToMerging = React.useMemo(() => {
    try {
      // Ensure service is available before calling
      if (!mobileMediaIntegration || typeof mobileMediaIntegration.hasAllStatementRecordings !== 'function') {
        console.warn('Mobile media integration service not available');
        return false;
      }
      return mobileMediaIntegration.hasAllStatementRecordings(getValidRecordings);
    } catch (error) {
      console.error('Error checking recording completeness:', error);
      return false;
    }
  }, [getValidRecordings]);

  // Handle statement text changes
  const handleStatementTextChange = (index: number, text: string) => {
    const newTexts = [...statementTexts];
    newTexts[index] = text;
    setStatementTexts(newTexts);

    // Update Redux state
    dispatch(updateStatement({
      index,
      statement: {
        id: `stmt_${index + 1}`,
        text,
        isLie: selectedLieIndex === index,
        confidence: 0,
      },
    }));
  };

  // Handle lie selection
  const handleLieSelection = (index: number) => {
    setSelectedLieIndex(index);
    dispatch(setLieStatement(index));
  };

  // Start recording for a specific statement
  const startRecordingStatement = (index: number) => {
    if (statementTexts[index].trim() === '') {
      Alert.alert('Missing Statement', 'Please enter the statement text before recording.');
      return;
    }

    setCurrentRecordingIndex(index);
    setCurrentStep('recording');
  };

  // Handle recording completion
  const handleRecordingComplete = (media: MediaCapture) => {
    console.log(`Recording completed for statement ${currentRecordingIndex}:`, media);

    // Return to statements view
    setCurrentRecordingIndex(null);
    setCurrentStep('statements');

    // Check if all recordings are complete
    if (canProceedToMerging) {
      Alert.alert(
        'All Recordings Complete!',
        'You have recorded all three statements. Ready to merge them into your challenge?',
        [
          { text: 'Review Statements', style: 'cancel' },
          {
            text: 'Create Challenge',
            style: 'default',
            onPress: createChallengeWithIndividualVideos,
          },
        ]
      );
    }
  };

  // Handle recording cancellation
  const handleRecordingCancel = () => {
    setCurrentRecordingIndex(null);
    setCurrentStep('statements');
  };

  // Create challenge with individual videos (server-side merging)
  const createChallengeWithIndividualVideos = async () => {
    if (!canProceedToMerging) {
      Alert.alert('Incomplete Recordings', 'Please record all three statements before creating challenge.');
      return;
    }

    if (selectedLieIndex === null) {
      Alert.alert('Select the Lie', 'Please select which statement is the lie before proceeding.');
      return;
    }

    setCurrentStep('merging');
  };

  // Start merge process
  const startMergeProcess = async () => {
    try {
      clearUploadError(); // Clear any previous errors
      
      setMergeProgress({
        stage: 'pending',
        progress: 0,
        currentStep: 'Preparing videos for merge...',
        estimatedTimeRemaining: undefined,
        error: undefined,
      });

      const validRecordings = getValidRecordings;
      
      // Upload videos for merging
      const result = await mobileMediaIntegration.uploadVideosForMerging(validRecordings);
      
      if (!result.success) {
        const error = new Error(result.error || 'Failed to upload videos for merging');
        handleUploadError(error, 'uploadVideosForMerging');
        
        setMergeProgress({
          stage: 'failed',
          progress: 0,
          currentStep: 'Upload failed',
          estimatedTimeRemaining: undefined,
          error: result.error || 'Failed to upload videos for merging',
        });
        return;
      }

      // If merge completed immediately (small videos)
      if (result.mergedVideoUrl) {
        setMergeResult({
          mergedVideoUrl: result.mergedVideoUrl,
          segmentMetadata: result.segmentMetadata,
          mergeSessionId: result.mergeSessionId,
        });
        setMergeProgress({
          stage: 'completed',
          progress: 100,
          currentStep: 'Merge completed successfully!',
          estimatedTimeRemaining: undefined,
          error: undefined,
        });
        
        // Auto-proceed to preview after a short delay
        setTimeout(() => {
          setCurrentStep('preview');
        }, 2000);
        return;
      }

      // Start monitoring merge progress if we have a session ID
      if (result.mergeSessionId) {
        setMergeSessionId(result.mergeSessionId);
        
        // Initialize merge state in Redux
        dispatch(initiateMerge({ mergeSessionId: result.mergeSessionId }));
        
        // Start monitoring progress
        await mobileMediaIntegration.startMergeProgressMonitoring(
          result.mergeSessionId,
          (progress) => {
            setMergeProgress({
              stage: progress.stage as any,
              progress: progress.progress,
              currentStep: progress.currentStep || '',
              estimatedTimeRemaining: progress.estimatedTimeRemaining,
              error: undefined,
            });
          },
          (mergeResult) => {
            if (mergeResult.success) {
              setMergeResult({
                mergedVideoUrl: mergeResult.mergedVideoUrl,
                segmentMetadata: mergeResult.segmentMetadata,
                mergeSessionId: mergeResult.mergeSessionId,
              });
              setMergeProgress({
                stage: 'completed',
                progress: 100,
                currentStep: 'Merge completed successfully!',
                estimatedTimeRemaining: undefined,
                error: undefined,
              });
              
              // Auto-proceed to preview after a short delay
              setTimeout(() => {
                setCurrentStep('preview');
              }, 2000);
            } else {
              setMergeProgress({
                stage: 'failed',
                progress: 0,
                currentStep: 'Merge failed',
                estimatedTimeRemaining: undefined,
                error: mergeResult.error || 'Merge operation failed',
              });
            }
          }
        );
      } else {
        throw new Error('No merge session ID returned from upload');
      }

    } catch (error: any) {
      console.error('Merge process error:', error);
      
      handleUploadError(error, 'startMergeProcess');
      
      setMergeProgress({
        stage: 'failed',
        progress: 0,
        currentStep: 'Merge failed',
        estimatedTimeRemaining: undefined,
        error: error.message || 'Failed to start merge process',
      });
    }
  };

  // Complete challenge creation
  const completeChallenge = async () => {
    try {
      if (!mergeResult?.mergedVideoUrl || !mergeResult?.segmentMetadata) {
        Alert.alert('Error', 'Merged video data is not available. Please try again.');
        return;
      }

      if (selectedLieIndex === null) {
        Alert.alert('Error', 'Please select which statement is the lie.');
        return;
      }

      // Prepare challenge request with merged video data
      const challengeRequest = {
        statements: statementTexts.map((text, index) => {
          const segmentData = mergeResult.segmentMetadata?.find((s: any) => s.statementIndex === index);
          return {
            text: text || `Statement ${index + 1}`,
            media_file_id: mergeResult.mergedVideoUrl || '',
            segment_start_time: segmentData?.startTime ? segmentData.startTime / 1000 : undefined,
            segment_end_time: segmentData?.endTime ? segmentData.endTime / 1000 : undefined,
            segment_duration: segmentData ? (segmentData.endTime - segmentData.startTime) / 1000 : undefined,
          };
        }),
        lie_statement_index: selectedLieIndex,
        tags: ['mobile-game', '2truths1lie'],
        is_merged_video: true,
        merged_video_url: mergeResult.mergedVideoUrl,
        merged_video_file_id: mergeResult.mergedVideoUrl,
        merge_session_id: mergeResult.mergeSessionId,
        merged_video_metadata: {
          total_duration: mergeResult.segmentMetadata.reduce((total: number, segment: any) =>
            Math.max(total, segment.endTime), 0) / 1000,
          segments: mergeResult.segmentMetadata.map((segment: any) => ({
            statement_index: segment.statementIndex,
            start_time: segment.startTime / 1000,
            end_time: segment.endTime / 1000,
            duration: (segment.endTime - segment.startTime) / 1000,
          })),
          video_file_id: mergeResult.mergedVideoUrl || '',
          compression_applied: true,
          original_total_duration: mergeResult.segmentMetadata.reduce((total: number, segment: any) =>
            Math.max(total, segment.endTime), 0) / 1000,
        },
      };

      // Submit to backend using the real challenge API
      const response = await realChallengeAPI.createChallenge(challengeRequest);

      if (response.success && response.data) {
        console.log('✅ Challenge created successfully:', response.data.challenge_id || response.data.id);
        
        const challengeData = {
          ...currentChallenge,
          id: response.data.challenge_id || response.data.id,
          mergedVideoUrl: mergeResult.mergedVideoUrl,
          segmentMetadata: mergeResult.segmentMetadata,
          lieIndex: selectedLieIndex,
        };

        setCurrentStep('complete');
        onChallengeComplete?.(challengeData);
      } else {
        throw new Error(response.error || 'Failed to create challenge');
      }

    } catch (error: any) {
      console.error('❌ Failed to complete challenge:', error);
      Alert.alert(
        'Challenge Creation Failed',
        error.message || 'Failed to create challenge. Please try again.',
        [
          {
            text: 'Retry',
            onPress: completeChallenge,
          },
          {
            text: 'Back to Edit',
            style: 'cancel',
            onPress: () => setCurrentStep('preview'),
          },
        ]
      );
    }
  };

  // Render statements input step
  const renderStatementsStep = () => (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Create Your Challenge</Text>
      <Text style={styles.subtitle}>
        Enter three statements - two truths and one lie. Then record a video for each.
      </Text>

      {statementTexts.map((text, index) => (
        <View key={index} style={styles.statementContainer}>
          <Text style={styles.statementLabel}>Statement {index + 1}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              testID={`statement-input-${index}`}
              style={styles.textInput}
              value={text}
              onChangeText={(newText) => handleStatementTextChange(index, newText)}
              placeholder={`Enter statement ${index + 1}...`}
              multiline
              maxLength={200}
            />
          </View>

          <View style={styles.statementActions}>
            <TouchableOpacity
              style={[
                styles.lieButton,
                selectedLieIndex === index && styles.lieButtonSelected,
              ]}
              onPress={() => handleLieSelection(index)}
            >
              <Text style={[
                styles.lieButtonText,
                selectedLieIndex === index && styles.lieButtonTextSelected,
              ]}>
                {selectedLieIndex === index ? '✓ This is the lie' : 'Mark as lie'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.recordButton,
                individualRecordings && individualRecordings[index] && styles.recordButtonComplete,
              ]}
              onPress={() => startRecordingStatement(index)}
              disabled={text.trim() === ''}
            >
              <Text style={styles.recordButtonText}>
                {individualRecordings && individualRecordings[index] ? '✓ Re-record' : '🎥 Record'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {validationErrors.length > 0 && (
        <View style={styles.errorContainer}>
          {validationErrors.map((error, index) => (
            <Text key={index} style={styles.errorText}>• {error}</Text>
          ))}
        </View>
      )}

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.mergeButton,
            (!canProceedToMerging || selectedLieIndex === null) && styles.mergeButtonDisabled,
          ]}
          onPress={createChallengeWithIndividualVideos}
          disabled={!canProceedToMerging || selectedLieIndex === null}
        >
          <Text style={styles.mergeButtonText}>
            {canProceedToMerging ? 'Create Challenge' : 'Record All Statements First'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // Render recording step
  const renderRecordingStep = () => {
    if (currentRecordingIndex === null) return null;

    return (
      <View style={styles.recordingContainer}>
        <Text style={styles.recordingTitle}>
          Recording Statement {currentRecordingIndex + 1}
        </Text>
        <Text style={styles.recordingStatement}>
          "{statementTexts[currentRecordingIndex]}"
        </Text>

        <MobileCameraRecorder
          statementIndex={currentRecordingIndex}
          onRecordingComplete={handleRecordingComplete}
          onError={(error) => {
            console.error('Recording error:', error);
            Alert.alert('Recording Error', error);
          }}
          onCancel={handleRecordingCancel}
        />
      </View>
    );
  };



  // Render merging step
  const renderMergingStep = () => (
    <View style={styles.mergingContainer}>
      <Text style={styles.mergingTitle}>Creating Your Challenge</Text>
      <Text style={styles.mergingSubtitle}>
        Your videos are being merged on our servers. This may take a few moments.
      </Text>

      <MergeProgressIndicator
        progress={mergeProgress.progress}
        stage={mergeProgress.stage}
        currentStep={mergeProgress.currentStep}
        estimatedTimeRemaining={mergeProgress.estimatedTimeRemaining}
        error={mergeProgress.error}
      />

      {mergeProgress.stage === 'failed' && uploadError && (
        <UploadErrorHandler
          error={uploadError}
          isRetrying={isUploadRetrying}
          retryCount={uploadRetryCount}
          maxRetries={3}
          onRetry={() => {
            clearUploadError();
            startMergeProcess();
          }}
          onCancel={() => {
            clearUploadError();
            setCurrentStep('statements');
            setMergeProgress({
              stage: 'pending',
              progress: 0,
              currentStep: '',
              estimatedTimeRemaining: undefined,
              error: undefined,
            });
          }}
          onSelectNewFile={() => {
            clearUploadError();
            setCurrentStep('statements');
          }}
        />
      )}

      {mergeProgress.stage === 'failed' && !uploadError && (
        <View style={styles.mergeErrorActions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setCurrentStep('statements');
              setMergeProgress({
                stage: 'pending',
                progress: 0,
                currentStep: '',
                estimatedTimeRemaining: undefined,
                error: undefined,
              });
            }}
          >
            <Text style={styles.retryButtonText}>Back to Edit</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Render preview step
  const renderPreviewStep = () => {
    const validRecordings = getValidRecordings;
    const totalDuration = Object.values(validRecordings).reduce((sum, recording) => sum + (recording?.duration || 0), 0);
    const segmentCount = mergeResult?.segmentMetadata?.length || 3;
    
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>🎉 Challenge Created!</Text>
        <Text style={styles.previewSubtitle}>
          Your videos have been successfully merged into a single challenge video.
        </Text>

        <View style={styles.videoInfo}>
          <Text style={styles.videoInfoText}>
            📹 Total Duration: {Math.round(totalDuration / 1000)}s
          </Text>
          <Text style={styles.videoInfoText}>
            🎬 Segments: {segmentCount} statements
          </Text>
          <Text style={styles.videoInfoText}>
            🤥 Lie: Statement {(selectedLieIndex || 0) + 1}
          </Text>
          {mergeResult?.mergedVideoUrl && (
            <Text style={styles.videoInfoText}>
              ✅ Merged Video: Ready for playback
            </Text>
          )}
        </View>

        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={completeChallenge}
          >
            <Text style={styles.completeButtonText}>Complete Challenge</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.backButton, { marginTop: 12 }]}
            onPress={() => setCurrentStep('statements')}
          >
            <Text style={styles.backButtonText}>Back to Edit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render complete step
  const renderCompleteStep = () => (
    <View style={styles.completeContainer}>
      <Text style={styles.completeTitle}>🎉 Challenge Created!</Text>
      <Text style={styles.completeSubtitle}>
        Your challenge has been successfully created and uploaded.
      </Text>
    </View>
  );

  // Main render
  return (
    <View style={styles.mainContainer}>
      {currentStep === 'statements' && renderStatementsStep()}
      {currentStep === 'recording' && renderRecordingStep()}
      {currentStep === 'merging' && renderMergingStep()}
      {currentStep === 'preview' && renderPreviewStep()}
      {currentStep === 'complete' && renderCompleteStep()}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  statementContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statementLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  statementActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lieButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  lieButtonSelected: {
    backgroundColor: '#ff6b6b',
    borderColor: '#ff6b6b',
  },
  lieButtonText: {
    fontSize: 14,
    color: '#666',
  },
  lieButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  recordButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordButtonComplete: {
    backgroundColor: '#51cf66',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
    marginBottom: 4,
  },
  bottomActions: {
    marginTop: 20,
  },
  mergeButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  mergeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  mergeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  recordingContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  recordingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 10,
  },
  recordingStatement: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  mergingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mergingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  mergingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    lineHeight: 22,
  },
  mergeErrorActions: {
    marginTop: 20,
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  previewSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    lineHeight: 22,
  },
  videoInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoInfoText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  previewActions: {
    // gap: 12, // gap is not supported in React Native, use marginBottom instead
  },
  completeButton: {
    backgroundColor: '#51cf66',
    padding: 16,
    borderRadius: 12,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#51cf66',
  },
  completeSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    lineHeight: 24,
  },
});

export default EnhancedChallengeCreation;