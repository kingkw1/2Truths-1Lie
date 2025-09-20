import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePremiumStatus } from '../hooks/usePremiumStatus';

interface TrialBannerProps {
  onUpgradePress?: () => void;
  showDismiss?: boolean;
  onDismiss?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  onUpgradePress,
  showDismiss = false,
  onDismiss,
}) => {
  const { isInTrial, trialDaysRemaining, isPremium, loading } = usePremiumStatus();

  if (loading || isPremium || !isInTrial) {
    return null;
  }

  const getMessage = () => {
    if (trialDaysRemaining === 0) {
      return 'Your free trial expires today!';
    } else if (trialDaysRemaining === 1) {
      return 'Your free trial expires tomorrow!';
    } else {
      return `${trialDaysRemaining} days left in your free trial`;
    }
  };

  const getUrgencyStyle = () => {
    if (trialDaysRemaining <= 1) {
      return styles.urgent;
    } else if (trialDaysRemaining <= 3) {
      return styles.warning;
    }
    return styles.normal;
  };

  return (
    <View style={[styles.container, getUrgencyStyle()]}>
      <View style={styles.content}>
        <Text style={styles.message}>{getMessage()}</Text>
        {onUpgradePress && (
          <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
            <Text style={styles.upgradeText}>Upgrade Now</Text>
          </TouchableOpacity>
        )}
      </View>
      {showDismiss && onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  normal: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  warning: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  urgent: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});