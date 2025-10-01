import React, { useState, useContext } from 'react';
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
import { TokenAPI, makeAuthenticatedRequest, getApiBaseUrl } from '../services/tokenAPI';
import { ThemeContext } from '../context/ThemeContext';

export const StoreScreen: React.FC = () => {
  const { colors } = useContext(ThemeContext);
  const [purchasing, setPurchasing] = useState(false);
  const [pollingTokens, setPollingTokens] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const { offerings, isLoading: offeringsLoading, error: offeringsError } = useOfferings();
  const { isPremium, customerInfo } = usePremiumStatus();
  const { user } = useAuth();
  const { balance, loading: tokenBalanceLoading, refresh: refreshTokenBalance } = useTokenBalance();
  const styles = getStyles(colors);
  
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
      
      // Check if this is a token purchase before making the purchase
      const isTokenPurchase = pkg.product.identifier.toLowerCase().includes('token');
      const currentTokenBalance = balance; // Get current balance before purchase
      
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
      } else if (isTokenPurchase) {
        // Token purchase - implement robust polling mechanism
        console.log('🔄 Starting token balance polling after purchase...');
        setPollingTokens(true);
        
        let pollCount = 0;
        const maxPolls = 8; // 15 seconds (8 * 2 = 16 seconds max)
        let pollingInterval: NodeJS.Timeout | null = null;
        let timeoutHandle: NodeJS.Timeout | null = null;
        
        const startPolling = (): Promise<void> => {
          return new Promise((resolve, reject) => {
            pollingInterval = setInterval(async () => {
              try {
                pollCount++;
                console.log(`🔄 Polling attempt ${pollCount}/${maxPolls} for token balance update...`);
                
                // Get fresh balance directly from API for most reliable check
                const balanceResponse = await TokenAPI.getBalance();
                const newBalance = balanceResponse.balance;
                
                console.log(`🔍 Polling balance check - Current: ${newBalance}, Original: ${currentTokenBalance}`);
                
                // Check if balance has increased
                if (newBalance > currentTokenBalance) {
                  console.log(`✅ Token balance updated! Old: ${currentTokenBalance}, New: ${newBalance}`);
                  
                  // Clear polling
                  if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                  }
                  if (timeoutHandle) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                  }
                  
                  // Refresh the hook's balance to update UI
                  await refreshTokenBalance();
                  setPollingTokens(false);
                  
                  // Show success message
                  Alert.alert(
                    'Success!', 
                    `Your tokens have been added to your account. New balance: ${newBalance} tokens.`
                  );
                  
                  resolve();
                  return;
                }
                
                // Stop polling if max attempts reached
                if (pollCount >= maxPolls) {
                  if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                  }
                  
                  setPollingTokens(false);
                  console.log('⚠️ Token balance polling reached maximum attempts');
                  Alert.alert(
                    'Purchase Processing', 
                    'There was a delay processing your purchase. Please restart the app to see your new balance.'
                  );
                  
                  resolve();
                }
              } catch (error) {
                console.error('🔍 Error during token balance polling:', error);
                // Continue polling even if one attempt fails
                pollCount--; // Don't count failed attempts
              }
            }, 2000); // Poll every 2 seconds
            
            // Set timeout to stop polling after 15 seconds
            timeoutHandle = setTimeout(() => {
              if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
              }
              
              setPollingTokens(false);
              console.log('⚠️ Token balance polling timed out after 15 seconds');
              Alert.alert(
                'Purchase Processing', 
                'There was a delay processing your purchase. Please restart the app to see your new balance.'
              );
              
              resolve();
            }, 15000); // 15 second timeout
          });
        };
        
        // Start the polling process
        await startPolling();
        
        // If polling didn't work, try manual fallback
        if (pollingTokens) {
          console.log('🔧 Polling timeout reached, trying manual token addition fallback...');
          try {
            // Call our debug endpoint to manually add tokens
            const result = await makeAuthenticatedRequest(
              `/api/v1/tokens/debug/simulate-purchase?user_email=${encodeURIComponent(user?.email || '')}&product_id=${encodeURIComponent(pkg.product.identifier)}`,
              { method: 'POST' }
            );
            
            if (result.success) {
              console.log(`✅ Manual token addition successful: ${result.tokens_added} tokens added`);
              await refreshTokenBalance();
              setPollingTokens(false);
              
              Alert.alert(
                'Purchase Complete!', 
                `Your ${result.tokens_added} tokens have been added to your account. New balance: ${result.new_balance} tokens.`
              );
            } else {
              console.error('❌ Manual token addition failed:', result.error);
            }
          } catch (error) {
            console.error('🔧 Manual fallback failed:', error);
          }
        }
        
      } else {
        // Non-token, non-premium purchase
        Alert.alert('Purchase Successful!', `You've purchased ${pkg.identifier}.`);
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
      setPollingTokens(false);
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
    return <ActivityIndicator testID="loading-indicator" color={colors.primary} style={styles.center} />;
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
        {isPremium ? 'Token Store' : 'Upgrade to Pro'}
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
                disabled={purchasing || pollingTokens}
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
                disabled={purchasing || pollingTokens}
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
            disabled={purchasing || pollingTokens || !selectedPackage}
          >
            <Text style={styles.primaryCtaText}>
              {purchasing ? (pollingTokens ? 'Verifying Purchase...' : 'Processing...') : 'Start 7-Day Free Trial'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* À La Carte Token Section - Prioritized for Premium Users */}
      {tokenPackages.length > 0 && (
        <>
          {/* Visual Separator - Only show for non-premium users */}
          {!isPremium && (
            <View style={styles.separatorContainer}>
              <Text style={styles.separatorText}>— Or, Get a Few Tokens —</Text>
            </View>
          )}

          {/* Token Packages */}
          <View style={styles.tokenSection}>
            <Text style={styles.tokenSectionTitle}>
              {isPremium ? 'Get More Tokens' : 'Token Packs'}
            </Text>
            <View style={styles.tokenPackagesContainer}>
              {/* Small Token Pack */}
              <TouchableOpacity 
                style={styles.tokenPackageCard}
                onPress={() => {
                  const smallPack = tokenPackages.find(pkg => pkg.identifier === 'token_pack_small');
                  if (smallPack) handlePurchase(smallPack);
                }}
                disabled={purchasing || pollingTokens}
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
                  disabled={purchasing || pollingTokens}
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
              {pollingTokens && (
                <View style={styles.pollingIndicator}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.pollingText}>Verifying your purchase...</Text>
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Subscription Management Card for Premium Users */}
      {isPremium && customerInfo && (
        <View style={styles.subscriptionManagementCard}>
          <Text style={styles.subscriptionCardTitle}>Your Subscription</Text>
          
          {/* Current Plan Display */}
          <View style={styles.currentPlanContainer}>
            <Text style={styles.currentPlanLabel}>Current Plan:</Text>
            <Text style={styles.currentPlanValue}>
              {(() => {
                const activeSubscriptions = customerInfo.activeSubscriptions;
                if (activeSubscriptions.includes('pro_monthly') || activeSubscriptions.includes('pro_monthly:pro-monthly')) {
                  return 'Pro Monthly';
                } else if (activeSubscriptions.includes('pro_annual') || activeSubscriptions.includes('pro_annual:pro-annual')) {
                  return 'Pro Annual';
                } else {
                  return 'Pro Subscription';
                }
              })()}
            </Text>
          </View>

          {/* Conditional Upgrade Button */}
          {(() => {
            const activeSubscriptions = customerInfo.activeSubscriptions;
            const isMonthly = activeSubscriptions.some(sub => 
              sub.includes('monthly') || sub.includes('pro_monthly')
            );
            
            if (isMonthly) {
              const annualPackage = subscriptionPackages.find(pkg => 
                pkg.identifier === 'pro_annual' || 
                pkg.identifier === 'annual' ||
                pkg.packageType === 'ANNUAL'
              );
              
              if (annualPackage) {
                return (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => handlePurchase(annualPackage)}
                    disabled={purchasing || pollingTokens}
                  >
                    <Text style={styles.upgradeButtonText}>
                      {purchasing ? (pollingTokens ? 'Verifying Purchase...' : 'Processing...') : 'Upgrade to Annual & Save 17%'}
                    </Text>
                  </TouchableOpacity>
                );
              }
            }
            return null;
          })()}

          {/* Management Options */}
          <View style={styles.managementOptionsContainer}>
            <TouchableOpacity
              style={styles.manageSubscriptionButton}
              onPress={() => {
                // Open subscription management
                if (Platform.OS === 'ios') {
                  Purchases.showManageSubscriptions();
                } else {
                  // For Android, you might need to open Play Store subscription page
                  Alert.alert(
                    'Manage Subscription',
                    'To manage your subscription, please visit the Google Play Store.',
                    [{ text: 'OK' }]
                  );
                }
              }}
            >
              <Text style={styles.manageSubscriptionButtonText}>Manage Subscription</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.restorePurchasesLink}
              onPress={handleRestorePurchases}
              disabled={purchasing || pollingTokens}
            >
              <Text style={styles.restorePurchasesLinkText}>Restore Purchases</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Restore Purchases Button - Only for non-premium users */}
      {!isPremium && (
        <TouchableOpacity 
          style={styles.restoreButton} 
          onPress={handleRestorePurchases}
          disabled={purchasing || pollingTokens}
        >
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: colors.text,
  },
  premiumBanner: {
    backgroundColor: colors.successBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.successText,
    marginBottom: 4,
  },
  premiumText: {
    fontSize: 14,
    color: colors.successText,
  },
  heroSection: {
    backgroundColor: colors.storeHeroBackground,
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
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    marginBottom: 4,
    lineHeight: 20,
  },
  mostPopularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: colors.storeBadgeBackground,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  badgeText: {
    color: colors.storeBadgeText,
    fontSize: 12,
    fontWeight: 'bold',
  },
  primaryCtaButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryCtaText: {
    color: colors.card,
    fontSize: 18,
    fontWeight: 'bold',
  },
  separatorContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  separatorText: {
    fontSize: 16,
    color: colors.storeSeparatorText,
    fontStyle: 'italic',
  },
  tokenSection: {
    backgroundColor: colors.storeHeroBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tokenSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
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
    color: colors.placeholder,
    marginTop: 4,
    fontStyle: 'italic',
  },
  packagesContainer: {
    marginBottom: 16,
  },
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
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
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
    borderColor: colors.primary,
    backgroundColor: colors.selectedCard,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.storePlanPrice,
  },
  selectedPlanText: {
    color: colors.storeSelectedPlanText,
  },
  savingsBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    backgroundColor: colors.storeBadgeBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  savingsBadgeText: {
    color: colors.storeBadgeText,
    fontSize: 10,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: colors.disabled,
    shadowOpacity: 0,
  },
  tokenPackageCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
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
    color: colors.text,
    marginBottom: 4,
  },
  tokenPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.storePlanPrice,
    marginBottom: 4,
  },
  tokenPerUnit: {
    fontSize: 12,
    color: colors.placeholder,
    fontStyle: 'italic',
  },
  restoreButton: {
    backgroundColor: colors.storeRestoreButtonBackground,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  restoreButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  currentBalanceContainer: {
    backgroundColor: colors.storeBalanceBackground,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentBalanceText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.storeBalanceText,
    textAlign: 'center',
  },
  pollingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pollingText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  // New styles for subscription management card
  subscriptionManagementCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subscriptionCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  currentPlanContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentPlanLabel: {
    fontSize: 16,
    color: colors.placeholder,
    fontWeight: '500',
  },
  currentPlanValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  managementOptionsContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  manageSubscriptionButton: {
    backgroundColor: colors.storeRestoreButtonBackground,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageSubscriptionButtonText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  restorePurchasesLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restorePurchasesLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
