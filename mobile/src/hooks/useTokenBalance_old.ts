import { useState, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

interface TokenBalanceState {
  balance: number;
  loading: boolean;
  error: Error | null;
}

interface TokenBalance extends TokenBalanceState {
  refresh: () => Promise<void>;
}

/**
 * React Native hook for fetching token balance from RevenueCat
 * 
 * This hook integrates with RevenueCat's CustomerInfo to track virtual currency
 * balances. The tokens are managed via RevenueCat's setAttributes system.
 * 
 * Note: Since RevenueCat doesn't natively support virtual currencies for non-consumable
 * purchases, this hook simulates token tracking using subscriber attributes.
 * 
 * @returns {TokenBalance} Object containing balance, loading state, and error
 * 
 * Usage:
 * ```tsx
 * const { balance, loading, error } = useTokenBalance();
 * 
 * if (loading) return <LoadingSpinner />;
 * if (error) return <ErrorDisplay error={error} />;
 * return <Text>Token Balance: {balance}</Text>;
 * ```
 */
export const useTokenBalance = (): TokenBalance => {
  const [tokenBalance, setTokenBalance] = useState<TokenBalanceState>({
    balance: 0,
    loading: true,
    error: null,
  });

  const fetchTokenBalance = useCallback(async (): Promise<number> => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      
      // In RevenueCat 9.x, subscriber attributes may not be immediately available
      // or may be under a different property. Let's check all possible locations
      console.log('🔍 CustomerInfo structure:', {
        hasSubscriberAttributes: 'subscriberAttributes' in customerInfo,
        hasCustomAttributes: 'customAttributes' in customerInfo,
        hasAttributes: 'attributes' in customerInfo,
        allKeys: Object.keys(customerInfo)
      });
      
      // Debug: Log the actual subscriber attributes content
      const customerInfoAny = customerInfo as any;
      if (customerInfoAny.subscriberAttributes) {
        console.log('🔍 SubscriberAttributes content:', JSON.stringify(customerInfoAny.subscriberAttributes, null, 2));
      } else {
        console.log('🔍 No subscriberAttributes found');
      }
      
      // Try different possible attribute access patterns
      let tokensStr = '0';
      
      if (customerInfoAny.subscriberAttributes && customerInfoAny.subscriberAttributes.tokens) {
        if (typeof customerInfoAny.subscriberAttributes.tokens === 'object') {
          tokensStr = customerInfoAny.subscriberAttributes.tokens.value || '0';
        } else {
          tokensStr = customerInfoAny.subscriberAttributes.tokens || '0';
        }
      } else if (customerInfoAny.customAttributes && customerInfoAny.customAttributes.tokens) {
        tokensStr = customerInfoAny.customAttributes.tokens || '0';
      } else if (customerInfoAny.attributes && customerInfoAny.attributes.tokens) {
        tokensStr = customerInfoAny.attributes.tokens || '0';
      }
      
      const balance = parseInt(tokensStr, 10);
      
      console.log('🪙 Token balance fetched:', balance, 'from tokens string:', tokensStr);
      return balance;
    } catch (error) {
      console.error('❌ Failed to fetch token balance:', error);
      return 0;
    }
  }, []);

  useEffect(() => {
    fetchTokenBalance();
    
    // Listen for customer info updates (e.g., after purchases)
    const purchaseUpdateListener = (customerInfo: CustomerInfo) => {
      const customerAttributes = customerInfo as any;
      
      let balance = 0;
      if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
        const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
        if (tokenAttribute.value) {
          const parsedBalance = parseInt(tokenAttribute.value, 10);
          balance = isNaN(parsedBalance) ? 0 : parsedBalance;
        }
      }
      
      setTokenBalance(prev => ({
        ...prev,
        balance,
        error: null,
      }));
      
      console.log(`🪙 Token balance updated: ${balance}`);
    };

    // Add listener for customer info updates
    Purchases.addCustomerInfoUpdateListener(purchaseUpdateListener);
    
    return () => {
      // Clean up listener
      Purchases.removeCustomerInfoUpdateListener(purchaseUpdateListener);
    };
  }, []);

  const refreshWrapper = useCallback(async (): Promise<void> => {
    setTokenBalance(prev => ({ ...prev, loading: true, error: null }));
    try {
      const newBalance = await fetchTokenBalance();
      setTokenBalance(prev => ({ ...prev, balance: newBalance, loading: false }));
    } catch (error) {
      setTokenBalance(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      }));
    }
  }, [fetchTokenBalance]);

  return {
    balance: tokenBalance.balance,
    loading: tokenBalance.loading,
    error: tokenBalance.error,
    refresh: refreshWrapper,
  };
};

