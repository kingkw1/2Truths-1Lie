"""
Data Migration Scripts
=====================

Scripts for migrating data from SQLite to PostgreSQL with
data transformation and validation.
"""

import sqlite3
import psycopg2
import json
import logging
from typing import Dict, List, Any, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class DataMigrator:
    """Handles data migration between SQLite and PostgreSQL"""
    
    def __init__(self, sqlite_path: str, postgres_url: str):
        self.sqlite_path = sqlite_path
        self.postgres_url = postgres_url
        
    def migrate_users_table(self) -> Tuple[bool, int]:
        """Migrate users table with data validation"""
        try:
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    sqlite_cursor = sqlite_conn.cursor()
                    postgres_cursor = postgres_conn.cursor()
                    
                    # Get users from SQLite
                    sqlite_cursor.execute("""
                        SELECT id, email, password_hash, name, created_at, 
                               updated_at, is_active, last_login
                        FROM users
                        ORDER BY id
                    """)
                    
                    users = sqlite_cursor.fetchall()
                    migrated_count = 0
                    
                    for user in users:
                        # Validate email format
                        email = user[1]
                        if not self._validate_email(email):
                            logger.warning(f"Skipping user with invalid email: {email}")
                            continue
                        
                        # Insert into PostgreSQL
                        postgres_cursor.execute("""
                            INSERT INTO users (id, email, password_hash, name, created_at, 
                                             updated_at, is_active, last_login)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (email) DO NOTHING
                        """, user)
                        
                        migrated_count += 1
                    
                    postgres_conn.commit()
                    logger.info(f"Migrated {migrated_count} users")
                    return True, migrated_count
                    
        except Exception as e:
            logger.error(f"Failed to migrate users: {e}")
            return False, 0
    
    def migrate_challenges_table(self) -> Tuple[bool, int]:
        """Migrate challenges table with JSON validation"""
        try:
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    sqlite_cursor = sqlite_conn.cursor()
                    postgres_cursor = postgres_conn.cursor()
                    
                    # Get challenges from SQLite
                    sqlite_cursor.execute("""
                        SELECT challenge_id, creator_id, title, status, lie_statement_id,
                               view_count, guess_count, correct_guess_count, is_merged_video,
                               statements_json, merged_video_metadata_json, tags_json,
                               created_at, updated_at, published_at
                        FROM challenges
                        ORDER BY created_at
                    """)
                    
                    challenges = sqlite_cursor.fetchall()
                    migrated_count = 0
                    
                    for challenge in challenges:
                        # Validate and convert JSON fields
                        statements_json = self._validate_json(challenge[9], '[]')
                        metadata_json = self._validate_json(challenge[10], None)
                        tags_json = self._validate_json(challenge[11], None)
                        
                        # Convert data
                        challenge_data = (
                            challenge[0],  # challenge_id
                            challenge[1],  # creator_id
                            challenge[2],  # title
                            challenge[3] or 'draft',  # status
                            challenge[4],  # lie_statement_id
                            challenge[5] or 0,  # view_count
                            challenge[6] or 0,  # guess_count
                            challenge[7] or 0,  # correct_guess_count
                            challenge[8] or False,  # is_merged_video
                            statements_json,  # statements_json
                            metadata_json,  # merged_video_metadata_json
                            tags_json,  # tags_json
                            challenge[12],  # created_at
                            challenge[13],  # updated_at
                            challenge[14],  # published_at
                        )
                        
                        # Insert into PostgreSQL
                        postgres_cursor.execute("""
                            INSERT INTO challenges (
                                challenge_id, creator_id, title, status, lie_statement_id,
                                view_count, guess_count, correct_guess_count, is_merged_video,
                                statements_json, merged_video_metadata_json, tags_json,
                                created_at, updated_at, published_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (challenge_id) DO NOTHING
                        """, challenge_data)
                        
                        migrated_count += 1
                    
                    postgres_conn.commit()
                    logger.info(f"Migrated {migrated_count} challenges")
                    return True, migrated_count
                    
        except Exception as e:
            logger.error(f"Failed to migrate challenges: {e}")
            return False, 0
    
    def migrate_token_transactions_table(self) -> Tuple[bool, int]:
        """Migrate token transactions with UUID and JSONB conversion"""
        try:
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    sqlite_cursor = sqlite_conn.cursor()
                    postgres_cursor = postgres_conn.cursor()
                    
                    # Get token transactions from SQLite
                    sqlite_cursor.execute("""
                        SELECT user_id, transaction_type, amount, balance_before, balance_after,
                               description, metadata, revenuecat_transaction_id, 
                               revenuecat_product_id, created_at
                        FROM token_transactions
                        ORDER BY created_at
                    """)
                    
                    transactions = sqlite_cursor.fetchall()
                    migrated_count = 0
                    
                    for transaction in transactions:
                        # Convert metadata from TEXT to JSONB
                        metadata = self._validate_json(transaction[6], '{}')
                        
                        # Convert data (PostgreSQL will generate new UUID)
                        transaction_data = (
                            transaction[0],  # user_id
                            transaction[1],  # transaction_type
                            transaction[2],  # amount
                            transaction[3],  # balance_before
                            transaction[4],  # balance_after
                            transaction[5],  # description
                            metadata,  # metadata (JSONB)
                            transaction[7],  # revenuecat_transaction_id
                            transaction[8],  # revenuecat_product_id
                            transaction[9],  # created_at
                        )
                        
                        # Insert into PostgreSQL (UUID auto-generated)
                        postgres_cursor.execute("""
                            INSERT INTO token_transactions (
                                user_id, transaction_type, amount, balance_before, balance_after,
                                description, metadata, revenuecat_transaction_id, 
                                revenuecat_product_id, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, transaction_data)
                        
                        migrated_count += 1
                    
                    postgres_conn.commit()
                    logger.info(f"Migrated {migrated_count} token transactions")
                    return True, migrated_count
                    
        except Exception as e:
            logger.error(f"Failed to migrate token transactions: {e}")
            return False, 0
    
    def migrate_user_sessions_table(self) -> Tuple[bool, int]:
        """Migrate user sessions with UUID, JSONB, and INET conversion"""
        try:
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    sqlite_cursor = sqlite_conn.cursor()
                    postgres_cursor = postgres_conn.cursor()
                    
                    # Get user sessions from SQLite
                    sqlite_cursor.execute("""
                        SELECT user_id, jwt_token, token_hash, session_type, permissions,
                               created_at, expires_at, last_accessed, is_active, 
                               user_agent, ip_address
                        FROM user_sessions
                        WHERE expires_at > datetime('now')  -- Only migrate active sessions
                        ORDER BY created_at
                    """)
                    
                    sessions = sqlite_cursor.fetchall()
                    migrated_count = 0
                    
                    for session in sessions:
                        # Convert permissions from TEXT to JSONB
                        permissions = self._validate_json(session[4], '[]')
                        
                        # Convert IP address (basic validation)
                        ip_address = session[10]
                        if ip_address and not self._validate_ip_address(ip_address):
                            ip_address = None
                        
                        # Convert data (PostgreSQL will generate new UUID)
                        session_data = (
                            session[0],   # user_id
                            session[1],   # jwt_token
                            session[2],   # token_hash
                            session[3],   # session_type
                            permissions,  # permissions (JSONB)
                            session[5],   # created_at
                            session[6],   # expires_at
                            session[7],   # last_accessed
                            session[8],   # is_active
                            session[9],   # user_agent
                            ip_address,   # ip_address (INET)
                        )
                        
                        # Insert into PostgreSQL (UUID auto-generated)
                        postgres_cursor.execute("""
                            INSERT INTO user_sessions (
                                user_id, jwt_token, token_hash, session_type, permissions,
                                created_at, expires_at, last_accessed, is_active, 
                                user_agent, ip_address
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (token_hash) DO NOTHING
                        """, session_data)
                        
                        migrated_count += 1
                    
                    postgres_conn.commit()
                    logger.info(f"Migrated {migrated_count} user sessions")
                    return True, migrated_count
                    
        except Exception as e:
            logger.error(f"Failed to migrate user sessions: {e}")
            return False, 0
    
    def _validate_email(self, email: str) -> bool:
        """Basic email validation"""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email)) if email else False
    
    def _validate_json(self, json_str: str, default: str = None) -> str:
        """Validate and clean JSON string"""
        if not json_str:
            return default
        
        try:
            # Try to parse as JSON to validate
            json.loads(json_str)
            return json_str
        except (json.JSONDecodeError, TypeError):
            logger.warning(f"Invalid JSON found, using default: {json_str[:100]}...")
            return default
    
    def _validate_ip_address(self, ip: str) -> bool:
        """Basic IP address validation"""
        if not ip:
            return False
        
        import ipaddress
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False
    
    def migrate_all_tables(self) -> Dict[str, Tuple[bool, int]]:
        """Migrate all tables with data transformations"""
        results = {}
        
        # Migration order (respecting dependencies)
        migrations = [
            ('users', self.migrate_users_table),
            ('challenges', self.migrate_challenges_table),
            ('guesses', self._migrate_simple_table),
            ('user_reports', self._migrate_simple_table),
            ('token_balances', self._migrate_simple_table),
            ('token_transactions', self.migrate_token_transactions_table),
            ('user_sessions', self.migrate_user_sessions_table),
        ]
        
        for table_name, migration_func in migrations:
            logger.info(f"Starting migration for table: {table_name}")
            if table_name in ['guesses', 'user_reports', 'token_balances']:
                # Use simple migration for these tables
                success, count = migration_func(table_name)
            else:
                # Use specialized migration
                success, count = migration_func()
            
            results[table_name] = (success, count)
            
            if not success:
                logger.error(f"Migration failed for table: {table_name}")
                break
            else:
                logger.info(f"Successfully migrated {count} rows from {table_name}")
        
        return results
    
    def _migrate_simple_table(self, table_name: str) -> Tuple[bool, int]:
        """Simple table migration without special transformations"""
        try:
            with sqlite3.connect(self.sqlite_path) as sqlite_conn:
                with psycopg2.connect(self.postgres_url) as postgres_conn:
                    sqlite_cursor = sqlite_conn.cursor()
                    postgres_cursor = postgres_conn.cursor()
                    
                    # Get table structure
                    sqlite_cursor.execute(f"PRAGMA table_info({table_name})")
                    columns = [col[1] for col in sqlite_cursor.fetchall()]
                    
                    # Get all data
                    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
                    rows = sqlite_cursor.fetchall()
                    
                    if not rows:
                        return True, 0
                    
                    # Prepare insert statement
                    placeholders = ', '.join(['%s'] * len(columns))
                    insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
                    
                    # Insert data
                    postgres_cursor.executemany(insert_sql, rows)
                    postgres_conn.commit()
                    
                    logger.info(f"Migrated {len(rows)} rows from {table_name}")
                    return True, len(rows)
                    
        except Exception as e:
            logger.error(f"Failed to migrate {table_name}: {e}")
            return False, 0