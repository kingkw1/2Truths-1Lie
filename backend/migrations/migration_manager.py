"""
Database Migration Manager
=========================

Comprehensive migration system for converting SQLite to PostgreSQL
and handling schema evolution with rollback support.
"""

import os
import sys
import json
import logging
import sqlite3
import psycopg2
import importlib.util
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from abc import ABC, abstractmethod

# Add backend to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from services.database_service import DatabaseService

logger = logging.getLogger(__name__)

class BaseMigration(ABC):
    """Base class for all database migrations"""
    
    def __init__(self, migration_id: str, description: str):
        self.migration_id = migration_id
        self.description = description
        self.executed_at: Optional[datetime] = None
    
    @abstractmethod
    def up(self, source_conn, target_conn) -> bool:
        """Execute the migration"""
        pass
    
    @abstractmethod
    def down(self, source_conn, target_conn) -> bool:
        """Rollback the migration"""
        pass
    
    @abstractmethod
    def validate(self, conn) -> bool:
        """Validate migration was successful"""
        pass

class MigrationManager:
    """
    Database Migration Manager
    
    Handles SQLite to PostgreSQL migration with comprehensive
    data transfer, schema conversion, and rollback support.
    """
    
    def __init__(self, 
                 sqlite_path: str,
                 postgres_url: str,
                 migration_dir: str = None):
        self.sqlite_path = sqlite_path
        self.postgres_url = postgres_url
        self.migration_dir = migration_dir or os.path.dirname(__file__)
        self.migration_log: List[Dict[str, Any]] = []
        
        # Initialize database services
        self.db_service = DatabaseService()
        
    def create_migration_tracking_table(self, conn) -> None:
        """Create table to track migration status"""
        if self._is_postgres_connection(conn):
            # PostgreSQL version
            conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_history (
                    id SERIAL PRIMARY KEY,
                    migration_id VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    rollback_sql TEXT,
                    checksum VARCHAR(64),
                    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'rolled_back'))
                )
            """)
        else:
            # SQLite version  
            conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    migration_id TEXT UNIQUE NOT NULL,
                    description TEXT NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    rollback_sql TEXT,
                    checksum TEXT,
                    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'rolled_back'))
                )
            """)
        conn.commit()
    
    def _is_postgres_connection(self, conn) -> bool:
        """Check if connection is PostgreSQL"""
        return hasattr(conn, 'server_version')
    
    def get_sqlite_schema_info(self) -> Dict[str, Any]:
        """Extract comprehensive schema information from SQLite database"""
        schema_info = {
            'tables': {},
            'indexes': {},
            'foreign_keys': {},
            'triggers': {},
            'data_counts': {}
        }
        
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Get all tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                tables = [row[0] for row in cursor.fetchall()]
                
                for table in tables:
                    # Get table schema
                    cursor.execute(f"PRAGMA table_info({table})")
                    columns = cursor.fetchall()
                    
                    # Get row count
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    row_count = cursor.fetchone()[0]
                    
                    schema_info['tables'][table] = {
                        'columns': [dict(col) for col in columns],
                        'row_count': row_count
                    }
                    schema_info['data_counts'][table] = row_count
                    
                    # Get indexes for this table
                    cursor.execute(f"PRAGMA index_list({table})")
                    indexes = cursor.fetchall()
                    schema_info['indexes'][table] = [dict(idx) for idx in indexes]
                    
                    # Get foreign keys for this table
                    cursor.execute(f"PRAGMA foreign_key_list({table})")
                    foreign_keys = cursor.fetchall()
                    schema_info['foreign_keys'][table] = [dict(fk) for fk in foreign_keys]
                
                logger.info(f"Extracted schema for {len(tables)} tables from SQLite database")
                logger.info(f"Total data rows: {sum(schema_info['data_counts'].values())}")
                
        except Exception as e:
            logger.error(f"Failed to extract SQLite schema: {e}")
            raise
            
        return schema_info
    
    def validate_postgres_connection(self) -> bool:
        """Validate PostgreSQL connection and readiness"""
        try:
            with psycopg2.connect(self.postgres_url) as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT version()")
                    version = cursor.fetchone()[0]
                    logger.info(f"PostgreSQL connection validated: {version}")
                    
                    # Check for required extensions
                    cursor.execute("SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm')")
                    extensions = [row[0] for row in cursor.fetchall()]
                    
                    if 'uuid-ossp' not in extensions:
                        logger.warning("uuid-ossp extension not found - UUIDs may not work properly")
                    
                    return True
                    
        except Exception as e:
            logger.error(f"PostgreSQL connection validation failed: {e}")
            return False
    
    def create_postgres_schema(self) -> bool:
        """Create PostgreSQL schema based on current database structure"""
        try:
            with psycopg2.connect(self.postgres_url) as conn:
                with conn.cursor() as cursor:
                    
                    # Enable required extensions
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
                    
                    # Create users table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS users (
                            id SERIAL PRIMARY KEY,
                            email VARCHAR(255) UNIQUE NOT NULL,
                            password_hash VARCHAR(255) NOT NULL,
                            name VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            is_active BOOLEAN DEFAULT TRUE,
                            last_login TIMESTAMP
                        )
                    """)
                    
                    # Create challenges table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS challenges (
                            challenge_id VARCHAR(255) PRIMARY KEY,
                            creator_id VARCHAR(255) NOT NULL,
                            title VARCHAR(255),
                            status VARCHAR(50) NOT NULL DEFAULT 'draft',
                            lie_statement_id VARCHAR(255) NOT NULL,
                            view_count INTEGER DEFAULT 0,
                            guess_count INTEGER DEFAULT 0,
                            correct_guess_count INTEGER DEFAULT 0,
                            is_merged_video BOOLEAN DEFAULT FALSE,
                            statements_json TEXT NOT NULL,
                            merged_video_metadata_json TEXT,
                            tags_json TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            published_at TIMESTAMP
                        )
                    """)
                    
                    # Create guesses table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS guesses (
                            guess_id VARCHAR(255) PRIMARY KEY,
                            challenge_id VARCHAR(255) NOT NULL,
                            user_id VARCHAR(255) NOT NULL,
                            guessed_lie_statement_id VARCHAR(255) NOT NULL,
                            is_correct BOOLEAN NOT NULL,
                            response_time_seconds REAL,
                            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_guesses_challenge_id 
                                FOREIGN KEY (challenge_id) REFERENCES challenges(challenge_id) ON DELETE CASCADE
                        )
                    """)
                    
                    # Create user_reports table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS user_reports (
                            id SERIAL PRIMARY KEY,
                            challenge_id VARCHAR(255) NOT NULL,
                            user_id INTEGER NOT NULL,
                            reason VARCHAR(100) NOT NULL,
                            details TEXT,
                            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            CONSTRAINT fk_user_reports_user_id 
                                FOREIGN KEY (user_id) REFERENCES users (id) 
                                ON DELETE CASCADE,
                            CONSTRAINT chk_user_reports_reason 
                                CHECK (reason IN (
                                    'inappropriate_language', 'spam', 'personal_info', 
                                    'violence', 'hate_speech', 'adult_content', 
                                    'copyright', 'misleading', 'low_quality'
                                ))
                        )
                    """)
                    
                    # Create token_balances table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS token_balances (
                            user_id VARCHAR(255) PRIMARY KEY,
                            balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
                            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    
                    # Create token_transactions table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS token_transactions (
                            transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id VARCHAR(255) NOT NULL,
                            transaction_type VARCHAR(20) NOT NULL CHECK (
                                transaction_type IN ('purchase', 'spend', 'adjustment', 'refund')
                            ),
                            amount INTEGER NOT NULL,
                            balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
                            balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
                            description TEXT NOT NULL,
                            metadata JSONB DEFAULT '{}',
                            revenuecat_transaction_id VARCHAR(255),
                            revenuecat_product_id VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                    
                    # Create user_sessions table
                    cursor.execute("""
                        CREATE TABLE IF NOT EXISTS user_sessions (
                            session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id VARCHAR(255) NOT NULL,
                            jwt_token TEXT NOT NULL,
                            token_hash VARCHAR(64) NOT NULL UNIQUE,
                            session_type VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (
                                session_type IN ('user', 'guest', 'admin')
                            ),
                            permissions JSONB DEFAULT '[]',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            expires_at TIMESTAMP NOT NULL,
                            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            is_active BOOLEAN DEFAULT TRUE,
                            user_agent TEXT,
                            ip_address INET
                        )
                    """)
                    
                    # Create all indexes
                    self._create_postgres_indexes(cursor)
                    
                    # Create migration tracking table
                    self.create_migration_tracking_table(conn)
                    
                    conn.commit()
                    logger.info("PostgreSQL schema created successfully")
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL schema: {e}")
            return False
    
    def _create_postgres_indexes(self, cursor) -> None:
        """Create all PostgreSQL indexes"""
        indexes = [
            # Users table indexes
            "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)",
            "CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)",
            
            # Challenges table indexes
            "CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON challenges(creator_id)",
            "CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status)",
            "CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_challenges_published_at ON challenges(published_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_challenges_view_count ON challenges(view_count DESC)",
            
            # Guesses table indexes
            "CREATE INDEX IF NOT EXISTS idx_guesses_challenge_id ON guesses(challenge_id)",
            "CREATE INDEX IF NOT EXISTS idx_guesses_user_id ON guesses(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_guesses_submitted_at ON guesses(submitted_at DESC)",
            
            # User_reports table indexes
            "CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_id ON user_reports(challenge_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON user_reports(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC)",
            
            # Token tables indexes
            "CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_token_transactions_revenuecat ON token_transactions(revenuecat_transaction_id)",
            
            # Session tables indexes
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active)",
        ]
        
        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
            except Exception as e:
                logger.warning(f"Failed to create index: {index_sql}, Error: {e}")
    
    def migrate_table_data(self, table_name: str, 
                          sqlite_conn, postgres_conn,
                          batch_size: int = 1000) -> Tuple[bool, int]:
        """
        Migrate data from SQLite table to PostgreSQL table
        
        Returns:
            Tuple of (success, rows_migrated)
        """
        try:
            sqlite_cursor = sqlite_conn.cursor()
            postgres_cursor = postgres_conn.cursor()
            
            # Get table schema from SQLite
            sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
            columns_info = sqlite_cursor.fetchall()
            column_names = [col[1] for col in columns_info]
            
            # Get total row count
            sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_rows = sqlite_cursor.fetchone()[0]
            
            if total_rows == 0:
                logger.info(f"Table {table_name} is empty, skipping data migration")
                return True, 0
            
            logger.info(f"Migrating {total_rows} rows from {table_name}")
            
            # Prepare insert statement for PostgreSQL
            placeholders = ', '.join(['%s'] * len(column_names))
            insert_sql = f"INSERT INTO {table_name} ({', '.join(column_names)}) VALUES ({placeholders})"
            
            rows_migrated = 0
            offset = 0
            
            while offset < total_rows:
                # Fetch batch from SQLite
                sqlite_cursor.execute(f"SELECT * FROM {table_name} LIMIT {batch_size} OFFSET {offset}")
                rows = sqlite_cursor.fetchall()
                
                if not rows:
                    break
                
                # Convert data for PostgreSQL compatibility
                converted_rows = []
                for row in rows:
                    converted_row = self._convert_row_for_postgres(table_name, column_names, row)
                    converted_rows.append(converted_row)
                
                # Batch insert into PostgreSQL
                try:
                    postgres_cursor.executemany(insert_sql, converted_rows)
                    postgres_conn.commit()
                    rows_migrated += len(converted_rows)
                    logger.info(f"Migrated {rows_migrated}/{total_rows} rows from {table_name}")
                    
                except Exception as e:
                    logger.error(f"Failed to insert batch for {table_name}: {e}")
                    postgres_conn.rollback()
                    return False, rows_migrated
                
                offset += batch_size
            
            logger.info(f"Successfully migrated {rows_migrated} rows from {table_name}")
            return True, rows_migrated
            
        except Exception as e:
            logger.error(f"Failed to migrate data for table {table_name}: {e}")
            return False, 0
    
    def _convert_row_for_postgres(self, table_name: str, column_names: List[str], row: tuple) -> tuple:
        """Convert SQLite row data to PostgreSQL compatible format"""
        converted = []
        
        for i, (col_name, value) in enumerate(zip(column_names, row)):
            # Handle special conversions based on table and column
            if table_name == 'token_transactions' and col_name == 'metadata':
                # Convert TEXT to JSONB
                if value and isinstance(value, str):
                    try:
                        # Validate JSON
                        json.loads(value)
                        converted.append(value)
                    except:
                        converted.append('{}')
                else:
                    converted.append('{}')
                    
            elif table_name == 'user_sessions' and col_name == 'permissions':
                # Convert TEXT to JSONB
                if value and isinstance(value, str):
                    try:
                        # Validate JSON
                        json.loads(value)
                        converted.append(value)
                    except:
                        converted.append('[]')
                else:
                    converted.append('[]')
                    
            elif col_name == 'transaction_id' and table_name == 'token_transactions':
                # Handle UUID conversion - PostgreSQL will generate new UUIDs
                converted.append(None)  # Let PostgreSQL generate UUID
                
            elif col_name == 'session_id' and table_name == 'user_sessions':
                # Handle UUID conversion - PostgreSQL will generate new UUIDs
                converted.append(None)  # Let PostgreSQL generate UUID
                
            else:
                # Default: use value as-is
                converted.append(value)
        
        return tuple(converted)
    
    def validate_migration(self, sqlite_conn, postgres_conn) -> Dict[str, Any]:
        """Validate that migration was successful"""
        validation_results = {
            'success': True,
            'table_counts': {},
            'mismatches': [],
            'errors': []
        }
        
        try:
            sqlite_cursor = sqlite_conn.cursor()
            postgres_cursor = postgres_conn.cursor()
            
            # Get list of tables
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [row[0] for row in sqlite_cursor.fetchall()]
            
            for table in tables:
                try:
                    # Count rows in both databases
                    sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    sqlite_count = sqlite_cursor.fetchone()[0]
                    
                    postgres_cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    postgres_count = postgres_cursor.fetchone()[0]
                    
                    validation_results['table_counts'][table] = {
                        'sqlite': sqlite_count,
                        'postgres': postgres_count,
                        'match': sqlite_count == postgres_count
                    }
                    
                    if sqlite_count != postgres_count:
                        validation_results['mismatches'].append({
                            'table': table,
                            'sqlite_count': sqlite_count,
                            'postgres_count': postgres_count
                        })
                        validation_results['success'] = False
                        
                except Exception as e:
                    error_msg = f"Failed to validate table {table}: {e}"
                    validation_results['errors'].append(error_msg)
                    logger.error(error_msg)
                    validation_results['success'] = False
            
            logger.info(f"Migration validation completed: {'SUCCESS' if validation_results['success'] else 'FAILED'}")
            
        except Exception as e:
            logger.error(f"Migration validation failed: {e}")
            validation_results['success'] = False
            validation_results['errors'].append(str(e))
        
        return validation_results
    
    def perform_full_migration(self) -> Dict[str, Any]:
        """
        Perform complete SQLite to PostgreSQL migration
        
        Returns:
            Dictionary with migration results and status
        """
        migration_result = {
            'success': False,
            'start_time': datetime.now(),
            'end_time': None,
            'tables_migrated': {},
            'total_rows_migrated': 0,
            'validation_results': {},
            'errors': []
        }
        
        try:
            logger.info("Starting SQLite to PostgreSQL migration")
            
            # Validate connections
            if not self.validate_postgres_connection():
                raise Exception("PostgreSQL connection validation failed")
            
            if not os.path.exists(self.sqlite_path):
                raise Exception(f"SQLite database not found: {self.sqlite_path}")
            
            # Get SQLite schema information
            schema_info = self.get_sqlite_schema_info()
            logger.info(f"Source database contains {len(schema_info['tables'])} tables")
            
            # Create PostgreSQL schema
            if not self.create_postgres_schema():
                raise Exception("Failed to create PostgreSQL schema")
            
            # Migrate data table by table
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    
                    # Migration order (respecting foreign key dependencies)
                    migration_order = ['users', 'challenges', 'guesses', 'user_reports', 
                                     'token_balances', 'token_transactions', 'user_sessions']
                    
                    for table_name in migration_order:
                        if table_name in schema_info['tables']:
                            logger.info(f"Migrating table: {table_name}")
                            success, rows_migrated = self.migrate_table_data(
                                table_name, sqlite_conn, postgres_conn
                            )
                            
                            migration_result['tables_migrated'][table_name] = {
                                'success': success,
                                'rows_migrated': rows_migrated
                            }
                            
                            migration_result['total_rows_migrated'] += rows_migrated
                            
                            if not success:
                                raise Exception(f"Failed to migrate table {table_name}")
                    
                    # Validate migration
                    logger.info("Validating migration results...")
                    validation_results = self.validate_migration(sqlite_conn, postgres_conn)
                    migration_result['validation_results'] = validation_results
                    
                    if not validation_results['success']:
                        raise Exception("Migration validation failed")
                    
                    # Record migration in history
                    self._record_migration_completion(postgres_conn, migration_result)
            
            migration_result['success'] = True
            logger.info("SQLite to PostgreSQL migration completed successfully")
            
        except Exception as e:
            error_msg = f"Migration failed: {e}"
            logger.error(error_msg)
            migration_result['errors'].append(error_msg)
        
        finally:
            migration_result['end_time'] = datetime.now()
            migration_result['duration'] = (
                migration_result['end_time'] - migration_result['start_time']
            ).total_seconds()
        
        return migration_result
    
    def _record_migration_completion(self, postgres_conn, migration_result: Dict[str, Any]) -> None:
        """Record successful migration in migration history"""
        try:
            with postgres_conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO migration_history (migration_id, description, executed_at, status)
                    VALUES (%s, %s, %s, %s)
                """, (
                    'sqlite_to_postgres_full',
                    f"Full SQLite to PostgreSQL migration - {migration_result['total_rows_migrated']} rows",
                    migration_result['start_time'],
                    'completed'
                ))
                postgres_conn.commit()
                logger.info("Migration completion recorded in history")
        except Exception as e:
            logger.warning(f"Failed to record migration completion: {e}")
    
    def create_rollback_script(self, migration_result: Dict[str, Any]) -> str:
        """Generate rollback script for the migration"""
        rollback_script = f"""-- Rollback script for SQLite to PostgreSQL migration
