import { renderHook, waitFor } from '@testing-library/react-native';
import { useOfferings } from './useOfferings';

// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  getOfferings: jest.fn(),
}));

// Import the mocked module for typing
const mockPurchases = require('react-native-purchases');

describe('useOfferings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should start with loading state', () => {
    // Mock pending promise to keep loading state
    mockPurchases.getOfferings.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useOfferings());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.offerings).toBe(null);
  });

  it('should handle successful offerings fetch', async () => {
    const mockOfferings = {
      current: {
        identifier: 'default',
        serverDescription: 'Default offering',
        availablePackages: [
          {
            identifier: 'monthly',
            packageType: 'MONTHLY',
            product: {
              identifier: 'monthly_subscription',
              title: 'Monthly Premium',
              description: 'Monthly premium subscription',
              priceString: '$9.99',
              price: 9.99,
              currencyCode: 'USD',
            },
            offeringIdentifier: 'default',
          },
        ],
      },
      all: {},
    };

    mockPurchases.getOfferings.mockResolvedValue(mockOfferings);

    const { result } = renderHook(() => useOfferings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.offerings).toEqual(mockOfferings);
  });

  it('should handle error when fetching offerings fails', async () => {
    const mockError = new Error('Failed to fetch offerings');
    mockPurchases.getOfferings.mockRejectedValue(mockError);

    const { result } = renderHook(() => useOfferings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);
    expect(result.current.offerings).toBe(null);
  });

  it('should handle network error', async () => {
    const networkError = new Error('Network request failed');
    mockPurchases.getOfferings.mockRejectedValue(networkError);

    const { result } = renderHook(() => useOfferings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(networkError);
    expect(result.current.offerings).toBe(null);
  });

  it('should handle empty offerings response', async () => {
    const emptyOfferings = {
      current: null,
      all: {},
    };

    mockPurchases.getOfferings.mockResolvedValue(emptyOfferings);

    const { result } = renderHook(() => useOfferings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(null);
    expect(result.current.offerings).toEqual(emptyOfferings);
  });

  it('should only fetch offerings once on mount', async () => {
    const mockOfferings = {
      current: null,
      all: {},
    };

    mockPurchases.getOfferings.mockResolvedValue(mockOfferings);

    const { result, rerender } = renderHook(() => useOfferings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Rerender the hook
    rerender({});

    // getOfferings should only be called once
    expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(1);
  });
});