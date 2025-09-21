import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTokenBalance, addTokens, spendTokens, refreshTokenBalanceAfterPurchase } from '../hooks/useTokenBalance';

/**
 * Example component demonstrating usage of the useTokenBalance hook
 * 
 * This component shows:
 * - Displaying current token balance with refresh functionality
 * - Handling loading and error states
 * - Adding tokens to balance
 * - Spending tokens from balance
 * - Refreshing balance after purchases
 * - Error handling for insufficient tokens
 */
export const TokenBalanceDemo: React.FC = () => {
  const { balance, loading, error, refresh } = useTokenBalance();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAddTokens = async () => {
    try {
      setActionLoading('add');
      const newBalance = await addTokens(10);
      Alert.alert('Success', `Added 10 tokens! New balance: ${newBalance}`);
    } catch (error) {
      Alert.alert('Error', `Failed to add tokens: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSpendTokens = async () => {
    try {
      setActionLoading('spend');
      const newBalance = await spendTokens(5);
      Alert.alert('Success', `Spent 5 tokens! New balance: ${newBalance}`);
    } catch (error) {
      Alert.alert('Error', `Failed to spend tokens: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setActionLoading('refresh');
      await refresh();
      Alert.alert('Success', 'Token balance refreshed!');
    } catch (error) {
      Alert.alert('Error', `Failed to refresh: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulatePurchase = async () => {
    try {
      setActionLoading('purchase');
      
      // Simulate a token pack purchase completion
      const tokensEarned = 25;
      const newBalance = await refreshTokenBalanceAfterPurchase(tokensEarned);
      
      Alert.alert(
        'Purchase Complete!', 
        `You received ${tokensEarned} tokens! New balance: ${newBalance}`
      );
    } catch (error) {
      Alert.alert('Error', `Purchase failed: ${error}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading token balance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Token Balance</Text>
        <Text style={styles.balanceValue}>🪙 {balance}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.addButton, actionLoading === 'add' && styles.disabledButton]} 
          onPress={handleAddTokens}
          disabled={actionLoading === 'add'}
        >
          <Text style={styles.buttonText}>
            {actionLoading === 'add' ? 'Adding...' : 'Add 10 Tokens'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.spendButton, 
            (balance < 5 || actionLoading === 'spend') && styles.disabledButton
          ]} 
          onPress={handleSpendTokens}
          disabled={balance < 5 || actionLoading === 'spend'}
        >
          <Text style={[styles.buttonText, (balance < 5 || actionLoading === 'spend') && styles.disabledText]}>
            {actionLoading === 'spend' ? 'Spending...' : 'Spend 5 Tokens'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.purchaseButton, actionLoading === 'purchase' && styles.disabledButton]} 
          onPress={handleSimulatePurchase}
          disabled={actionLoading === 'purchase'}
        >
          <Text style={styles.buttonText}>
            {actionLoading === 'purchase' ? 'Purchasing...' : '🛒 Buy 25 Tokens'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.refreshButton, actionLoading === 'refresh' && styles.disabledButton]} 
          onPress={handleRefresh}
          disabled={actionLoading === 'refresh'}
        >
          <Text style={styles.buttonText}>
            {actionLoading === 'refresh' ? 'Refreshing...' : '🔄 Refresh Balance'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helpText}>
        This demo shows how to use the useTokenBalance hook with RevenueCat.
        Tokens are stored as subscriber attributes and sync across devices.
        New: Refresh functionality for immediate UI updates after purchases!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  balanceContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E86AB',
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 15,
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  spendButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  purchaseButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#999999',
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#FF6B6B',
    backgroundColor: '#FFE6E6',
    padding: 15,
    borderRadius: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});