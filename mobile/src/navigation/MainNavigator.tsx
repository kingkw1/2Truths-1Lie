/**
 * Main App Navigator
 * Handles navigation between main app screens (Home, Game, Create)
 */

import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { GameScreen } from '../screens/GameScreen';
import { StoreScreen } from '../screens/StoreScreen';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import { MainStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { ConditionalAuthContent, AuthGuard } from '../components/AuthGuard';
import { AuthToggleButton } from '../components/AuthToggleButton';

const Stack = createStackNavigator<MainStackParamList>();

interface MainNavigatorProps {
  onLogout: () => void;
}

const HomeScreen: React.FC<{ navigation: any; onLogout: () => void }> = ({ navigation, onLogout }) => {
  const { user, isAuthenticated, isGuest, triggerAuthFlow } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>2 Truths & 1 Lie</Text>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>
            Welcome, {user?.name || 'Guest'}!
          </Text>
          
          <AuthToggleButton 
            onAuthAction={onLogout}
            style={styles.authToggleButton}
          />
        </View>
      </View>
      
      <Text style={styles.subtitle}>What would you like to do?</Text>
      
      <AuthGuard
        showGuestPrompt={isGuest}
        onAuthPrompt={onLogout}
      >
        <TouchableOpacity 
          style={[styles.menuButton, styles.primaryButton]} 
          onPress={() => navigation.navigate('Game')}
        >
          <Text style={styles.menuButtonIcon}>🎮</Text>
          <Text style={styles.menuButtonText}>Guess Challenges</Text>
          <Text style={styles.menuButtonDescription}>
            Play existing challenges and test your detective skills
          </Text>
          {isGuest && (
            <Text style={styles.guestModeText}>Playing as guest</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.menuButton, styles.secondaryButton]} 
          onPress={() => {
            console.log('🎯 CREATE_BUTTON: Create Challenge button pressed in HomeScreen');
            console.log('🎯 CREATE_BUTTON: Auth state:', { isAuthenticated, isGuest });
            
            if (!isAuthenticated || isGuest) {
              console.log('🚨 CREATE_BUTTON: Blocking guest user - showing auth popup');
              Alert.alert(
                'Sign In Required',
                'Please sign in to create a challenge',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Sign In',
                    style: 'default',
                    onPress: () => {
                      console.log('🎯 CREATE_BUTTON: Navigating to auth...');
                      triggerAuthFlow();
                    },
                  },
                ]
              );
              return;
            }
            
            console.log('✅ CREATE_BUTTON: User authenticated - navigating to Create');
            navigation.navigate('Create');
          }}
        >
          <Text style={styles.menuButtonIcon}>🎬</Text>
          <Text style={styles.menuButtonText}>Create Challenge</Text>
          <Text style={styles.menuButtonDescription}>
            Record your own two truths and a lie
          </Text>
          {isGuest && (
            <Text style={styles.guestModeText}>Progress won't be saved</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: '#AF52DE' }]}
          onPress={() => navigation.navigate('Store')}
        >
          <Text style={styles.menuButtonIcon}>🛍️</Text>
          <Text style={styles.menuButtonText}>Store</Text>
          <Text style={styles.menuButtonDescription}>
            Purchase premium features
          </Text>
        </TouchableOpacity>
      </AuthGuard>
    </SafeAreaView>
  );
};

export const MainNavigator: React.FC<MainNavigatorProps> = ({ onLogout }) => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
        // Enhanced transitions for main app screens
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
      initialRouteName="Home"
    >
      <Stack.Screen name="Home">
        {({ navigation }) => (
          <HomeScreen navigation={navigation} onLogout={onLogout} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Game">
        {({ navigation }) => (
          <View style={styles.fullScreen}>
            <GameScreen 
              hideCreateButton={true} 
              onBack={() => navigation.goBack()}
            />
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Create">
        {({ navigation }) => (
          <View style={styles.fullScreen}>
            <ChallengeCreationScreen 
              onComplete={() => navigation.goBack()}
              onCancel={() => navigation.goBack()}
            />
          </View>
        )}
      </Stack.Screen>
      <Stack.Screen name="Store" component={StoreScreen} />
    </Stack.Navigator>
  );
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
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  authToggleButton: {
    marginTop: 8,
  },
  guestModeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
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