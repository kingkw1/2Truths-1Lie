/**
 * LoginScreen Integration Example
 * 
 * This file demonstrates how to integrate the LoginScreen into the main App.tsx
 * navigation flow. This is an example implementation that shows the integration
 * pattern without modifying the actual App.tsx file.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { LoginScreen } from '../screens/LoginScreen';
import { authService } from '../services/authService';

type Screen = 'home' | 'login' | 'signup' | 'game' | 'create';

const AppWithAuthIntegration: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated
  React.useEffect(() => {
    const checkAuthStatus = () => {
      const user = authService.getCurrentUser();
      const token = authService.getAuthToken();
      
      // Consider user authenticated if they have both user data and a non-guest token
      const isAuth = user && token && !token.startsWith('local_guest_token_');
      setIsAuthenticated(!!isAuth);
    };

    checkAuthStatus();
  }, []);

  const handleLoginSuccess = () => {
    console.log('✅ Login successful, updating auth state');
    setIsAuthenticated(true);
    setCurrentScreen('home');
  };

  const handleLogout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setCurrentScreen('home');
  };

  const renderAuthenticatedHome = () => (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>2 Truths & 1 Lie</Text>
      <Text style={styles.subtitle}>Welcome back! You're signed in.</Text>
      
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

      <TouchableOpacity 
        style={[styles.menuButton, styles.logoutButton]} 
        onPress={handleLogout}
      >
        <Text style={styles.menuButtonIcon}>🚪</Text>
        <Text style={styles.menuButtonText}>Sign Out</Text>
        <Text style={styles.menuButtonDescription}>Return to guest mode</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const renderGuestHome = () => (
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

      {/* Auth Options */}
      <View style={styles.authSection}>
        <Text style={styles.authSectionTitle}>Account Options</Text>
        
        <TouchableOpacity 
          style={[styles.menuButton, styles.authButton]} 
          onPress={() => setCurrentScreen('login')}
        >
          <Text style={styles.menuButtonIcon}>🔐</Text>
          <Text style={styles.menuButtonText}>Sign In</Text>
          <Text style={styles.menuButtonDescription}>Access your account and saved challenges</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.menuButton, styles.authButton]} 
          onPress={() => setCurrentScreen('signup')}
        >
          <Text style={styles.menuButtonIcon}>✨</Text>
          <Text style={styles.menuButtonText}>Create Account</Text>
          <Text style={styles.menuButtonDescription}>Sign up to save your progress</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Screen routing
  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSignup={() => setCurrentScreen('signup')}
        onBack={() => setCurrentScreen('home')}
      />
    );
  }

  if (currentScreen === 'signup') {
    return (
      <View style={styles.fullScreen}>
        <Text style={styles.placeholderText}>SignupScreen would go here</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'game') {
    return (
      <View style={styles.fullScreen}>
        <Text style={styles.placeholderText}>GameScreen would go here</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentScreen === 'create') {
    return (
      <View style={styles.fullScreen}>
        <Text style={styles.placeholderText}>ChallengeCreationScreen would go here</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentScreen('home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Home screen - show different content based on auth status
  return isAuthenticated ? renderAuthenticatedHome() : renderGuestHome();
};

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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  authButton: {
    backgroundColor: '#007AFF',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
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
  authSection: {
    marginTop: 30,
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  authSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AppWithAuthIntegration;