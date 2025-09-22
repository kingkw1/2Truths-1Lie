import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Simple gesture handler test component to verify basic import compatibility
 * This tests that the gesture handler module is properly installed
 */
export const GestureHandlerTest: React.FC = () => {
  let gestureHandlerModule;
  let reanimatedModule;
  
  try {
    gestureHandlerModule = require('react-native-gesture-handler');
    reanimatedModule = require('react-native-reanimated');
  } catch (error) {
    console.error('Failed to import gesture modules:', error);
  }

  const hasGestureHandler = !!gestureHandlerModule;
  const hasReanimated = !!reanimatedModule;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Module Compatibility Test</Text>
      
      <View style={styles.testItem}>
        <Text style={styles.testLabel}>React Native Gesture Handler:</Text>
        <Text style={[styles.status, hasGestureHandler ? styles.success : styles.error]}>
          {hasGestureHandler ? '✅ Available' : '❌ Missing'}
        </Text>
      </View>
      
      <View style={styles.testItem}>
        <Text style={styles.testLabel}>React Native Reanimated:</Text>
        <Text style={[styles.status, hasReanimated ? styles.success : styles.error]}>
          {hasReanimated ? '✅ Available' : '❌ Missing'}
        </Text>
      </View>

      {hasGestureHandler && hasReanimated && (
        <Text style={styles.overallSuccess}>
          🎉 All gesture modules are available!
        </Text>
      )}
      
      {gestureHandlerModule && (
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Available Gesture Handler Exports:</Text>
          <Text style={styles.infoText}>
            {Object.keys(gestureHandlerModule).slice(0, 10).join(', ')}
            {Object.keys(gestureHandlerModule).length > 10 ? '...' : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  testItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
    maxWidth: 400,
  },
  testLabel: {
    fontSize: 16,
    flex: 1,
    color: '#333',
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  success: {
    color: '#4CAF50',
  },
  error: {
    color: '#F44336',
  },
  overallSuccess: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  infoSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '100%',
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
  },
});