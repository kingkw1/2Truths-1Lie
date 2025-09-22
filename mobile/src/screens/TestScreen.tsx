import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerTest } from '../components/GestureHandlerTest';

export const TestScreen: React.FC = () => {
  const [showTest, setShowTest] = React.useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Development Test Screen</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => setShowTest(!showTest)}
      >
        <Text style={styles.buttonText}>
          {showTest ? 'Hide' : 'Show'} Gesture Handler Test
        </Text>
      </TouchableOpacity>
      
      {showTest && <GestureHandlerTest />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});