-- Generated on: {datetime.now()}
-- Migration completed: {migration_result.get('success', False)}
-- Total rows migrated: {migration_result.get('total_rows_migrated', 0)}

-- WARNING: This will delete all data in PostgreSQL tables
-- Only run if you need to completely rollback the migration

BEGIN;

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS token_transactions CASCADE;
DROP TABLE IF EXISTS token_balances CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS guesses CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS migration_history CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

COMMIT;

-- To restore from SQLite, run the migration again
"""
        
        rollback_file = os.path.join(self.migration_dir, 'rollback', 'rollback_sqlite_to_postgres.sql')
        os.makedirs(os.path.dirname(rollback_file), exist_ok=True)
        
        with open(rollback_file, 'w') as f:
            f.write(rollback_script)
        
        logger.info(f"Rollback script created: {rollback_file}")
        return rollback_file

    def apply_versioned_migrations(self, db_conn):
        """
        Applies all unapplied versioned migrations from the 'versions' directory.
        """
        versions_dir = os.path.join(self.migration_dir, 'versions')
        if not os.path.isdir(versions_dir):
            logger.info("No 'versions' directory found, skipping versioned migrations.")
            return

        self.create_migration_tracking_table(db_conn)

        with db_conn.cursor() as cursor:
            cursor.execute("SELECT migration_id FROM migration_history")
            applied_migrations = {row[0] for row in cursor.fetchall()}

        migration_files = sorted(
            [f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')]
        )

        for filename in migration_files:
            migration_id = os.path.splitext(filename)[0]
            if migration_id in applied_migrations:
                continue

            logger.info(f"Applying migration: {migration_id}")
            try:
                spec = importlib.util.spec_from_file_location(
                    migration_id, os.path.join(versions_dir, filename)
                )
                migration_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(migration_module)

                migration_module.upgrade(db_conn)

                with db_conn.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO migration_history (migration_id, description) VALUES (%s, %s)",
                        (migration_id, migration_module.__doc__ or "")
                    )
                db_conn.commit()
                logger.info(f"Successfully applied migration: {migration_id}")

            except Exception as e:
                db_conn.rollback()
                logger.error(f"Failed to apply migration {migration_id}: {e}")
                raise