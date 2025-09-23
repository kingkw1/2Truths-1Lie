/**
 * RevenueCat User Sync Service
 * Links authenticated users with RevenueCat for proper purchase attribution
 */

import Purchases from 'react-native-purchases';

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
  public async syncAuthenticatedUser(userEmail: string): Promise<void> {
    try {
      if (!userEmail) {
        console.log('🔄 [SYNC] No user email provided for RevenueCat sync');
        return;
      }

      console.log(`🔄 [SYNC] Starting RevenueCat sync with user: ${userEmail}`);
      
      // Check current RevenueCat user before sync
      const currentCustomerInfo = await Purchases.getCustomerInfo();
      console.log(`🔍 [SYNC] Current RevenueCat User ID BEFORE sync: ${currentCustomerInfo.originalAppUserId}`);

      // Login to RevenueCat with the user's email
      console.log(`🔑 [SYNC] Calling Purchases.logIn('${userEmail}')...`);
      const loginResult = await Purchases.logIn(userEmail);
      
      console.log('✅ [SYNC] RevenueCat user synced successfully');
      console.log(`🆔 [SYNC] RevenueCat User ID AFTER sync: ${loginResult.customerInfo.originalAppUserId}`);
      console.log(`🔍 [SYNC] Login result created: ${loginResult.created}`);
      
      this.currentRevenueCatUserId = loginResult.customerInfo.originalAppUserId;

      // Verify the sync worked
      const verifyCustomerInfo = await Purchases.getCustomerInfo();
      console.log(`✅ [SYNC] Verification - Current RevenueCat User ID: ${verifyCustomerInfo.originalAppUserId}`);

      return;
    } catch (error) {
      console.error('❌ [SYNC] Failed to sync user with RevenueCat:', error);
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
  public async isRevenueCatUserSynced(userEmail: string | null): Promise<boolean> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      
      console.log(`🔍 [SYNC CHECK] Current auth user: ${userEmail || 'none'}`);
      console.log(`🔍 [SYNC CHECK] Current RevenueCat user: ${customerInfo.originalAppUserId}`);
      
      if (!userEmail) {
        // No authenticated user, so any RevenueCat user is "synced"
        console.log(`✅ [SYNC CHECK] No auth user, considering synced`);
        return true;
      }

      // Check if RevenueCat user ID matches the authenticated user's email
      const isSynced = customerInfo.originalAppUserId === userEmail;
      console.log(`${isSynced ? '✅' : '❌'} [SYNC CHECK] Sync status: ${isSynced}`);
      return isSynced;
    } catch (error) {
      console.error('❌ [SYNC CHECK] Failed to check RevenueCat sync status:', error);
      return false;
    }
  }

  /**
   * Auto-sync RevenueCat user if needed
   * Call this periodically or when making purchases
   */
  public async ensureUserSynced(userEmail: string | null): Promise<void> {
    try {
      console.log('🔄 [ENSURE SYNC] Checking if user sync needed...');
      const isSynced = await this.isRevenueCatUserSynced(userEmail);
      
      if (!isSynced && userEmail) {
        console.log('🔄 [ENSURE SYNC] RevenueCat user out of sync, re-syncing...');
        await this.syncAuthenticatedUser(userEmail);
      } else {
        console.log('✅ [ENSURE SYNC] RevenueCat user already synced');
      }
    } catch (error) {
      console.error('❌ [ENSURE SYNC] Failed to ensure RevenueCat user sync:', error);
    }
  }
}

// Export singleton instance
export const revenueCatUserSync = RevenueCatUserSyncService.getInstance();