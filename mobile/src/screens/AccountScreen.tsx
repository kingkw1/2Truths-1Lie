import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';
import Purchases from 'react-native-purchases';

const AccountScreen = () => {
  // State for Edit Profile
  const [name, setName] = useState('Current User Name'); // Placeholder

  // State for Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleUpdateName = async () => {
    // Placeholder for PATCH API call
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // const response = await fetch('/api/user/profile', {
      //   method: 'PATCH',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ name }),
      // });
      // if (!response.ok) throw new Error('Failed to update name.');
      Alert.alert('Success', 'Your name has been updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update your name.');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    // Placeholder for POST API call
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // const response = await fetch('/api/user/change-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ currentPassword, newPassword }),
      // });
      // if (!response.ok) throw new Error('Failed to change password.');
      Alert.alert('Success', 'Your password has been changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      Alert.alert('Error', 'Could not change your password.');
    }
  };

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
        {/* Edit Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Display Name"
          />
          <TouchableOpacity style={styles.button} onPress={handleUpdateName}>
            <Text style={styles.buttonText}>Save Name</Text>
          </TouchableOpacity>
        </View>

        {/* Change Password Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current Password"
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New Password"
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Confirm New Password"
            secureTextEntry
          />
          <TouchableOpacity style={styles.button} onPress={handleChangePassword}>
            <Text style={styles.buttonText}>Change Password</Text>
          </TouchableOpacity>
        </View>

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
  section: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
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
    marginTop: 'auto',
  },
  logoutButtonText: {
    color: '#ffffff',
  },
});

export default AccountScreen;