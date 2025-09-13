import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {
  LoadingOverlay,
  Toast,
  AuthButton,
  RetryButton,
  ProgressIndicator,
} from '../components';
import { useToast } from '../hooks/useToast';
import { useAuthOperations } from '../hooks/useAuthOperations';

/**
 * Example integration of all loading states and user feedback components
 * This demonstrates how to use the enhanced authentication feedback system
 */
export const LoadingStatesIntegrationExample: React.FC = () => {
  const [demoLoading, setDemoLoading] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const { toast, showSuccess, showError, showWarning, showInfo, hideToast } = useToast();
  const { loginState, signupState, login, signup } = useAuthOperations();

  // Demo progress steps
  const [progressSteps, setProgressSteps] = useState([
    { id: 'step1', label: 'Validating credentials', completed: false, active: false },
    { id: 'step2', label: 'Connecting to server', completed: false, active: false },
    { id: 'step3', label: 'Creating session', completed: false, active: false },
  ]);

  const simulateLoading = async () => {
    setDemoLoading(true);
    setShowRetry(false);
    
    // Step 1
    setProgressSteps(prev => prev.map((step, index) => ({
      ...step,
      active: index === 0,
      completed: false,
    })));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2
    setProgressSteps(prev => prev.map((step, index) => ({
      ...step,
      active: index === 1,
      completed: index === 0,
    })));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3
    setProgressSteps(prev => prev.map((step, index) => ({
      ...step,
      active: index === 2,
      completed: index < 2,
    })));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Complete
    setProgressSteps(prev => prev.map(step => ({
      ...step,
      active: false,
      completed: true,
    })));
    
    setDemoLoading(false);
    showSuccess('Operation completed successfully!');
  };

  const simulateError = () => {
    setShowRetry(true);
    showError('Something went wrong. Please try again.');
  };

  const handleRetry = () => {
    setShowRetry(false);
    simulateLoading();
  };

  const demoLogin = async () => {
    try {
      await login('demo@example.com', 'password123');
      showSuccess('Login successful!');
    } catch (error) {
      showError('Login failed. Please check your credentials.');
    }
  };

  const demoSignup = async () => {
    try {
      await signup('newuser@example.com', 'password123');
      showSuccess('Account created successfully!');
    } catch (error) {
      showError('Signup failed. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Loading States & Feedback Demo</Text>
        
        {/* Toast Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toast Notifications</Text>
          <View style={styles.buttonRow}>
            <AuthButton
              title="Success"
              onPress={() => showSuccess('This is a success message!')}
              variant="primary"
              style={styles.smallButton}
            />
            <AuthButton
              title="Error"
              onPress={() => showError('This is an error message!')}
              variant="secondary"
              style={styles.smallButton}
            />
          </View>
          <View style={styles.buttonRow}>
            <AuthButton
              title="Warning"
              onPress={() => showWarning('This is a warning message!')}
              variant="primary"
              style={styles.smallButton}
            />
            <AuthButton
              title="Info"
              onPress={() => showInfo('This is an info message!')}
              variant="secondary"
              style={styles.smallButton}
            />
          </View>
        </View>

        {/* Loading States Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Loading States</Text>
          <AuthButton
            title="Simulate Loading"
            onPress={simulateLoading}
            loading={demoLoading}
            loadingText="Processing..."
            style={styles.fullButton}
          />
          
          <AuthButton
            title="Simulate Error"
            onPress={simulateError}
            variant="secondary"
            style={styles.fullButton}
          />
        </View>

        {/* Progress Indicator Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progress Indicator</Text>
          <ProgressIndicator steps={progressSteps} />
        </View>

        {/* Retry Button Section */}
        {showRetry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retry Mechanism</Text>
            <RetryButton
              onRetry={handleRetry}
              message="Network error occurred. Please check your connection and try again."
            />
          </View>
        )}

        {/* Auth Operations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auth Operations</Text>
          
          <AuthButton
            title="Demo Login"
            onPress={demoLogin}
            loading={loginState.isLoading}
            loadingText="Signing In..."
            style={styles.fullButton}
          />
          
          {loginState.isLoading && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {loginState.message} ({loginState.progress}%)
              </Text>
            </View>
          )}
          
          <AuthButton
            title="Demo Signup"
            onPress={demoSignup}
            loading={signupState.isLoading}
            loadingText="Creating Account..."
            variant="secondary"
            style={styles.fullButton}
          />
          
          {signupState.isLoading && (
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {signupState.message} ({signupState.progress}%)
              </Text>
            </View>
          )}
        </View>

        {/* Error States Section */}
        {(loginState.error || signupState.error) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Error States</Text>
            {loginState.error && (
              <Text style={styles.errorText}>Login Error: {loginState.error}</Text>
            )}
            {signupState.error && (
              <Text style={styles.errorText}>Signup Error: {signupState.error}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Loading Overlay */}
      <LoadingOverlay
        visible={demoLoading}
        message="Processing your request..."
      />

      {/* Toast Component */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  smallButton: {
    flex: 0.48,
  },
  fullButton: {
    marginBottom: 10,
  },
  progressInfo: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  progressText: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff4444',
    backgroundColor: '#fff5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
});