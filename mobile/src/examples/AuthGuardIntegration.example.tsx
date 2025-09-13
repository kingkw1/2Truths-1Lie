/**
 * Auth Guard Integration Examples
 * Demonstrates how to use auth guards in different scenarios
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  AuthGuard,
  RequireAuth,
  GuestOnly,
  AuthenticatedOnly,
  ConditionalAuthContent,
} from '../components/AuthGuard';
import { ProtectedScreen, AuthStatusBanner } from '../components/ProtectedScreen';
import { useAuth } from '../hooks/useAuth';

// Example 1: Basic screen with guest prompts
const ExampleGameScreen: React.FC = () => {
  const { logout } = useAuth();

  const handleAuthPrompt = () => {
    logout(); // Trigger auth flow
  };

  return (
    <ProtectedScreen showGuestWarning={true}>
      <View style={styles.container}>
        <AuthStatusBanner
          showForGuests={true}
          guestMessage="Sign in to save your game progress"
          onAuthAction={handleAuthPrompt}
        />
        
        <Text style={styles.title}>Game Screen</Text>
        
        <AuthGuard showGuestPrompt={true} onAuthPrompt={handleAuthPrompt}>
          <TouchableOpacity style={styles.gameButton}>
            <Text style={styles.gameButtonText}>Start Game</Text>
          </TouchableOpacity>
        </AuthGuard>

        <ConditionalAuthContent
          guest={
            <View style={styles.guestInfo}>
              <Text style={styles.guestInfoText}>
                Playing as guest - progress won't be saved
              </Text>
            </View>
          }
          authenticated={
            <View style={styles.userInfo}>
              <Text style={styles.userInfoText}>
                Progress will be saved to your account
              </Text>
            </View>
          }
        />
      </View>
    </ProtectedScreen>
  );
};

// Example 2: Screen that requires authentication
const ExampleProfileScreen: React.FC = () => {
  const { logout } = useAuth();

  return (
    <RequireAuth onAuthRequired={() => logout()}>
      <View style={styles.container}>
        <Text style={styles.title}>User Profile</Text>
        <Text>This content is only visible to authenticated users</Text>
        
        <AuthenticatedOnly>
          <TouchableOpacity style={styles.button} onPress={logout}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </AuthenticatedOnly>
      </View>
    </RequireAuth>
  );
};

// Example 3: Screen with different content for different user types
const ExampleHomeScreen: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Welcome to the App</Text>
      
      <ConditionalAuthContent
        guest={
          <View style={styles.guestSection}>
            <Text style={styles.sectionTitle}>Guest Mode</Text>
            <Text style={styles.sectionText}>
              You're browsing as a guest. Sign in to unlock all features!
            </Text>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={() => logout()}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        }
        authenticated={
          <View style={styles.userSection}>
            <Text style={styles.sectionTitle}>Welcome back, {user?.name}!</Text>
            <Text style={styles.sectionText}>
              All your progress is being saved automatically.
            </Text>
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={logout}
            >
              <Text style={styles.secondaryButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Features</Text>
        
        <TouchableOpacity style={styles.featureButton}>
          <Text style={styles.featureButtonText}>🎮 Play Games</Text>
          <ConditionalAuthContent
            guest={<Text style={styles.featureNote}>Available in guest mode</Text>}
            authenticated={<Text style={styles.featureNote}>Progress saved</Text>}
          />
        </TouchableOpacity>

        <AuthGuard
          requireAuth={false}
          showGuestPrompt={true}
          onAuthPrompt={() => logout()}
        >
          <TouchableOpacity style={styles.featureButton}>
            <Text style={styles.featureButtonText}>🏆 Leaderboards</Text>
            <ConditionalAuthContent
              guest={<Text style={styles.featureNote}>Sign in to compete</Text>}
              authenticated={<Text style={styles.featureNote}>Compete with friends</Text>}
            />
          </TouchableOpacity>
        </AuthGuard>

        <RequireAuth onAuthRequired={() => logout()}>
          <TouchableOpacity style={styles.featureButton}>
            <Text style={styles.featureButtonText}>👤 Profile Settings</Text>
            <Text style={styles.featureNote}>Authenticated users only</Text>
          </TouchableOpacity>
        </RequireAuth>
      </View>

      <GuestOnly>
        <View style={styles.guestOnlySection}>
          <Text style={styles.sectionTitle}>New User?</Text>
          <Text style={styles.sectionText}>
            Create an account to save your progress and compete with friends!
          </Text>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => logout()}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </GuestOnly>
    </ScrollView>
  );
};

// Example 4: Complex screen with multiple auth states
const ExampleChallengeScreen: React.FC = () => {
  const { user, isGuest, logout } = useAuth();

  return (
    <View style={styles.container}>
      <AuthStatusBanner
        showForGuests={true}
        showForAuthenticated={true}
        guestMessage="Sign in to save your challenges"
        authenticatedMessage="Signed in successfully"
      />

      <Text style={styles.title}>Create Challenge</Text>

      <AuthGuard showGuestPrompt={isGuest} onAuthPrompt={() => logout()}>
        <View style={styles.challengeForm}>
          <Text style={styles.formLabel}>Challenge Title</Text>
          {/* Form inputs would go here */}
          
          <ConditionalAuthContent
            guest={
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Guest Mode: Your challenge will be created but won't be saved to your account
                </Text>
              </View>
            }
            authenticated={
              <View style={styles.successBox}>
                <Text style={styles.successText}>
                  ✅ Your challenge will be saved to your account
                </Text>
              </View>
            }
          />

          <TouchableOpacity style={styles.submitButton}>
            <Text style={styles.submitButtonText}>Create Challenge</Text>
          </TouchableOpacity>
        </View>
      </AuthGuard>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    lineHeight: 22,
  },
  guestSection: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  userSection: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  featuresSection: {
    marginBottom: 20,
  },
  guestOnlySection: {
    backgroundColor: '#fff3cd',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  gameButton: {
    backgroundColor: '#34C759',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  gameButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  featureButton: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featureButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  featureNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  guestInfo: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  guestInfoText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  userInfo: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  userInfoText: {
    fontSize: 14,
    color: '#0c5460',
    textAlign: 'center',
  },
  challengeForm: {
    marginTop: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 6,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#d1ecf1',
    padding: 12,
    borderRadius: 6,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#bee5eb',
  },
  successText: {
    fontSize: 14,
    color: '#0c5460',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export {
  ExampleGameScreen,
  ExampleProfileScreen,
  ExampleHomeScreen,
  ExampleChallengeScreen,
};