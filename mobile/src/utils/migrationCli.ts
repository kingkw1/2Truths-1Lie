/**
 * Mobile Media Migration CLI Utility
 * Command-line interface for running mobile media migrations
 */

import { mediaMigrationService, MigrationResult } from '../services/mediaMigrationService';

export interface MigrationCliOptions {
  userId: string;
  dryRun?: boolean;
  batchSize?: number;
  cleanup?: boolean;
  verify?: boolean;
}

export class MigrationCli {
  /**
   * Run migration with CLI-style output
   */
  public static async runMigration(options: MigrationCliOptions): Promise<boolean> {
    const { userId, dryRun = false, batchSize = 5, cleanup = false, verify = false } = options;

    console.log('\n' + '='.repeat(60));
    console.log('MOBILE MEDIA MIGRATION');
    console.log('='.repeat(60));

    try {
      if (verify) {
        return await this.runVerification();
      }

      // Discover legacy media first
      console.log('🔍 Discovering legacy media items...');
      const legacyItems = await mediaMigrationService.discoverLegacyMedia();

      if (legacyItems.length === 0) {
        console.log('✅ No legacy media items found - migration not needed');
        return true;
      }

      console.log(`📱 Found ${legacyItems.length} legacy media items`);
      
      if (dryRun) {
        console.log('🔍 Running in DRY RUN mode - no actual changes will be made');
      }

      // Run migration
      console.log(`🚀 Starting migration (batchSize: ${batchSize})...`);
      const result = await mediaMigrationService.migrateAllLegacyMedia(userId, dryRun, batchSize);

      // Display results
      this.displayMigrationResults(result, dryRun);

      // Cleanup if requested and not dry run
      if (cleanup && !dryRun && result.migrated > 0) {
        console.log('\n🗑️ Cleaning up migrated local files...');
        await mediaMigrationService.cleanupMigratedFiles(result);
      }

      // Verify migration if not dry run
      if (!dryRun) {
        console.log('\n🔍 Verifying migration...');
        const verification = await mediaMigrationService.verifyMigration();
        this.displayVerificationResults(verification);
        
        if (!verification.verificationPassed) {
          console.log('\n⚠️ Migration verification failed - some legacy items remain');
          return false;
        }
      }

      if (dryRun) {
        console.log('\n🔍 DRY RUN completed - run without --dry-run to perform actual migration');
      } else {
        console.log('\n✅ Migration completed successfully!');
      }

      return true;

    } catch (error: any) {
      console.error('\n❌ Migration failed:', error.message);
      return false;
    }
  }

  /**
   * Run verification only
   */
  private static async runVerification(): Promise<boolean> {
    console.log('🔍 Verifying mobile media migration status...');

    try {
      const verification = await mediaMigrationService.verifyMigration();
      const status = await mediaMigrationService.getMigrationStatus();

      console.log('\n' + '='.repeat(60));
      console.log('MOBILE MEDIA MIGRATION VERIFICATION');
      console.log('='.repeat(60));

      if (status) {
        console.log(`Last migration: ${new Date(status.lastMigration!).toLocaleString()}`);
        console.log(`Migration type: ${status.dryRun ? 'DRY RUN' : 'ACTUAL'}`);
        console.log(`Total items processed: ${status.totalItems}`);
        console.log(`Successfully migrated: ${status.migrated}`);
        console.log(`Failed: ${status.failed}`);
        console.log(`Skipped: ${status.skipped}`);
      } else {
        console.log('No previous migration found');
      }

      console.log('\nCurrent Status:');
      this.displayVerificationResults(verification);

      return verification.verificationPassed;

    } catch (error: any) {
      console.error('❌ Verification failed:', error.message);
      return false;
    }
  }

