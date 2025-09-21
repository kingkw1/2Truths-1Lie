import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { TokenBalanceDisplay } from './TokenBalanceDisplay';

/**
 * Example usage of the TokenBalanceDisplay component
 * 
 * This file demonstrates different ways to use the TokenBalanceDisplay
 * component in various contexts within your app.
 */

export const TokenBalanceExamples: React.FC = () => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>TokenBalanceDisplay Examples</Text>
      
      {/* Basic Usage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Usage</Text>
        <TokenBalanceDisplay />
      </View>

      {/* With Refresh Button */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>With Refresh Button</Text>
        <TokenBalanceDisplay 
          showRefreshButton 
          onRefresh={() => console.log('Balance refreshed!')}
        />
      </View>

      {/* Small Size */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Small Size (for headers)</Text>
        <TokenBalanceDisplay 
          size="small" 
          showRefreshButton 
        />
      </View>

      {/* Large Size */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Large Size (for main display)</Text>
        <TokenBalanceDisplay 
          size="large" 
          showRefreshButton 
        />
      </View>

      {/* Custom Styling */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Styling</Text>
        <TokenBalanceDisplay 
          style={styles.customContainer}
          textColor="#FF6B6B"
          showRefreshButton 
        />
      </View>

      {/* In a Header Layout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Header Layout Example</Text>
        <View style={styles.headerExample}>
          <Text style={styles.headerTitle}>My Game</Text>
          <TokenBalanceDisplay size="small" />
        </View>
      </View>

      {/* In a Card Layout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Layout Example</Text>
        <View style={styles.cardExample}>
          <Text style={styles.cardTitle}>Account Balance</Text>
          <TokenBalanceDisplay 
            size="medium"
            showRefreshButton 
            onRefresh={() => console.log('Card balance refreshed!')}
          />
          <Text style={styles.cardSubtext}>
            Tokens can be used to play premium games
          </Text>
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
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  customContainer: {
    backgroundColor: '#FFE6E6',
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  headerExample: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2E86AB',
    padding: 15,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  cardExample: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  cardSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default TokenBalanceExamples;