/**
 * Helper function to update token balance in RevenueCat
 * 
 * Call this function when tokens are earned or spent to sync with RevenueCat
 * 
 * @param newBalance - The new token balance to set
 * @returns Promise<void>
 * 
 * Usage:
 * ```tsx
 * import { updateTokenBalance } from './hooks/useTokenBalance';
 * 
 * // After earning tokens
 * await updateTokenBalance(currentBalance + tokensEarned);
 * 
 * // After spending tokens  
 * await updateTokenBalance(currentBalance - tokensSpent);
 * ```
 */
export const updateTokenBalance = async (newBalance: number): Promise<void> => {
  try {
    // Update the tokens attribute in RevenueCat
    await Purchases.setAttributes({
      tokens: newBalance.toString(),
    });
    
    // Force sync to ensure attributes are persisted
    try {
      await Purchases.syncAttributesAndOfferingsIfNeeded();
      console.log(`🪙 Token balance updated and synced to: ${newBalance}`);
    } catch (syncError) {
      console.warn(`⚠️ Token balance updated to ${newBalance} but sync failed:`, syncError);
    }
    
  } catch (error: any) {
    // Handle Expo Go mode gracefully
    if (error.message?.includes('singleton instance') || error.message?.includes('Invalid API key')) {
      console.log(`🌐 Demo mode: Token balance would be updated to: ${newBalance}`);
      return;
    }
    console.error('❌ Failed to update token balance:', error);
    throw error;
  }
};

/**
 * Helper function to add tokens to current balance
 * 
 * @param tokensToAdd - Number of tokens to add
 * @returns Promise<number> - The new balance after adding tokens
 */
export const addTokens = async (tokensToAdd: number): Promise<number> => {
  try {
    let customerInfo: any;
    let currentBalance = 0;
    
    try {
      customerInfo = await Purchases.getCustomerInfo();
      const customerAttributes = customerInfo as any;
      
      if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
        const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
        if (tokenAttribute.value) {
          const parsedBalance = parseInt(tokenAttribute.value, 10);
          currentBalance = isNaN(parsedBalance) ? 0 : parsedBalance;
        }
      }
    } catch (error: any) {
      // Handle Expo Go browser mode
      if (error.message?.includes('singleton instance') || error.message?.includes('Invalid API key')) {
        console.log('🌐 RevenueCat not available (Expo Go mode) - using demo token adding');
        currentBalance = 50; // Demo balance
        customerInfo = null;
      } else {
        throw error;
      }
    }
    
    const newBalance = currentBalance + tokensToAdd;
    
    // Only try to update if RevenueCat is available
    if (customerInfo) {
      await updateTokenBalance(newBalance);
      
      // Give a small delay for attribute sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`🌐 Demo: Added ${tokensToAdd} tokens. New balance would be: ${newBalance}`);
    }
    
    console.log(`🪙 Added ${tokensToAdd} tokens. New balance: ${newBalance}`);
    return newBalance;
  } catch (error) {
    console.error('❌ Failed to add tokens:', error);
    throw error;
  }
};

/**
 * Helper function to spend tokens from current balance
 * 
 * @param tokensToSpend - Number of tokens to spend
 * @returns Promise<number> - The new balance after spending tokens
 * @throws Error if insufficient tokens
 */
export const spendTokens = async (tokensToSpend: number): Promise<number> => {
  try {
    let customerInfo: any;
    let currentBalance = 0;
    
    try {
      customerInfo = await Purchases.getCustomerInfo();
      const customerAttributes = customerInfo as any;
      
      if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
        const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
        if (tokenAttribute.value) {
          const parsedBalance = parseInt(tokenAttribute.value, 10);
          currentBalance = isNaN(parsedBalance) ? 0 : parsedBalance;
        }
      }
    } catch (error: any) {
      // Handle Expo Go browser mode
      if (error.message?.includes('singleton instance') || error.message?.includes('Invalid API key')) {
        console.log('🌐 RevenueCat not available (Expo Go mode) - using demo token spending');
        currentBalance = 50; // Demo balance
      } else {
        throw error;
      }
    }
    
    if (currentBalance < tokensToSpend) {
      throw new Error(`Insufficient tokens. Current: ${currentBalance}, Required: ${tokensToSpend}`);
    }
    
    const newBalance = currentBalance - tokensToSpend;
    
    // Only try to update if RevenueCat is available
    if (customerInfo) {
      await updateTokenBalance(newBalance);
    } else {
      console.log(`🌐 Demo: Spent ${tokensToSpend} tokens. New balance would be: ${newBalance}`);
    }
    
    console.log(`🪙 Spent ${tokensToSpend} tokens. New balance: ${newBalance}`);
    return newBalance;
  } catch (error) {
    console.error('❌ Failed to spend tokens:', error);
    throw error;
  }
};

