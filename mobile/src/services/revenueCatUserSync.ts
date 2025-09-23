/**
 * RevenueCat User Sync Service
 * Links authenticated users with RevenueCat for proper purchase attribution
 */

import Purchases from 'react-native-purchases';
import { authService } from './authService';

export class RevenueCatUserSyncService {
  private static instance: RevenueCatUserSyncService;
  private currentRevenueCatUserId: string | null = null;

  private constructor() {}

  public static getInstance(): RevenueCatUserSyncService {
    if (!RevenueCatUserSyncService.instance) {
      RevenueCatUserSyncService.instance = new RevenueCatUserSyncService();
    }
    return RevenueCatUserSyncService.instance;
  }

  /**
   * Sync authenticated user with RevenueCat
   * Call this after successful login
   */
  public async syncAuthenticatedUser(): Promise<void> {
    try {
      const currentUser = authService.getCurrentUser();
      
      if (!currentUser || !currentUser.email) {
        console.log('🔄 No authenticated user to sync with RevenueCat');
        return;
      }

      // Use email as RevenueCat user ID for consistency with backend
      const userIdForRevenueCat = currentUser.email;

      console.log(`🔄 Syncing RevenueCat with authenticated user: ${userIdForRevenueCat}`);

      // Login to RevenueCat with the user's email
      const customerInfo = await Purchases.logIn(userIdForRevenueCat);
      
      console.log('✅ RevenueCat user synced successfully');
      console.log(`🆔 RevenueCat User ID: ${customerInfo.customerInfo.originalAppUserId}`);
      
      this.currentRevenueCatUserId = customerInfo.customerInfo.originalAppUserId;

      return;
    } catch (error) {
      console.error('❌ Failed to sync user with RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Logout from RevenueCat (switch back to anonymous)
   * Call this when user logs out
   */
  public async logoutFromRevenueCat(): Promise<void> {
    try {
      console.log('🔄 Logging out from RevenueCat...');
      
      const customerInfo = await Purchases.logOut();
      
      console.log('✅ RevenueCat logout successful');
      console.log(`🆔 New anonymous RevenueCat User ID: ${customerInfo.originalAppUserId}`);
      
      this.currentRevenueCatUserId = customerInfo.originalAppUserId;
    } catch (error) {
      console.error('❌ Failed to logout from RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Get current RevenueCat user ID
   */
  public getCurrentRevenueCatUserId(): string | null {
    return this.currentRevenueCatUserId;
  }

  /**
   * Check if RevenueCat user matches authenticated user
   */
  public async isRevenueCatUserSynced(): Promise<boolean> {
    try {
      const currentUser = authService.getCurrentUser();
      const customerInfo = await Purchases.getCustomerInfo();
      
      if (!currentUser || !currentUser.email) {
        // No authenticated user, so any RevenueCat user is "synced"
        return true;
      }

      // Check if RevenueCat user ID matches the authenticated user's email
      return customerInfo.originalAppUserId === currentUser.email;
    } catch (error) {
      console.error('❌ Failed to check RevenueCat sync status:', error);
      return false;
    }
  }

  /**
   * Auto-sync RevenueCat user if needed
   * Call this periodically or when making purchases
   */
  public async ensureUserSynced(): Promise<void> {
    try {
      const isSynced = await this.isRevenueCatUserSynced();
      
      if (!isSynced) {
        console.log('🔄 RevenueCat user out of sync, re-syncing...');
        await this.syncAuthenticatedUser();
      } else {
        console.log('✅ RevenueCat user already synced');
      }
    } catch (error) {
      console.error('❌ Failed to ensure RevenueCat user sync:', error);
    }
  }
}

// Export singleton instance
export const revenueCatUserSync = RevenueCatUserSyncService.getInstance();