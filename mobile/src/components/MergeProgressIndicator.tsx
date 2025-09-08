/**
 * Merge Progress Indicator Component
 * Displays real-time progress of server-side video merging
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';

export interface MergeProgressProps {
  progress: number; // 0-100
  stage: 'pending' | 'processing' | 'completed' | 'failed';
  currentStep?: string;
  estimatedTimeRemaining?: number; // in seconds
  error?: string;
  style?: any;
}

export const MergeProgressIndicator: React.FC<MergeProgressProps> = ({
  progress,
  stage,
  currentStep,
  estimatedTimeRemaining,
  error,
  style,
}) => {
  const [animatedProgress] = React.useState(new Animated.Value(0));
  const [pulseAnimation] = React.useState(new Animated.Value(1));

  // Animate progress bar
  React.useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  // Pulse animation for processing state
  React.useEffect(() => {
    if (stage === 'processing') {
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (stage === 'processing') {
            pulse();
          }
        });
      };
      pulse();
    } else {
      pulseAnimation.setValue(1);
    }
  }, [stage, pulseAnimation]);

  const getStageColor = () => {
    switch (stage) {
      case 'pending':
        return '#4a90e2';
      case 'processing':
        return '#f39c12';
      case 'completed':
        return '#51cf66';
      case 'failed':
        return '#e74c3c';
      default:
        return '#4a90e2';
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getStatusText = (): string => {
    switch (stage) {
      case 'pending':
        return 'Preparing videos for merge...';
      case 'processing':
        return currentStep || 'Processing videos...';
      case 'completed':
        return 'Video merge completed successfully!';
      case 'failed':
        return error || 'Video merge failed';
      default:
        return 'Initializing...';
    }
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header with icon and stage */}
      <View style={styles.header}>
        <Animated.Text 
          style={[
            styles.stageIcon,
            { transform: [{ scale: pulseAnimation }] }
          ]}
        >
          {getStageIcon()}
        </Animated.Text>
        <Text style={styles.stageText}>
          {stage === 'pending' && 'Uploading Videos'}
          {stage === 'processing' && 'Merging Videos'}
          {stage === 'completed' && 'Merge Complete'}
          {stage === 'failed' && 'Merge Failed'}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBackground, { borderColor: getStageColor() }]}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: getStageColor(),
                width: animatedProgress.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: getStageColor() }]}>
          {Math.round(progress)}%
        </Text>
      </View>

      {/* Status text */}
      <Text style={styles.statusText}>{getStatusText()}</Text>

      {/* Time remaining */}
      {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && stage !== 'completed' && (
        <Text style={styles.timeText}>
          Estimated time remaining: {formatTime(estimatedTimeRemaining)}
        </Text>
      )}

      {/* Loading spinner for processing */}
      {stage === 'processing' && (
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="small" color={getStageColor()} />
        </View>
      )}

      {/* Error message */}
      {stage === 'failed' && error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stageIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  stageText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  spinnerContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default MergeProgressIndicator;