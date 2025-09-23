"""
Rollback Manager
===============

Handles rollback operations for database migrations with
safety checks and validation.
"""

import os
import sys
import logging
import psycopg2
from typing import Dict, List, Optional, Any
from datetime import datetime

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

logger = logging.getLogger(__name__)

class RollbackManager:
    """
    Manages rollback operations for database migrations
    """
    
    def __init__(self, postgres_url: str, rollback_dir: str = None):
        self.postgres_url = postgres_url
        self.rollback_dir = rollback_dir or os.path.dirname(__file__)
        
    def list_available_rollbacks(self) -> List[str]:
        """List available rollback scripts"""
        rollback_files = []
        for file in os.listdir(self.rollback_dir):
            if file.endswith('.sql') and file.startswith('rollback_'):
                rollback_files.append(file)
        return sorted(rollback_files)
    
    def validate_rollback_safety(self) -> Dict[str, Any]:
        """
        Validate that rollback can be performed safely
        """
        safety_check = {
            'safe_to_rollback': True,
            'warnings': [],
            'table_counts': {},
            'migration_history': []
        }
        
        try:
            with psycopg2.connect(self.postgres_url) as conn:
                with conn.cursor() as cursor:
                    
                    # Check migration history
                    try:
                        cursor.execute("""
                            SELECT migration_id, description, executed_at, status
                            FROM migration_history
                            ORDER BY executed_at DESC
                        """)
                        safety_check['migration_history'] = cursor.fetchall()
                    except psycopg2.ProgrammingError:
                        # Migration history table doesn't exist
                        safety_check['warnings'].append("Migration history table not found")
                    
                    # Check table counts
                    tables = ['users', 'challenges', 'guesses', 'user_reports', 
                             'token_balances', 'token_transactions', 'user_sessions']
                    
                    for table in tables:
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {table}")
                            count = cursor.fetchone()[0]
                            safety_check['table_counts'][table] = count
                            
                            if count > 1000:
                                safety_check['warnings'].append(
                                    f"Table {table} has {count} rows - consider backup before rollback"
                                )
                        except psycopg2.ProgrammingError:
                            # Table doesn't exist
                            safety_check['table_counts'][table] = 0
                    
                    # Check for active sessions
                    try:
                        cursor.execute("""
                            SELECT COUNT(*) FROM user_sessions 
                            WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP
                        """)
                        active_sessions = cursor.fetchone()[0]
                        if active_sessions > 0:
                            safety_check['warnings'].append(
                                f"{active_sessions} active user sessions will be lost"
                            )
                    except psycopg2.ProgrammingError:
                        pass
                    
                    # Check total data volume
                    total_rows = sum(safety_check['table_counts'].values())
                    if total_rows > 10000:
                        safety_check['warnings'].append(
                            f"Large dataset detected ({total_rows} total rows) - ensure you have backup"
                        )
                        safety_check['safe_to_rollback'] = False
        
        except Exception as e:
            logger.error(f"Safety validation failed: {e}")
            safety_check['safe_to_rollback'] = False
            safety_check['warnings'].append(f"Connection error: {e}")
        
        return safety_check
    
    def create_backup_before_rollback(self) -> Optional[str]:
        """
        Create a data backup before performing rollback
        Returns backup file path or None if failed
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = f"postgres_backup_before_rollback_{timestamp}.sql"
            backup_path = os.path.join(self.rollback_dir, backup_file)
            
            # Use pg_dump to create backup
            import subprocess
            
            # Extract connection info from URL
            # Format: postgresql://user:password@host:port/database
            if self.postgres_url.startswith('postgresql://'):
                url_parts = self.postgres_url.replace('postgresql://', '').split('/')
                connection_part = url_parts[0]
                database = url_parts[1] if len(url_parts) > 1 else 'postgres'
                
                if '@' in connection_part:
                    auth_part, host_part = connection_part.split('@')
                    if ':' in auth_part:
                        user, password = auth_part.split(':', 1)
                    else:
                        user = auth_part
                        password = ''
                    
                    if ':' in host_part:
                        host, port = host_part.split(':')
                    else:
                        host = host_part
                        port = '5432'
                else:
                    host = connection_part
                    port = '5432'
                    user = 'postgres'
                    password = ''
                
                # Build pg_dump command
                cmd = [
                    'pg_dump',
                    '-h', host,
                    '-p', port,
                    '-U', user,
                    '-d', database,
                    '--no-password',  # Use .pgpass or environment variables
                    '--verbose',
                    '--clean',
                    '--if-exists',
                    '-f', backup_path
                ]
                
                # Set password via environment if provided
                env = os.environ.copy()
                if password:
                    env['PGPASSWORD'] = password
                
                logger.info(f"Creating backup with pg_dump: {backup_file}")
                result = subprocess.run(cmd, env=env, capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.info(f"Backup created successfully: {backup_path}")
                    return backup_path
                else:
                    logger.error(f"Backup failed: {result.stderr}")
                    return None
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            return None
    
    def execute_rollback_script(self, script_name: str, confirm: bool = False) -> bool:
        """
        Execute a specific rollback script
        """
        if not confirm:
            logger.error("Rollback requires explicit confirmation (confirm=True)")
            return False
        
        script_path = os.path.join(self.rollback_dir, script_name)
        if not os.path.exists(script_path):
            logger.error(f"Rollback script not found: {script_path}")
            return False
        
        try:
            logger.info(f"Executing rollback script: {script_name}")
            
            with open(script_path, 'r') as f:
                rollback_sql = f.read()
            
            with psycopg2.connect(self.postgres_url) as conn:
                with conn.cursor() as cursor:
                    # Execute rollback script
                    cursor.execute(rollback_sql)
                    conn.commit()
            
            logger.info("Rollback script executed successfully")
            
            # Record rollback in migration history (if table still exists)
            try:
                with psycopg2.connect(self.postgres_url) as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("""
                            INSERT INTO migration_history (migration_id, description, executed_at, status)
                            VALUES (%s, %s, %s, %s)
                        """, (
                            f'rollback_{script_name}',
                            f'Executed rollback script: {script_name}',
                            datetime.now(),
                            'completed'
                        ))
                        conn.commit()
            except psycopg2.ProgrammingError:
                # Migration history table was dropped
                pass
            
            return True
            
        except Exception as e:
            logger.error(f"Rollback execution failed: {e}")
            return False
    
    def perform_safe_rollback(self, script_name: str, 
                            create_backup: bool = True,
                            force: bool = False) -> Dict[str, Any]:
        """
        Perform a complete safe rollback with validation and backup
        """
        rollback_result = {
            'success': False,
            'backup_created': None,
            'safety_validation': None,
            'rollback_executed': False,
            'errors': []
        }
        
        try:
            # Validate safety
            logger.info("Validating rollback safety...")
            safety_check = self.validate_rollback_safety()
            rollback_result['safety_validation'] = safety_check
            
            if not safety_check['safe_to_rollback'] and not force:
                raise Exception("Rollback safety validation failed. Use force=True to override.")
            
            if safety_check['warnings']:
                for warning in safety_check['warnings']:
                    logger.warning(f"Rollback warning: {warning}")
            
            # Create backup if requested
            if create_backup:
                logger.info("Creating backup before rollback...")
                backup_path = self.create_backup_before_rollback()
                rollback_result['backup_created'] = backup_path
                
                if not backup_path and not force:
                    raise Exception("Backup creation failed. Use force=True to proceed without backup.")
            
            # Execute rollback
            logger.info(f"Executing rollback: {script_name}")
            if self.execute_rollback_script(script_name, confirm=True):
                rollback_result['rollback_executed'] = True
                rollback_result['success'] = True
                logger.info("Rollback completed successfully")
            else:
                raise Exception("Rollback script execution failed")
        
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Rollback failed: {error_msg}")
            rollback_result['errors'].append(error_msg)
        
        return rollback_result
    
    def get_rollback_status(self) -> Dict[str, Any]:
        """Get current rollback status and available options"""
        status = {
            'available_rollbacks': self.list_available_rollbacks(),
            'database_state': {},
            'recommendations': []
        }
        
        try:
            with psycopg2.connect(self.postgres_url) as conn:
                with conn.cursor() as cursor:
                    # Check if tables exist
                    cursor.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public'
                        AND table_type = 'BASE TABLE'
                    """)
                    
                    existing_tables = [row[0] for row in cursor.fetchall()]
                    status['database_state']['existing_tables'] = existing_tables
                    
                    if existing_tables:
                        status['recommendations'].append("Database contains tables - rollback available")
                    else:
                        status['recommendations'].append("Database appears empty - no rollback needed")
                    
                    # Check migration history
                    if 'migration_history' in existing_tables:
                        cursor.execute("""
                            SELECT COUNT(*) FROM migration_history 
                            WHERE status = 'completed'
                        """)
                        completed_migrations = cursor.fetchone()[0]
                        status['database_state']['completed_migrations'] = completed_migrations
                        
                        if completed_migrations > 0:
                            status['recommendations'].append(
                                f"{completed_migrations} completed migrations found"
                            )
        
        except Exception as e:
            status['database_state']['error'] = str(e)
            status['recommendations'].append("Could not connect to database")
        
        return status