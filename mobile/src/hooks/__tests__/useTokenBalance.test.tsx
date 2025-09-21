import { renderHook, act } from '@testing-library/react-native';
import { useTokenBalance, updateTokenBalance, addTokens, spendTokens } from '../useTokenBalance';
import Purchases from 'react-native-purchases';

// Mock the Purchases module
jest.mock('react-native-purchases', () => ({
  getCustomerInfo: jest.fn(),
  setAttributes: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
  removeCustomerInfoUpdateListener: jest.fn(),
}));

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

describe('useTokenBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useTokenBalance hook', () => {
    it('should return initial loading state', () => {
      mockPurchases.getCustomerInfo.mockResolvedValue({
        subscriberAttributes: { tokens: { value: '100' } }
      } as any);

      const { result } = renderHook(() => useTokenBalance());

      expect(result.current.loading).toBe(true);
      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe(null);
    });

    it('should fetch token balance from customer info', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {
          tokens: { value: '150' }
        }
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

      const { result } = renderHook(() => useTokenBalance());

      await act(async () => {
        // Wait for the hook to complete its initial fetch
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.balance).toBe(150);
      expect(result.current.error).toBe(null);
    });

    it('should handle missing token attribute', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {}
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

      const { result } = renderHook(() => useTokenBalance());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe(null);
    });

    it('should handle invalid token value', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {
          tokens: { value: 'invalid_number' }
        }
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

      const { result } = renderHook(() => useTokenBalance());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe(null);
    });

    it('should handle errors from RevenueCat', async () => {
      const mockError = new Error('RevenueCat API error');
      mockPurchases.getCustomerInfo.mockRejectedValue(mockError);

      const { result } = renderHook(() => useTokenBalance());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.balance).toBe(0);
      expect(result.current.error).toBe(mockError);
    });

    it('should set up customer info update listener', () => {
      mockPurchases.getCustomerInfo.mockResolvedValue({
        subscriberAttributes: { tokens: { value: '100' } }
      } as any);

      renderHook(() => useTokenBalance());

      expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should clean up listener on unmount', () => {
      mockPurchases.getCustomerInfo.mockResolvedValue({
        subscriberAttributes: { tokens: { value: '100' } }
      } as any);

      const { unmount } = renderHook(() => useTokenBalance());
      
      unmount();

      expect(mockPurchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('updateTokenBalance', () => {
    it('should call setAttributes with correct token value', async () => {
      mockPurchases.setAttributes.mockResolvedValue(undefined);

      await updateTokenBalance(250);

      expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
        tokens: '250'
      });
    });

    it('should handle setAttributes errors', async () => {
      const mockError = new Error('Failed to set attributes');
      mockPurchases.setAttributes.mockRejectedValue(mockError);

      await expect(updateTokenBalance(250)).rejects.toThrow('Failed to set attributes');
    });
  });

  describe('addTokens', () => {
    it('should add tokens to current balance', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {
          tokens: { value: '100' }
        }
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);
      mockPurchases.setAttributes.mockResolvedValue(undefined);

      const newBalance = await addTokens(50);

      expect(newBalance).toBe(150);
      expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
        tokens: '150'
      });
    });

    it('should handle case with no existing tokens', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {}
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);
      mockPurchases.setAttributes.mockResolvedValue(undefined);

      const newBalance = await addTokens(75);

      expect(newBalance).toBe(75);
      expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
        tokens: '75'
      });
    });

    it('should handle errors', async () => {
      const mockError = new Error('Failed to get customer info');
      mockPurchases.getCustomerInfo.mockRejectedValue(mockError);

      await expect(addTokens(50)).rejects.toThrow('Failed to get customer info');
    });
  });

  describe('spendTokens', () => {
    it('should spend tokens from current balance', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {
          tokens: { value: '200' }
        }
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);
      mockPurchases.setAttributes.mockResolvedValue(undefined);

      const newBalance = await spendTokens(75);

      expect(newBalance).toBe(125);
      expect(mockPurchases.setAttributes).toHaveBeenCalledWith({
        tokens: '125'
      });
    });

    it('should throw error when insufficient tokens', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {
          tokens: { value: '50' }
        }
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

      await expect(spendTokens(100)).rejects.toThrow(
        'Insufficient tokens. Current: 50, Required: 100'
      );

      expect(mockPurchases.setAttributes).not.toHaveBeenCalled();
    });

    it('should handle case with no existing tokens', async () => {
      const mockCustomerInfo = {
        subscriberAttributes: {}
      };

      mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo as any);

      await expect(spendTokens(10)).rejects.toThrow(
        'Insufficient tokens. Current: 0, Required: 10'
      );
    });

    it('should handle errors', async () => {
      const mockError = new Error('Failed to get customer info');
      mockPurchases.getCustomerInfo.mockRejectedValue(mockError);

      await expect(spendTokens(25)).rejects.toThrow('Failed to get customer info');
    });
  });
});