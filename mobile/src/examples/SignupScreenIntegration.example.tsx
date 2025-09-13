import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { SignupScreen } from '../screens/SignupScreen';
import { LoginScreen } from '../screens/LoginScreen';

/**
 * Example integration showing how to use SignupScreen with navigation
 * This demonstrates the typical auth flow patterns
 */
export const SignupScreenIntegrationExample: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<'signup' | 'login' | 'main'>('signup');

  const handleSignupSuccess = () => {
    Alert.alert(
      'Account Created!',
      'Your account has been created successfully. Welcome!',
      [
        {
          text: 'Continue',
          onPress: () => setCurrentScreen('main'),
        },
      ]
    );
  };

  const handleLoginSuccess = () => {
    Alert.alert(
      'Welcome Back!',
      'You have been logged in successfully.',
      [
        {
          text: 'Continue',
          onPress: () => setCurrentScreen('main'),
        },
      ]
    );
  };

  const handleNavigateToLogin = () => {
    setCurrentScreen('login');
  };

  const handleNavigateToSignup = () => {
    setCurrentScreen('signup');
  };

  const handleBack = () => {
    // In a real app, this might navigate back to a welcome screen
    // or the previous screen in the navigation stack
    console.log('Back button pressed');
  };

  if (currentScreen === 'signup') {
    return (
      <SignupScreen
        onSignupSuccess={handleSignupSuccess}
        onNavigateToLogin={handleNavigateToLogin}
        onBack={handleBack}
      />
    );
  }

  if (currentScreen === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSignup={handleNavigateToSignup}
        onBack={handleBack}
      />
    );
  }

  // Main app screen (placeholder)
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {/* Your main app content would go here */}
    </View>
  );
};

/**
 * Example showing SignupScreen in a modal presentation
 */
export const SignupModalExample: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSignupSuccess: () => void;
}> = ({ visible, onClose, onSignupSuccess }) => {
  const [showLogin, setShowLogin] = useState(false);

  if (!visible) return null;

  const handleSignupSuccess = () => {
    onSignupSuccess();
    onClose();
  };

  const handleLoginSuccess = () => {
    onSignupSuccess(); // Same callback for both login and signup success
    onClose();
  };

  if (showLogin) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onNavigateToSignup={() => setShowLogin(false)}
        onBack={onClose}
      />
    );
  }

  return (
    <SignupScreen
      onSignupSuccess={handleSignupSuccess}
      onNavigateToLogin={() => setShowLogin(true)}
      onBack={onClose}
    />
  );
};

/**
 * Example showing how to integrate with React Navigation
 * This would be used in your navigation stack
 */
export const navigationIntegrationExample = {
  // In your navigation stack configuration:
  screens: {
    Signup: {
      screen: ({ navigation }: any) => (
        <SignupScreen
          onSignupSuccess={() => {
            // Navigate to main app or dashboard
            navigation.navigate('MainApp');
          }}
          onNavigateToLogin={() => {
            // Navigate to login screen
            navigation.navigate('Login');
          }}
          onBack={() => {
            // Go back to previous screen
            navigation.goBack();
          }}
        />
      ),
    },
    Login: {
      screen: ({ navigation }: any) => (
        <LoginScreen
          onLoginSuccess={() => {
            // Navigate to main app or dashboard
            navigation.navigate('MainApp');
          }}
          onNavigateToSignup={() => {
            // Navigate to signup screen
            navigation.navigate('Signup');
          }}
          onBack={() => {
            // Go back to previous screen
            navigation.goBack();
          }}
        />
      ),
    },
  },
};