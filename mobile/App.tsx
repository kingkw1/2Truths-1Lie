import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { StoreProvider } from './src/store/StoreProvider';
import { GameScreen } from './src/screens/GameScreen';
import { ChallengeCreationScreen } from './src/screens/ChallengeCreationScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type Screen = 'game' | 'create' | 'test';

const AppContent: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('test');

  console.log('=== APP LOADING ===');
  console.log('If you see this in Expo logs, logging is working!');

  const testBackendConnection = async () => {
    try {
      console.log('🔄 Testing backend connection...');
      const response = await fetch('http://192.168.50.111:8000/health');
      console.log('📡 Health endpoint status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🏥 Health check result:', data);
        console.log('✅ Backend is ready for full app testing!');
      }
    } catch (err) {
      console.error('❌ Backend connection test failed:', err);
    }
  };

  if (currentScreen === 'test') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>2 Truths & 1 Lie</Text>
        <Text style={styles.subtitle}>Choose App Mode</Text>
        
        <TouchableOpacity style={styles.button} onPress={testBackendConnection}>
          <Text style={styles.buttonText}>Test Backend Connection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={() => setCurrentScreen('game')}
        >
          <Text style={styles.buttonText}>🎮 Enter Game Mode</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => setCurrentScreen('create')}
        >
          <Text style={styles.buttonText}>📹 Create Challenge Mode</Text>
        </TouchableOpacity>
        
        <Text style={styles.info}>
          This is the full app with Redux store, video players, and backend integration.
          {'\n\n'}Upload services are temporarily disabled to prevent FormData issues.
        </Text>
      </SafeAreaView>
    );
  }

  if (currentScreen === 'game') {
    return (
      <View style={styles.fullScreen}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('test')}
        >
          <Text style={styles.backText}>← Back to Menu</Text>
        </TouchableOpacity>
        <GameScreen />
      </View>
    );
  }

  if (currentScreen === 'create') {
    return (
      <View style={styles.fullScreen}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setCurrentScreen('test')}
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
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#34C759',
  },
  secondaryButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
  info: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
  },
});
