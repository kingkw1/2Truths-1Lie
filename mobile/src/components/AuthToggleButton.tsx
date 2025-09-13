/**
 * AuthToggleButton Component
 * A unified button that toggles between Sign In and Sign Out based on authentication state
 * Positioned at the top to avoid Android navigation bar conflicts
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

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
  const { user, isAuthenticated, isGuest, isLoading, triggerAuthFlow } = useAuth();

  const handlePress = () => {
    if (isGuest) {
      // Directly trigger auth flow for guests
      console.log('🔄 User requested sign in from toggle button - using triggerAuthFlow');
      triggerAuthFlow();
    } else {
      // Directly trigger sign out for authenticated users
      console.log('🔄 User signed out from toggle button');
      onAuthAction();
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.compactContainer, style]}>
        <Text style={[styles.loadingText, compact && styles.compactText]}>...</Text>
      </View>
    );
  }

  const buttonText = isGuest ? 'Sign In' : 'Sign Out';
  const buttonIcon = isGuest ? '🔐' : '🚪';

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        compact && styles.compactButton,
        isGuest ? styles.signInButton : styles.signOutButton,
        style,
      ]}
      disabled={isLoading}
    >
      {!compact && <Text style={styles.buttonIcon}>{buttonIcon}</Text>}
      <Text style={[styles.buttonText, compact && styles.compactButtonText]}>
        {buttonText}
      </Text>
      {!compact && isGuest && (
        <Text style={styles.subText}>Save progress</Text>
      )}
      {!compact && !isGuest && user?.email && (
        <Text style={styles.subText}>{user.email}</Text>
      )}
    </TouchableOpacity>
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