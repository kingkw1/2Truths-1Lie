import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StoreProvider } from './src/store/StoreProvider';
import { GameScreen } from './src/screens/GameScreen';
import { ChallengeCreationScreen } from './src/screens/ChallengeCreationScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type Screen = 'game' | 'create' | 'home';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  // Lock screen orientation to portrait
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        console.log('📱 Screen orientation locked to portrait');
      } catch (error) {
        console.warn('Failed to lock screen orientation:', error);
      }
    };
    
    lockOrientation();
    
    // Cleanup function to unlock orientation when component unmounts
    return () => {
      ScreenOrientation.unlockAsync().catch(console.warn);
    };
  }, []);

  console.log('=== APP LOADING ===');
  console.log('If you see this in Expo logs, logging is working!');

  if (currentScreen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>2 Truths & 1 Lie</Text>
        <Text style={styles.subtitle}>What would you like to do?</Text>
        
        <TouchableOpacity 
          style={[styles.menuButton, styles.primaryButton]} 
          onPress={() => setCurrentScreen('game')}
        >
          <Text style={styles.menuButtonIcon}>🎮</Text>
          <Text style={styles.menuButtonText}>Guess Challenges</Text>
          <Text style={styles.menuButtonDescription}>Play existing challenges and test your detective skills</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.menuButton, styles.secondaryButton]} 
          onPress={() => setCurrentScreen('create')}
        >
          <Text style={styles.menuButtonIcon}>🎬</Text>
          <Text style={styles.menuButtonText}>Create Challenge</Text>
          <Text style={styles.menuButtonDescription}>Record your own two truths and a lie</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (currentScreen === 'game') {
    return (
      <View style={styles.fullScreen}>
        <GameScreen 
          hideCreateButton={true} 
          onBack={() => setCurrentScreen('home')}
        />
      </View>
    );
  }

  if (currentScreen === 'create') {
    return (
      <View style={styles.fullScreen}>
        <ChallengeCreationScreen 
          onComplete={() => {
            // Automatically navigate back to home screen after challenge creation
            setCurrentScreen('home');
          }}
          onCancel={() => {
            // Navigate back to home screen on cancel
            setCurrentScreen('home');
          }}
        />
      </View>
    );
  }

  return null;
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    color: '#666',
  },
  menuButton: {
    backgroundColor: '#007AFF',
    padding: 25,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  secondaryButton: {
    backgroundColor: '#FF9500',
  },
  menuButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  menuButtonDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
});
