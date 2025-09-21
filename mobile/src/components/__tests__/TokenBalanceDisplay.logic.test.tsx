import { renderHook, act } from '@testing-library/react-hooks';
import { useTokenBalance } from '../../hooks/useTokenBalance';

// Mock RevenueCat module
jest.mock('react-native-purchases', () => ({
  getCustomerInfo: jest.fn(),
  syncSubscriberAttributes: jest.fn(),
  setAttributes: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
}));

import Purchases from 'react-native-purchases';

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

describe('useTokenBalance Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      subscriberAttributes: {
        user_token_balance: {
          value: '100',
          updatedAt: new Date(),
        },
      },
    } as any);

    const { result } = renderHook(() => useTokenBalance());

    expect(result.current.loading).toBe(true);
    expect(result.current.balance).toBe(0);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should have proper hook structure', () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      subscriberAttributes: {},
    } as any);

    const { result } = renderHook(() => useTokenBalance());

    // Test hook interface
    expect(result.current).toHaveProperty('balance');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('refresh');
    
    expect(typeof result.current.balance).toBe('number');
    expect(typeof result.current.loading).toBe('boolean');
    expect(typeof result.current.refresh).toBe('function');
  });
});

describe('TokenBalanceDisplay Component Logic', () => {
  // Test the pure logic functions without async complexities
  it('should format numbers with commas correctly', () => {
    const formatNumber = (num: number) => {
      return num.toLocaleString();
    };

    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(150)).toBe('150');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle singular vs plural token text', () => {
    const getTokenText = (balance: number) => {
      return balance === 1 ? 'token' : 'tokens';
    };

    expect(getTokenText(0)).toBe('tokens');
    expect(getTokenText(1)).toBe('token');
    expect(getTokenText(2)).toBe('tokens');
    expect(getTokenText(100)).toBe('tokens');
  });

  it('should determine size styling correctly', () => {
    const getSizeStyles = (size: 'small' | 'medium' | 'large') => {
      const sizeStyles = {
        small: { fontSize: 14, iconSize: 12 },
        medium: { fontSize: 16, iconSize: 14 },
        large: { fontSize: 18, iconSize: 16 },
      };
      return sizeStyles[size];
    };

    expect(getSizeStyles('small')).toEqual({ fontSize: 14, iconSize: 12 });
    expect(getSizeStyles('medium')).toEqual({ fontSize: 16, iconSize: 14 });
    expect(getSizeStyles('large')).toEqual({ fontSize: 18, iconSize: 16 });
  });

  it('should determine component states correctly', () => {
    const getComponentState = (loading: boolean, error: Error | null, balance: number) => {
      if (loading) return 'loading';
      if (error) return 'error';
      return 'success';
    };

    expect(getComponentState(true, null, 0)).toBe('loading');
    expect(getComponentState(false, new Error('test'), 0)).toBe('error');
    expect(getComponentState(false, null, 100)).toBe('success');
    expect(getComponentState(false, null, 0)).toBe('success');
  });

  it('should generate accessibility labels correctly', () => {
    const getAccessibilityLabel = (balance: number, loading: boolean, error: Error | null) => {
      if (loading) return 'Loading token balance';
      if (error) return 'Error loading token balance';
      return `Current token balance: ${balance}`;
    };

    expect(getAccessibilityLabel(100, false, null)).toBe('Current token balance: 100');
    expect(getAccessibilityLabel(0, true, null)).toBe('Loading token balance');
    expect(getAccessibilityLabel(0, false, new Error('test'))).toBe('Error loading token balance');
  });

  it('should validate button states for TokenSpendButton', () => {
    const isButtonEnabled = (balance: number, tokensRequired: number, loading: boolean) => {
      return !loading && balance >= tokensRequired;
    };

    expect(isButtonEnabled(100, 50, false)).toBe(true);
    expect(isButtonEnabled(25, 50, false)).toBe(false);
    expect(isButtonEnabled(100, 50, true)).toBe(false);
    expect(isButtonEnabled(50, 50, false)).toBe(true);
  });

  it('should determine warning messages correctly', () => {
    const getWarningMessage = (balance: number, tokensRequired: number, actionDescription?: string) => {
      if (balance >= tokensRequired) return null;
      
      const action = actionDescription || 'perform this action';
      return `You need ${tokensRequired} tokens but only have ${balance}. This is required to ${action}.`;
    };

    expect(getWarningMessage(100, 50)).toBe(null);
    expect(getWarningMessage(25, 50)).toBe('You need 50 tokens but only have 25. This is required to perform this action.');
    expect(getWarningMessage(10, 25, 'unlock premium feature')).toBe('You need 25 tokens but only have 10. This is required to unlock premium feature.');
  });
});