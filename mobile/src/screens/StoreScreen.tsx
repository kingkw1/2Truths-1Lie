import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useOfferings } from '../hooks/useOfferings';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { ProductCard } from '../components/ProductCard';
import { TrialBanner } from '../components/TrialBanner';

export const StoreScreen: React.FC = () => {
  const { offerings, isLoading: offeringsLoading, error: offeringsError } = useOfferings();
  const { 
    isPremium, 
    isInTrial, 
    trialDaysRemaining, 
    loading: premiumLoading
  } = usePremiumStatus();
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchasing(true);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      
      const premiumEntitlement = customerInfo.entitlements.active['premium'];
      if (premiumEntitlement) {
        if (premiumEntitlement.periodType === 'trial') {
          Alert.alert(
            'Free Trial Started!', 
            `Your free trial has begun. Enjoy premium features for ${pkg.product.introPrice?.periodNumberOfUnits || 7} days!`
          );
        } else {
          Alert.alert('Success', 'You are now a premium user!');
        }
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error', e.message);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      Alert.alert('Success', 'Your purchases have been restored.');
    } catch (e: any) {
      Alert.alert('Error', 'Could not restore purchases.');
    }
  };

  const isLoading = offeringsLoading || premiumLoading;
  const error = offeringsError;

  if (isLoading) {
    return <ActivityIndicator testID="loading-indicator" style={styles.center} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Error: {error.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Trial Banner Component */}
      <TrialBanner onUpgradePress={() => {}} />

      {/* Premium Status */}
      {isPremium && !isInTrial && (
        <View style={styles.premiumBanner}>
          <Text style={styles.premiumTitle}>✨ Premium Active</Text>
          <Text style={styles.premiumText}>
            You have full access to all premium features!
          </Text>
        </View>
      )}

      {/* Header */}
      <Text style={styles.title}>
        {isPremium ? 'Manage Subscription' : 'Upgrade to Pro'}
      </Text>

      {/* Benefits Section */}
      {!isPremium && (
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Premium Benefits:</Text>
          <Text style={styles.benefitItem}>• Unlimited Challenge Creation</Text>
          <Text style={styles.benefitItem}>• Monthly 'AI Detector' Tokens</Text>
          <Text style={styles.benefitItem}>• Exclusive Pro Badge</Text>
          <Text style={styles.benefitItem}>• Priority Support</Text>
          <Text style={styles.benefitItem}>• Ad-Free Experience</Text>
        </View>
      )}

      {/* Free Trial Callout for Judge Access */}
      {!isPremium && (
        <View style={styles.judgeAccessContainer}>
          <Text style={styles.judgeAccessTitle}>🏆 Hackathon Judges</Text>
          <Text style={styles.judgeAccessText}>
            Start your free trial to evaluate all premium features during the judging period.
          </Text>
        </View>
      )}

      {/* Subscription Packages */}
      <View style={styles.packagesContainer}>
        {offerings?.current?.availablePackages.map((pkg) => (
          <ProductCard 
            key={pkg.identifier} 
            pkg={pkg} 
            onPress={handlePurchase}
            disabled={purchasing}
          />
        ))}
      </View>

      {/* Restore Purchases Button */}
      <TouchableOpacity 
        style={styles.restoreButton} 
        onPress={handleRestorePurchases}
        disabled={purchasing}
      >
        <Text style={styles.restoreButtonText}>Restore Purchases</Text>
      </TouchableOpacity>
    </ScrollView>
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
  premiumBanner: {
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  premiumText: {
    fontSize: 14,
    color: '#2E7D32',
  },
  benefitsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    lineHeight: 20,
  },
  judgeAccessContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  judgeAccessTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: 4,
  },
  judgeAccessText: {
    fontSize: 14,
    color: '#E65100',
  },
  packagesContainer: {
    marginBottom: 16,
  },
  restoreButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
