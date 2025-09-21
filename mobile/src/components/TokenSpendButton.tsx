import React, { useState } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  View, 
  StyleSheet, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { useTokenBalance, spendTokens } from '../hooks/useTokenBalance';

interface TokenSpendButtonProps {
  /**
   * Number of tokens required for this action
   */
  tokensRequired: number;
  
  /**
   * Text to display on the button
   */
  buttonText: string;
  
  /**
   * Description of what the tokens will be spent on
   */
  actionDescription?: string;
  
  /**
   * Callback when spending is successful
   */
  onSpendSuccess?: (newBalance: number) => void;
  
  /**
   * Callback when spending fails
   */
  onSpendError?: (error: Error) => void;
  
  /**
   * Custom styling for the button
   */
  style?: any;
  
  /**
   * Button size variant
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Show detailed insufficient funds message
   */
  showDetailedWarning?: boolean;
  
  /**
   * Custom insufficient funds message
   */
  customInsufficientMessage?: string;
  
  /**
   * Disable the button even if user has enough tokens
   */
  disabled?: boolean;
}

/**
 * TokenSpendButton Component
 * 
 * A smart button component that validates token balance before allowing
 * the user to spend tokens. Shows warnings when insufficient funds and
 * handles the complete spend transaction flow.
 * 
 * Features:
 * - Automatic token balance validation
 * - Visual feedback for insufficient funds
 * - Loading states during transaction
 * - Success/error callbacks
 * - Customizable appearance and messages
 * - Accessibility support
 * 
 * @param props - Component props
 */
export const TokenSpendButton: React.FC<TokenSpendButtonProps> = ({
  tokensRequired,
  buttonText,
  actionDescription,
  onSpendSuccess,
  onSpendError,
  style,
  size = 'medium',
  showDetailedWarning = true,
  customInsufficientMessage,
  disabled = false,
}) => {
  const { balance, loading: balanceLoading } = useTokenBalance();
  const [spending, setSpending] = useState(false);

  // Calculate if user has sufficient tokens
  const hasSufficientTokens = balance >= tokensRequired;
  const isButtonDisabled = disabled || balanceLoading || spending || !hasSufficientTokens;

  // Size-based styling
  const sizeStyles = {
    small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
      iconSize: 12,
    },
    medium: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 16,
      iconSize: 14,
    },
    large: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      fontSize: 18,
      iconSize: 16,
    },
  };

  const currentSize = sizeStyles[size];

  const handleSpendTokens = async () => {
    if (!hasSufficientTokens) {
      // Show detailed warning if insufficient funds
      const message = customInsufficientMessage || 
        `You need ${tokensRequired} tokens but only have ${balance}. ${actionDescription ? `This is required to ${actionDescription}.` : ''}`;
      
      Alert.alert(
        'Insufficient Tokens',
        message,
        [
          { text: 'OK', style: 'default' },
          { text: 'Get More Tokens', style: 'default', onPress: () => {
            // TODO: Navigate to token purchase screen
            console.log('Navigate to token purchase');
          }}
        ]
      );
      return;
    }

    try {
      setSpending(true);
      const newBalance = await spendTokens(tokensRequired);
      
      // Success callback
      onSpendSuccess?.(newBalance);
      
      // Show success message
      Alert.alert(
        'Success!',
        `Spent ${tokensRequired} tokens${actionDescription ? ` to ${actionDescription}` : ''}. New balance: ${newBalance}`
      );
      
    } catch (error: any) {
      console.error('Failed to spend tokens:', error);
      
      // Error callback
      onSpendError?.(error);
      
      // Show error message
      Alert.alert(
        'Transaction Failed',
        error.message || 'Failed to spend tokens. Please try again.'
      );
    } finally {
      setSpending(false);
    }
  };

  // Get button style based on state
  const getButtonStyle = () => {
    if (disabled) {
      return [styles.button, styles.disabledButton, { 
        paddingVertical: currentSize.paddingVertical,
        paddingHorizontal: currentSize.paddingHorizontal 
      }, style];
    }
    
    if (!hasSufficientTokens) {
      return [styles.button, styles.insufficientButton, { 
        paddingVertical: currentSize.paddingVertical,
        paddingHorizontal: currentSize.paddingHorizontal 
      }, style];
    }
    
    return [styles.button, styles.enabledButton, { 
      paddingVertical: currentSize.paddingVertical,
      paddingHorizontal: currentSize.paddingHorizontal 
    }, style];
  };

  // Get text style based on state
  const getTextStyle = () => {
    const baseStyle = [styles.buttonText, { fontSize: currentSize.fontSize }];
    
    if (disabled || !hasSufficientTokens) {
      return [...baseStyle, styles.disabledText];
    }
    
    return [...baseStyle, styles.enabledText];
  };

  // Show loading state during balance fetch
  if (balanceLoading) {
    return (
      <TouchableOpacity 
        style={[styles.button, styles.loadingButton, { 
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal 
        }, style]}
        disabled
        accessibilityLabel="Loading token balance"
      >
        <ActivityIndicator size="small" color="#666" style={{ marginRight: 8 }} />
        <Text style={[styles.buttonText, styles.disabledText, { fontSize: currentSize.fontSize }]}>
          Loading...
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handleSpendTokens}
        disabled={isButtonDisabled}
        accessibilityLabel={
          !hasSufficientTokens 
            ? `Insufficient tokens. Need ${tokensRequired}, have ${balance}` 
            : `Spend ${tokensRequired} tokens to ${actionDescription || 'complete action'}`
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: isButtonDisabled }}
      >
        <View style={styles.buttonContent}>
          {spending && (
            <ActivityIndicator 
              size="small" 
              color={!hasSufficientTokens ? "#999" : "white"} 
              style={{ marginRight: 8 }} 
            />
          )}
          
          <Text style={getTextStyle()}>
            {spending ? 'Processing...' : buttonText}
          </Text>
          
          {!spending && (
            <View style={styles.tokenInfo}>
              <Text style={[styles.tokenIcon, { fontSize: currentSize.iconSize }]}>🪙</Text>
              <Text style={[styles.tokenAmount, { fontSize: currentSize.fontSize - 2 }]}>
                {tokensRequired}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Warning message for insufficient tokens */}
      {!hasSufficientTokens && showDetailedWarning && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            {customInsufficientMessage || 
              `Need ${tokensRequired} tokens, you have ${balance}`
            }
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'stretch',
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  enabledButton: {
    backgroundColor: '#4CAF50',
  },
  insufficientButton: {
    backgroundColor: '#FF6B6B',
    opacity: 0.7,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  loadingButton: {
    backgroundColor: '#F0F0F0',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  enabledText: {
    color: 'white',
  },
  disabledText: {
    color: '#999999',
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  tokenIcon: {
    marginRight: 2,
  },
  tokenAmount: {
    color: 'white',
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
});

export default TokenSpendButton;