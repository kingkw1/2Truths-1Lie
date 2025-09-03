#!/usr/bin/env python3
"""
Challenge URL Migration Script

This script migrates challenge data models from legacy blob URLs to persistent server URLs.
It updates the challenge statements to use the new URL structure with cloud storage support.
"""

import asyncio
import logging
import argparse
from pathlib import Path
import sys

# Add the backend directory to the Python path
sys.path.insert(0, str(Path(__file__).parent))

from services.migration_service import MediaMigrationService
from services.challenge_service import ChallengeService
from services.upload_service import ChunkedUploadService
from services.moderation_service import ModerationService

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

async def migrate_challenge_urls(dry_run: bool = False):
    """Migrate challenge URLs from legacy format to persistent server URLs"""
    
    logger.info("Starting challenge URL migration...")
    
    try:
        # Initialize services
        challenge_service = ChallengeService()
        migration_service = MediaMigrationService()
        
        # Run the migration
        result = await migration_service.migrate_challenge_urls(
            challenge_service=challenge_service,
            dry_run=dry_run
        )
        
        # Print results
        print("\n" + "="*60)
        print("CHALLENGE URL MIGRATION RESULTS")
        print("="*60)
        print(f"Total challenges processed: {result['total_challenges']}")
        print(f"Successfully migrated: {result['migrated']}")
        print(f"Failed migrations: {result['failed']}")
        print(f"No migration needed: {len([r for r in result['results'] if r['status'] == 'no_migration_needed'])}")
        
        if result['results']:
            print("\nDetailed Results:")
            print("-" * 40)
            for res in result['results']:
                status_icon = {
                    'migrated': '✅',
                    'failed': '❌', 
                    'no_migration_needed': '⏭️',
                    'dry_run': '🔍'
                }.get(res['status'], '❓')
                
                print(f"{status_icon} {res['challenge_id']}: {res['status']}")
                if 'statements_updated' in res:
                    print(f"   └─ Updated {res['statements_updated']} statements")
                if 'error' in res:
                    print(f"   └─ Error: {res['error']}")
        
        if dry_run:
            print("\n🔍 This was a DRY RUN - no actual changes were made")
            print("Run without --dry-run to perform the actual migration")
        else:
            print("\n✅ Migration completed successfully!")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"\n❌ Migration failed: {e}")
        return False
    
    return True

async def verify_migration():
    """Verify that challenge URLs have been properly migrated"""
    
    logger.info("Verifying challenge URL migration...")
    
    try:
        # Initialize services
        challenge_service = ChallengeService()
        
        # Get all challenges
        challenges = await challenge_service.get_all_challenges()
        
        total_challenges = len(challenges)
        migrated_challenges = 0
        legacy_challenges = 0
        
        print("\n" + "="*60)
        print("CHALLENGE URL MIGRATION VERIFICATION")
        print("="*60)
        
        for challenge in challenges:
            has_legacy_urls = False
            has_persistent_urls = False
            
            for statement in challenge.statements:
                # Check for legacy URL patterns
                if (statement.media_url.startswith('blob:') or 
                    statement.media_url.startswith('/api/v1/files/')):
                    has_legacy_urls = True
                
                # Check for persistent URL patterns
                if (statement.streaming_url and 
                    statement.storage_type and 
                    statement.storage_type in ['local', 'cloud', 'cloud_fallback']):
                    has_persistent_urls = True
            
            if has_persistent_urls and not has_legacy_urls:
                migrated_challenges += 1
                status = "✅ MIGRATED"
            elif has_legacy_urls:
                legacy_challenges += 1
                status = "⚠️  LEGACY"
            else:
                status = "❓ UNKNOWN"
            
            print(f"{status} {challenge.challenge_id} ({len(challenge.statements)} statements)")
        
        print(f"\nSummary:")
        print(f"Total challenges: {total_challenges}")
        print(f"Migrated: {migrated_challenges}")
        print(f"Legacy (need migration): {legacy_challenges}")
        print(f"Migration coverage: {(migrated_challenges/total_challenges*100):.1f}%" if total_challenges > 0 else "N/A")
        
        return legacy_challenges == 0
        
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        print(f"\n❌ Verification failed: {e}")
        return False

async def main():
    """Main CLI function"""
    
    parser = argparse.ArgumentParser(
        description="Migrate challenge URLs from legacy format to persistent server URLs"
    )
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Perform dry run without making actual changes"
    )
    parser.add_argument(
        "--verify", 
        action="store_true", 
        help="Verify migration status instead of running migration"
    )
    
    args = parser.parse_args()
    
    if args.verify:
        success = await verify_migration()
    else:
        success = await migrate_challenge_urls(dry_run=args.dry_run)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())