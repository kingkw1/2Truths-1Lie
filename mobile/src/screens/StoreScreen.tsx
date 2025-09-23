import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Platform,
  ActivityIndicator
} from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOfferings } from '../hooks/useOfferings';
import { usePremiumStatus } from '../hooks/usePremiumStatus';
import { ProductCard } from '../components/ProductCard';
import { TrialBanner } from '../components/TrialBanner';
import { revenueCatUserSync } from '../services/revenueCatUserSync';

export const StoreScreen: React.FC = () => {
  const [purchasing, setPurchasing] = useState(false);
  const { offerings, isLoading: offeringsLoading, error: offeringsError } = useOfferings();
  const { isPremium } = usePremiumStatus();
  
  // Debug RevenueCat connectivity
  React.useEffect(() => {
    const debugRevenueCat = async () => {
      try {
        console.log('🔍 DEBUG: Starting RevenueCat debug...');
        
        // Get offerings - simplified logging
        const offerings = await Purchases.getOfferings();
        
        if (offerings.current) {
          console.log('🔍 DEBUG: Available packages count:', offerings.current.availablePackages?.length || 0);
          
          // Log only essential package info
          offerings.current.availablePackages?.forEach((pkg, index) => {
            console.log(`🔍 DEBUG: Package ${index + 1}:`, {
              identifier: pkg.identifier,
              productId: pkg.product.identifier,
              productType: pkg.product.productType,
              priceString: pkg.product.priceString,
            });
          });
        } else {
          console.log('🔍 DEBUG: No current offering found');
        }
        
      } catch (error) {
        console.error('🔍 DEBUG: RevenueCat error:', error);
      }
    };
    
    debugRevenueCat();
  }, []);

  // Filter and separate product packages
  const allPackages = offerings?.current?.availablePackages || [];
  
  const subscriptionPackages = allPackages.filter(pkg => 
    pkg.identifier === 'pro_monthly' || pkg.identifier === 'pro_annual'
  );
  
  const tokenPackages = allPackages.filter(pkg => 
    pkg.identifier.includes('token_pack') || 
    pkg.identifier.includes('token') ||
    pkg.product.productType === 'NON_CONSUMABLE' ||
    pkg.product.productType === 'CONSUMABLE'
  );

  // Debug logging
  console.log('🛍️ All available packages:', allPackages.map(pkg => ({
    identifier: pkg.identifier,
    title: pkg.product.title,
    type: pkg.product.productType
  })));
  console.log('📱 Subscription packages:', subscriptionPackages.length);
  console.log('🪙 Token packages:', tokenPackages.length);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchasing(true);
      
      // Ensure RevenueCat user is synced before purchase
      console.log('🔄 Ensuring RevenueCat user is synced before purchase...');
      await revenueCatUserSync.ensureUserSynced();
      
      // Log the current RevenueCat user for verification
      const customerInfo = await Purchases.getCustomerInfo();
      console.log(`🆔 Making purchase with RevenueCat User ID: ${customerInfo.originalAppUserId}`);
      
      const { customerInfo: purchaseCustomerInfo } = await Purchases.purchasePackage(pkg);
      
      const premiumEntitlement = purchaseCustomerInfo.entitlements.active['premium'];
      if (premiumEntitlement) {
        if (premiumEntitlement.periodType === 'trial') {
          Alert.alert(
            'Free Trial Started!', 
            `Your free trial has begun. Enjoy premium features for ${pkg.product.introPrice?.periodNumberOfUnits || 7} days!`
          );
        } else {
          Alert.alert('Success', 'You are now a premium user!');
        }
      } else {
        // Token purchase
        Alert.alert('Purchase Successful!', `You've purchased ${pkg.identifier}. Tokens will be added to your account shortly.`);
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

  const isLoading = offeringsLoading;
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
      {isPremium && (
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

      {/* Subscription Hero Section */}
      {!isPremium && (
        <View style={styles.heroSection}>
          {/* Free Trial Callout for Judge Access */}
          <View style={styles.judgeAccessContainer}>
            <Text style={styles.judgeAccessTitle}>🏆 Hackathon Judges</Text>
            <Text style={styles.judgeAccessText}>
              Start your free trial to evaluate all premium features during the judging period.
            </Text>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Premium Benefits:</Text>
            <Text style={styles.benefitItem}>• Unlimited Challenge Creation</Text>
            <Text style={styles.benefitItem}>• Monthly 'AI Detector' Tokens</Text>
            <Text style={styles.benefitItem}>• Exclusive Pro Badge</Text>
            <Text style={styles.benefitItem}>• Priority Support</Text>
            <Text style={styles.benefitItem}>• Ad-Free Experience</Text>
          </View>

          {/* Subscription Packages */}
          <View style={styles.subscriptionPackagesContainer}>
            {subscriptionPackages.map((pkg) => (
              <View key={pkg.identifier} style={styles.packageWithBadge}>
                {pkg.identifier === 'pro_annual' && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.badgeText}>Best Value - Save 17%!</Text>
                  </View>
                )}
                <ProductCard 
                  pkg={pkg} 
                  onPress={handlePurchase}
                  disabled={purchasing}
                />
              </View>
            ))}
          </View>

          {/* Primary CTA Button */}
          <TouchableOpacity 
            style={styles.primaryCtaButton}
            onPress={() => {
              const preferredPackage = subscriptionPackages.find(pkg => pkg.identifier === 'pro_annual') 
                || subscriptionPackages[0];
              if (preferredPackage) {
                handlePurchase(preferredPackage);
              }
            }}
            disabled={purchasing || subscriptionPackages.length === 0}
          >
            <Text style={styles.primaryCtaText}>
              {purchasing ? 'Processing...' : 'Start 7-Day Free Trial'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* À La Carte Token Section */}
      {tokenPackages.length > 0 && (
        <>
          {/* Visual Separator */}
          <View style={styles.separatorContainer}>
            <Text style={styles.separatorText}>— Or, Get a Few Tokens —</Text>
          </View>

          {/* Token Packages */}
          <View style={styles.tokenSection}>
            <Text style={styles.tokenSectionTitle}>Token Packs</Text>
            <View style={styles.tokenPackagesContainer}>
              {tokenPackages.map((pkg) => (
                <View key={pkg.identifier} style={styles.tokenPackageWrapper}>
                  {pkg.identifier === 'token_pack_large' && (
                    <View style={styles.mostPopularBadge}>
                      <Text style={styles.badgeText}>Most Popular</Text>
                    </View>
                  )}
                  <ProductCard 
                    pkg={pkg} 
                    onPress={handlePurchase}
                    disabled={purchasing}
                  />
                  {/* Per-unit cost display */}
                  <Text style={styles.perUnitCost}>
                    {pkg.identifier === 'token_pack_small' && '($1.00 each)'}
                    {pkg.identifier === 'token_pack_medium' && '($0.01 each)'}
                    {pkg.identifier === 'token_pack_large' && '($0.20 each)'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Existing subscription packages for premium users */}
      {isPremium && (
        <View style={styles.packagesContainer}>
          {subscriptionPackages.map((pkg) => (
            <ProductCard 
              key={pkg.identifier} 
              pkg={pkg} 
              onPress={handlePurchase}
              disabled={purchasing}
            />
          ))}
        </View>
      )}

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
  
  // Hero Section Styles
  heroSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  benefitsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  
  subscriptionPackagesContainer: {
    marginBottom: 16,
  },
  
  packageWithBadge: {
    position: 'relative',
    marginBottom: 12,
  },
  
  bestValueBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#FF5722',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  
  mostPopularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  primaryCtaButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2196F3',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // À La Carte Section Styles
  separatorContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  
  separatorText: {
    fontSize: 16,
    color: '#666666',
    fontStyle: 'italic',
  },
  
  tokenSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  
  tokenSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  
  tokenPackagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  
  tokenPackageWrapper: {
    position: 'relative',
    flex: 1,
    marginHorizontal: 4,
    maxWidth: '48%',
  },
  
  perUnitCost: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontStyle: 'italic',
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
