/**
 * Secure Token Management Hook - Backend API Version
 * 
 * This is the new secure implementation that uses backend APIs instead of RevenueCat subscriber attributes.
 * Replace the existing useTokenBalance.ts with this implementation.
 */
import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { TokenAPI } from '../services/tokenAPI';

interface TokenBalanceState {
  balance: number;
  loading: boolean;
  error: Error | null;
}

interface TokenBalance extends TokenBalanceState {
  refresh: () => Promise<void>;
}

interface TokenSpendRequest {
  amount: number;
  description: string;
  metadata?: Record<string, any>;
}

interface TokenSpendResponse {
  success: boolean;
  transaction_id?: string;
  new_balance: number;
  message: string;
}

interface TokenBalanceResponse {
  balance: number;
  last_updated: string;
}

/**
 * Secure Token Balance Hook - Backend API Version
 * 
 * This hook fetches token balance from your secure backend instead of RevenueCat subscriber attributes.
 * It provides the same interface as the old hook but with enhanced security.
 * 
 * Features:
 * - Secure backend API calls with JWT authentication
 * - Real-time balance updates
 * - Comprehensive error handling
 * - Token spending validation
 * - Transaction history support
 * 
 * @returns {TokenBalance} Object containing balance, loading state, error, and refresh function
 */
export const useTokenBalance = (): TokenBalance => {
  const [tokenBalance, setTokenBalance] = useState<TokenBalanceState>({
    balance: 0,
    loading: true,
    error: null,
  });

  const fetchTokenBalance = useCallback(async (): Promise<number> => {
    try {
      console.log('🔐 Fetching token balance from secure backend...');
      
      const response = await TokenAPI.getBalance();
      
      console.log('🪙 Token balance fetched from backend:', response.balance);
      return response.balance;
    } catch (error) {
      console.error('❌ Failed to fetch token balance from backend:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
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

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    balance: tokenBalance.balance,
    loading: tokenBalance.loading,
    error: tokenBalance.error,
    refresh,
  };
};

/**
 * Spend tokens securely through backend API
 * 
 * @param spendRequest - Token spend request with amount, description, and metadata
 * @returns Promise<TokenSpendResponse> - Response with success status and new balance
 */
export const spendTokens = async (spendRequest: TokenSpendRequest): Promise<TokenSpendResponse> => {
  try {
    console.log(`🔐 Spending ${spendRequest.amount} tokens via backend API...`);
    
    const response = await TokenAPI.spendTokens(spendRequest);
    
    if (response.success) {
      console.log(`✅ Successfully spent ${spendRequest.amount} tokens. New balance: ${response.new_balance}`);
    } else {
      console.log(`❌ Failed to spend tokens: ${response.message}`);
    }
    
    return response;
  } catch (error) {
    console.error('❌ Error spending tokens:', error);
    return {
      success: false,
      new_balance: 0,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Get transaction history from backend
 * 
 * @param limit - Maximum number of transactions to fetch (default: 50)
 * @returns Promise<Array> - Array of transaction objects
 */
export const getTransactionHistory = async (limit: number = 50): Promise<any[]> => {
  try {
    console.log('🔐 Fetching transaction history from backend...');
    
    const transactions = await TokenAPI.getTransactionHistory(limit);
    
    console.log(`📜 Fetched ${transactions.length} transactions from backend`);
    return transactions;
  } catch (error) {
    console.error('❌ Failed to fetch transaction history:', error);
    return [];
  }
};

/**
 * Helper function for spending tokens with automatic UI updates
 * 
 * @param amount - Number of tokens to spend
 * @param description - Description of what the tokens are being spent on
 * @param metadata - Optional additional data
 * @param onSuccess - Callback called on successful spend
 * @param onError - Callback called on spend failure
 */
export const spendTokensWithFeedback = async (
  amount: number,
  description: string,
  metadata: Record<string, any> = {},
  onSuccess?: (newBalance: number) => void,
  onError?: (message: string) => void
) => {
  try {
    const response = await spendTokens({
      amount,
      description,
      metadata
    });
    
    if (response.success) {
      Alert.alert(
        'Tokens Spent!',
        `Successfully spent ${amount} tokens. New balance: ${response.new_balance}`,
        [{ text: 'OK' }]
      );
      onSuccess?.(response.new_balance);
    } else {
      Alert.alert(
        'Unable to Spend Tokens',
        response.message,
        [{ text: 'OK' }]
      );
      onError?.(response.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    Alert.alert(
      'Error',
      `Failed to spend tokens: ${message}`,
      [{ text: 'OK' }]
    );
    onError?.(message);
  }
};

// Legacy function stubs for compatibility (these no longer use RevenueCat attributes)
export const addTokens = async (tokensToAdd: number): Promise<number> => {
  console.warn('⚠️ addTokens() is deprecated. Tokens are now added automatically via RevenueCat webhook to backend.');
  console.warn('⚠️ Use the refresh() function to get updated balance after purchases.');
  
  // Return current balance (this should trigger a refresh in the UI)
  try {
    const response = await TokenAPI.getBalance();
    return response.balance;
  } catch (error) {
    console.error('Failed to get current balance:', error);
    return 0;
  }
};

export const updateTokenBalance = async (newBalance: number): Promise<void> => {
  console.warn('⚠️ updateTokenBalance() is deprecated. Token balance is now managed securely by the backend.');
  console.warn('⚠️ Use spendTokens() for spending or wait for automatic updates from RevenueCat webhook.');
};

export const refreshTokenBalanceAfterPurchase = async (tokensEarned?: number): Promise<number> => {
  console.log('🔄 Refreshing token balance after purchase...');
  console.log('ℹ️ Note: RevenueCat webhook should automatically update backend balance.');
  
  // Add a small delay to allow webhook processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const response = await TokenAPI.getBalance();
    console.log(`✅ Balance refreshed after purchase: ${response.balance}`);
    return response.balance;
  } catch (error) {
    console.error('Failed to refresh balance after purchase:', error);
    return 0;
  }
};

export default useTokenBalance;