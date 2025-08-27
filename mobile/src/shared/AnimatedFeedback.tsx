/**
 * Animated Feedback Component - React Native Version
 * Provides visual feedback animations for correct/incorrect guesses and streaks
 * Relates to Requirements 1, 2, 4: Core Game Loop, Progress Feedback, Social Interaction
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GuessResult } from '../types';

interface AnimatedFeedbackProps {
  result: GuessResult | null | undefined;
  onAnimationComplete?: () => void;
  showStreakAnimation?: boolean;
  currentStreak?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const AnimatedFeedback: React.FC<AnimatedFeedbackProps> = ({
  result,
  onAnimationComplete,
  showStreakAnimation = false,
  currentStreak = 0
}) => {
  // Early return if no result
  if (!result) {
    console.log('🎬 AnimatedFeedback: No result provided, not rendering');
    return null;
  }
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'result' | 'score' | 'streak' | 'complete'>('initial');
  const [scoreCounter, setScoreCounter] = useState(0);
  const animationStartedRef = useRef(false);
  const stableResultRef = useRef(result);

  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scoreScaleAnim = useRef(new Animated.Value(0.8)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(Array.from({length: 8}, () => new Animated.Value(0))).current;

  // Lock in the result when animation first starts
  useEffect(() => {
    if (!animationStartedRef.current) {
      stableResultRef.current = result;
      animationStartedRef.current = true;
    }
  }, []);

  // Use the stable result for all animations
  const stableResult = stableResultRef.current;

  useEffect(() => {
    console.log('🎬 AnimatedFeedback component mounted with result:', stableResult);
    const sequence = async () => {
      // Haptic feedback
      if (Platform.OS === 'ios') {
        if (stableResult.wasCorrect) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }

      // Phase 1: Fade in background
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Phase 2: Bounce in icon (100ms delay)
      setTimeout(() => {
        setAnimationPhase('result');
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start();

        // Shake animation for incorrect answers
        if (!stableResult.wasCorrect) {
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          ]).start();
        }
      }, 100);

      // Phase 3: Show score (600ms)
      setTimeout(() => {
        setAnimationPhase('score');
        animateScore();
        
        // Animate score scale
        Animated.spring(scoreScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }).start();

        // Particle effects for correct answers
        if (stableResult.wasCorrect) {
          animateParticles();
        }
      }, 600);

      // Phase 4: Show streak animation if applicable (2600ms)
      if (showStreakAnimation && currentStreak > 1) {
        setTimeout(() => {
          setAnimationPhase('streak');
        }, 2600);
      }

      // Phase 5: Complete animation
      setTimeout(() => {
        setAnimationPhase('complete');
        onAnimationComplete?.();
      }, showStreakAnimation && currentStreak > 1 ? 3600 : 2600);
    };

    sequence();
  }, [stableResult, showStreakAnimation, currentStreak, onAnimationComplete]);

  const animateScore = () => {
    const duration = 1000;
    const steps = 30;
    const increment = stableResult.totalScore / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= stableResult.totalScore) {
        setScoreCounter(stableResult.totalScore);
        clearInterval(timer);
      } else {
        setScoreCounter(Math.floor(current));
      }
    }, duration / steps);
  };

  const animateParticles = () => {
    const animations = particleAnims.map((anim, index) => 
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    );
    
    Animated.parallel(animations).start();
  };

  const getResultIcon = () => {
    if (stableResult.wasCorrect) {
      return currentStreak > 1 ? '🔥' : '🎉';
    }
    return '🤔';
  };

  const getResultMessage = () => {
    if (stableResult.wasCorrect) {
      if (currentStreak > 1) {
        return `${currentStreak} in a row!`;
      }
      return 'Correct!';
    }
    return 'Not quite!';
  };

  const getResultColor = () => {
    return stableResult.wasCorrect ? '#059669' : '#DC2626';
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* Result Icon */}
        <Animated.View style={[
          styles.iconContainer,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim },
              { translateX: shakeAnim }
            ]
          }
        ]}>
          <Text style={styles.resultIcon}>{getResultIcon()}</Text>
        </Animated.View>

        {/* Result Message */}
        {animationPhase !== 'initial' && (
          <Animated.View style={[
            styles.messageContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}>
            <Text style={[styles.resultMessage, { color: getResultColor() }]}>
              {getResultMessage()}
            </Text>
          </Animated.View>
        )}

        {/* Score Display */}
        {(animationPhase === 'score' || animationPhase === 'streak' || animationPhase === 'complete') && (
          <Animated.View style={[
            styles.scoreContainer,
            { transform: [{ scale: scoreScaleAnim }] }
          ]}>
            <Text style={styles.scoreDisplay}>
              +{scoreCounter.toLocaleString()} points
            </Text>
            
            {/* Score Breakdown */}
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Base</Text>
                <Text style={styles.scoreValue}>+{stableResult.pointsEarned}</Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Time</Text>
                <Text style={styles.scoreValue}>+{stableResult.timeBonus}</Text>
              </View>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>Accuracy</Text>
                <Text style={styles.scoreValue}>+{stableResult.accuracyBonus}</Text>
              </View>
              {stableResult.streakBonus > 0 && (
                <View style={styles.scoreItem}>
                  <Text style={styles.scoreLabel}>Streak</Text>
                  <Text style={styles.scoreValue}>+{stableResult.streakBonus}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Streak Animation */}
        {animationPhase === 'streak' && showStreakAnimation && currentStreak > 1 && (
          <View style={styles.streakContainer}>
            <Text style={styles.streakText}>
              🔥 {currentStreak} STREAK! 🔥
            </Text>
          </View>
        )}

        {/* Achievement Notifications */}
        {stableResult.newAchievements && stableResult.newAchievements.length > 0 && 
         (animationPhase === 'complete' || animationPhase === 'streak') && (
          <View style={styles.achievementContainer}>
            <Text style={styles.achievementTitle}>
              🏆 New Achievement{stableResult.newAchievements.length > 1 ? 's' : ''}!
            </Text>
            {stableResult.newAchievements.map((achievement, index) => (
              <View key={achievement} style={styles.achievementItem}>
                <Text style={styles.achievementText}>
                  ✨ {achievement.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Level Up Animation */}
        {stableResult.levelUp && (animationPhase === 'complete' || animationPhase === 'streak') && (
          <View style={styles.levelUpContainer}>
            <Text style={styles.levelUpTitle}>🎊 LEVEL UP! 🎊</Text>
            <Text style={styles.levelUpText}>
              Level {stableResult.levelUp.oldLevel} → {stableResult.levelUp.newLevel}
            </Text>
          </View>
        )}

        {/* Particle Effects */}
        {stableResult.wasCorrect && particleAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                transform: [
                  {
                    translateX: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.cos((index * 45) * Math.PI / 180) * 100],
                    }),
                  },
                  {
                    translateY: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin((index * 45) * Math.PI / 180) * 100],
                    }),
                  },
                  { scale: anim },
                ],
                opacity: anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 1, 0],
                }),
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: screenWidth * 0.8,
    padding: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  resultIcon: {
    fontSize: 80,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 20,
  },
  resultMessage: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  scoreDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  scoreBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  scoreItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  streakContainer: {
    marginVertical: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  streakText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  achievementContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: 10,
    textAlign: 'center',
  },
  achievementItem: {
    marginVertical: 5,
    padding: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 15,
  },
  achievementText: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
  },
  levelUpContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
    borderRadius: 10,
    alignItems: 'center',
  },
  levelUpTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 5,
    textAlign: 'center',
  },
  levelUpText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
  },
});

export default AnimatedFeedback;