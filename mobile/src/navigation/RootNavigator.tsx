/**
 * Root Navigator
 * Manages navigation between authenticated and unauthenticated states
 * Enhanced with improved auth transitions and deep linking support
 */

import React, { useEffect, useRef, useContext } from 'react';
import { NavigationContainer, NavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthNavigator } from './AuthNavigator';
import { ThemeContext } from '../context/ThemeContext';
import { MainNavigator } from './MainNavigator';
import { RootStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { navigationManager } from './navigationUtils';
import { AuthProvider } from '../components/AuthProvider';
import { View, ActivityIndicator, StyleSheet, Text, Animated } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <AuthProvider>
      <RootNavigatorContent />
    </AuthProvider>
  );
};

const RootNavigatorContent: React.FC = () => {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { theme, colors } = useContext(ThemeContext);
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const styles = getStyles(colors);

  const navigationTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  // Initialize navigation manager
  useEffect(() => {
    if (navigationRef) {
      navigationManager.setNavigationRef(navigationRef);
    }
  }, []);

  // Update navigation state when auth changes
  useEffect(() => {
    navigationManager.updateNavigationState({
      isAuthenticated,
      currentRoute: isAuthenticated ? 'Main' : 'Auth',
    });

    // Handle auth transitions
    if (!isLoading) {
      navigationManager.handleAuthTransition({
        from: isAuthenticated ? 'unauthenticated' : 'authenticated',
        to: isAuthenticated ? 'authenticated' : 'unauthenticated',
        preserveState: true,
        showWelcome: isAuthenticated && !!user,
      });
    }
  }, [isAuthenticated, isLoading, user]);

  // Enhanced loading state with fade animation
  useEffect(() => {
    if (isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 0.7,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, fadeAnim]);

  // Enhanced loading screen with user context
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {user ? 'Signing you in...' : 'Loading...'}
        </Text>
        {user && (
          <Text style={styles.loadingSubtext}>
            Welcome back, {user.name}!
          </Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onStateChange={(state) => {
        // Enhanced navigation state logging for debugging
        console.log('Navigation state changed:', state?.routes?.[0]?.name);
      }}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Stack.Navigator
          id={undefined}
          screenOptions={{
            headerShown: false,
            // contentStyle is now handled by the navigation theme
            animation: 'slide_from_right',
          }}
        >
          {isAuthenticated ? (
            <Stack.Screen 
              name="Main"
              options={{
                // Native stack animation options
                animation: 'fade_from_bottom',
              }}
            >
              {() => <MainNavigator onLogout={logout} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen 
              name="Auth"
              options={{
                // Native stack animation options
                animation: 'slide_from_bottom',
              }}
            >
              {() => <AuthNavigator />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </Animated.View>
    </NavigationContainer>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.text,
    opacity: 0.8,
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: colors.text,
    opacity: 0.6,
    textAlign: 'center',
  },
});