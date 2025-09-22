/**
 * Authentication Navigator
 * Handles navigation between login and signup screens
 * Enhanced with improved        {({ navigation }) => (
          <SignupScreen
            onSignupSuccess={handleSignupSuccess}
            onNavigateToLogin={() => handleNavigateToLogin(navigation)}
            onBack={() => handleBackToLogin(navigation)}
          />
        )}ns and guest user migration
 */

import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { AuthStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { Alert } from 'react-native';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  const { refreshAuth, user, isGuest, exitAuthFlow } = useAuth();
  const [hasShownGuestMigrationPrompt, setHasShownGuestMigrationPrompt] = useState(false);

  // Enhanced auth success handler for LOGIN (no account created message)
  const handleLoginSuccess = async () => {
    console.log('🔄 Login success - refreshing auth state');
    
    // Refresh auth state to trigger navigation update
    await refreshAuth();
  };

  // Enhanced auth success handler for SIGNUP (with account created message)
  const handleSignupSuccess = async () => {
    console.log('🔄 Signup success - refreshing auth state');
    
    // For new account signup, show welcome message
    if (user && !hasShownGuestMigrationPrompt) {
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
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
      }}
      initialRouteName="Login"
    >
      <Stack.Screen 
        name="Login"
        options={{
          animation: 'fade_from_bottom',
        }}
      >
        {({ navigation, route }) => (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
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
          animation: 'slide_from_right',
        }}
      >
        {({ navigation, route }) => (
          <SignupScreen
            onSignupSuccess={handleSignupSuccess}
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