/**
 * Helper function to refresh token balance after a successful purchase
 * 
 * Call this function after completing token pack purchases to immediately
 * update the balance display. This ensures the UI reflects the new tokens
 * without waiting for the automatic refresh.
 * 
 * @param tokensEarned - Optional: Number of tokens earned from the purchase
 * @returns Promise<number> - The updated token balance
 * 
 * Usage:
 * ```tsx
 * import { refreshTokenBalanceAfterPurchase } from './hooks/useTokenBalance';
 * 
 * // After successful purchase
 * const { customerInfo } = await Purchases.purchasePackage(package);
 * const newBalance = await refreshTokenBalanceAfterPurchase(50); // 50 tokens earned
 * Alert.alert('Success!', `Purchase complete! New balance: ${newBalance}`);
 * ```
 */
export const refreshTokenBalanceAfterPurchase = async (tokensEarned?: number): Promise<number> => {
  try {
    console.log('🔄 Refreshing token balance after purchase...');
    
    // Force refresh customer info from RevenueCat servers
    const customerInfo = await Purchases.getCustomerInfo();
    
    const customerAttributes = customerInfo as any;
    let balance = 0;
    
    // Parse current balance from RevenueCat
    if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
      const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
      if (tokenAttribute.value) {
        const parsedBalance = parseInt(tokenAttribute.value, 10);
        balance = isNaN(parsedBalance) ? 0 : parsedBalance;
      }
    }
    
    // If tokens were earned and not yet reflected, add them
    if (tokensEarned && tokensEarned > 0) {
      const newBalance = balance + tokensEarned;
      await updateTokenBalance(newBalance);
      console.log(`🪙 Added ${tokensEarned} tokens from purchase. New balance: ${newBalance}`);
      return newBalance;
    }
    
    console.log(`🪙 Token balance after purchase: ${balance}`);
    return balance;
    
  } catch (error) {
    console.error('❌ Failed to refresh token balance after purchase:', error);
    throw error;
  }
};

/**
 * Helper function to handle token pack purchases
 * 
 * This function combines the purchase flow with automatic token balance updates.
 * It handles the entire flow from purchase to token balance refresh.
 * 
 * @param packageToPurchase - RevenueCat package for the token pack
 * @param expectedTokens - Number of tokens expected from this purchase
 * @returns Promise<{ customerInfo: CustomerInfo, newBalance: number }>
 * 
 * Usage:
 * ```tsx
 * import { purchaseTokenPack } from './hooks/useTokenBalance';
 * 
 * const handlePurchase = async () => {
 *   try {
 *     const { customerInfo, newBalance } = await purchaseTokenPack(package, 50);
 *     Alert.alert('Success!', `50 tokens added! New balance: ${newBalance}`);
 *   } catch (error) {
 *     Alert.alert('Error', error.message);
 *   }
 * };
 * ```
 */
export const purchaseTokenPack = async (
  packageToPurchase: any,
  expectedTokens: number
): Promise<{ customerInfo: any, newBalance: number }> => {
  try {
    console.log(`🛒 Starting token pack purchase: ${expectedTokens} tokens`);
    
    // Execute the purchase
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    console.log('✅ Purchase completed successfully');
    
    // Add the earned tokens to the balance
    const newBalance = await addTokens(expectedTokens);
    
    console.log(`🪙 Token pack purchase complete! Added ${expectedTokens} tokens. New balance: ${newBalance}`);
    
    return { customerInfo, newBalance };
    
  } catch (error: any) {
    console.error('❌ Token pack purchase failed:', error);
    
    // Re-throw with more context
    if (error.userCancelled) {
      throw new Error('Purchase was cancelled');
    } else if (error.message?.includes('credentials')) {
      throw new Error('There was a credentials issue. Please try again.');
    } else {
      throw new Error(`Purchase failed: ${error.message || 'Unknown error'}`);
    }
  }
};