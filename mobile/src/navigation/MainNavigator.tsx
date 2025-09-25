/**
 * Main App Navigator
 * Handles navigation between main app screens (Home, Game, Create, Account)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameScreen } from '../screens/GameScreen';
import { StoreScreen } from '../screens/StoreScreen';
import AccountScreen from '../screens/AccountScreen'; // Import AccountScreen
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import { MainStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { AuthGuard } from '../components/AuthGuard';

const Stack = createNativeStackNavigator<MainStackParamList>();

interface MainNavigatorProps {
  onLogout: () => void;
}

const HomeScreen: React.FC<{ navigation: any; onLogout: () => void }> = ({ navigation, onLogout }) => {
  const { user, isAuthenticated, isGuest, triggerAuthFlow } = useAuth();
  const { balance, loading: isLoading, error, refresh: refreshTokenBalance } = useTokenBalance();

  useFocusEffect(
    React.useCallback(() => {
      refreshTokenBalance();
    }, [refreshTokenBalance])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>2 Truths & 1 Lie</Text>
          </View>
          
          <View style={styles.headerRight}>
            {!isLoading && balance > 0 && (
              <Pressable
                style={styles.tokenBalance}
                onPress={() => navigation.navigate('Store')}
              >
                <Text style={styles.tokenIcon}>🪙</Text>
                <Text style={styles.tokenBalanceText}>{balance}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Profile Card */}
        <Pressable
          style={styles.profileCard}
          onPress={() => navigation.navigate('Account')}
        >
          <Text style={styles.welcomeText}>
            Welcome, {user?.name || 'Guest'}!
          </Text>
          <Text style={styles.profileCardIcon}>〉</Text>
        </Pressable>
        
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
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuButton, styles.secondaryButton]}
            onPress={() => {
              if (!isAuthenticated || isGuest) {
                Alert.alert(
                  'Sign In Required',
                  'Please sign in to create a challenge',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign In', style: 'default', onPress: triggerAuthFlow },
                  ]
                );
                return;
              }
              navigation.navigate('Create');
            }}
          >
            <Text style={styles.menuButtonIcon}>🎬</Text>
            <Text style={styles.menuButtonText}>Create Challenge</Text>
            <Text style={styles.menuButtonDescription}>
              Record your own two truths and a lie
            </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
};

export const MainNavigator: React.FC<MainNavigatorProps> = ({ onLogout }) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
        animation: 'slide_from_right',
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
      <Stack.Screen name="Account" component={AccountScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'left',
    color: '#333',
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 15,
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  profileCardIcon: {
    fontSize: 20,
    color: '#888',
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
  tokenBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tokenIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tokenBalanceText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});