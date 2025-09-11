import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { StoreProvider } from './src/store/StoreProvider';
import { GameScreen } from './src/screens/GameScreen';
import { ChallengeCreationScreen } from './src/screens/ChallengeCreationScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type Screen = 'game' | 'create' | 'home';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

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
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.backText}>← Back to Menu</Text>
        </TouchableOpacity>
        <GameScreen hideCreateButton={true} />
      </View>
    );
  }

  if (currentScreen === 'create') {
    return (
      <View style={styles.fullScreen}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.backText}>← Back to Menu</Text>
        </TouchableOpacity>
        <ChallengeCreationScreen />
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
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
  },
  backText: {
    color: 'white',
    fontSize: 16,
  },
});
