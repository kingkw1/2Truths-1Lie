#!/usr/bin/env python3
"""
Migration CLI Tool
=================

Command-line interface for database migrations between SQLite and PostgreSQL.
Includes validation, rollback, and status reporting.
"""

import os
import sys
import json
import argparse
import logging
from datetime import datetime
from typing import Dict, Any

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from migration_manager import MigrationManager
from data.data_migrator import DataMigrator

def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'migration_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
        ]
    )

def validate_environment(sqlite_path: str, postgres_url: str) -> bool:
    """Validate migration environment"""
    logger = logging.getLogger(__name__)
    
    # Check SQLite database exists
    if not os.path.exists(sqlite_path):
        logger.error(f"SQLite database not found: {sqlite_path}")
        return False
    
    # Validate PostgreSQL connection
    manager = MigrationManager(sqlite_path, postgres_url)
    if not manager.validate_postgres_connection():
        logger.error("PostgreSQL connection validation failed")
        return False
    
    logger.info("Environment validation passed")
    return True

def run_schema_migration(sqlite_path: str, postgres_url: str) -> bool:
    """Run schema migration only"""
    logger = logging.getLogger(__name__)
    logger.info("Starting schema migration...")
    
    manager = MigrationManager(sqlite_path, postgres_url)
    
    if manager.create_postgres_schema():
        logger.info("Schema migration completed successfully")
        return True
    else:
        logger.error("Schema migration failed")
        return False

def run_data_migration(sqlite_path: str, postgres_url: str) -> Dict[str, Any]:
    """Run data migration with detailed results"""
    logger = logging.getLogger(__name__)
    logger.info("Starting data migration...")
    
    migrator = DataMigrator(sqlite_path, postgres_url)
    results = migrator.migrate_all_tables()
    
    # Summary
    total_success = all(result[0] for result in results.values())
    total_rows = sum(result[1] for result in results.values())
    
    logger.info(f"Data migration completed: {'SUCCESS' if total_success else 'FAILED'}")
    logger.info(f"Total rows migrated: {total_rows}")
    
    return {
        'success': total_success,
        'total_rows': total_rows,
        'table_results': results
    }

def run_full_migration(sqlite_path: str, postgres_url: str) -> Dict[str, Any]:
    """Run complete migration (schema + data)"""
    logger = logging.getLogger(__name__)
    logger.info("Starting full migration (schema + data)...")
    
    manager = MigrationManager(sqlite_path, postgres_url)
    result = manager.perform_full_migration()
    
    if result['success']:
        logger.info("Full migration completed successfully")
        logger.info(f"Total rows migrated: {result['total_rows_migrated']}")
        
        # Create rollback script
        rollback_file = manager.create_rollback_script(result)
        logger.info(f"Rollback script created: {rollback_file}")
    else:
        logger.error("Full migration failed")
        for error in result.get('errors', []):
            logger.error(f"Error: {error}")
    
    return result

def validate_migration(sqlite_path: str, postgres_url: str) -> bool:
    """Validate completed migration"""
    logger = logging.getLogger(__name__)
    logger.info("Validating migration...")
    
    import sqlite3
    import psycopg2
    
    try:
        with sqlite3.connect(sqlite_path) as sqlite_conn:
            with psycopg2.connect(postgres_url) as postgres_conn:
                manager = MigrationManager(sqlite_path, postgres_url)
                validation_results = manager.validate_migration(sqlite_conn, postgres_conn)
                
                if validation_results['success']:
                    logger.info("Migration validation PASSED")
                    for table, counts in validation_results['table_counts'].items():
                        logger.info(f"  {table}: SQLite={counts['sqlite']}, PostgreSQL={counts['postgres']}")
                    return True
                else:
                    logger.error("Migration validation FAILED")
                    for mismatch in validation_results['mismatches']:
                        logger.error(f"  {mismatch['table']}: SQLite={mismatch['sqlite_count']}, PostgreSQL={mismatch['postgres_count']}")
                    return False
    
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return False

def show_migration_status(sqlite_path: str, postgres_url: str):
    """Show current migration status"""
    logger = logging.getLogger(__name__)
    
    try:
        import psycopg2
        
        with psycopg2.connect(postgres_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT migration_id, description, executed_at, status
                    FROM migration_history
                    ORDER BY executed_at DESC
                    LIMIT 10
                """)
                
                migrations = cursor.fetchall()
                
                if migrations:
                    logger.info("Recent migrations:")
                    for migration in migrations:
                        logger.info(f"  {migration[0]}: {migration[1]} ({migration[3]}) - {migration[2]}")
                else:
                    logger.info("No migrations found in history")
    
    except Exception as e:
        logger.warning(f"Could not retrieve migration status: {e}")

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='Database Migration Tool - SQLite to PostgreSQL',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s validate --sqlite app.db --postgres "postgresql://user:pass@localhost/db"
  %(prog)s schema --sqlite app.db --postgres "postgresql://user:pass@localhost/db"
  %(prog)s data --sqlite app.db --postgres "postgresql://user:pass@localhost/db"
  %(prog)s full --sqlite app.db --postgres "postgresql://user:pass@localhost/db"
  %(prog)s check --sqlite app.db --postgres "postgresql://user:pass@localhost/db"
  %(prog)s status --postgres "postgresql://user:pass@localhost/db"
        """
    )
    
    parser.add_argument('command', choices=['validate', 'schema', 'data', 'full', 'check', 'status'],
                       help='Migration command to run')
    parser.add_argument('--sqlite', required=False, 
                       help='Path to SQLite database file')
    parser.add_argument('--postgres', required=True,
                       help='PostgreSQL connection URL')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be done without executing')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)
    
    # Validate required arguments
    if args.command != 'status' and not args.sqlite:
        logger.error("--sqlite argument is required for this command")
        return 1
    
    if args.dry_run:
        logger.info("DRY RUN MODE - No changes will be made")
    
    # Execute command
    try:
        if args.command == 'validate':
            if validate_environment(args.sqlite, args.postgres):
                logger.info("Environment validation: PASSED")
                return 0
            else:
                logger.error("Environment validation: FAILED")
                return 1
                
        elif args.command == 'schema':
            if args.dry_run:
                logger.info("Would create PostgreSQL schema")
                return 0
            
            if run_schema_migration(args.sqlite, args.postgres):
                return 0
            else:
                return 1
                
        elif args.command == 'data':
            if args.dry_run:
                logger.info("Would migrate data from SQLite to PostgreSQL")
                return 0
            
            result = run_data_migration(args.sqlite, args.postgres)
            return 0 if result['success'] else 1
            
        elif args.command == 'full':
            if args.dry_run:
                logger.info("Would run full migration (schema + data)")
                return 0
            
            result = run_full_migration(args.sqlite, args.postgres)
            return 0 if result['success'] else 1
            
        elif args.command == 'check':
            if validate_migration(args.sqlite, args.postgres):
                return 0
            else:
                return 1
                
        elif args.command == 'status':
            show_migration_status(args.sqlite, args.postgres)
            return 0
            
    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
        return 1
    except Exception as e:
        logger.error(f"Migration failed with error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)