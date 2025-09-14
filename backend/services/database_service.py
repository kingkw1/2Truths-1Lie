"""
Database service for managing SQLite database operations
"""
import sqlite3
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
from passlib.context import CryptContext
from config import settings

logger = logging.getLogger(__name__)

class DatabaseService:
    """Service for managing SQLite database operations"""
    
    def __init__(self):
        self.db_path = Path(__file__).parent.parent / "app.db"  # backend/app.db
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self._init_database()
        self._verify_database_constraints()
    
    def _init_database(self):
        """Initialize the database with required tables"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create users table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        name TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        last_login TIMESTAMP
                    )
                """)
                
                # Create indexes on users table for faster lookups
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)
                """)
                
                # Add name column to existing users table if it doesn't exist
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
                except sqlite3.OperationalError as e:
                    # Column already exists or other issue
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Failed to add name column: {e}")
                
                # Create user_reports table for content moderation
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS user_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        challenge_id TEXT NOT NULL CHECK (length(challenge_id) > 0),
                        user_id INTEGER NOT NULL,
                        reason TEXT NOT NULL,
                        details TEXT,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_user_reports_user_id 
                            FOREIGN KEY (user_id) REFERENCES users (id) 
                            ON DELETE CASCADE 
                            ON UPDATE CASCADE,
                        CONSTRAINT chk_user_reports_reason 
                            CHECK (reason IN (
                                'inappropriate_language', 'spam', 'personal_info', 
                                'violence', 'hate_speech', 'adult_content', 
                                'copyright', 'misleading', 'low_quality'
                            )),
                        CONSTRAINT chk_user_reports_details_length 
                            CHECK (details IS NULL OR length(details) <= 1000)
                    )
                """)
                
                # Create indexes for user_reports table for faster lookups
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_id ON user_reports(challenge_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON user_reports(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_reason ON user_reports(reason)
                """)
                
                # Create unique constraint to prevent duplicate reports from same user for same challenge
                cursor.execute("""
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reports_unique_user_challenge 
                    ON user_reports(challenge_id, user_id)
                """)
                
                # Create composite index for common query patterns
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_created 
                    ON user_reports(challenge_id, created_at DESC)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_user_created 
                    ON user_reports(user_id, created_at DESC)
                """)
                
                # Create covering index for admin reports aggregation queries
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_reports_admin_summary 
                    ON user_reports(challenge_id, created_at, reason, id)
                """)
                
                # Enable foreign key constraints (SQLite doesn't enable them by default)
                cursor.execute("PRAGMA foreign_keys = ON")
                
                # Verify foreign key constraints are enabled
                cursor.execute("PRAGMA foreign_keys")
                fk_enabled = cursor.fetchone()[0]
                if not fk_enabled:
                    logger.warning("Foreign key constraints are not enabled in SQLite")
                else:
                    logger.info("Foreign key constraints are enabled")
                
                # Run integrity check
                cursor.execute("PRAGMA integrity_check")
                integrity_result = cursor.fetchone()[0]
                if integrity_result != "ok":
                    logger.error(f"Database integrity check failed: {integrity_result}")
                    raise Exception(f"Database integrity check failed: {integrity_result}")
                
                conn.commit()
                logger.info(f"Database initialized successfully at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _verify_database_constraints(self):
        """Verify that all foreign key constraints and indexes are properly set up"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Enable foreign key constraints for this connection
                cursor.execute("PRAGMA foreign_keys = ON")
                
                # Check if we need to migrate the user_reports table for updated constraints
                cursor.execute("PRAGMA foreign_key_list(user_reports)")
                fk_constraints = cursor.fetchall()
                
                needs_migration = True
                for constraint in fk_constraints:
                    # constraint format: (id, seq, table, from, to, on_update, on_delete, match)
                    if (constraint[2] == 'users' and constraint[3] == 'user_id' and 
                        constraint[4] == 'id' and constraint[5] == 'CASCADE'):
                        needs_migration = False
                        logger.info(f"Foreign key constraint verified: user_reports.user_id -> users.id (ON UPDATE CASCADE)")
                        break
                
                if needs_migration:
                    logger.info("Migrating user_reports table to update foreign key constraints...")
                    self._migrate_user_reports_table(conn)
                
                # Verify foreign key constraints exist after potential migration
                cursor.execute("PRAGMA foreign_key_list(user_reports)")
                fk_constraints = cursor.fetchall()
                
                expected_fk = False
                for constraint in fk_constraints:
                    if constraint[2] == 'users' and constraint[3] == 'user_id' and constraint[4] == 'id':
                        expected_fk = True
                        on_update = constraint[5]
                        on_delete = constraint[6]
                        logger.info(f"Foreign key constraint verified: user_reports.user_id -> users.id (ON UPDATE {on_update}, ON DELETE {on_delete})")
                        break
                
                if not expected_fk:
                    logger.warning("Expected foreign key constraint not found: user_reports.user_id -> users.id")
                
                # Verify indexes exist
                cursor.execute("PRAGMA index_list(users)")
                user_indexes = {row[1] for row in cursor.fetchall()}
                
                cursor.execute("PRAGMA index_list(user_reports)")
                report_indexes = {row[1] for row in cursor.fetchall()}
                
                expected_user_indexes = {
                    'idx_users_email',
                    'idx_users_is_active', 
                    'idx_users_created_at',
                    'idx_users_last_login'
                }
                
                expected_report_indexes = {
                    'idx_user_reports_challenge_id',
                    'idx_user_reports_user_id',
                    'idx_user_reports_created_at',
                    'idx_user_reports_reason',
                    'idx_user_reports_unique_user_challenge',
                    'idx_user_reports_challenge_created',
                    'idx_user_reports_user_created',
                    'idx_user_reports_admin_summary'
                }
                
                missing_user_indexes = expected_user_indexes - user_indexes
                missing_report_indexes = expected_report_indexes - report_indexes
                
                if missing_user_indexes:
                    logger.warning(f"Missing user table indexes: {missing_user_indexes}")
                else:
                    logger.info("All expected user table indexes are present")
                
                if missing_report_indexes:
                    logger.warning(f"Missing user_reports table indexes: {missing_report_indexes}")
                else:
                    logger.info("All expected user_reports table indexes are present")
                
                # Run foreign key check
                cursor.execute("PRAGMA foreign_key_check")
                fk_violations = cursor.fetchall()
                if fk_violations:
                    logger.error(f"Foreign key violations found: {fk_violations}")
                    raise Exception(f"Foreign key violations detected: {fk_violations}")
                else:
                    logger.info("No foreign key violations detected")
                
        except Exception as e:
            logger.error(f"Failed to verify database constraints: {e}")
            # Don't raise here as this is verification, not critical for operation
    
    def _migrate_user_reports_table(self, conn):
        """Migrate user_reports table to update foreign key constraints"""
        try:
            cursor = conn.cursor()
            
            # Check if table has data
            cursor.execute("SELECT COUNT(*) FROM user_reports")
            row_count = cursor.fetchone()[0]
            
            if row_count > 0:
                logger.info(f"Backing up {row_count} user reports before migration...")
                
                # Create backup table with existing data
                cursor.execute("""
                    CREATE TABLE user_reports_backup AS 
                    SELECT * FROM user_reports
                """)
            
            # Drop existing table and indexes
            cursor.execute("DROP TABLE IF EXISTS user_reports")
            
            # Recreate table with updated constraints
            cursor.execute("""
                CREATE TABLE user_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    challenge_id TEXT NOT NULL CHECK (length(challenge_id) > 0),
                    user_id INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    details TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_user_reports_user_id 
                        FOREIGN KEY (user_id) REFERENCES users (id) 
                        ON DELETE CASCADE 
                        ON UPDATE CASCADE,
                    CONSTRAINT chk_user_reports_reason 
                        CHECK (reason IN (
                            'inappropriate_language', 'spam', 'personal_info', 
                            'violence', 'hate_speech', 'adult_content', 
                            'copyright', 'misleading', 'low_quality'
                        )),
                    CONSTRAINT chk_user_reports_details_length 
                        CHECK (details IS NULL OR length(details) <= 1000)
                )
            """)
            
            # Restore data if we had any
            if row_count > 0:
                cursor.execute("""
                    INSERT INTO user_reports (id, challenge_id, user_id, reason, details, created_at)
                    SELECT id, challenge_id, user_id, reason, details, created_at 
                    FROM user_reports_backup
                """)
                
                # Drop backup table
                cursor.execute("DROP TABLE user_reports_backup")
                logger.info(f"Restored {row_count} user reports after migration")
            
            # Recreate all indexes
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_id ON user_reports(challenge_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON user_reports(user_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_reason ON user_reports(reason)
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reports_unique_user_challenge 
                ON user_reports(challenge_id, user_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_created 
                ON user_reports(challenge_id, created_at DESC)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_user_created 
                ON user_reports(user_id, created_at DESC)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_reports_admin_summary 
                ON user_reports(challenge_id, created_at, reason, id)
            """)
            
            conn.commit()
            logger.info("User reports table migration completed successfully")
            
        except Exception as e:
            logger.error(f"Failed to migrate user_reports table: {e}")
            # Try to restore from backup if it exists
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_reports_backup'")
                if cursor.fetchone():
                    cursor.execute("DROP TABLE IF EXISTS user_reports")
                    cursor.execute("ALTER TABLE user_reports_backup RENAME TO user_reports")
                    logger.info("Restored user_reports table from backup after migration failure")
            except:
                pass
            raise
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def create_user(self, email: str, password: str, name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Create a new user with email and password
        
        Args:
            email: User's email address
            password: Plain text password
            name: Optional user display name
            
        Returns:
            Dict with user data if successful, None if email already exists
            
        Raises:
            Exception: If database operation fails
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                # Check if user already exists
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    logger.warning(f"User creation failed: email {email} already exists")
                    return None
                
                # Hash password and create user
                password_hash = self.hash_password(password)
                
                cursor.execute("""
                    INSERT INTO users (email, password_hash, name, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (email, password_hash, name, datetime.utcnow(), datetime.utcnow()))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                # Return user data (without password hash)
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "created_at": datetime.utcnow().isoformat(),
                    "is_active": True
                }
                
        except Exception as e:
            logger.error(f"Failed to create user {email}: {e}")
            raise
    
    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate a user with email and password
        
        Args:
            email: User's email address
            password: Plain text password
            
        Returns:
            Dict with user data if authentication successful, None if failed
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                # Get user by email
                cursor.execute("""
                    SELECT id, email, password_hash, name, created_at, is_active, last_login
                    FROM users 
                    WHERE email = ? AND is_active = TRUE
                """, (email,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    logger.warning(f"Authentication failed: user {email} not found")
                    return None
                
                user_id, user_email, password_hash, name, created_at, is_active, last_login = user_data
                
                # Verify password
                if not self.verify_password(password, password_hash):
                    logger.warning(f"Authentication failed: invalid password for {email}")
                    return None
                
                # Update last login
                cursor.execute("""
                    UPDATE users 
                    SET last_login = ?, updated_at = ?
                    WHERE id = ?
                """, (datetime.utcnow(), datetime.utcnow(), user_id))
                
                conn.commit()
                
                return {
                    "id": user_id,
                    "email": user_email,
                    "name": name,
                    "created_at": created_at,
                    "is_active": bool(is_active),
                    "last_login": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Authentication error for {email}: {e}")
            raise
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, email, name, created_at, is_active, last_login
                    FROM users 
                    WHERE id = ? AND is_active = TRUE
                """, (user_id,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    return None
                
                user_id, email, name, created_at, is_active, last_login = user_data
                
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "created_at": created_at,
                    "is_active": bool(is_active),
                    "last_login": last_login
                }
                
        except Exception as e:
            logger.error(f"Failed to get user by ID {user_id}: {e}")
            raise
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, email, name, created_at, is_active, last_login
                    FROM users 
                    WHERE email = ? AND is_active = TRUE
                """, (email,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    return None
                
                user_id, email, name, created_at, is_active, last_login = user_data
                
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "created_at": created_at,
                    "is_active": bool(is_active),
                    "last_login": last_login
                }
                
        except Exception as e:
            logger.error(f"Failed to get user by email {email}: {e}")
            raise
    
    def create_user_report(self, challenge_id: str, user_id: int, reason: str, details: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Create a new user report for a challenge
        
        Args:
            challenge_id: ID of the challenge being reported
            user_id: ID of the user making the report
            reason: Reason for the report (should match ModerationReason enum values)
            details: Optional additional details about the report
            
        Returns:
            Dict with report data if successful, None if duplicate report exists
            
        Raises:
            Exception: If database operation fails
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                # Check if user has already reported this challenge
                cursor.execute("""
                    SELECT id FROM user_reports 
                    WHERE challenge_id = ? AND user_id = ?
                """, (challenge_id, user_id))
                
                if cursor.fetchone():
                    logger.warning(f"Duplicate report attempt: user {user_id} already reported challenge {challenge_id}")
                    return None
                
                # Create the report
                cursor.execute("""
                    INSERT INTO user_reports (challenge_id, user_id, reason, details, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (challenge_id, user_id, reason, details, datetime.utcnow()))
                
                report_id = cursor.lastrowid
                conn.commit()
                
                logger.info(f"User report created: ID {report_id}, user {user_id}, challenge {challenge_id}, reason: {reason}")
                
                return {
                    "id": report_id,
                    "challenge_id": challenge_id,
                    "user_id": user_id,
                    "reason": reason,
                    "details": details,
                    "created_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Failed to create user report for challenge {challenge_id} by user {user_id}: {e}")
            raise
    
    def get_user_reports_by_challenge(self, challenge_id: str) -> List[Dict[str, Any]]:
        """
        Get all user reports for a specific challenge
        
        Args:
            challenge_id: ID of the challenge
            
        Returns:
            List of report dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                           u.email, u.name
                    FROM user_reports ur
                    LEFT JOIN users u ON ur.user_id = u.id
                    WHERE ur.challenge_id = ?
                    ORDER BY ur.created_at DESC
                """, (challenge_id,))
                
                reports = []
                for row in cursor.fetchall():
                    report_id, challenge_id, user_id, reason, details, created_at, user_email, user_name = row
                    reports.append({
                        "id": report_id,
                        "challenge_id": challenge_id,
                        "user_id": user_id,
                        "reason": reason,
                        "details": details,
                        "created_at": created_at,
                        "user_email": user_email,
                        "user_name": user_name
                    })
                
                return reports
                
        except Exception as e:
            logger.error(f"Failed to get user reports for challenge {challenge_id}: {e}")
            raise
    
    def get_all_reported_challenges(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get all challenges that have been reported by users
        
        Args:
            limit: Maximum number of results to return
            offset: Number of results to skip
            
        Returns:
            List of challenge report summaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT ur.challenge_id, 
                           COUNT(ur.id) as report_count,
                           MIN(ur.created_at) as first_report_at,
                           MAX(ur.created_at) as last_report_at,
                           GROUP_CONCAT(DISTINCT ur.reason) as reasons
                    FROM user_reports ur
                    GROUP BY ur.challenge_id
                    ORDER BY MAX(ur.created_at) DESC
                    LIMIT ? OFFSET ?
                """, (limit, offset))
                
                reported_challenges = []
                for row in cursor.fetchall():
                    challenge_id, report_count, first_report_at, last_report_at, reasons = row
                    reported_challenges.append({
                        "challenge_id": challenge_id,
                        "report_count": report_count,
                        "first_report_at": first_report_at,
                        "last_report_at": last_report_at,
                        "reasons": reasons.split(',') if reasons else []
                    })
                
                return reported_challenges
                
        except Exception as e:
            logger.error(f"Failed to get reported challenges: {e}")
            raise
    
    def get_reported_challenges_count(self) -> int:
        """
        Get the total count of unique challenges that have been reported
        
        Returns:
            Total number of unique challenges with reports
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT COUNT(DISTINCT ur.challenge_id) as total_count
                    FROM user_reports ur
                """)
                
                result = cursor.fetchone()
                return result[0] if result else 0
                
        except Exception as e:
            logger.error(f"Failed to get reported challenges count: {e}")
            raise
    
    def get_user_report_by_id(self, report_id: int) -> Optional[Dict[str, Any]]:
        """
        Get a specific user report by ID
        
        Args:
            report_id: ID of the report
            
        Returns:
            Report dictionary if found, None otherwise
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Enable foreign key constraints for this connection
                conn.execute("PRAGMA foreign_keys = ON")
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                           u.email, u.name
                    FROM user_reports ur
                    LEFT JOIN users u ON ur.user_id = u.id
                    WHERE ur.id = ?
                """, (report_id,))
                
                row = cursor.fetchone()
                if not row:
                    return None
                
                report_id, challenge_id, user_id, reason, details, created_at, user_email, user_name = row
                
                return {
                    "id": report_id,
                    "challenge_id": challenge_id,
                    "user_id": user_id,
                    "reason": reason,
                    "details": details,
                    "created_at": created_at,
                    "user_email": user_email,
                    "user_name": user_name
                }
                
        except Exception as e:
            logger.error(f"Failed to get user report by ID {report_id}: {e}")
            raise

# Global instance
db_service = DatabaseService()