/**
 * FullscreenGuessScreen - Modern fullscreen interface for challenge guessing
 * 
 * This component provides a fullscreen experience for the guess challenge 
 * functionality, featuring:
 * - True fullscreen video playback without UI clutter
 * - Three circular buttons positioned at bottom for thumb-friendly interaction
 * - Tap to play video segments, long-press to submit guess
 * - Immersive black background with minimal header (back button only)
 * - Gesture-based interaction with haptic feedback
 * - Redux integration for game state management
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import HapticsService from '../services/HapticsService';
import { useAppDispatch, useAppSelector } from '../store';
import {
  removeChallenge,
  selectChallenge,
  startGuessingSession,
  submitGuess,
  setGuessResult,
  endGuessingSession,
  clearGuessResult,
} from '../store/slices/guessingGameSlice';
import { selectUser, updateUserScore } from '../store/slices/authSlice';
import { realChallengeAPI } from '../services/realChallengeAPI';
import { FullscreenVideoPlayer } from '../components/FullscreenVideoPlayer';
import { AnimatedFeedback } from '../shared/AnimatedFeedback';
import { EnhancedChallenge, MediaCapture, VideoSegment, GuessResult } from '../types';
import { store } from '../store';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { getApiBaseUrl, makeAuthenticatedRequest } from '../services/tokenAPI';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FullscreenGuessScreenProps {
  challenge: EnhancedChallenge;
  onBack: () => void;
  onComplete?: () => void;
  onRefreshChallenges?: () => void;
}

// Custom hook for long press gesture detection
const useLongPress = (callback: () => void, delay = 600) => { // Reduced from 800ms to 600ms for snappier response
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(new Animated.Value(0)).current; // Separate value for smooth progress

  const startPress = useCallback(() => {
    setIsPressed(true);
    
    // Reset progress and start smooth animation
    progressValue.setValue(0);
    
    // Start smooth progress animation for visual feedback
    Animated.timing(progressValue, {
      toValue: 1,
      duration: delay,
      useNativeDriver: false,
    }).start();

    // Start pulse animation for the button
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 100, // Quick initial feedback
      useNativeDriver: false,
    }).start();

    // Start timer for long press detection
    timerRef.current = setTimeout(() => {
      callback();
      setIsPressed(false);
      progressValue.setValue(0);
      animatedValue.setValue(0);
      
      // Enhanced haptic feedback for successful long press
      HapticsService.triggerImpact('heavy');
    }, delay);
  }, [callback, delay, animatedValue, progressValue]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
    
    // Reset animations smoothly
    Animated.parallel([
      Animated.timing(progressValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [animatedValue, progressValue]);

  return {
    isPressed,
    startPress,
    endPress,
    animatedValue,
    progressValue, // Return progress value for circular indicator
  };
};

export const FullscreenGuessScreen: React.FC<FullscreenGuessScreenProps> = ({
  challenge,
  onBack,
  onComplete,
  onRefreshChallenges,
}) => {
  const dispatch = useAppDispatch();
  const { currentSession, guessSubmitted, guessResult, currentStreak } = useAppSelector(
    (state) => state.guessingGame
  );
  const currentUser = useAppSelector(selectUser);
  const { balance: tokenBalance, refresh: refreshTokenBalance } = useTokenBalance();

  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [disabledStatements, setDisabledStatements] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [finalResult, setFinalResult] = useState<GuessResult | null>(null);
  const [animationResult, setAnimationResult] = useState<GuessResult | null>(null);

  const isOwner = challenge?.creatorId === currentUser?.id;

  const performDelete = async () => {
    if (!challenge?.id) {
      Alert.alert('Error', 'Challenge ID is missing, cannot delete.');
      return;
    }
    try {
      const response = await realChallengeAPI.deleteChallenge(challenge.id);
      if (response.success) {
        Alert.alert('Success', 'Challenge has been deleted.');
        dispatch(removeChallenge(challenge.id));
        onBack(); // Navigate back after deletion
      } else {
        throw new Error(response.error || 'Failed to delete challenge.');
      }
    } catch (error: any) {
      console.error('Error deleting challenge:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred while deleting.');
    }
  };

  const handleDeleteChallenge = () => {
    Alert.alert(
      'Delete Challenge',
      'Are you sure you want to permanently delete this challenge?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ],
      { cancelable: true }
    );
  };

  // Initialize guessing session on mount
  useEffect(() => {
    if (!currentSession) {
      dispatch(selectChallenge(challenge));
      dispatch(startGuessingSession({
        challengeId: challenge.id,
        statements: challenge.statements,
      }));
    }
  }, [challenge, currentSession, dispatch]);

  // Media processing - determine video type and format
  const mediaData = challenge?.mediaData || [];
  const mergedVideo = mediaData.find(media => media.isMergedVideo && media.segments);
  const individualVideos = mediaData.filter(media => !media.isMergedVideo);
  const hasVideo = !!mergedVideo || individualVideos.length === 3;
  
  // Log when challenge screen loads  
  useEffect(() => {
    if (challenge) {
      console.log(`🎯 TIMING_DEBUG: FullscreenGuessScreen loaded challenge ${challenge.id}`);
      console.log(`  Has merged video: ${!!mergedVideo}`);
      console.log(`  Segments: ${mergedVideo?.segments?.length || 0}`);
    }
  }, [challenge, mergedVideo, individualVideos, mediaData]);
  
  // Reduced logging - video data (enable for debugging if needed)
  // console.log('🔥 FULLSCREEN_SCREEN: mediaData count:', mediaData.length, 'hasVideo:', hasVideo);

  // Statement selection and auto-submission handlers
  const handleStatementTap = useCallback((index: number) => {
    if (guessSubmitted) return;
    
    console.log(`🎯 TIMING_DEBUG: Statement ${index} tapped`);
    
    // Validate segment exists for tapped statement
    if (mergedVideo?.segments) {
      const segment = mergedVideo.segments.find(s => s.statementIndex === index);
      if (segment) {
        console.log(`🎯 TIMING_DEBUG: Playing segment ${index}: ${segment.startTime}ms - ${segment.endTime}ms (${segment.duration}ms)`);
      } else {
        console.warn(`⚠️ TIMING_WARNING: No segment found for statement ${index}`);
      }
    }
    
    setSelectedStatement(index);
    setShowVideo(true);

    // Light haptic feedback for tap
    HapticsService.triggerImpact('light');
  }, [guessSubmitted, mergedVideo]);

  const handleStatementLongPress = useCallback(async (index: number) => {
    if (guessSubmitted || isAnimating) return; // Prevent multiple submissions

    console.log(`🔥 FULLSCREEN_SCREEN: Statement ${index + 1} long-pressed - submitting guess`);
    setSelectedStatement(index);
    HapticsService.triggerImpact('heavy');

    // 1. Determine preliminary result for immediate animation
    if (!currentSession) return;

    const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
    const wasCorrect = index === correctStatement;

    const preliminaryResult: GuessResult = {
      sessionId: currentSession.sessionId,
      playerId: currentSession.playerId,
      challengeId: currentSession.challengeId,
      guessedStatement: index,
      correctStatement,
      wasCorrect,
      pointsEarned: wasCorrect ? 10 : 0,
      timeBonus: 0,
      accuracyBonus: 0,
      streakBonus: 0,
      totalScore: wasCorrect ? 10 : 0,
      newAchievements: [],
    };

    // 2. Trigger animation immediately
    setAnimationResult(preliminaryResult);
    setIsAnimating(true);
    dispatch(submitGuess(index)); // Mark as submitted in Redux

    // 3. Handle API call in the background
    try {
      const guessedStatement = currentSession.statements[index];
      const guessedStatementId = guessedStatement?.id || `statement_${index}`;
      
      console.log(`🎯 API_CALL: Submitting guess to backend API in background`);
      const apiResponse = await realChallengeAPI.submitGuess(
        currentSession.challengeId,
        guessedStatementId
      );
      
      if (apiResponse.success && apiResponse.data) {
        const backendResult = apiResponse.data;
        console.log(`✅ API_SUCCESS: Backend response received:`, backendResult);
        
        if (backendResult.points_earned > 0) {
          const currentUser = (store.getState() as any).auth.user;
          if (currentUser) {
            const newScore = (currentUser.score || 0) + backendResult.points_earned;
            dispatch(updateUserScore(newScore));
          }
        }
        
        const realResult: GuessResult = {
          ...preliminaryResult,
          pointsEarned: backendResult.points_earned,
          totalScore: backendResult.points_earned,
        };
        
        setFinalResult(realResult);
      } else {
        console.error(`❌ API_ERROR: Failed to submit guess:`, apiResponse.error);
        setFinalResult(preliminaryResult); // Use preliminary as fallback
      }
    } catch (error) {
      console.error(`❌ GUESS_SUBMISSION_ERROR:`, error);
      setFinalResult(preliminaryResult); // Use preliminary as fallback
    }

    // Refresh challenges in the background
    setTimeout(() => {
      onRefreshChallenges?.();
    }, 500);

  }, [guessSubmitted, currentSession, dispatch, isAnimating, onRefreshChallenges]);

  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    setFinalResult(null);
    dispatch(endGuessingSession());
    onComplete?.();
  }, [dispatch, onComplete]);

  // Handle hint token usage
  const handleUseHint = useCallback(async () => {
    if (tokenBalance <= 0) {
      Alert.alert(
        'Insufficient Tokens',
        'You need at least 1 token to use a hint. Purchase tokens from the store.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Make API request to use hint
      const response = await makeAuthenticatedRequest(`${getApiBaseUrl()}/api/hints/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success) {
        // Update local token balance
        dispatch(updateUserScore((currentUser?.score || 0))); // Trigger token balance refresh

        // Implement 50/50 hint logic - disable one of the two truth statements
        if (!hintUsed && challenge?.statements) {
          const lieIndex = challenge.statements.findIndex(stmt => stmt.isLie);
          const truthIndices = challenge.statements
            .map((stmt, idx) => ({ stmt, idx }))
            .filter(({ stmt }) => !stmt.isLie)
            .map(({ idx }) => idx);

          if (truthIndices.length >= 2) {
            // Randomly disable one of the truth statements
            const randomTruthIndex = truthIndices[Math.floor(Math.random() * truthIndices.length)];
            setDisabledStatements([randomTruthIndex]);
            setHintUsed(true);

            Alert.alert(
              'Hint Used! 💡',
              'One incorrect option has been eliminated.',
              [{ text: 'Got it!' }]
            );

            // Haptic feedback for successful hint
            HapticsService.triggerImpact('medium');
          }
        }

        // Refresh token balance
        await refreshTokenBalance();
      }
    } catch (error: any) {
      console.error('Failed to use hint:', error);
      
      if (error.status === 402) {
        Alert.alert(
          'Insufficient Tokens',
          'You need at least 1 token to use a hint. Purchase tokens from the store.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to use hint. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [tokenBalance, hintUsed, challenge, currentUser, dispatch, refreshTokenBalance]);

  // Statement button component with gesture handling
  const StatementButton: React.FC<{
    index: number;
    isSelected: boolean;
  }> = ({ index, isSelected }) => {
    const pressStartTime = useRef<number>(0);
    const longPressTriggered = useRef<boolean>(false);
    const isDisabled = disabledStatements.includes(index);

    // Create a custom long press handler for this button
    const wrappedLongPressCallback = useCallback(() => {
      longPressTriggered.current = true;
      handleStatementLongPress(index);
    }, [index]);

    const customLongPressHandler = useLongPress(wrappedLongPressCallback, 600); // Reduced delay for snappier response

    return (
      <TouchableOpacity
        style={[
          styles.statementButton,
          isSelected && styles.selectedStatementButton,
          isDisabled && styles.disabledStatementButton,
        ]}
        onPressIn={() => {
          if (isDisabled) return;
          
          pressStartTime.current = Date.now();
          longPressTriggered.current = false;
          customLongPressHandler.startPress();
          
          // Immediate haptic feedback on press start
          HapticsService.triggerImpact('light');
        }}
        onPressOut={() => {
          if (isDisabled) return;
          
          const pressDuration = Date.now() - pressStartTime.current;
          customLongPressHandler.endPress();
          
          // If it was a short press (less than 200ms), trigger tap
          if (pressDuration < 200 && !longPressTriggered.current) {
            handleStatementTap(index);
          }
        }}
        disabled={guessSubmitted || isDisabled}
        activeOpacity={isDisabled ? 1 : 0.8}
      >
        {/* Circular Progress Indicator */}
        <Animated.View
          style={[
            styles.circularProgress,
            {
              opacity: customLongPressHandler.isPressed ? 1 : 0,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.progressCircle,
              {
                transform: [
                  {
                    rotate: customLongPressHandler.progressValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.progressArc} />
          </Animated.View>
        </Animated.View>

        {/* Button glow effect during press */}
        <Animated.View
          style={[
            styles.buttonGlow,
            {
              opacity: customLongPressHandler.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.6],
              }),
              transform: [{
                scale: customLongPressHandler.animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.05],
                }),
              }],
            },
          ]}
        />
        
        {/* Statement number */}
        <Text style={[
          styles.statementNumber,
          isSelected && styles.selectedStatementNumber,
        ]}>
          {index + 1}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Hide status bar for true fullscreen experience */}
      <StatusBar hidden />
      
      {/* Minimal header with back button and statement indicator */}
      <SafeAreaView style={styles.header}>
        <View style={styles.headerControls}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={handleDeleteChallenge} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Statement indicator bubble at top */}
        {selectedStatement !== null && !guessSubmitted && (
          <View style={styles.topStatementIndicator}>
            <Text style={styles.topStatementText}>
              Statement {selectedStatement + 1}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Full-screen video container */}
      <View style={styles.videoContainer}>
        {hasVideo && showVideo && (
          <FullscreenVideoPlayer
            mergedVideo={mergedVideo}
            segments={mergedVideo?.segments}
            individualVideos={individualVideos}
            selectedSegment={selectedStatement ?? undefined}
            autoPlay={true}
          />
        )}
        
        {/* Placeholder when no video is playing */}
        {(!hasVideo || !showVideo) && (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>
              {hasVideo ? 'Tap a number to watch' : 'Audio-only challenge'}
            </Text>
            <Text style={styles.creatorText}>By {challenge.creatorName}</Text>
          </View>
        )}
      </View>

      {/* Bottom statement selector buttons */}
      <View style={styles.bottomControls}>
        {/* Hint button */}
        {!guessSubmitted && !hintUsed && (
          <View style={styles.hintContainer}>
            <TouchableOpacity
              style={[
                styles.hintButton,
                tokenBalance <= 0 && styles.hintButtonDisabled
              ]}
              onPress={handleUseHint}
              disabled={tokenBalance <= 0}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.hintButtonText,
                tokenBalance <= 0 && styles.hintButtonTextDisabled
              ]}>
                Use Hint (🪙1)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statementButtonsContainer}>
          <StatementButton
            index={0}
            isSelected={selectedStatement === 0}
          />
          <StatementButton
            index={1}
            isSelected={selectedStatement === 1}
          />
          <StatementButton
            index={2}
            isSelected={selectedStatement === 2}
          />
        </View>
        
        {/* Enhanced instruction text - consolidated to single line */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            {guessSubmitted 
              ? 'Challenge complete!' 
              : hintUsed 
                ? 'One incorrect option eliminated • Tap to watch • Hold to select'
                : 'Tap to watch • Hold to select and submit'
            }
          </Text>
        </View>
      </View>

      {/* Results Modal */}
      {isModalVisible && (
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsContainer}>
            {finalResult ? (
              <>
                <Text style={[
                  styles.resultText,
                  finalResult.wasCorrect ? styles.correctText : styles.incorrectText
                ]}>
                  {finalResult.wasCorrect ? '🎉 Correct!' : '❌ Wrong!'}
                </Text>
                <Text style={styles.lieRevealText}>
                  The lie was statement {finalResult.correctStatement + 1}
                </Text>
                <Text style={styles.scoreText}>
                  +{finalResult.totalScore} points
                </Text>
                <TouchableOpacity
                  style={styles.playAgainButton}
                  onPress={handleCloseModal}
                >
                  <Text style={styles.playAgainText}>Back to Challenges</Text>
                </TouchableOpacity>
              </>
            ) : (
              <ActivityIndicator size="large" color="#007AFF" />
            )}
          </View>
        </View>
      )}

      {/* Animated feedback for streaks and achievements */}
      {isAnimating && animationResult && (
        <AnimatedFeedback
          result={animationResult}
          currentStreak={currentStreak}
          showStreakAnimation={currentStreak > 1}
          onAnimationComplete={() => {
            setIsAnimating(false);
            setIsModalVisible(true);
            setAnimationResult(null); // Clean up animation state
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // True black for immersive experience
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 24,
  },
  topStatementIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 70,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  topStatementText: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  creatorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  statementButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 15,
  },
  statementButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  selectedStatementButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
  },
  progressRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  statementNumber: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  selectedStatementNumber: {
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  instructionContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  resultsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  resultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 40,
    maxWidth: 300,
  },
  resultText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  correctText: {
    color: '#34C759',
  },
  incorrectText: {
    color: '#FF3B30',
  },
  lieRevealText: {
    fontSize: 18,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
    marginBottom: 25,
  },
  playAgainButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  playAgainText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Enhanced circular progress indicator styles
  circularProgress: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    top: -5,
    left: -5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressArc: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#4CAF50', // Green progress color
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-90deg' }], // Start from top
  },
  buttonGlow: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    top: -3,
    left: -3,
  },
  // Hint button styles
  hintContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  hintButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)', // Green background
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  hintButtonDisabled: {
    backgroundColor: 'rgba(128, 128, 128, 0.5)', // Gray when disabled
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hintButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  hintButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  // Disabled statement button style
  disabledStatementButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 0.5,
  },
});

export default FullscreenGuessScreen;
