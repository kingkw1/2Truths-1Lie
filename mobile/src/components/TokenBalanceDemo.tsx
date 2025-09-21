import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTokenBalance, addTokens, spendTokens } from '../hooks/useTokenBalance';

/**
 * Example component demonstrating usage of the useTokenBalance hook
 * 
 * This component shows:
 * - Displaying current token balance
 * - Handling loading and error states
 * - Adding tokens to balance
 * - Spending tokens from balance
 * - Error handling for insufficient tokens
 */
export const TokenBalanceDemo: React.FC = () => {
  const { balance, loading, error } = useTokenBalance();

  const handleAddTokens = async () => {
    try {
      const newBalance = await addTokens(10);
      Alert.alert('Success', `Added 10 tokens! New balance: ${newBalance}`);
    } catch (error) {
      Alert.alert('Error', `Failed to add tokens: ${error}`);
    }
  };

  const handleSpendTokens = async () => {
    try {
      const newBalance = await spendTokens(5);
      Alert.alert('Success', `Spent 5 tokens! New balance: ${newBalance}`);
    } catch (error) {
      Alert.alert('Error', `Failed to spend tokens: ${error}`);
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
        <TouchableOpacity style={styles.addButton} onPress={handleAddTokens}>
          <Text style={styles.buttonText}>Add 10 Tokens</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.spendButton, balance < 5 && styles.disabledButton]} 
          onPress={handleSpendTokens}
          disabled={balance < 5}
        >
          <Text style={[styles.buttonText, balance < 5 && styles.disabledText]}>
            Spend 5 Tokens
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helpText}>
        This demo shows how to use the useTokenBalance hook with RevenueCat.
        Tokens are stored as subscriber attributes and sync across devices.
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    flex: 0.48,
    alignItems: 'center',
  },
  spendButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    flex: 0.48,
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