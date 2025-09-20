import React from 'react';
import { View, Text, Button, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { useOfferings } from '../hooks/useOfferings';
import { ProductCard } from '../components/ProductCard';

export const StoreScreen: React.FC = () => {
  const { offerings, isLoading, error } = useOfferings();

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (typeof customerInfo.entitlements.active['premium'] !== 'undefined') {
        Alert.alert('Success', 'You are now a premium user!');
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error', e.message);
      }
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const {- entitlements } = await Purchases.restorePurchases();
      if (entitlements.active['premium']) {
        Alert.alert('Success', 'Your purchases have been restored.');
      } else {
        Alert.alert('Info', 'No purchases to restore.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (isLoading) {
    return <ActivityIndicator style={styles.center} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upgrade to Pro</Text>
      {offerings?.current?.availablePackages.map((pkg) => (
        <ProductCard key={pkg.identifier} pkg={pkg} onPress={handlePurchase} />
      ))}
      <Button title="Restore Purchases" onPress={handleRestorePurchases} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
  },
});
