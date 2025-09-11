/**
 * Snapchat-Inspired Guess Challenge Screen
 * 
 * Features:
 * - Full-screen immersive video display
 * - Minimal UI with no borders, padding, or cards
 * - Three circular statement selector buttons at bottom
 * - Tap to play video, long-press to auto-submit guess
 * - Gesture-driven interaction (tap/hold)
 * - Modern thumb-friendly mobile interface
 * - Clean header with back navigation only
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
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '../store';
import {
  selectChallenge,
  startGuessingSession,
  submitGuess,
  setGuessResult,
  endGuessingSession,
  clearGuessResult,
} from '../store/slices/guessingGameSlice';
import { FullscreenVideoPlayer } from '../components/FullscreenVideoPlayer';
import { AnimatedFeedback } from '../shared/AnimatedFeedback';
import { EnhancedChallenge, MediaCapture, VideoSegment, GuessResult } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SnapchatGuessScreenProps {
  challenge: EnhancedChallenge;
  onBack: () => void;
  onComplete?: () => void;
}

// Custom hook for long press gesture detection
const useLongPress = (callback: () => void, delay = 800) => {
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

  const startPress = useCallback(() => {
    setIsPressed(true);
    
    // Start animation for visual feedback
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: delay,
      useNativeDriver: false,
    }).start();

    // Start timer for long press detection
    timerRef.current = setTimeout(() => {
      callback();
      setIsPressed(false);
      animatedValue.setValue(0);
      
      // Haptic feedback for successful long press
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, delay);
  }, [callback, delay, animatedValue]);

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPressed(false);
    animatedValue.setValue(0);
  }, [animatedValue]);

  return {
    isPressed,
    startPress,
    endPress,
    animatedValue,
  };
};

export const SnapchatGuessScreen: React.FC<SnapchatGuessScreenProps> = ({
  challenge,
  onBack,
  onComplete,
}) => {
  const dispatch = useAppDispatch();
  const { currentSession, guessSubmitted, guessResult, currentStreak } = useAppSelector(
    (state) => state.guessingGame
  );

  const [selectedStatement, setSelectedStatement] = useState<number | null>(null);
  const [showVideo, setShowVideo] = useState(false);

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

  // Statement selection and auto-submission handlers
  const handleStatementTap = useCallback((index: number) => {
    if (guessSubmitted) return;
    
    console.log(`🔥 SNAPCHAT_SCREEN: Statement ${index + 1} tapped - playing video only`);
    setSelectedStatement(index);
    setShowVideo(true);

    // Light haptic feedback for tap
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [guessSubmitted]);

  const handleStatementLongPress = useCallback((index: number) => {
    if (guessSubmitted) return;
    
    console.log(`🔥 SNAPCHAT_SCREEN: Statement ${index + 1} long-pressed - submitting guess`);
    setSelectedStatement(index);
    
    // Submit guess automatically on long press
    dispatch(submitGuess(index));

    // Handle guess result
    setTimeout(() => {
      if (!currentSession) return;
      
      const correctStatement = currentSession.statements.findIndex((stmt: any) => stmt.isLie);
      const wasCorrect = index === correctStatement;

      const mockResult: GuessResult = {
        sessionId: currentSession.sessionId,
        playerId: currentSession.playerId,
        challengeId: currentSession.challengeId,
        guessedStatement: index,
        correctStatement,
        wasCorrect,
        pointsEarned: wasCorrect ? 100 : 0,
        timeBonus: 20,
        accuracyBonus: wasCorrect ? 30 : 0,
        streakBonus: wasCorrect ? 10 : 0,
        totalScore: wasCorrect ? 160 : 0,
        newAchievements: wasCorrect ? ['first_correct_guess'] : [],
      };

      dispatch(setGuessResult(mockResult));
      
      // Automatically proceed to completion after showing result
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    }, 1500);

    // Strong haptic feedback for submission
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [guessSubmitted, currentSession, dispatch, onComplete]);

  const handleNewGame = useCallback(() => {
    dispatch(endGuessingSession());
    onBack();
  }, [dispatch, onBack]);

  // Statement button component with gesture handling
  const StatementButton: React.FC<{
    index: number;
    isSelected: boolean;
  }> = ({ index, isSelected }) => {
    const pressStartTime = useRef<number>(0);
    const longPressTriggered = useRef<boolean>(false);

    // Create a custom long press handler for this button
    const wrappedLongPressCallback = useCallback(() => {
      longPressTriggered.current = true;
      handleStatementLongPress(index);
    }, [index]);

    const customLongPressHandler = useLongPress(wrappedLongPressCallback, 800);

    return (
      <TouchableOpacity
        style={[
          styles.statementButton,
          isSelected && styles.selectedStatementButton,
        ]}
        onPressIn={() => {
          pressStartTime.current = Date.now();
          longPressTriggered.current = false;
          customLongPressHandler.startPress();
        }}
        onPressOut={() => {
          const pressDuration = Date.now() - pressStartTime.current;
          customLongPressHandler.endPress();
          
          // If it was a short press (less than 300ms), trigger tap
          if (pressDuration < 300 && !longPressTriggered.current) {
            handleStatementTap(index);
          }
        }}
        disabled={guessSubmitted}
        activeOpacity={0.8}
      >
        {/* Long press progress ring animation */}
        <Animated.View
          style={[
            styles.progressRing,
            {
              borderColor: customLongPressHandler.animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['transparent', '#ffffff'],
              }),
              transform: [{
                scale: customLongPressHandler.animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
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
      
      {/* Minimal header with only back button */}
      <SafeAreaView style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
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
        
        {/* Instruction text */}
        <Text style={styles.instructionText}>
          {guessSubmitted 
            ? 'Challenge complete!' 
            : 'Tap to watch • Hold to guess'
          }
        </Text>
      </View>

      {/* Results feedback overlay */}
      {guessResult && (
        <View style={styles.resultsOverlay}>
          <View style={styles.resultsContainer}>
            <Text style={[
              styles.resultText,
              guessResult.wasCorrect ? styles.correctText : styles.incorrectText
            ]}>
              {guessResult.wasCorrect ? '🎉 Correct!' : '❌ Wrong!'}
            </Text>
            <Text style={styles.lieRevealText}>
              The lie was statement {guessResult.correctStatement + 1}
            </Text>
            <Text style={styles.scoreText}>
              +{guessResult.totalScore} points
            </Text>
            
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={handleNewGame}
            >
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Animated feedback for streaks and achievements */}
      {guessResult && (
        <AnimatedFeedback
          result={guessResult}
          currentStreak={currentStreak}
          showStreakAnimation={currentStreak > 1}
          onAnimationComplete={() => {
            dispatch(clearGuessResult());
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
});

export default SnapchatGuessScreen;
