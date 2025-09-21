import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { TokenSpendButton } from './TokenSpendButton';

/**
 * Examples demonstrating how to use the TokenSpendButton component
 * in various scenarios throughout your app.
 */

export const TokenSpendButtonExamples: React.FC = () => {
  // Callback handlers
  const handleSpendSuccess = (newBalance: number) => {
    console.log(`✅ Spend successful! New balance: ${newBalance}`);
  };

  const handleSpendError = (error: Error) => {
    console.error('❌ Spend failed:', error);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>TokenSpendButton Examples</Text>
      
      {/* Basic Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Usage</Text>
        <Text style={styles.description}>
          Simple button to spend tokens on an action
        </Text>
        <TokenSpendButton
          tokensRequired={5}
          buttonText="Play Premium Game"
          actionDescription="play this premium game"
        />
      </View>

      {/* With Callbacks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>With Success/Error Callbacks</Text>
        <Text style={styles.description}>
          Handle success and error events from token spending
        </Text>
        <TokenSpendButton
          tokensRequired={10}
          buttonText="Unlock Feature"
          actionDescription="unlock this feature"
          onSpendSuccess={handleSpendSuccess}
          onSpendError={handleSpendError}
        />
      </View>

      {/* High Cost Item */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>High Cost Item</Text>
        <Text style={styles.description}>
          Example with higher token requirement - likely to show insufficient funds warning
        </Text>
        <TokenSpendButton
          tokensRequired={100}
          buttonText="Buy Rare Item"
          actionDescription="purchase this rare collectible"
          showDetailedWarning={true}
        />
      </View>

      {/* Custom Insufficient Message */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Insufficient Message</Text>
        <Text style={styles.description}>
          Custom message when user doesn't have enough tokens
        </Text>
        <TokenSpendButton
          tokensRequired={25}
          buttonText="Skip Level"
          actionDescription="skip to the next level"
          customInsufficientMessage="You need more coins to skip this level! Complete challenges to earn more."
        />
      </View>

      {/* Size Variants */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Size Variants</Text>
        <Text style={styles.description}>Small size for compact spaces</Text>
        <TokenSpendButton
          tokensRequired={3}
          buttonText="Quick Action"
          actionDescription="perform quick action"
          size="small"
        />
        
        <Text style={[styles.description, { marginTop: 15 }]}>Large size for main actions</Text>
        <TokenSpendButton
          tokensRequired={15}
          buttonText="Major Purchase"
          actionDescription="complete this major purchase"
          size="large"
        />
      </View>

      {/* Custom Styling */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Styling</Text>
        <Text style={styles.description}>
          Custom colors and styling for themed buttons
        </Text>
        <TokenSpendButton
          tokensRequired={8}
          buttonText="Special Action"
          actionDescription="perform special action"
          style={styles.customButton}
        />
      </View>

      {/* Disabled State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disabled State</Text>
        <Text style={styles.description}>
          Button disabled regardless of token balance
        </Text>
        <TokenSpendButton
          tokensRequired={5}
          buttonText="Coming Soon"
          actionDescription="use this feature"
          disabled={true}
        />
      </View>

      {/* No Warning Variant */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>No Warning Message</Text>
        <Text style={styles.description}>
          Hide the detailed warning for insufficient funds
        </Text>
        <TokenSpendButton
          tokensRequired={50}
          buttonText="Quick Buy"
          actionDescription="purchase instantly"
          showDetailedWarning={false}
        />
      </View>

      {/* Game Purchase Example */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Purchase Example</Text>
        <Text style={styles.description}>
          Real-world example for in-game purchases
        </Text>
        <View style={styles.gameCard}>
          <Text style={styles.gameTitle}>Power-Up Pack</Text>
          <Text style={styles.gameDescription}>
            Get 3x damage boost for the next 5 minutes
          </Text>
          <TokenSpendButton
            tokensRequired={20}
            buttonText="Buy Power-Up"
            actionDescription="activate this power-up"
            onSpendSuccess={(newBalance) => {
              Alert.alert('Power-Up Activated!', `Remaining tokens: ${newBalance}`);
            }}
            onSpendError={(error) => {
              Alert.alert('Purchase Failed', 'Please try again later.');
            }}
          />
        </View>
      </View>

      {/* Subscription Example */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription Example</Text>
        <Text style={styles.description}>
          Monthly subscription with token payment
        </Text>
        <View style={styles.subscriptionCard}>
          <Text style={styles.subscriptionTitle}>Premium Monthly</Text>
          <Text style={styles.subscriptionFeatures}>
            • Unlimited plays{'\n'}
            • Exclusive content{'\n'}
            • No ads{'\n'}
            • Priority support
          </Text>
          <TokenSpendButton
            tokensRequired={75}
            buttonText="Subscribe Now"
            actionDescription="activate premium subscription"
            size="large"
            customInsufficientMessage="You need 75 tokens for Premium subscription. Purchase a token pack to continue!"
            onSpendSuccess={(newBalance) => {
              Alert.alert(
                'Welcome to Premium!', 
                `Subscription activated! Remaining balance: ${newBalance} tokens`
              );
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    marginBottom: 8,
    color: '#444',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  customButton: {
    backgroundColor: '#9C27B0',
    borderColor: '#7B1FA2',
    borderWidth: 2,
  },
  gameCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  gameDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  subscriptionCard: {
    backgroundColor: '#1A237E',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionFeatures: {
    fontSize: 14,
    color: 'white',
    marginBottom: 20,
    lineHeight: 22,
    opacity: 0.9,
  },
});

export default TokenSpendButtonExamples;