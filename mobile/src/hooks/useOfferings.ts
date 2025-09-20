import { useState, useEffect } from 'react';
import { PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';

interface OfferingsInfo {
  offerings: PurchasesOfferings | null;
  isLoading: boolean;
  error: Error | null;
}

export const useOfferings = (): OfferingsInfo => {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const getOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        setOfferings(offerings);
      } catch (e) {
        setError(e as Error);
      } finally {
        setIsLoading(false);
      }
    };

    getOfferings();
  }, []);

  return { offerings, isLoading, error };
};
