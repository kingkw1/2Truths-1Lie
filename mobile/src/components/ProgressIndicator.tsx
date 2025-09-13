import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface ProgressStep {
  id: string;
  label: string;
  completed: boolean;
  active: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
}) => {
  return (
    <View style={styles.container}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <View style={styles.stepIndicator}>
            <View
              style={[
                styles.stepCircle,
                step.completed && styles.stepCompleted,
                step.active && styles.stepActive,
              ]}
            >
              {step.completed ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    step.active && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  step.completed && styles.stepLineCompleted,
                ]}
              />
            )}
          </View>
          <Text
            style={[
              styles.stepLabel,
              step.active && styles.stepLabelActive,
              step.completed && styles.stepLabelCompleted,
            ]}
          >
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 12,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  stepCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  stepNumberActive: {
    color: 'white',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: '#ddd',
    marginTop: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#4CAF50',
  },
  stepLabel: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  stepLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#4CAF50',
    fontWeight: '500',
  },
});