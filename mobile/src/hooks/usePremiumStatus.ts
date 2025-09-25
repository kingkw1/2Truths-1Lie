import { useState, useEffect } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

interface PremiumStatus {
  isPremium: boolean;
  isInTrial: boolean;
  trialDaysRemaining: number;
  trialEndDate: Date | null;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  error: Error | null;
}

export const usePremiumStatus = (): PremiumStatus => {
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus>({
    isPremium: false,
    isInTrial: false,
    trialDaysRemaining: 0,
    trialEndDate: null,
    customerInfo: null,
    loading: true,
    error: null,
  });

  const checkPremiumStatus = async () => {
    try {
      setPremiumStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const customerInfo = await Purchases.getCustomerInfo();
      
      // Debug: Log all available entitlements
      console.log('🔍 usePremiumStatus: Available entitlements:', Object.keys(customerInfo.entitlements.active));
      console.log('🔍 usePremiumStatus: Active subscriptions:', customerInfo.activeSubscriptions);
      
      // Check for the correct entitlement name
      const premiumEntitlement = customerInfo.entitlements.active['pro_investigator'];
      
      if (premiumEntitlement) {
        const isInTrial = premiumEntitlement.willRenew && premiumEntitlement.periodType === 'trial';
        let trialDaysRemaining = 0;
        let trialEndDate: Date | null = null;
        
        if (isInTrial && premiumEntitlement.expirationDate) {
          trialEndDate = new Date(premiumEntitlement.expirationDate);
          const now = new Date();
          const diffTime = trialEndDate.getTime() - now.getTime();
          trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }
        
        setPremiumStatus({
          isPremium: true,
          isInTrial,
          trialDaysRemaining,
          trialEndDate,
          customerInfo,
          loading: false,
          error: null,
        });
      } else {
        setPremiumStatus({
          isPremium: false,
          isInTrial: false,
          trialDaysRemaining: 0,
          trialEndDate: null,
          customerInfo,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      setPremiumStatus(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  };

  useEffect(() => {
    checkPremiumStatus();
    
    // Listen for purchase updates
    const purchaseUpdateListener = (customerInfo: CustomerInfo) => {
      // Check for the correct entitlement name
      const premiumEntitlement = customerInfo.entitlements.active['pro_investigator'];
      
      if (premiumEntitlement) {
        const isInTrial = premiumEntitlement.willRenew && premiumEntitlement.periodType === 'trial';
        let trialDaysRemaining = 0;
        let trialEndDate: Date | null = null;
        
        if (isInTrial && premiumEntitlement.expirationDate) {
          trialEndDate = new Date(premiumEntitlement.expirationDate);
          const now = new Date();
          const diffTime = trialEndDate.getTime() - now.getTime();
          trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }
        
        setPremiumStatus(prev => ({
          ...prev,
          isPremium: true,
          isInTrial,
          trialDaysRemaining,
          trialEndDate,
          customerInfo,
        }));
      } else {
        setPremiumStatus(prev => ({
          ...prev,
          isPremium: false,
          isInTrial: false,
          trialDaysRemaining: 0,
          trialEndDate: null,
          customerInfo,
        }));
      }
    };

    // Add listener for customer info updates
    Purchases.addCustomerInfoUpdateListener(purchaseUpdateListener);
    
    return () => {
      // Clean up listener
      Purchases.removeCustomerInfoUpdateListener(purchaseUpdateListener);
    };
  }, []);

  return {
    ...premiumStatus,
    refresh: checkPremiumStatus,
  } as PremiumStatus & { refresh: () => Promise<void> };
};