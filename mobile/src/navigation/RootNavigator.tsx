/**
 * Root Navigator
 * Manages navigation between authenticated and unauthenticated states
 * Enhanced with improved auth transitions and deep linking support
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { RootStackParamList } from './types';
import { useAuth } from '../hooks/useAuth';
import { navigationManager } from './navigationUtils';
import { AuthProvider } from '../components/AuthProvider';
import { View, ActivityIndicator, StyleSheet, Text, Animated } from 'react-native';

const Stack = createStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <AuthProvider>
      <RootNavigatorContent />
    </AuthProvider>
  );
};

const RootNavigatorContent: React.FC = () => {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

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
        <ActivityIndicator size="large" color="#007AFF" />
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
            cardStyle: { backgroundColor: '#fff' },
            // Enhanced transition animations for auth flows
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        >
          {isAuthenticated ? (
            <Stack.Screen 
              name="Main"
              options={{
                // Smooth transition when entering authenticated state
                cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
              }}
            >
              {() => <MainNavigator onLogout={logout} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen 
              name="Auth"
              options={{
                // Smooth transition when entering auth state
                cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});