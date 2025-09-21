import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { TokenBalanceDisplay } from '../components/TokenBalanceDisplay';
import { TokenSpendButton } from '../components/TokenSpendButton';
import { useTokenBalance, addTokens, spendTokens } from '../hooks/useTokenBalance';

/**
 * Test screen for token management functionality
 * This screen lets you test all token features on your device
 */
export const TokenTestScreen = () => {
  const { balance, loading, error, refresh } = useTokenBalance();

  const handleAddTokens = async (amount: number) => {
    try {
      const newBalance = await addTokens(amount);
      Alert.alert('Success!', `Added ${amount} tokens. New balance: ${newBalance}`);
      refresh(); // Refresh to show updated balance
    } catch (error) {
      Alert.alert('Error', `Failed to add tokens: ${error}`);
    }
  };

  const handleSpendSuccess = (newBalance: number) => {
    Alert.alert(
      'Purchase Successful!', 
      `Token spent successfully! Your new balance is ${newBalance} tokens.`,
      [{ text: 'OK' }]
    );
  };

  const handleSpendError = (error: Error) => {
    Alert.alert(
      'Purchase Failed', 
      `Could not complete purchase: ${error.message}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>🪙 Token Management Test</Text>
      
      {/* Current Balance Display */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Balance</Text>
        <TokenBalanceDisplay 
          size="large" 
          showRefreshButton 
          style={styles.balanceDisplay}
        />
      </View>

      {/* Quick Add Tokens */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Tokens (Test Only)</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.addButton, { flex: 1, marginHorizontal: 6, borderRadius: 8, padding: 12 }]}
            onPress={() => handleAddTokens(10)}
          >
            <Text style={styles.buttonText}>Add 10 Tokens</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { flex: 1, marginHorizontal: 6, borderRadius: 8, padding: 12 }]}
            onPress={() => handleAddTokens(50)}
          >
            <Text style={styles.buttonText}>Add 50 Tokens</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Test Spending - Small Amounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Small Purchases</Text>
        <View style={styles.buttonRow}>
          <TokenSpendButton
            tokensRequired={5}
            buttonText="Skip Ad"
            actionDescription="skip this advertisement"
            onSpendSuccess={handleSpendSuccess}
            onSpendError={handleSpendError}
            style={styles.button}
            size="small"
          />
          <TokenSpendButton
            tokensRequired={10}
            buttonText="Hint"
            actionDescription="get a helpful hint"
            onSpendSuccess={handleSpendSuccess}
            onSpendError={handleSpendError}
            style={styles.button}
            size="small"
          />
        </View>
      </View>

      {/* Test Spending - Medium Amounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medium Purchases</Text>
        <TokenSpendButton
          tokensRequired={25}
          buttonText="Unlock Premium Level"
          actionDescription="unlock this premium level"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
        />
        <TokenSpendButton
          tokensRequired={30}
          buttonText="Extra Lives (3x)"
          actionDescription="get 3 extra lives"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
        />
      </View>

      {/* Test Spending - Large Amounts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium Purchases</Text>
        <TokenSpendButton
          tokensRequired={75}
          buttonText="Remove All Ads"
          actionDescription="remove all advertisements permanently"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
          size="large"
        />
        <TokenSpendButton
          tokensRequired={100}
          buttonText="VIP Premium Access"
          actionDescription="unlock VIP premium features"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
          size="large"
          customInsufficientMessage="Complete daily challenges or purchase more tokens to unlock VIP access!"
        />
      </View>

      {/* Test Edge Cases */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edge Case Tests</Text>
        <TokenSpendButton
          tokensRequired={1}
          buttonText="Single Token Test"
          actionDescription="test single token spending"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
        />
        <TokenSpendButton
          tokensRequired={999}
          buttonText="Large Amount Test"
          actionDescription="test large token requirement"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
          style={styles.fullWidthButton}
          customInsufficientMessage="This is a test of the insufficient funds warning system!"
        />
      </View>

      {/* Manual Refresh */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Controls</Text>
        <TokenSpendButton
          tokensRequired={0} // No tokens required for refresh
          buttonText="🔄 Force Refresh Balance"
          onSpendSuccess={() => {
            refresh();
            Alert.alert('Refreshed', 'Token balance has been refreshed from RevenueCat.');
          }}
          style={[styles.fullWidthButton, styles.refreshButton]}
        />
      </View>

      {/* Debug Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Info</Text>
        <Text style={styles.debugText}>Loading: {loading ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Error: {error ? error.message : 'None'}</Text>
        <Text style={styles.debugText}>Balance: {balance} tokens</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  balanceDisplay: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    marginVertical: 4,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    padding: 12,
  },
  fullWidthButton: {
    marginVertical: 4,
  },
  addButton: {
    backgroundColor: '#28a745',
  },
  refreshButton: {
    backgroundColor: '#17a2b8',
  },
  debugText: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
    fontFamily: 'monospace',
  },
});