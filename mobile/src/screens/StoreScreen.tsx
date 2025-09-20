import React from 'react';
import { View, Text, Button, ActivityIndicator, Alert } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { useOfferings } from '../hooks/useOfferings';

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

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (error) {
    return <Text>Error: {error.message}</Text>;
  }

  return (
    <View>
      {offerings?.current?.availablePackages.map((pkg) => (
        <View key={pkg.identifier}>
          <Text>{pkg.product.title}</Text>
          <Text>{pkg.product.description}</Text>
          <Text>{pkg.product.priceString}</Text>
          <Button title="Buy" onPress={() => handlePurchase(pkg)} />
        </View>
      ))}
    </View>
  );
};
