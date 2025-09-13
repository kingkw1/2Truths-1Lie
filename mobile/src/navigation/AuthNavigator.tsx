/**
 * Authentication Navigator
 * Handles navigation between login and signup screens
 * Enhanced with improved transitions and guest user migration
 */

import React, { useEffect, useState } from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { AuthStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { Alert } from 'react-native';

const Stack = createStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { refreshAuth, user, isGuest, exitAuthFlow } = useAuth();
  const [hasShownGuestMigrationPrompt, setHasShownGuestMigrationPrompt] = useState(false);

  // Enhanced auth success handler with guest user migration
  const handleAuthSuccess = async () => {
    console.log('🔄 Auth success - refreshing auth state');
    
    // If user was a guest, show migration success message
    if (isGuest && user && !hasShownGuestMigrationPrompt) {
      setHasShownGuestMigrationPrompt(true);
      Alert.alert(
        'Account Created!',
        'Your guest progress has been saved to your new account. Welcome!',
        [{ text: 'Continue', style: 'default' }]
      );
    }
    
    // Refresh auth state to trigger navigation update
    await refreshAuth();
  };

  // Handler to go back to main app as guest
  const handleBackToMainApp = () => {
    console.log('📱 Returning to main app as guest');
    // Exit the auth flow and return to main app
    exitAuthFlow();
  };

  // Enhanced navigation handlers with better UX
  const handleNavigateToSignup = (navigation: any) => {
    console.log('📱 Navigating to Signup');
    navigation.navigate('Signup');
  };

  const handleNavigateToLogin = (navigation: any) => {
    console.log('📱 Navigating to Login');
    navigation.navigate('Login');
  };

  const handleBackToLogin = (navigation: any) => {
    console.log('📱 Going back to Login');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  };

  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#fff' },
        // Enhanced transitions for auth screens
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
      initialRouteName="Login"
    >
      <Stack.Screen 
        name="Login"
        options={{
          // Smooth entry animation for login
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
        }}
      >
        {({ navigation, route }) => (
          <LoginScreen
            onLoginSuccess={handleAuthSuccess}
            onNavigateToSignup={() => handleNavigateToSignup(navigation)}
            onBack={handleBackToMainApp}
            initialEmail={route.params?.email}
            guestMigration={route.params?.guestMigration || isGuest}
            returnTo={route.params?.returnTo}
          />
        )}
      </Stack.Screen>
      <Stack.Screen 
        name="Signup"
        options={{
          // Slide transition for signup
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          gestureEnabled: true,
        }}
      >
        {({ navigation, route }) => (
          <SignupScreen
            onSignupSuccess={handleAuthSuccess}
            onNavigateToLogin={() => handleNavigateToLogin(navigation)}
            onBack={handleBackToMainApp}
            initialEmail={route.params?.email}
            guestMigration={route.params?.guestMigration || isGuest}
            returnTo={route.params?.returnTo}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};