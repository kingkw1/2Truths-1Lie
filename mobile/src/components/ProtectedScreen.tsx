/**
 * Protected Screen Wrapper
 * Wraps screens that require authentication or show different content for guests
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthGuard, RequireAuth, ConditionalAuthContent } from './AuthGuard';
import { useAuth } from '../hooks/useAuth';

interface ProtectedScreenProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  showGuestWarning?: boolean;
  guestWarningMessage?: string;
  onAuthRequired?: () => void;
}

/**
 * Wrapper for screens that need auth protection or guest warnings
 */
export const ProtectedScreen: React.FC<ProtectedScreenProps> = ({
  children,
  requireAuth = false,
  showGuestWarning = false,
  guestWarningMessage = "Sign in to save your progress and access all features",
  onAuthRequired,
}) => {
  const { logout } = useAuth();

  const handleAuthRequired = () => {
    if (onAuthRequired) {
      onAuthRequired();
    } else {
      // Default behavior: logout to trigger auth flow
      logout();
    }
  };

  if (requireAuth) {
    return (
      <RequireAuth
        onAuthRequired={handleAuthRequired}
        fallback={
          <View style={styles.authRequiredContainer}>
            <Text style={styles.authRequiredTitle}>Authentication Required</Text>
            <Text style={styles.authRequiredText}>
              Please sign in to access this feature
            </Text>
            <TouchableOpacity 
              style={styles.signInButton} 
              onPress={handleAuthRequired}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        }
      >
        {children}
      </RequireAuth>
    );
  }

  if (showGuestWarning) {
    return (
      <AuthGuard
        showGuestPrompt={true}
        onAuthPrompt={handleAuthRequired}
      >
        <View style={styles.container}>
          <ConditionalAuthContent
            guest={
              <View style={styles.guestWarningContainer}>
                <Text style={styles.guestWarningText}>
                  {guestWarningMessage}
                </Text>
              </View>
            }
          />
          {children}
        </View>
      </AuthGuard>
    );
  }

  return <>{children}</>;
};

interface AuthStatusBannerProps {
  showForGuests?: boolean;
  showForAuthenticated?: boolean;
  guestMessage?: string;
  authenticatedMessage?: string;
  onAuthAction?: () => void;
}

/**
 * Banner component that shows auth status and actions
 */
export const AuthStatusBanner: React.FC<AuthStatusBannerProps> = ({
  showForGuests = true,
  showForAuthenticated = false,
  guestMessage = "Sign in to save your progress",
  authenticatedMessage = "Signed in successfully",
  onAuthAction,
}) => {
  const { user, isGuest, logout } = useAuth();

  const handleAuthAction = () => {
    if (onAuthAction) {
      onAuthAction();
    } else if (isGuest) {
      logout(); // Trigger auth flow
    }
  };

  return (
    <ConditionalAuthContent
      guest={
        showForGuests ? (
          <View style={styles.bannerContainer}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerText}>{guestMessage}</Text>
              <TouchableOpacity 
                style={styles.bannerButton} 
                onPress={handleAuthAction}
              >
                <Text style={styles.bannerButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null
      }
      authenticated={
        showForAuthenticated ? (
          <View style={[styles.bannerContainer, styles.authenticatedBanner]}>
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerText, styles.authenticatedBannerText]}>
                {authenticatedMessage}
              </Text>
              <Text style={styles.userEmailBanner}>{user?.email}</Text>
            </View>
          </View>
        ) : null
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authRequiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  authRequiredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  authRequiredText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  guestWarningContainer: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffeaa7',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  guestWarningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  bannerContainer: {
    backgroundColor: '#e3f2fd',
    borderBottomWidth: 1,
    borderBottomColor: '#bbdefb',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  authenticatedBanner: {
    backgroundColor: '#e8f5e8',
    borderBottomColor: '#c8e6c9',
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 14,
    color: '#1976d2',
    flex: 1,
  },
  authenticatedBannerText: {
    color: '#2e7d32',
  },
  bannerButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  bannerButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  userEmailBanner: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '500',
  },
});