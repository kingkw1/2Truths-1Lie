/**
 * Authentication Guard Components
 * Provides conditional rendering and protection for authenticated/guest users
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
  showGuestPrompt?: boolean;
  onAuthPrompt?: () => void;
}

/**
 * General purpose auth guard that can protect content or show fallbacks
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  requireAuth = false,
  showGuestPrompt = false,
  onAuthPrompt,
}) => {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If auth is required and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.authRequiredContainer}>
        <Text style={styles.authRequiredTitle}>Sign In Required</Text>
        <Text style={styles.authRequiredText}>
          Please sign in to access this feature
        </Text>
        {onAuthPrompt && (
          <TouchableOpacity style={styles.signInButton} onPress={onAuthPrompt}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show guest prompt if user is guest and prompt is enabled
  if (showGuestPrompt && isGuest && onAuthPrompt) {
    return (
      <View style={styles.container}>
        {children}
        <View style={styles.guestPromptContainer}>
          <Text style={styles.guestPromptText}>
            Sign in to save your progress and compete with friends
          </Text>
          <TouchableOpacity style={styles.guestPromptButton} onPress={onAuthPrompt}>
            <Text style={styles.guestPromptButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
};

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onAuthRequired?: () => void;
}

/**
 * Strict auth guard that requires authentication
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({
  children,
  fallback,
  onAuthRequired,
}) => {
  return (
    <AuthGuard
      requireAuth={true}
      fallback={fallback}
      onAuthPrompt={onAuthRequired}
    >
      {children}
    </AuthGuard>
  );
};

interface GuestOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Guard that only shows content for guest users
 */
export const GuestOnly: React.FC<GuestOnlyProps> = ({
  children,
  fallback,
}) => {
  const { isGuest, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isGuest) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

interface AuthenticatedOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Guard that only shows content for authenticated users
 */
export const AuthenticatedOnly: React.FC<AuthenticatedOnlyProps> = ({
  children,
  fallback,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

interface ConditionalAuthContentProps {
  authenticated?: React.ReactNode;
  guest?: React.ReactNode;
  loading?: React.ReactNode;
}

/**
 * Conditional rendering based on auth state
 */
export const ConditionalAuthContent: React.FC<ConditionalAuthContentProps> = ({
  authenticated,
  guest,
  loading,
}) => {
  const { isAuthenticated, isGuest, isLoading } = useAuth();

  if (isLoading) {
    return loading ? <>{loading}</> : (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (isAuthenticated) {
    return authenticated ? <>{authenticated}</> : null;
  }

  if (isGuest) {
    return guest ? <>{guest}</> : null;
  }

  return null;
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
    fontSize: 16,
    color: '#666',
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
  guestPromptContainer: {
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    padding: 16,
    alignItems: 'center',
  },
  guestPromptText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  guestPromptButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
  },
  guestPromptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});