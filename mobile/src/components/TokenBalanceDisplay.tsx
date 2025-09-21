import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useTokenBalance } from '../hooks/useTokenBalance';

interface TokenBalanceDisplayProps {
  /**
   * Custom styling for the container
   */
  style?: any;
  
  /**
   * Show refresh button next to balance
   */
  showRefreshButton?: boolean;
  
  /**
   * Custom text color for the balance
   */
  textColor?: string;
  
  /**
   * Size variant for the display
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Callback when refresh is tapped
   */
  onRefresh?: () => void;
}

/**
 * TokenBalanceDisplay Component
 * 
 * A React Native component that displays the user's current token balance
 * using the useTokenBalance hook. Shows loading spinner while fetching
 * and error message when fetch fails.
 * 
 * Features:
 * - Real-time token balance display
 * - Loading spinner during fetch
 * - Error handling with retry option
 * - Customizable styling and size
 * - Optional refresh button
 * 
 * @param props - Component props
 */
export const TokenBalanceDisplay: React.FC<TokenBalanceDisplayProps> = ({
  style,
  showRefreshButton = false,
  textColor,
  size = 'medium',
  onRefresh,
}) => {
  const { balance, loading, error, refresh } = useTokenBalance();

  const handleRefresh = async () => {
    try {
      await refresh();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to refresh token balance:', error);
    }
  };

  // Size-based styling
  const sizeStyles = {
    small: {
      fontSize: 14,
      iconSize: 12,
      padding: 8,
    },
    medium: {
      fontSize: 16,
      iconSize: 16,
      padding: 12,
    },
    large: {
      fontSize: 20,
      iconSize: 20,
      padding: 16,
    },
  };

  const currentSize = sizeStyles[size];

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { padding: currentSize.padding }, style]}>
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'large'} 
          color="#2196F3" 
          style={styles.spinner}
        />
        <Text style={[
          styles.loadingText, 
          { fontSize: currentSize.fontSize, color: textColor || '#666' }
        ]}>
          Loading...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { padding: currentSize.padding }, style]}>
        <View style={styles.errorContainer}>
          <Text style={[
            styles.errorIcon, 
            { fontSize: currentSize.iconSize }
          ]}>
            ⚠️
          </Text>
          <Text style={[
            styles.errorText, 
            { fontSize: currentSize.fontSize - 2, color: textColor || '#FF6B6B' }
          ]}>
            Error loading balance
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRefresh}
          accessibilityLabel="Retry loading token balance"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success state - show balance
  return (
    <View style={[styles.container, { padding: currentSize.padding }, style]}>
      <View style={styles.balanceContainer}>
        <Text 
          style={[
            styles.tokenIcon, 
            { fontSize: currentSize.iconSize }
          ]}
          accessibilityLabel="Token icon"
        >
          🪙
        </Text>
        <Text 
          style={[
            styles.balanceText, 
            { fontSize: currentSize.fontSize, color: textColor || '#2E86AB' }
          ]}
          accessibilityLabel={`Current token balance: ${balance}`}
        >
          {balance.toLocaleString()}
        </Text>
        <Text 
          style={[
            styles.tokensLabel, 
            { fontSize: currentSize.fontSize - 4, color: textColor || '#666' }
          ]}
        >
          {balance === 1 ? 'token' : 'tokens'}
        </Text>
      </View>
      
      {showRefreshButton && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleRefresh}
          accessibilityLabel="Refresh token balance"
        >
          <Text style={styles.refreshIcon}>🔄</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  spinner: {
    marginRight: 8,
  },
  loadingText: {
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorText: {
    fontWeight: '500',
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tokenIcon: {
    marginRight: 6,
  },
  balanceText: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  tokensLabel: {
    fontWeight: '500',
    opacity: 0.8,
  },
  refreshButton: {
    padding: 8,
    marginLeft: 8,
  },
  refreshIcon: {
    fontSize: 16,
  },
});

export default TokenBalanceDisplay;