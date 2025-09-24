import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';
import Purchases from 'react-native-purchases';

const AccountScreen = () => {
  const handleManageSubscription = async () => {
    try {
      await Purchases.showManageSubscriptions();
    } catch (e) {
      Alert.alert('Error', 'Could not open manage subscriptions.');
    }
  };

  const handleLogout = () => {
    // Placeholder for logout logic
    Alert.alert('Log Out', 'You have been logged out.');
  };

  const openURL = (url: string) => {
    Linking.openURL(url).catch(err => Alert.alert('Error', `Failed to open URL: ${err}`));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
          <Text style={styles.buttonText}>Manage Subscription</Text>
        </TouchableOpacity>

        <View style={styles.legalSection}>
          <Pressable onPress={() => openURL('https://www.yourapp.com/privacy')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => openURL('https://www.yourapp.com/terms')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </Pressable>
        </View>

        <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
          <Text style={[styles.buttonText, styles.logoutButtonText]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legalSection: {
    marginVertical: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#007bff',
    fontSize: 16,
    marginVertical: 5,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    marginTop: 'auto', // Push to the bottom
  },
  logoutButtonText: {
    color: '#ffffff',
  },
});

export default AccountScreen;