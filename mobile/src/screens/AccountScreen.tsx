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
import { useNavigation } from '@react-navigation/native';
import Purchases from 'react-native-purchases';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { useAuth } from '../hooks/useAuth';

const AccountScreen = () => {
  const navigation = useNavigation();
  const { isPremium } = usePremiumStatus();
  const { user } = useAuth();

  const handleManageSubscription = async () => {
    try {
      await Purchases.showManageSubscriptions();
    } catch (e) {
      Alert.alert('Error', 'Could not open manage subscriptions.');
    }
  };

  const handleLogout = () => {
    // TODO: Dispatch logout action and clear user session
    Alert.alert('Log Out', 'You have been logged out.');
  };

  const handleEditProfile = () => {
    // Placeholder for navigating to an edit profile screen
    Alert.alert('Edit Profile', 'This would navigate to an edit profile screen.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PROFILE</Text>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Name</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.value}>{user?.name || 'Guest User'}</Text>
              <Pressable onPress={handleEditProfile}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email || 'guest@example.com'}</Text>
          </View>
        </View>

        {/* Security Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SECURITY</Text>
          <Pressable style={styles.cardRow} onPress={() => navigation.navigate('ChangePassword')}>
            <Text style={styles.label}>Change Password</Text>
            <Text style={styles.chevron}>〉</Text>
          </Pressable>
        </View>

        {/* Subscription Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SUBSCRIPTION</Text>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{isPremium ? 'Pro Member' : 'Free User'}</Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </TouchableOpacity>
        </View>

        {/* Legal Card */}
        <View style={styles.card}>
          <Pressable style={styles.cardRow} onPress={() => Linking.openURL('https://kingkw1.github.io/2Truths-1Lie/privacy-policy.html')}>
            <Text style={styles.label}>Privacy Policy</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.cardRow} onPress={() => Linking.openURL('https://kingkw1.github.io/2Truths-1Lie/terms-of-service.html')}>
            <Text style={styles.label}>Terms of Service</Text>
          </Pressable>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f4f8',
  },
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    color: '#343a40',
  },
  value: {
    fontSize: 16,
    color: '#6c757d',
  },
  editText: {
    fontSize: 16,
    color: '#007bff',
    marginLeft: 8,
  },
  chevron: {
    fontSize: 20,
    color: '#adb5bd',
  },
  divider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginHorizontal: -16, // Extend to card edges
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AccountScreen;