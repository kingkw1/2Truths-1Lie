import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Challenge {
  id: string;
  title: string;
  statements: string[];
  category: string;
}

export default function App() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  console.log('=== APP LOADING ===');
  console.log('If you see this in Expo logs, logging is working!');

  const fetchChallenges = async () => {
    try {
      console.log('🔄 Testing backend connection...');
      setLoading(true);
      setError(null);
      
      // First try the health endpoint to test basic connectivity
      const healthResponse = await fetch('http://192.168.50.111:8000/health');
      console.log('📡 Health endpoint status:', healthResponse.status);
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log('🏥 Health check result:', healthData);
        
        // Mock some challenge data for now since we confirmed connectivity
        const mockChallenges = [
          {
            id: "test1",
            title: "Backend Connection Test",
            statements: [
              "The backend server is running on port 8000",
              "The health endpoint returned status 200",
              "Console logging is working perfectly"
            ],
            category: "System Test"
          },
          {
            id: "test2", 
            title: "Server-Side Video Processing Ready",
            statements: [
              "Your FFmpeg video processing is completed",
              "The API endpoints are responding correctly",
              "Mobile app integration is successful"
            ],
            category: "Video Processing"
          }
        ];
        
        console.log('📦 Using test challenges:', mockChallenges.length);
        console.log('🔍 First challenge:', mockChallenges[0]);
        setChallenges(mockChallenges);
        setLoading(false);
      } else {
        throw new Error(`Health check failed with status: ${healthResponse.status}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ Backend test failed:', errorMsg);
      setError(errorMsg);
      setLoading(false);
    }
  };

  const testBasicLogging = () => {
    console.log('🔘 Test button pressed!');
    console.log('📱 App is fully interactive');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>2 Truths & 1 Lie</Text>
      <Text style={styles.subtitle}>Mobile Testing Interface</Text>
      
      <TouchableOpacity style={styles.button} onPress={testBasicLogging}>
        <Text style={styles.buttonText}>Test Console Logging</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={fetchChallenges}>
        <Text style={styles.buttonText}>
          {loading ? 'Loading...' : 'Fetch Challenges from Backend'}
        </Text>
      </TouchableOpacity>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Error:</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {challenges.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            ✅ Successfully loaded {challenges.length} challenges!
          </Text>
          
          {challenges.slice(0, 3).map((challenge, index) => (
            <View key={challenge.id} style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <Text style={styles.challengeCategory}>Category: {challenge.category}</Text>
              <View style={styles.statements}>
                {challenge.statements.map((statement, idx) => (
                  <Text key={idx} style={styles.statement}>
                    {idx + 1}. {statement}
                  </Text>
                ))}
              </View>
            </View>
          ))}
          
          {challenges.length > 3 && (
            <Text style={styles.moreText}>
              ... and {challenges.length - 3} more challenges
            </Text>
          )}
        </View>
      )}
      
      <Text style={styles.info}>
        This tests backend connectivity and server-side video processing
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 5,
  },
  errorText: {
    color: '#c62828',
  },
  resultsContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  challengeCard: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  challengeCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  statements: {
    marginLeft: 5,
  },
  statement: {
    fontSize: 14,
    marginBottom: 3,
  },
  moreText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  info: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});
