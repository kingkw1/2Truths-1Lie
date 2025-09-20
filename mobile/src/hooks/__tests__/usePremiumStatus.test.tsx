import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { usePremiumStatus } from '../usePremiumStatus';

const mockPurchases = Purchases as jest.Mocked<typeof Purchases>;

describe('usePremiumStatus', () => {
  const mockCustomerInfo = {
    entitlements: {
      active: {},
      all: {},
      verification: 'VERIFIED' as any,
    },
  } as CustomerInfo;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return loading state initially', async () => {
    mockPurchases.getCustomerInfo.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockCustomerInfo), 100))
    );

    const { result } = renderHook(() => usePremiumStatus());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isInTrial).toBe(false);
  });

  it('should return non-premium state when no active entitlements', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue(mockCustomerInfo);

    const { result } = renderHook(() => usePremiumStatus());
    
    // Wait for effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.isPremium).toBe(false);
    expect(result.current.isInTrial).toBe(false);
    expect(result.current.trialDaysRemaining).toBe(0);
  });

  it('should return premium state when premium entitlement is active', async () => {
    const premiumCustomerInfo = {
      entitlements: {
        active: {
          premium: {
            identifier: 'premium',
            isActive: true,
            willRenew: true,
            periodType: 'normal',
            latestPurchaseDate: '2023-01-01T00:00:00Z',
            originalPurchaseDate: '2023-01-01T00:00:00Z',
            expirationDate: '2024-01-01T00:00:00Z',
            store: 'APP_STORE' as any,
            productIdentifier: 'premium_annual',
            isSandbox: false,
            unsubscribeDetectedAt: null,
            billingIssueDetectedAt: null,
            ownershipType: 'PURCHASED' as any,
          },
        },
        all: {},
        verification: 'VERIFIED' as any,
      },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
      latestExpirationDate: null,
      firstSeen: '2023-01-01T00:00:00Z',
      originalAppUserId: 'test-user',
      requestDate: '2023-01-01T00:00:00Z',
      allPurchaseDates: {},
      allExpirationDates: {},
      managementURL: null,
      originalApplicationVersion: null,
      originalPurchaseDate: null,
    } as unknown as CustomerInfo;

    mockPurchases.getCustomerInfo.mockResolvedValue(premiumCustomerInfo);

    const { result } = renderHook(() => usePremiumStatus());
    
    // Wait for effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isInTrial).toBe(false);
  });

  it('should return trial state when in trial period', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    
    const trialCustomerInfo = {
      entitlements: {
        active: {
          premium: {
            identifier: 'premium',
            isActive: true,
            willRenew: true,
            periodType: 'trial',
            latestPurchaseDate: new Date().toISOString(),
            originalPurchaseDate: new Date().toISOString(),
            expirationDate: futureDate.toISOString(),
            store: 'APP_STORE' as any,
            productIdentifier: 'premium_annual',
            isSandbox: false,
            unsubscribeDetectedAt: null,
            billingIssueDetectedAt: null,
            ownershipType: 'PURCHASED' as any,
          },
        },
        all: {},
        verification: 'VERIFIED' as any,
      },
      activeSubscriptions: [],
      allPurchasedProductIdentifiers: [],
      latestExpirationDate: null,
      firstSeen: '2023-01-01T00:00:00Z',
      originalAppUserId: 'test-user',
      requestDate: '2023-01-01T00:00:00Z',
      allPurchaseDates: {},
      allExpirationDates: {},
      managementURL: null,
      originalApplicationVersion: null,
      originalPurchaseDate: null,
    } as unknown as CustomerInfo;

    mockPurchases.getCustomerInfo.mockResolvedValue(trialCustomerInfo);

    const { result } = renderHook(() => usePremiumStatus());
    
    // Wait for effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isInTrial).toBe(true);
    expect(result.current.trialDaysRemaining).toBe(7);
    expect(result.current.trialEndDate).toBeInstanceOf(Date);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    mockPurchases.getCustomerInfo.mockRejectedValue(error);

    const { result } = renderHook(() => usePremiumStatus());
    
    // Wait for effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toEqual(error);
    expect(result.current.isPremium).toBe(false);
  });
});