/**
 * Main App Navigator
 * Handles navigation between main app screens (Home, Game, Create, Account)
 */

import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Pressable } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameScreen } from '../screens/GameScreen';
import { StoreScreen } from '../screens/StoreScreen';
import AccountScreen from '../screens/AccountScreen'; // Import AccountScreen
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import { MainStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { AuthGuard } from '../components/AuthGuard';
import { realChallengeAPI } from '../services/realChallengeAPI';

const Stack = createNativeStackNavigator<MainStackParamList>();

// Placeholder for ChangePasswordScreen
const ChangePasswordScreen: React.FC = () => (
  <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Change Password Screen</Text>
  </SafeAreaView>
);

interface MainNavigatorProps {
  onLogout: () => void;
}

interface HomeScreenProps {
  navigation: any;
  onLogout: () => void;
  styles: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, onLogout, styles }) => {
  const { user, isAuthenticated, isGuest, triggerAuthFlow } = useAuth();
  const { balance, loading: isLoading, error, refresh: refreshTokenBalance } = useTokenBalance();
  const { isPremium } = usePremiumStatus();

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
          onPress={() => {
            if (isGuest || !isAuthenticated) {
              triggerAuthFlow();
            } else {
              navigation.navigate('Account');
            }
          }}
        >
          <Text style={styles.welcomeText}>
            {isGuest || !isAuthenticated
              ? 'Sign In to Your Account'
              : `Welcome, ${user?.name}${isPremium ? ' 🕵️' : ''}! (🏆 ${user?.score ?? 0})`}
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
            onPress={async () => {
              console.log('🚨🚨🚨 MAIN_NAV: CREATE CHALLENGE BUTTON CLICKED! 🚨🚨🚨');
              console.log('🔍 MAIN_NAV: Debug info - isAuthenticated:', isAuthenticated, 'isGuest:', isGuest);
              
              if (!isAuthenticated || isGuest) {
                console.log('🚨 MAIN_NAV: Blocking guest - showing auth popup');
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

              console.log('✅ MAIN_NAV: User authenticated, checking creation status...');
              console.log('🔍 MAIN_NAV: isPremium check - isPremium:', isPremium);

              // Check premium status from RevenueCat
              if (isPremium) {
                console.log('✅ MAIN_NAV: Premium user - proceeding to creation');
                navigation.navigate('Create');
                return;
              }

              // Non-premium user, check API
              console.log('🔍 MAIN_NAV: Non-premium user, calling API to check creation status...');
              try {
                console.log('🔍 MAIN_NAV: Calling realChallengeAPI.getCreationStatus()...');
                const response = await realChallengeAPI.getCreationStatus();
                console.log('🔍 MAIN_NAV: API response received:', JSON.stringify(response));
                
                if (response.success && response.data?.canCreate) {
                  console.log('✅ MAIN_NAV: Non-premium user has creations left - proceeding');
                  navigation.navigate('Create');
                } else {
                  console.log('🚫 MAIN_NAV: Non-premium user has no creations left - showing paywall');
                  console.log('🚫 MAIN_NAV: Response data:', JSON.stringify(response.data));
                  Alert.alert(
                    'Creation Limit Reached',
                    'You have used all your free challenge creations. Upgrade to "Pro" for unlimited creations!',
                    [
                      { text: 'Later', style: 'cancel' },
                      {
                        text: 'Upgrade to Pro',
                        onPress: () => {
                          console.log('🛒 MAIN_NAV: Navigating to store screen...');
                          navigation.navigate('Store');
                        },
                      },
                    ]
                  );
                }
              } catch (error) {
                console.error('❌ MAIN_NAV: Error checking creation status:', error);
                Alert.alert(
                  'Error',
                  'Could not check your creation status. Please try again later.'
                );
              }
            }}
          >
            <Text style={styles.menuButtonIcon}>🎬</Text>
            <Text style={styles.menuButtonText}>Create Challenge</Text>
            <Text style={styles.menuButtonDescription}>
              Record your own two truths and a lie
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuButton, styles.tertiaryButton]}
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
  const { colors } = useContext(ThemeContext);
  const styles = getStyles(colors);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName="Home"
    >
      <Stack.Screen name="Home">
        {({ navigation }) => (
          <HomeScreen navigation={navigation} onLogout={onLogout} styles={styles} />
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
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 15,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcomeText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  profileCardIcon: {
    fontSize: 20,
    color: colors.placeholder,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    color: colors.text,
    opacity: 0.7,
  },
  menuButton: {
    backgroundColor: colors.primary,
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
    backgroundColor: colors.success,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  tertiaryButton: {
    backgroundColor: colors.tertiary,
  },
  menuButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuButtonText: {
    color: colors.card,
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
    backgroundColor: colors.success,
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
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },
});