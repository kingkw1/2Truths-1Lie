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
import { useAuth } from '../hooks/useAuth';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { ProductCard } from '../components/ProductCard';
import { TrialBanner } from '../components/TrialBanner';
import { revenueCatUserSync } from '../services/revenueCatUserSync';

export const StoreScreen: React.FC = () => {
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const { offerings, isLoading: offeringsLoading, error: offeringsError } = useOfferings();
  const { isPremium } = usePremiumStatus();
  const { user } = useAuth();
  const { balance, loading: tokenBalanceLoading, refresh: refreshTokenBalance } = useTokenBalance();
  
  // Debug RevenueCat connectivity
  React.useEffect(() => {
    const debugRevenueCat = async () => {
      try {
        console.log('🔍 DEBUG: Starting RevenueCat debug...');
        
        // Get offerings - simplified logging
        const offerings = await Purchases.getOfferings();
        
        if (offerings.current) {
          console.log('🔍 DEBUG: Available packages count:', offerings.current.availablePackages?.length || 0);
          
          // Log detailed package info including billing period
          offerings.current.availablePackages?.forEach((pkg, index) => {
            console.log(`🔍 DEBUG: Package ${index + 1}:`, {
              identifier: pkg.identifier,
              productId: pkg.product.identifier,
              productType: pkg.product.productType,
              priceString: pkg.product.priceString,
              packageType: pkg.packageType,
              title: pkg.product.title,
              description: pkg.product.description,
              subscriptionPeriod: pkg.product.subscriptionPeriod,
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
    pkg.identifier === 'pro_monthly' || 
    pkg.identifier === 'pro_annual' ||
    pkg.identifier === 'monthly' ||
    pkg.identifier === 'annual' ||
    pkg.product.productType.toString().includes('SUBSCRIPTION') ||
    pkg.packageType === 'MONTHLY' ||
    pkg.packageType === 'ANNUAL'
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
    type: pkg.product.productType,
    packageType: pkg.packageType,
    price: pkg.product.priceString
  })));
  console.log('📱 Subscription packages found:', subscriptionPackages.map(pkg => ({
    identifier: pkg.identifier,
    packageType: pkg.packageType,
    price: pkg.product.priceString
  })));
  console.log('🪙 Token packages found:', tokenPackages.map(pkg => ({
    identifier: pkg.identifier,
    price: pkg.product.priceString
  })));

  // Set default selected package to monthly when offerings load
  React.useEffect(() => {
    if (subscriptionPackages.length > 0 && !selectedPackage) {
      const monthlyPackage = subscriptionPackages.find(pkg => 
        pkg.identifier === 'pro_monthly' ||
        pkg.identifier === 'monthly' ||
        pkg.packageType === 'MONTHLY'
      ) || subscriptionPackages[0]; // Fallback to first package
      
      console.log('🔍 Setting default selected package:', monthlyPackage?.identifier);
      setSelectedPackage(monthlyPackage);
    }
  }, [subscriptionPackages, selectedPackage]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchasing(true);
      
      // Ensure RevenueCat user is synced before purchase
      console.log('🔄 Ensuring RevenueCat user is synced before purchase...');
      await revenueCatUserSync.ensureUserSynced(user?.email || null);
      
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
        
        // Refresh token balance after successful token purchase
        console.log('🔄 Refreshing token balance after successful purchase...');
        await refreshTokenBalance();
      }
    } catch (e: any) {
      // Handle user cancellation silently
      if (e.userCancelled || e.code === 'PurchaseCancelledError' || e.message?.includes('USER_CANCELED')) {
        console.log('🔍 Purchase cancelled by user - no error shown');
        // Don't show any error to user when they cancel
      } else {
        // Only show errors for actual problems
        console.error('🔍 Purchase error:', e);
        Alert.alert('Purchase Error', e.message || 'Something went wrong with your purchase. Please try again.');
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

  // Debug offerings structure
  console.log('🔍 Offerings object:', {
    hasOfferings: !!offerings,
    hasCurrent: !!offerings?.current,
    currentIdentifier: offerings?.current?.identifier,
    packagesCount: offerings?.current?.availablePackages?.length || 0
  });

  return (
    <SafeAreaView style={styles.safeArea}>
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
          {/* Benefits Section */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Premium Benefits:</Text>
            <Text style={styles.benefitItem}>• Unlimited Challenge Creation</Text>
            <Text style={styles.benefitItem}>• Monthly 'AI Detector' Tokens</Text>
            <Text style={styles.benefitItem}>• Exclusive Pro Badge</Text>
            <Text style={styles.benefitItem}>• Priority Support</Text>
            <Text style={styles.benefitItem}>• Ad-Free Experience</Text>
          </View>

          {/* Plan Selector */}
          <View style={styles.planSelectorContainer}>
            <View style={styles.planOptionsContainer}>
              {/* Monthly Plan Selector */}
              <TouchableOpacity 
                style={[
                  styles.planSelector,
                  selectedPackage?.packageType === 'MONTHLY' && styles.selectedPlan
                ]}
                onPress={() => {
                  const monthlyPackage = subscriptionPackages.find(pkg => 
                    pkg.identifier === 'pro_monthly' ||
                    pkg.identifier === 'monthly' ||
                    pkg.packageType === 'MONTHLY'
                  );
                  if (monthlyPackage) {
                    console.log('🔍 Selected monthly plan:', monthlyPackage.identifier);
                    setSelectedPackage(monthlyPackage);
                  }
                }}
                disabled={purchasing}
              >
                <Text style={[
                  styles.planTitle,
                  selectedPackage?.packageType === 'MONTHLY' && styles.selectedPlanText
                ]}>
                  Monthly
                </Text>
                <Text style={[
                  styles.planPrice,
                  selectedPackage?.packageType === 'MONTHLY' && styles.selectedPlanText
                ]}>
                  $5/mo
                </Text>
              </TouchableOpacity>

              {/* Annual Plan Selector */}
              <TouchableOpacity 
                style={[
                  styles.planSelector,
                  selectedPackage?.packageType === 'ANNUAL' && styles.selectedPlan
                ]}
                onPress={() => {
                  const annualPackage = subscriptionPackages.find(pkg => 
                    pkg.identifier === 'pro_annual' ||
                    pkg.identifier === 'annual' ||
                    pkg.packageType === 'ANNUAL'
                  );
                  if (annualPackage) {
                    console.log('🔍 Selected annual plan:', annualPackage.identifier);
                    setSelectedPackage(annualPackage);
                  }
                }}
                disabled={purchasing}
              >
                {/* Save 17% Badge */}
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsBadgeText}>Save 17%!</Text>
                </View>
                
                <Text style={[
                  styles.planTitle,
                  selectedPackage?.packageType === 'ANNUAL' && styles.selectedPlanText
                ]}>
                  Annual
                </Text>
                <Text style={[
                  styles.planPrice,
                  selectedPackage?.packageType === 'ANNUAL' && styles.selectedPlanText
                ]}>
                  $50/yr
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Single CTA Button */}
          <TouchableOpacity 
            style={[
              styles.primaryCtaButton,
              !selectedPackage && styles.disabledButton
            ]}
            onPress={() => {
              if (selectedPackage) {
                console.log('🔍 Starting free trial with package:', selectedPackage.identifier);
                handlePurchase(selectedPackage);
              } else {
                console.log('🔍 No package selected');
                Alert.alert('Please select a plan', 'Choose Monthly or Annual plan to continue');
              }
            }}
            disabled={purchasing || !selectedPackage}
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
              {/* Small Token Pack */}
              <TouchableOpacity 
                style={styles.tokenPackageCard}
                onPress={() => {
                  const smallPack = tokenPackages.find(pkg => pkg.identifier === 'token_pack_small');
                  if (smallPack) handlePurchase(smallPack);
                }}
                disabled={purchasing}
              >
                <Text style={styles.tokenAmount}>5 Tokens</Text>
                <Text style={styles.tokenPrice}>$1.99</Text>
                <Text style={styles.tokenPerUnit}>($0.40 each)</Text>
              </TouchableOpacity>
              
              {/* Large Token Pack */}
              <View style={styles.tokenPackageWrapper}>
                <View style={styles.mostPopularBadge}>
                  <Text style={styles.badgeText}>Most Popular</Text>
                </View>
                <TouchableOpacity 
                  style={styles.tokenPackageCard}
                  onPress={() => {
                    const largePack = tokenPackages.find(pkg => pkg.identifier === 'token_pack_large');
                    if (largePack) handlePurchase(largePack);
                  }}
                  disabled={purchasing}
                >
                  <Text style={styles.tokenAmount}>25 Tokens</Text>
                  <Text style={styles.tokenPrice}>$7.99</Text>
                  <Text style={styles.tokenPerUnit}>($0.32 each)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Token Balance Display */}
          {!tokenBalanceLoading && (
            <View style={styles.currentBalanceContainer}>
              <Text style={styles.currentBalanceText}>
                Your Current Balance: {balance} 🪙
              </Text>
            </View>
          )}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
  // Plan Selector Styles
  planSelectorContainer: {
    marginBottom: 20,
  },
  planOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  planSelector: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedPlan: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
    shadowColor: '#2196F3',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  selectedPlanText: {
    color: '#1976D2',
  },
  savingsBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  savingsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
  },
  tokenPackageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tokenAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  tokenPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  tokenPerUnit: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  restoreButton: {
    backgroundColor: '#6C757D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  restoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  currentBalanceContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  currentBalanceText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
  },
});
