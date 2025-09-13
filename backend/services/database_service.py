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
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        last_login TIMESTAMP
                    )
                """)
                
                # Create index on email for faster lookups
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
                """)
                
                conn.commit()
                logger.info(f"Database initialized successfully at {self.db_path}")
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt"""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def create_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Create a new user with email and password
        
        Args:
            email: User's email address
            password: Plain text password
            
        Returns:
            Dict with user data if successful, None if email already exists
            
        Raises:
            Exception: If database operation fails
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if user already exists
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                if cursor.fetchone():
                    logger.warning(f"User creation failed: email {email} already exists")
                    return None
                
                # Hash password and create user
                password_hash = self.hash_password(password)
                
                cursor.execute("""
                    INSERT INTO users (email, password_hash, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                """, (email, password_hash, datetime.utcnow(), datetime.utcnow()))
                
                user_id = cursor.lastrowid
                conn.commit()
                
                # Return user data (without password hash)
                return {
                    "id": user_id,
                    "email": email,
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
                cursor = conn.cursor()
                
                # Get user by email
                cursor.execute("""
                    SELECT id, email, password_hash, created_at, is_active, last_login
                    FROM users 
                    WHERE email = ? AND is_active = TRUE
                """, (email,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    logger.warning(f"Authentication failed: user {email} not found")
                    return None
                
                user_id, user_email, password_hash, created_at, is_active, last_login = user_data
                
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
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, email, created_at, is_active, last_login
                    FROM users 
                    WHERE id = ? AND is_active = TRUE
                """, (user_id,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    return None
                
                user_id, email, created_at, is_active, last_login = user_data
                
                return {
                    "id": user_id,
                    "email": email,
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
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT id, email, created_at, is_active, last_login
                    FROM users 
                    WHERE email = ? AND is_active = TRUE
                """, (email,))
                
                user_data = cursor.fetchone()
                if not user_data:
                    return None
                
                user_id, email, created_at, is_active, last_login = user_data
                
                return {
                    "id": user_id,
                    "email": email,
                    "created_at": created_at,
                    "is_active": bool(is_active),
                    "last_login": last_login
                }
                
        except Exception as e:
            logger.error(f"Failed to get user by email {email}: {e}")
            raise

# Global instance
db_service = DatabaseService()