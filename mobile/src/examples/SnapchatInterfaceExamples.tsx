/**
 * Demo Usage of Snapchat-Inspired Guess Challenge Interface
 * 
 * This file demonstrates how to integrate the new fullscreen, 
 * Snapchat-style guess challenge interface into your app.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GameScreen } from '../screens/GameScreen';
import SnapchatGuessScreen from '../screens/SnapchatGuessScreen';

// Example 1: Using the new interface within GameScreen
export const ModernGameScreenExample = () => {
  return (
    <View style={styles.container}>
      {/* GameScreen with Snapchat interface enabled (default) */}
      <GameScreen 
        hideCreateButton={true}
        useSnapchatInterface={true} // Enable new fullscreen interface
        onBack={() => console.log('Navigate back to home')}
      />
    </View>
  );
};

// Example 2: Using the traditional interface 
export const TraditionalGameScreenExample = () => {
  return (
    <View style={styles.container}>
      {/* GameScreen with traditional interface */}
      <GameScreen 
        hideCreateButton={false}
        useSnapchatInterface={false} // Use traditional interface
        onBack={() => console.log('Navigate back to home')}
      />
    </View>
  );
};

// Example 3: Direct usage of SnapchatGuessScreen component
export const DirectSnapchatInterfaceExample = () => {
  // Example challenge data structure
  const exampleChallenge = {
    id: 'example-challenge',
    creatorId: 'user-123', 
    creatorName: 'John Doe',
    statements: [
      {
        id: 'stmt-1',
        text: 'I once traveled to 15 countries in one year',
        isLie: false,
        viewCount: 100,
        guessAccuracy: 60,
        averageConfidence: 70,
      },
      {
        id: 'stmt-2', 
        text: 'I can speak 5 languages fluently',
        isLie: true, // This is the lie
        viewCount: 120,
        guessAccuracy: 40,
        averageConfidence: 55,
      },
      {
        id: 'stmt-3',
        text: 'I have a pet parrot that knows 50 words',
        isLie: false,
        viewCount: 90,
        guessAccuracy: 75,
        averageConfidence: 80,
      },
    ],
    mediaData: [
      {
        type: 'video' as const,
        streamingUrl: 'https://example.com/video1.mp4',
        duration: 15000,
        mediaId: 'media-1',
        isUploaded: true,
      },
      {
        type: 'video' as const,
        streamingUrl: 'https://example.com/video2.mp4', 
        duration: 12000,
        mediaId: 'media-2',
        isUploaded: true,
      },
      {
        type: 'video' as const,
        streamingUrl: 'https://example.com/video3.mp4',
        duration: 18000,
        mediaId: 'media-3', 
        isUploaded: true,
      },
    ],
    difficultyRating: 65,
    averageGuessTime: 25000,
    popularityScore: 85,
    emotionComplexity: 60,
    recommendationWeight: 0.8,
    totalGuesses: 150,
    correctGuessRate: 0.45,
    createdAt: '2024-01-15T10:30:00Z',
    lastPlayed: '2024-01-20T15:45:00Z',
    tags: ['travel', 'languages', 'pets'],
    isActive: true,
  };

  return (
    <View style={styles.container}>
      <SnapchatGuessScreen
        challenge={exampleChallenge}
        onBack={() => console.log('Navigate back to challenge list')}
        onComplete={() => console.log('Challenge completed')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Black background for immersive experience
  },
});

/**
 * KEY FEATURES OF THE NEW INTERFACE:
 * 
 * 1. FULLSCREEN IMMERSIVE EXPERIENCE
 *    - True fullscreen video display with no borders or padding
 *    - Black background for cinematic feel
 *    - Hidden status bar for maximum immersion
 * 
 * 2. SNAPCHAT-STYLE INTERACTION
 *    - Three circular buttons at bottom (1, 2, 3)
 *    - Tap to play video statement
 *    - Long-press to auto-submit guess
 *    - Haptic feedback for touch interactions
 * 
 * 3. GESTURE-DRIVEN DESIGN
 *    - Long-press detection with visual progress ring
 *    - Smooth animations and transitions
 *    - Touch-friendly controls optimized for mobile
 * 
 * 4. MINIMAL UI ELEMENTS
 *    - Clean header with only back button
 *    - No extraneous buttons or debugging info
 *    - Controls hidden unless needed
 *    - Results overlay only when game complete
 * 
 * 5. MODERN MOBILE UX
 *    - Thumb-friendly bottom positioning
 *    - Large touch targets (80px circular buttons)
 *    - Intuitive visual feedback
 *    - Adaptive to screen sizes
 * 
 * USAGE NOTES:
 * - Set useSnapchatInterface={true} in GameScreen for new interface
 * - Set useSnapchatInterface={false} for traditional interface  
 * - Direct SnapchatGuessScreen usage requires challenge data
 * - All guess submission and scoring logic is handled automatically
 * - Supports both merged videos with segments and individual videos
 */

export default {
  ModernGameScreenExample,
  TraditionalGameScreenExample, 
  DirectSnapchatInterfaceExample,
};