  /**
   * Display migration results in a formatted way
   */
  private static displayMigrationResults(result: MigrationResult, dryRun: boolean): void {
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION RESULTS');
    console.log('='.repeat(60));
    console.log(`Total items processed: ${result.totalItems}`);
    console.log(`Successfully migrated: ${result.migrated}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Skipped/No migration needed: ${result.skipped}`);

    if (result.results.length > 0) {
      console.log('\nDetailed Results:');
      console.log('-'.repeat(40));

      const statusIcons = {
        migrated: '✅',
        failed: '❌',
        skipped: '⏭️',
        no_migration_needed: '✓',
      };

      for (const res of result.results) {
        const icon = statusIcons[res.status] || '❓';
        console.log(`${icon} ${res.id}: ${res.status}`);
        
        if (res.originalUrl) {
          console.log(`   └─ From: ${this.truncateUrl(res.originalUrl)}`);
        }
        
        if (res.newUrl) {
          console.log(`   └─ To: ${this.truncateUrl(res.newUrl)}`);
        }
        
        if (res.error) {
          console.log(`   └─ Error: ${res.error}`);
        }
      }
    }

    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - no actual changes were made');
    }
  }

  /**
   * Display verification results
   */
  private static displayVerificationResults(verification: {
    totalStoredItems: number;
    legacyItems: number;
    migratedItems: number;
    verificationPassed: boolean;
  }): void {
    console.log(`Legacy items remaining: ${verification.legacyItems}`);
    console.log(`Previously migrated: ${verification.migratedItems}`);
    console.log(`Total stored items: ${verification.totalStoredItems}`);
    
    if (verification.verificationPassed) {
      console.log('✅ Verification PASSED - no legacy items found');
    } else {
      console.log('⚠️ Verification FAILED - legacy items still present');
    }
  }

  /**
   * Truncate long URLs for display
   */
  private static truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get migration status summary
   */
  public static async getStatusSummary(): Promise<{
    hasLegacyItems: boolean;
    legacyCount: number;
    lastMigration?: string;
    migrationNeeded: boolean;
  }> {
    try {
      const legacyItems = await mediaMigrationService.discoverLegacyMedia();
      const status = await mediaMigrationService.getMigrationStatus();

      return {
        hasLegacyItems: legacyItems.length > 0,
        legacyCount: legacyItems.length,
        lastMigration: status?.lastMigration,
        migrationNeeded: legacyItems.length > 0,
      };
    } catch (error) {
      console.error('Failed to get status summary:', error);
      return {
        hasLegacyItems: false,
        legacyCount: 0,
        migrationNeeded: false,
      };
    }
  }

  /**
   * Clear all migration data (for testing)
   */
  public static async clearMigrationData(): Promise<void> {
    try {
      await mediaMigrationService.clearMigrationStatus();
      console.log('✅ Migration data cleared');
    } catch (error) {
      console.error('❌ Failed to clear migration data:', error);
    }
  }
}

// Example usage functions for different scenarios
export const migrationExamples = {
  /**
   * Run a dry run migration to see what would be migrated
   */
  async dryRun(userId: string): Promise<boolean> {
    return MigrationCli.runMigration({
      userId,
      dryRun: true,
      batchSize: 5,
    });
  },

  /**
   * Run actual migration with cleanup
   */
  async migrate(userId: string): Promise<boolean> {
    return MigrationCli.runMigration({
      userId,
      dryRun: false,
      batchSize: 5,
      cleanup: true,
    });
  },

  /**
   * Verify migration status
   */
  async verify(): Promise<boolean> {
    return MigrationCli.runMigration({
      userId: 'any', // Not used for verification
      verify: true,
    });
  },

  /**
   * Get quick status check
   */
  async status(): Promise<void> {
    const summary = await MigrationCli.getStatusSummary();
    
    console.log('\n📱 Mobile Media Migration Status:');
    console.log(`Legacy items found: ${summary.legacyCount}`);
    console.log(`Migration needed: ${summary.migrationNeeded ? 'YES' : 'NO'}`);
    
    if (summary.lastMigration) {
      console.log(`Last migration: ${new Date(summary.lastMigration).toLocaleString()}`);
    } else {
      console.log('Last migration: Never');
    }
  },
};