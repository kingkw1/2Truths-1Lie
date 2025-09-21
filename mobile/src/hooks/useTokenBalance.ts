import { useState, useEffect } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

interface TokenBalance {
  balance: number;
  loading: boolean;
  error: Error | null;
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
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    balance: 0,
    loading: true,
    error: null,
  });

  const fetchTokenBalance = async () => {
    try {
      setTokenBalance(prev => ({ ...prev, loading: true, error: null }));
      
      const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
      
      // RevenueCat stores custom attributes in the customerInfo
      // In RevenueCat SDK 9.x, subscriber attributes are accessed via customerInfo properties
      // For tokens, we'll use a custom attribute approach
      const customerAttributes = customerInfo as any; // Type assertion for custom attributes
      
      // Parse token balance from custom attribute
      let balance = 0;
      
      // Check if tokens are stored as a custom attribute
      if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
        const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
        if (tokenAttribute.value) {
          const parsedBalance = parseInt(tokenAttribute.value, 10);
          balance = isNaN(parsedBalance) ? 0 : parsedBalance;
        }
      }
      
      // Fallback: check if tokens are stored in management URL or other properties
      // This is a common pattern for storing virtual currency balances
      if (balance === 0 && customerInfo.managementURL) {
        // You could parse tokens from URL parameters if stored there
        // For now, we'll default to 0 and rely on setAttributes to manage the balance
      }
      
      setTokenBalance({
        balance,
        loading: false,
        error: null,
      });
      
      console.log(`🪙 Token balance fetched: ${balance}`);
      
    } catch (error) {
      console.error('❌ Failed to fetch token balance:', error);
      setTokenBalance(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  };

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

  return {
    balance: tokenBalance.balance,
    loading: tokenBalance.loading,
    error: tokenBalance.error,
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
    
    console.log(`🪙 Token balance updated to: ${newBalance}`);
  } catch (error) {
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
    const customerInfo = await Purchases.getCustomerInfo();
    const customerAttributes = customerInfo as any;
    
    let currentBalance = 0;
    if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
      const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
      if (tokenAttribute.value) {
        const parsedBalance = parseInt(tokenAttribute.value, 10);
        currentBalance = isNaN(parsedBalance) ? 0 : parsedBalance;
      }
    }
    
    const newBalance = currentBalance + tokensToAdd;
    await updateTokenBalance(newBalance);
    
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
    const customerInfo = await Purchases.getCustomerInfo();
    const customerAttributes = customerInfo as any;
    
    let currentBalance = 0;
    if (customerAttributes.subscriberAttributes && customerAttributes.subscriberAttributes.tokens) {
      const tokenAttribute = customerAttributes.subscriberAttributes.tokens;
      if (tokenAttribute.value) {
        const parsedBalance = parseInt(tokenAttribute.value, 10);
        currentBalance = isNaN(parsedBalance) ? 0 : parsedBalance;
      }
    }
    
    if (currentBalance < tokensToSpend) {
      throw new Error(`Insufficient tokens. Current: ${currentBalance}, Required: ${tokensToSpend}`);
    }
    
    const newBalance = currentBalance - tokensToSpend;
    await updateTokenBalance(newBalance);
    
    console.log(`🪙 Spent ${tokensToSpend} tokens. New balance: ${newBalance}`);
    return newBalance;
  } catch (error) {
    console.error('❌ Failed to spend tokens:', error);
    throw error;
  }
};