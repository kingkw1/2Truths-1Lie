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
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { MobileCameraRecorder } from './MobileCameraRecorder';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';
import {
  startNewChallenge,
  updateStatement,
  setLieStatement,
} from '../store/slices/challengeCreationSlice';



interface EnhancedChallengeCreationProps {
  onChallengeComplete?: (challengeData: any) => void;
  onCancel?: () => void;
}

type CreationStep = 'statements' | 'recording' | 'preview' | 'complete';

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

    };
  }, [dispatch]);

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

    setCurrentStep('preview');
  };

  // Complete challenge creation
  const completeChallenge = () => {
    const validRecordings = getValidRecordings;
    
    const challengeData = {
      ...currentChallenge,
      mediaData: [validRecordings[0], validRecordings[1], validRecordings[2]], // Send individual videos
      lieIndex: selectedLieIndex,
    };

    setCurrentStep('complete');
    onChallengeComplete?.(challengeData);
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



  // Render preview step
  const renderPreviewStep = () => {
    const validRecordings = getValidRecordings;
    const totalDuration = Object.values(validRecordings).reduce((sum, recording) => sum + (recording?.duration || 0), 0);
    const totalSize = Object.values(validRecordings).reduce((sum, recording) => sum + (recording?.fileSize || 0), 0);
    
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewTitle}>Challenge Ready!</Text>
        <Text style={styles.previewSubtitle}>
          Your three statements are ready to be uploaded. The server will merge them automatically.
        </Text>

        <View style={styles.videoInfo}>
          <Text style={styles.videoInfoText}>
            📹 Total Duration: {Math.round(totalDuration / 1000)}s
          </Text>
          <Text style={styles.videoInfoText}>
            💾 Total Size: {(totalSize / (1024 * 1024)).toFixed(1)}MB
          </Text>
          <Text style={styles.videoInfoText}>
            🎬 Videos: {Object.keys(validRecordings).length} statements
          </Text>
          <Text style={styles.videoInfoText}>
            🤥 Lie: Statement {(selectedLieIndex || 0) + 1}
          </Text>
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
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  currentSegmentText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4a90e2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
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