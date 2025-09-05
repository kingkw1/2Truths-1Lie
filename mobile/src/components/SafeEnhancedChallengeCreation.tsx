/**
 * Safe wrapper for Enhanced Challenge Creation Component
 * Provides error boundary and environment checks
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import EnhancedChallengeCreation from './EnhancedChallengeCreation';

interface SafeEnhancedChallengeCreationProps {
  onChallengeComplete?: (challengeData: any) => void;
  onCancel?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EnhancedChallengeCreation Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Text style={styles.errorDetails}>
            Please try restarting the app or contact support if the problem persists.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export const SafeEnhancedChallengeCreation: React.FC<SafeEnhancedChallengeCreationProps> = (props) => {
  return (
    <ErrorBoundary>
      <EnhancedChallengeCreation {...props} />
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d63031',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SafeEnhancedChallengeCreation;