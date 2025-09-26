import React, { useState, useEffect, useContext } from 'react';
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
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Purchases from 'react-native-purchases';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { useAuth } from '../hooks/useAuth';
import { ThemeContext } from '../context/ThemeContext';

const AccountScreen = () => {
  const navigation = useNavigation();
  const { theme, colors, toggleTheme } = useContext(ThemeContext);
  const premiumStatusHook = usePremiumStatus() as any; // Type assertion to handle refresh method
  const { isPremium, loading, error, customerInfo } = premiumStatusHook;
  const { user, logout } = useAuth();
  const styles = getStyles(colors);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);

  useEffect(() => {
    const loadHapticsPreference = async () => {
      try {
        const value = await AsyncStorage.getItem('hapticsEnabled');
        // AsyncStorage returns null if the key doesn't exist. Default to true.
        // It returns 'true' or 'false' as strings.
        if (value !== null) {
          setIsHapticsEnabled(value === 'true');
        }
      } catch (e) {
        console.error('Failed to load haptics preference.', e);
      }
    };

    loadHapticsPreference();
  }, []);

  const handleHapticsToggle = async (newValue: boolean) => {
    setIsHapticsEnabled(newValue);
    try {
      await AsyncStorage.setItem('hapticsEnabled', String(newValue));

      // Placeholder for PATCH API call for logged-in users
      if (user) {
        console.log(`SYNC HAPTICS PREFERENCE: User ${user.id} set haptics to ${newValue}. PATCH to /api/user/preferences`);
        // Example:
        // await api.patch('/user/preferences', { hapticsEnabled: newValue });
      }
    } catch (e) {
      console.error('Failed to save haptics preference.', e);
      // Optionally, revert state if saving fails
      setIsHapticsEnabled(!newValue);
      Alert.alert('Error', 'Could not save your preference. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    try {
      await Purchases.showManageSubscriptions();
    } catch (e) {
      Alert.alert('Error', 'Could not open manage subscriptions.');
    }
  };

  const handleDebugSubscription = async () => {
    try {
      // Force refresh customer info from RevenueCat servers (bypassing cache)
      const freshCustomerInfo = await Purchases.getCustomerInfo();
      
      console.log('🔍 DEBUG: Fresh customer info:', {
        activeEntitlements: Object.keys(freshCustomerInfo.entitlements.active),
        allEntitlements: Object.keys(freshCustomerInfo.entitlements.all),
        activeSubscriptions: freshCustomerInfo.activeSubscriptions,
        allPurchasedProductIdentifiers: freshCustomerInfo.allPurchasedProductIdentifiers,
      });
      
      // Check multiple possible entitlement names
      const possibleEntitlements = ['premium', 'pro', 'investigator', 'pro_access'];
      const activeEntitlementNames = Object.keys(freshCustomerInfo.entitlements.active);
      const foundEntitlements = possibleEntitlements.filter(name => 
        freshCustomerInfo.entitlements.active[name] !== undefined
      );

      // Trigger a manual refresh of the premium status hook if available
      if (premiumStatusHook.refresh) {
        await premiumStatusHook.refresh();
      }

      // Show debug info to user
      Alert.alert(
        'Debug Subscription Status',
        `Active Entitlements: ${activeEntitlementNames.join(', ') || 'None'}\n` +
        `Found Known Entitlements: ${foundEntitlements.join(', ') || 'None'}\n` +
        `Active Subscriptions: ${freshCustomerInfo.activeSubscriptions.join(', ') || 'None'}\n` +
        `All Purchased: ${freshCustomerInfo.allPurchasedProductIdentifiers.join(', ') || 'None'}\n` +
        `Current isPremium: ${isPremium}\n` +
        `Loading: ${loading}`
      );
    } catch (e) {
      Alert.alert('Debug Error', `Failed to debug: ${e}`);
    }
  };

  const handleLogout = async () => {
    try {
      // The `logout` function from `useAuth` now handles everything:
      // - Logging out from RevenueCat
      // - Clearing the auth token from AsyncStorage
      // - Updating the Redux state via `logoutUser` thunk
      // The state change will automatically trigger navigation to the Auth screen.
      await logout();
      console.log('Logout successful.');
    } catch (e) {
      console.error('Logout failed', e);
      Alert.alert('Error', 'An error occurred during logout. Please try again.');
    }
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

        {/* App Preferences Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>APP PREFERENCES</Text>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Dark Mode</Text>
            <Switch
              value={theme === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={theme === 'dark' ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Haptic Feedback</Text>
            <Switch
              value={isHapticsEnabled}
              onValueChange={handleHapticsToggle}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isHapticsEnabled ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Subscription Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SUBSCRIPTION</Text>
          <View style={styles.cardRow}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>
              {loading ? 'Checking...' : error ? 'Error loading' : isPremium ? 'Pro Member' : 'Free User'}
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.debugButton]} onPress={handleDebugSubscription}>
            <Text style={styles.buttonText}>Debug Subscription Status</Text>
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

const getStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000', // Shadow can be tricky with dark mode, keeping it simple
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    opacity: 0.7,
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
    color: colors.text,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    opacity: 0.6,
  },
  editText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 8,
  },
  chevron: {
    fontSize: 20,
    color: colors.text,
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -16, // Extend to card edges
  },
  button: {
    backgroundColor: colors.primary,
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
  debugButton: {
    backgroundColor: '#17a2b8',
    marginTop: 8,
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