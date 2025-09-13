/**
 * AuthToggleButton Component
 * A unified button that toggles between Sign In and Sign Out based on authentication state.
 * Uses session tracking to persist login state even after guest session overrides.
 * Positioned at the top to avoid Android navigation bar conflicts.
 */

import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';

// Global variable to track login success across component re-renders
let globalLoginSuccessDetected = false;
let loginInterceptorSet = false;

interface AuthToggleButtonProps {
  onAuthAction: () => void; // Called when user needs to sign in (logout to show auth flow) or sign out
  style?: any; // Additional styles
  compact?: boolean; // If true, shows a more compact version
}

export const AuthToggleButton: React.FC<AuthToggleButtonProps> = ({
  onAuthAction,
  style,
  compact = false,
}) => {
  const { user, isAuthenticated, isGuest, isLoading, triggerAuthFlow, logout } = useAuth();
  const [hasLoggedInThisSession, setHasLoggedInThisSession] = useState(false);

  // Check if user has logged in this session
  useEffect(() => {
    const checkSessionLogin = async () => {
      try {
        const sessionLogin = await AsyncStorage.getItem('hasLoggedInThisSession');
        const lastLoginEmail = await AsyncStorage.getItem('lastLoginEmail');
        setHasLoggedInThisSession(sessionLogin === 'true');
      } catch (error) {
        console.error('Error checking session login status:', error);
      }
    };
    checkSessionLogin();
  }, []);

  // Listen for successful logins (when user object gets a real email)
  useEffect(() => {
    const checkForSuccessfulLogin = async () => {
      if (user?.email && !user.email.includes('guest_') && !hasLoggedInThisSession) {
        // User has a real email, mark as logged in this session
        console.log('🎉 Real user login detected, marking session as authenticated:', user.email);
        setHasLoggedInThisSession(true);
        await AsyncStorage.setItem('hasLoggedInThisSession', 'true');
        await AsyncStorage.setItem('lastLoginEmail', user.email);
        await AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
      }
    };
    checkForSuccessfulLogin();
  }, [user?.email, hasLoggedInThisSession]);

    // Add a global event listener to catch login success messages
  useEffect(() => {
    // Check if we already have a login success stored from this session
    const checkStoredLogin = async () => {
      try {
        const sessionLogin = await AsyncStorage.getItem('hasLoggedInThisSession');
        const lastLoginTime = await AsyncStorage.getItem('lastLoginTime');
        
        // If we have a recent login (within last 10 minutes), keep the session active
        if (sessionLogin === 'true' && lastLoginTime) {
          const loginTime = new Date(lastLoginTime);
          const now = new Date();
          const diffMinutes = (now.getTime() - loginTime.getTime()) / (1000 * 60);
          
          if (diffMinutes < 10) {
            setHasLoggedInThisSession(true);
            return;
          }
        }

        // Check global flag
        if (globalLoginSuccessDetected && !hasLoggedInThisSession) {
          setHasLoggedInThisSession(true);
          await AsyncStorage.setItem('hasLoggedInThisSession', 'true');
          await AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
        }
      } catch (error) {
        console.error('Error checking stored login:', error);
      }
    };
    
    checkStoredLogin();

    // Only set up console.log interceptor once
    if (!loginInterceptorSet) {
      loginInterceptorSet = true;
      
      // Store original console.log
      const originalConsoleLog = console.log;
      
      // Intercept console.log to detect login success messages
      // This is necessary because the auth system immediately invalidates 
      // successful logins with guest session overrides
      const interceptConsoleLog = (...args: any[]) => {
        // Call original console.log first
        originalConsoleLog.apply(console, args);
        
        // Check for login success message
        const message = args.join(' ');
        if (message.includes('✅ Login successful for user:')) {
          const emailMatch = message.match(/✅ Login successful for user: (.+)/);
          if (emailMatch && emailMatch[1]) {
            const loginEmail = emailMatch[1];
            
            // Set global flag
            globalLoginSuccessDetected = true;
            
            // Store in AsyncStorage immediately
            AsyncStorage.setItem('hasLoggedInThisSession', 'true');
            AsyncStorage.setItem('lastLoginEmail', loginEmail);
            AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
          }
        }
      };

      // Override console.log globally
      console.log = interceptConsoleLog;
    }
  }, [hasLoggedInThisSession]);

  // Periodic check for global login success flag
  useEffect(() => {
    const interval = setInterval(() => {
      if (globalLoginSuccessDetected && !hasLoggedInThisSession) {
        setHasLoggedInThisSession(true);
        AsyncStorage.setItem('hasLoggedInThisSession', 'true');
        AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
        globalLoginSuccessDetected = false; // Reset flag
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [hasLoggedInThisSession]);

  // Alternative approach: Watch for auth state changes that indicate successful login
  useEffect(() => {
    // If we detect a successful login through auth state changes
    if (user?.email && !user.email.includes('guest_') && !hasLoggedInThisSession) {
      setHasLoggedInThisSession(true);
      AsyncStorage.setItem('hasLoggedInThisSession', 'true');
      AsyncStorage.setItem('lastLoginEmail', user.email);
      AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
    }
  }, [user?.email, hasLoggedInThisSession]);

  // Determine button state: show "Sign Out" if user has logged in this session AND is not a guest
  const showSignOut = hasLoggedInThisSession && !isGuest;
  const showSignIn = !showSignOut;
  
  console.log('📱 AuthToggleButton: Button state:', { 
    hasLoggedInThisSession, 
    isGuest, 
    showSignOut, 
    showSignIn,
    userEmail: user?.email 
  });

  const handlePress = async () => {
    try {
      if (showSignOut) {
        // User wants to sign out - clear session and logout directly
        console.log('📱 AuthToggleButton: Handling sign out...');
        setHasLoggedInThisSession(false);
        await AsyncStorage.removeItem('hasLoggedInThisSession');
        await AsyncStorage.removeItem('lastLoginEmail');
        await AsyncStorage.removeItem('lastLoginTime');
        // Use logout from useAuth directly instead of onAuthAction
        await logout();
      } else {
        // User wants to sign in - use triggerAuthFlow
        console.log('📱 AuthToggleButton: Handling sign in...');
        triggerAuthFlow();
      }
    } catch (error) {
      console.error('📱 AuthToggleButton: Error in handlePress:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer, style]}>
        <Text style={[styles.loadingText, compact && styles.compactText]}>...</Text>
      </View>
    );
  }

  const buttonText = showSignIn ? 'Sign In' : 'Sign Out';
  const buttonIcon = showSignIn ? '🔐' : '🚪';

  return (
          <Pressable
        style={[
          styles.button,
          compact ? styles.compactButton : null,
          showSignOut ? styles.signOutButton : styles.signInButton,
        ]}
        onPress={handlePress}
      >
      {!compact && <Text style={styles.buttonIcon}>{buttonIcon}</Text>}
      <Text style={[styles.buttonText, compact && styles.compactButtonText]}>
        {buttonText}
      </Text>
      {!compact && showSignIn && (
        <Text style={styles.subText}>Save progress</Text>
      )}
      {!compact && showSignOut && (
        <Text style={styles.subText}>Signed in</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  compactContainer: {
    padding: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
  },
  signInButton: {
    backgroundColor: '#007AFF',
  },
  signOutButton: {
    backgroundColor: '#ff4444',
  },
  buttonIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  compactButtonText: {
    fontSize: 14,
  },
  subText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  compactText: {
    fontSize: 14,
  },
});