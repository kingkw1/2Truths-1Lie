"""
Database service for managing database operations with PostgreSQL and SQLite support
"""
import sqlite3
import logging
import json
import traceback
from pathlib import Path
from typing import Optional, Dict, Any, List, Union, NamedTuple
from datetime import datetime
from passlib.context import CryptContext
from config import settings
import os
from enum import Enum
from urllib.parse import urlparse, parse_qs
import re

# PostgreSQL imports (will only be used if DATABASE_URL is set)
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

logger = logging.getLogger(__name__)

class DatabaseEnvironment(Enum):
    """Database environment types"""
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"
    TESTING = "testing"

class DatabaseMode(Enum):
    """Database operation modes"""
    POSTGRESQL_ONLY = "postgresql_only"
    SQLITE_ONLY = "sqlite_only"
    HYBRID = "hybrid"  # Only for development/testing

class DatabaseURLInfo(NamedTuple):
    """Parsed DATABASE_URL information"""
    scheme: str
    hostname: str
    port: Optional[int]
    username: Optional[str]
    password: Optional[str]
    database: str
    is_postgres: bool
    is_sqlite: bool
    
class DatabaseURLError(Exception):
    """Raised when DATABASE_URL is invalid or malformed"""
    pass

class DatabaseError(Exception):
    """Base class for database operation errors"""
    def __init__(self, message: str, query: str = None, params: tuple = None, original_error: Exception = None):
        super().__init__(message)
        self.query = query
        self.params = params
        self.original_error = original_error

class DatabaseConnectionError(DatabaseError):
    """Raised when database connection fails"""
    pass

class DatabaseQueryError(DatabaseError):
    """Raised when database query execution fails"""
    pass

class DatabaseTransactionError(DatabaseError):
    """Raised when database transaction fails"""
    pass

class DatabaseConstraintError(DatabaseError):
    """Raised when database constraint violations occur"""
    pass

class EnvironmentMismatchError(DatabaseError):
    """Raised when database operations don't match the configured environment"""
    pass

def detect_environment() -> DatabaseEnvironment:
    """
    Detect the current environment based on various indicators
    
    Returns:
        DatabaseEnvironment: The detected environment
    """
    # Check explicit environment variable first
    env_var = os.environ.get('ENVIRONMENT', '').lower()
    if env_var in ['production', 'prod']:
        return DatabaseEnvironment.PRODUCTION
    elif env_var in ['staging', 'stage']:
        return DatabaseEnvironment.STAGING
    elif env_var in ['development', 'dev']:
        return DatabaseEnvironment.DEVELOPMENT
    elif env_var in ['testing', 'test']:
        return DatabaseEnvironment.TESTING
    
    # Check for Railway environment (production indicator)
    if os.environ.get('RAILWAY_ENVIRONMENT'):
        railway_env = os.environ.get('RAILWAY_ENVIRONMENT', '').lower()
        if railway_env == 'production':
            return DatabaseEnvironment.PRODUCTION
        elif railway_env in ['staging', 'preview']:
            return DatabaseEnvironment.STAGING
        else:
            return DatabaseEnvironment.DEVELOPMENT
    
    # Check for other production indicators
    production_indicators = [
        'HEROKU_APP_NAME',
        'VERCEL_ENV',
        'AWS_LAMBDA_FUNCTION_NAME',
        'GOOGLE_CLOUD_PROJECT'
    ]
    
    for indicator in production_indicators:
        if os.environ.get(indicator):
            return DatabaseEnvironment.PRODUCTION
    
    # Check DATABASE_URL patterns for environment hints
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url:
        if any(prod_host in db_url for prod_host in [
            'railway.app',
            'amazonaws.com',
            'googleapis.com',
            'azure.com',
            'planetscale.com',
            'supabase.com'
        ]):
            return DatabaseEnvironment.PRODUCTION
        elif 'localhost' in db_url or '127.0.0.1' in db_url:
            return DatabaseEnvironment.DEVELOPMENT
    
    # Check for testing indicators
    if os.environ.get('CI') or os.environ.get('PYTEST_CURRENT_TEST'):
        return DatabaseEnvironment.TESTING
    
    # Default to development if no clear indicators
    return DatabaseEnvironment.DEVELOPMENT

def parse_database_url(database_url: str) -> DatabaseURLInfo:
    """
    Parse and validate DATABASE_URL
    
    Args:
        database_url: The DATABASE_URL to parse
        
    Returns:
        DatabaseURLInfo: Parsed database information
        
    Raises:
        DatabaseURLError: If URL is malformed or invalid
    """
    if not database_url or not database_url.strip():
        raise DatabaseURLError("DATABASE_URL is empty or missing")
    
    try:
        parsed = urlparse(database_url)
    except Exception as e:
        raise DatabaseURLError(f"Failed to parse DATABASE_URL: {e}")
    
    # Validate scheme
    if not parsed.scheme:
        raise DatabaseURLError("DATABASE_URL missing scheme (e.g., postgresql://, sqlite://)")
    
    scheme = parsed.scheme.lower()
    
    # Determine database type
    is_postgres = scheme in ['postgresql', 'postgres']
    is_sqlite = scheme in ['sqlite', 'sqlite3']
    
    if not is_postgres and not is_sqlite:
        raise DatabaseURLError(f"Unsupported database scheme: {scheme}. Only postgresql and sqlite are supported.")
    
    # For SQLite, validate file path
    if is_sqlite:
        if not parsed.path:
            raise DatabaseURLError("SQLite DATABASE_URL missing file path")
        
        # Handle sqlite:///path/to/file.db format
        db_path = parsed.path
        if db_path.startswith('/'):
            db_path = db_path[1:]  # Remove leading slash for relative paths
        
        return DatabaseURLInfo(
            scheme=scheme,
            hostname='',
            port=None,
            username=None,
            password=None,
            database=db_path,
            is_postgres=False,
            is_sqlite=True
        )
    
    # For PostgreSQL, validate required components
    if is_postgres:
        if not parsed.hostname:
            raise DatabaseURLError("PostgreSQL DATABASE_URL missing hostname")
        
        if not parsed.path or parsed.path == '/':
            raise DatabaseURLError("PostgreSQL DATABASE_URL missing database name")
        
        # Remove leading slash from database name
        database_name = parsed.path[1:] if parsed.path.startswith('/') else parsed.path
        
        # Validate database name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', database_name):
            raise DatabaseURLError(f"Invalid PostgreSQL database name: {database_name}")
        
        # Validate port if present
        port = parsed.port
        if port and (port < 1 or port > 65535):
            raise DatabaseURLError(f"Invalid port number: {port}")
        
        return DatabaseURLInfo(
            scheme=scheme,
            hostname=parsed.hostname,
            port=port,
            username=parsed.username,
            password=parsed.password,
            database=database_name,
            is_postgres=True,
            is_sqlite=False
        )

def validate_database_url_for_environment(database_url: Optional[str], env: DatabaseEnvironment) -> Optional[DatabaseURLInfo]:
    """
    Validate DATABASE_URL for the current environment with fail-fast behavior
    
    Args:
        database_url: The DATABASE_URL to validate
        env: The current environment
        
    Returns:
        DatabaseURLInfo: Parsed and validated database info, or None if no URL provided
        
    Raises:
        DatabaseURLError: If URL is invalid or inappropriate for environment
    """
    logger = logging.getLogger(__name__)
    
    # Production and staging require DATABASE_URL
    if env in [DatabaseEnvironment.PRODUCTION, DatabaseEnvironment.STAGING]:
        if not database_url:
            error_msg = f"DATABASE_URL is required in {env.value} environment but not configured"
            logger.error(error_msg)
            raise DatabaseURLError(error_msg)
        
        try:
            url_info = parse_database_url(database_url)
        except DatabaseURLError as e:
            error_msg = f"Invalid DATABASE_URL in {env.value} environment: {e}"
            logger.error(error_msg)
            raise DatabaseURLError(error_msg)
        
        # Production must use PostgreSQL
        if env == DatabaseEnvironment.PRODUCTION and not url_info.is_postgres:
            error_msg = f"Production environment requires PostgreSQL but found {url_info.scheme}"
            logger.error(error_msg)
            raise DatabaseURLError(error_msg)
        
        logger.info(f"DATABASE_URL validated for {env.value}: {url_info.scheme}://{url_info.hostname or 'file'}/***/")
        return url_info
    
    # Development and testing can work without DATABASE_URL (will use SQLite)
    if not database_url:
        logger.info(f"No DATABASE_URL configured for {env.value} environment, will use SQLite fallback")
        return None
    
    try:
        url_info = parse_database_url(database_url)
        logger.info(f"DATABASE_URL validated for {env.value}: {url_info.scheme}://{url_info.hostname or 'file'}/***/")
        return url_info
    except DatabaseURLError as e:
        logger.warning(f"Invalid DATABASE_URL in {env.value} environment (will use SQLite fallback): {e}")
        return None

def determine_database_mode(env: DatabaseEnvironment, url_info: Optional[DatabaseURLInfo]) -> DatabaseMode:
    """
    Determine the appropriate database mode based on environment and configuration
    
    Args:
        env: The detected environment
        url_info: Parsed DATABASE_URL information, None if no URL configured
        
    Returns:
        DatabaseMode: The appropriate database mode
    """
    logger = logging.getLogger(__name__)
    
    if env == DatabaseEnvironment.PRODUCTION:
        if not url_info or not url_info.is_postgres:
            raise EnvironmentMismatchError(
                "Production environment detected but no PostgreSQL DATABASE_URL configured. "
                "SQLite is not supported in production environments."
            )
        return DatabaseMode.POSTGRESQL_ONLY
    
    elif env == DatabaseEnvironment.STAGING:
        if url_info and url_info.is_postgres:
            return DatabaseMode.POSTGRESQL_ONLY
        elif url_info and url_info.is_sqlite:
            logger.warning("Staging environment using SQLite - consider using PostgreSQL for consistency")
            return DatabaseMode.SQLITE_ONLY
        else:
            logger.warning("Staging environment without DATABASE_URL - falling back to SQLite")
            return DatabaseMode.SQLITE_ONLY
    
    elif env == DatabaseEnvironment.TESTING:
        # Testing can use either, prefer SQLite for speed unless PostgreSQL is explicitly set
        if url_info and url_info.is_postgres:
            return DatabaseMode.POSTGRESQL_ONLY
        else:
            return DatabaseMode.SQLITE_ONLY
    
    else:  # DEVELOPMENT
        # Development can use either database type
        if url_info and url_info.is_postgres:
            return DatabaseMode.POSTGRESQL_ONLY
        else:
            return DatabaseMode.SQLITE_ONLY

class DatabaseService:
    """Service for managing database operations with environment-aware PostgreSQL/SQLite support"""
    
    def __init__(self):
        # Environment detection
        self.environment = detect_environment()
        
        # Parse and validate DATABASE_URL with fail-fast behavior
        database_url = settings.database_url
        self.url_info = validate_database_url_for_environment(database_url, self.environment)
        
        # Set explicit boolean flags for clear code path control
        self.is_postgres = self.url_info.is_postgres if self.url_info else False
        self.is_sqlite = not self.is_postgres
        
        # Determine database mode based on environment and configuration
        self.database_mode = determine_database_mode(self.environment, self.url_info)
        
        # Store parsed URL components for easy access
        self.database_url = database_url
        self.database_name = self.url_info.database if self.url_info else None
        self.hostname = self.url_info.hostname if self.url_info else None
        self.port = self.url_info.port if self.url_info else None
        
        # Validate environment and database configuration
        self._validate_environment_requirements()
        
        # Initialize bcrypt context with robust error handling
        try:
            self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            logger.info("bcrypt context initialized successfully")
        except Exception as e:
            logger.error(f"bcrypt initialization failed: {e}")
            # Try alternative bcrypt configuration
            try:
                import bcrypt
                # Use direct bcrypt instead of passlib if initialization fails
                self.use_direct_bcrypt = True
                logger.warning("Falling back to direct bcrypt implementation")
            except ImportError:
                logger.error("bcrypt library not available")
                raise RuntimeError(f"Password hashing initialization failed: {e}")
        
        # Set fallback flag
        self.use_direct_bcrypt = getattr(self, 'use_direct_bcrypt', False)
        
        # Set up database-specific properties
        if self.database_mode == DatabaseMode.POSTGRESQL_ONLY:
            if not PSYCOPG2_AVAILABLE:
                raise DatabaseError("psycopg2 is required for PostgreSQL support")
            logger.info(f"Using PostgreSQL database '{self.database_name}' at {self.hostname}:{self.port or 5432} in {self.environment.value} environment")
            self.db_path = None
        else:
            if self.environment == DatabaseEnvironment.PRODUCTION:
                raise EnvironmentMismatchError("SQLite is not allowed in production environment")
            # Use URL database path if provided, otherwise default location
            if self.url_info and self.url_info.is_sqlite:
                self.db_path = Path(self.url_info.database)
            else:
                self.db_path = Path(__file__).parent.parent / "app.db"
            logger.info(f"Using SQLite database at {self.db_path} in {self.environment.value} environment")
            
        self._init_database()
        self._verify_database_constraints()
    
    def _log_database_error(self, operation: str, error: Exception, query: str = None, params: tuple = None) -> None:
        """
        Log detailed database error information including stack trace and query details
        
        Args:
            operation: Name of the operation that failed
            error: The exception that occurred
            query: SQL query that failed (if applicable)
            params: Query parameters (if applicable)
        """
        import traceback
        
        # Sanitize parameters for logging (remove sensitive data)
        safe_params = None
        if params:
            safe_params = tuple(
                "***REDACTED***" if isinstance(p, str) and any(keyword in str(p).lower() for keyword in ['password', 'secret', 'token', 'key']) 
                else str(p)[:100] + "..." if isinstance(p, str) and len(str(p)) > 100
                else p
                for p in params
            )
        
        error_details = {
            "operation": operation,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "environment": self.environment.value,
            "database_mode": self.database_mode.value,
            "is_postgres": self.is_postgres,
            "query": query[:500] + "..." if query and len(query) > 500 else query,
            "params": safe_params,
            "stack_trace": traceback.format_exc()
        }
        
        logger.error(f"Database operation '{operation}' failed: {json.dumps(error_details, indent=2, default=str)}")

    def _handle_database_exception(self, operation: str, error: Exception, query: str = None, params: tuple = None) -> DatabaseError:
        """
        Handle and categorize database exceptions with detailed logging
        
        Args:
            operation: Name of the operation that failed
            error: The original exception
            query: SQL query that failed (if applicable)
            params: Query parameters (if applicable)
            
        Returns:
            DatabaseError: Categorized database error
        """
        self._log_database_error(operation, error, query, params)
        
        # Categorize the error based on type and message
        error_msg = str(error).lower()
        
        # Handle both SQLite and PostgreSQL connection errors
        connection_errors = []
        if PSYCOPG2_AVAILABLE:
            connection_errors.extend([psycopg2.OperationalError, psycopg2.InterfaceError, psycopg2.DatabaseError])
        connection_errors.extend([sqlite3.OperationalError, sqlite3.DatabaseError])
        
        if isinstance(error, tuple(connection_errors)) or "connection" in error_msg:
            return DatabaseConnectionError(
                f"Database connection failed during {operation}: {error}",
                query=query,
                params=params,
                original_error=error
            )
        
        # Handle constraint errors for both databases
        constraint_errors = []
        if PSYCOPG2_AVAILABLE:
            constraint_errors.extend([psycopg2.IntegrityError])
        constraint_errors.extend([sqlite3.IntegrityError])
        
        if (isinstance(error, tuple(constraint_errors)) or 
            "constraint" in error_msg or "unique" in error_msg or "foreign key" in error_msg):
            return DatabaseConstraintError(
                f"Database constraint violation during {operation}: {error}",
                query=query,
                params=params,
                original_error=error
            )
        elif "transaction" in error_msg or "rollback" in error_msg:
            return DatabaseTransactionError(
                f"Database transaction failed during {operation}: {error}",
                query=query,
                params=params,
                original_error=error
            )
        else:
            return DatabaseQueryError(
                f"Database query failed during {operation}: {error}",
                query=query,
                params=params,
                original_error=error
            )

    def _validate_environment_requirements(self):
        """Validate that the database configuration matches the environment requirements"""
        if self.environment == DatabaseEnvironment.PRODUCTION:
            if not self.is_postgres:
                raise EnvironmentMismatchError(
                    f"Production environment requires PostgreSQL but DATABASE_URL is: {self.database_url[:20]}..."
                )
            if self.database_mode != DatabaseMode.POSTGRESQL_ONLY:
                raise EnvironmentMismatchError(
                    f"Production environment must use POSTGRESQL_ONLY mode, got: {self.database_mode}"
                )
        
        logger.info(f"Database configuration validated for {self.environment.value} environment")
        logger.info(f"Database mode: {self.database_mode.value}")
        logger.info(f"PostgreSQL enabled: {self.is_postgres}")
    
    def _ensure_postgresql_mode(self, operation_name: str):
        """Ensure we're in PostgreSQL mode for operations that require it"""
        if self.database_mode != DatabaseMode.POSTGRESQL_ONLY and self.environment in [
            DatabaseEnvironment.PRODUCTION, 
            DatabaseEnvironment.STAGING
        ]:
            raise EnvironmentMismatchError(
                f"Operation '{operation_name}' requires PostgreSQL mode in {self.environment.value} environment"
            )
    
    def _ensure_not_production_for_sqlite(self, operation_name: str):
        """Ensure we're not in production when attempting SQLite operations"""
        if self.environment == DatabaseEnvironment.PRODUCTION and not self.is_postgres:
            raise EnvironmentMismatchError(
                f"SQLite operation '{operation_name}' is not allowed in production environment"
            )
    
    def _validate_database_operation(self, operation_name: str, requires_postgres: bool = False):
        """
        Validate that a database operation is allowed in the current environment
        
        Args:
            operation_name: Name of the operation being performed
            requires_postgres: Whether this operation specifically requires PostgreSQL
        """
        if requires_postgres and self.database_mode != DatabaseMode.POSTGRESQL_ONLY:
            raise EnvironmentMismatchError(
                f"Operation '{operation_name}' requires PostgreSQL but current mode is {self.database_mode.value}"
            )
        
        if self.environment == DatabaseEnvironment.PRODUCTION:
            if self.database_mode != DatabaseMode.POSTGRESQL_ONLY:
                raise EnvironmentMismatchError(
                    f"Production environment only allows PostgreSQL operations, attempted: {operation_name}"
                )
            if not self.is_postgres:
                raise EnvironmentMismatchError(
                    f"Production environment requires PostgreSQL URL, attempted: {operation_name}"
                )
        
        # Log operation in development/testing for debugging
        if self.environment in [DatabaseEnvironment.DEVELOPMENT, DatabaseEnvironment.TESTING]:
            logger.debug(f"Database operation '{operation_name}' in {self.environment.value} environment using {self.database_mode.value}")
    
    def _get_validated_connection(self, operation_name: str):
        """Get a database connection with environment validation"""
        self._validate_database_operation(operation_name)
        return self.get_connection()
    
    def get_connection(self):
        """Get database connection based on environment and mode"""
        if self.database_mode == DatabaseMode.POSTGRESQL_ONLY:
            if not self.is_postgres:
                raise EnvironmentMismatchError("PostgreSQL-only mode but no PostgreSQL URL configured")
            return psycopg2.connect(self.database_url)
        elif self.database_mode == DatabaseMode.SQLITE_ONLY:
            self._ensure_not_production_for_sqlite("get_connection")
            logger.warning(f"Using SQLite fallback connection in {self.environment.value} environment (path: {self.db_path})")
            if not self.db_path:
                raise EnvironmentMismatchError("SQLite mode but no database path configured")
            return sqlite3.connect(self.db_path)
        else:
            # HYBRID mode (development only)
            if self.environment == DatabaseEnvironment.PRODUCTION:
                raise EnvironmentMismatchError("Hybrid mode not allowed in production")
            
            if self.is_postgres:
                return psycopg2.connect(self.database_url)
            else:
                logger.warning(f"Using SQLite fallback connection in hybrid mode ({self.environment.value} environment, path: {self.db_path})")
                return sqlite3.connect(self.db_path)
    
    def get_cursor(self, conn):
        """Get a properly configured cursor for the database type"""
        if self.database_mode == DatabaseMode.POSTGRESQL_ONLY:
            return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        elif self.database_mode == DatabaseMode.SQLITE_ONLY:
            self._ensure_not_production_for_sqlite("get_cursor")
            logger.warning(f"Using SQLite fallback cursor in {self.environment.value} environment")
            # Enable foreign key constraints and set row factory for SQLite
            conn.execute("PRAGMA foreign_keys = ON")
            conn.row_factory = sqlite3.Row
            return conn.cursor()
        else:
            # HYBRID mode (development only)
            if self.environment == DatabaseEnvironment.PRODUCTION:
                raise EnvironmentMismatchError("Hybrid mode not allowed in production")
            
            if self.is_postgres:
                return conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
            else:
                logger.warning(f"Using SQLite fallback cursor in hybrid mode ({self.environment.value} environment)")
                conn.execute("PRAGMA foreign_keys = ON")
                conn.row_factory = sqlite3.Row
                return conn.cursor()
    
    def transaction(self):
        """
        Context manager for database transactions with proper rollback on error
        
        Usage:
            with db_service.transaction():
                db_service._execute_insert("table1", data1)
                db_service._execute_update("table2", data2, "id = ?", (id,))
                # Transaction will be committed automatically on success
                # or rolled back on any exception
        """
        class TransactionContext:
            def __init__(self, db_service):
                self.db_service = db_service
                self.conn = None
                
            def __enter__(self):
                self.conn = self.db_service._get_validated_connection("transaction")
                # Begin transaction (implicit in most cases, explicit for safety)
                if self.db_service.is_postgres:
                    self.conn.execute("BEGIN")
                else:
                    self.conn.execute("BEGIN")
                return self.conn
                
            def __exit__(self, exc_type, exc_val, exc_tb):
                if exc_type is None:
                    # Success - commit transaction
                    self.conn.commit()
                    logger.debug("Transaction committed successfully")
                else:
                    # Error - rollback transaction
                    self.conn.rollback()
                    logger.warning(f"Transaction rolled back due to error: {exc_val}")
                
                # Close connection
                if self.conn:
                    self.conn.close()
                    
                # Don't suppress exceptions
                return False
        
        return TransactionContext(self)
    
    def execute_query_with_params(self, query: str, params: tuple = (), fetch_one: bool = False, fetch_all: bool = False):
        """
        DEPRECATED: Use _execute_query, _execute_select, _execute_insert, _execute_update, or _execute_upsert instead.
        This method is kept for backward compatibility.
        """
        logger.warning("execute_query_with_params is deprecated. Use the new unified query methods instead.")
        return self._execute_query(query, params, fetch_one=fetch_one, fetch_all=fetch_all)
    
    def _init_database(self):
        """Initialize the database with required tables"""
        try:
            if self.database_mode == DatabaseMode.POSTGRESQL_ONLY:
                self._init_postgres_database()
            elif self.database_mode == DatabaseMode.SQLITE_ONLY:
                self._ensure_not_production_for_sqlite("_init_database")
                logger.warning(f"Initializing SQLite fallback database in {self.environment.value} environment")
                self._init_sqlite_database()
            else:
                # HYBRID mode (development only)
                if self.environment == DatabaseEnvironment.PRODUCTION:
                    raise EnvironmentMismatchError("Hybrid database initialization not allowed in production")
                
                if self.is_postgres:
                    self._init_postgres_database()
                else:
                    logger.warning(f"Initializing SQLite fallback database in hybrid mode ({self.environment.value} environment)")
                    self._init_sqlite_database()
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _init_postgres_database(self):
        """Initialize PostgreSQL database tables"""
        if self.database_mode not in [DatabaseMode.POSTGRESQL_ONLY, DatabaseMode.HYBRID]:
            raise EnvironmentMismatchError("PostgreSQL initialization not allowed in current database mode")
            
        with self.get_connection() as conn:
            conn.autocommit = True
            cursor = conn.cursor()
            
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
                    last_login TIMESTAMP,
                    is_premium BOOLEAN DEFAULT FALSE
                )
            """)
            
            # Add is_premium column to users table if it doesn't exist (for migration)
            cursor.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT FROM information_schema.columns
                        WHERE table_name = 'users' AND column_name = 'is_premium'
                    ) THEN
                        ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
                    END IF;
                END
                $$;
            """)

            # Create indexes on users table for faster lookups
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login)")
            
            # Create challenges table for persistent challenge storage
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
            
            # Create indexes on challenges table
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON challenges(creator_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenges_published_at ON challenges(published_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenges_view_count ON challenges(view_count DESC)")
            
            # Create guesses table for challenge guesses
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
            
            # Create indexes on guesses table
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guesses_challenge_id ON guesses(challenge_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guesses_user_id ON guesses(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guesses_submitted_at ON guesses(submitted_at DESC)")
            
            # Create guess_history table for challenge completion tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS guess_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    challenge_id VARCHAR(255) NOT NULL,
                    was_correct BOOLEAN NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_guess_history_user_id 
                        FOREIGN KEY (user_id) REFERENCES users (id) 
                        ON DELETE CASCADE
                )
            """)
            
            # Create indexes on guess_history table
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guess_history_user_id ON guess_history(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guess_history_challenge_id ON guess_history(challenge_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_guess_history_user_challenge ON guess_history(user_id, challenge_id)")
            
            # Create user_reports table for content moderation
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
            
            # Create indexes on user_reports table
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_reports_challenge_id ON user_reports(challenge_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_reports_user_id ON user_reports(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC)")
            
            # Create token_balances table for secure token storage
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS token_balances (
                    user_id VARCHAR(255) PRIMARY KEY,
                    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create token_transactions table for audit trail
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
            
            # Create user_sessions table for JWT session management
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
            
            # Create indexes on token tables
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_revenuecat ON token_transactions(revenuecat_transaction_id)")
            
            # Create indexes on session tables
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at DESC)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_transactions_revenuecat ON token_transactions(revenuecat_transaction_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_token_balances_last_updated ON token_balances(last_updated)")
    
    def _init_sqlite_database(self):
        """Initialize SQLite database tables (development/testing only)"""
        if self.environment == DatabaseEnvironment.PRODUCTION:
            raise EnvironmentMismatchError("SQLite initialization not allowed in production environment")
        
        if self.database_mode not in [DatabaseMode.SQLITE_ONLY, DatabaseMode.HYBRID]:
            raise EnvironmentMismatchError("SQLite initialization not allowed in current database mode")
        
        logger.warning(f"Creating SQLite fallback database schema in {self.environment.value} environment (path: {self.db_path})")
        
        try:
            with self._get_validated_connection("_init_sqlite_database") as conn:
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
                        last_login TIMESTAMP,
                        is_premium BOOLEAN DEFAULT FALSE
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
                
                # Create challenges table for persistent challenge storage
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS challenges (
                        challenge_id TEXT PRIMARY KEY,
                        creator_id TEXT NOT NULL,
                        title TEXT,
                        status TEXT NOT NULL DEFAULT 'draft',
                        lie_statement_id TEXT NOT NULL,
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
                
                # Create indexes on challenges table for faster lookups
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON challenges(creator_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at DESC)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_challenges_published_at ON challenges(published_at DESC)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_challenges_view_count ON challenges(view_count DESC)
                """)
                
                # Create guesses table for challenge guesses
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS guesses (
                        guess_id TEXT PRIMARY KEY,
                        challenge_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        guessed_lie_statement_id TEXT NOT NULL,
                        is_correct BOOLEAN NOT NULL,
                        response_time_seconds REAL,
                        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (challenge_id) REFERENCES challenges(challenge_id) ON DELETE CASCADE
                    )
                """)
                
                # Create indexes on guesses table
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guesses_challenge_id ON guesses(challenge_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guesses_user_id ON guesses(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guesses_submitted_at ON guesses(submitted_at DESC)
                """)
                
                # Create guess_history table for challenge completion tracking
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS guess_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        challenge_id TEXT NOT NULL,
                        was_correct BOOLEAN NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                    )
                """)
                
                # Create indexes on guess_history table
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guess_history_user_id ON guess_history(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guess_history_challenge_id ON guess_history(challenge_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_guess_history_user_challenge ON guess_history(user_id, challenge_id)
                """)
                
                # Add name column to existing users table if it doesn't exist
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN name TEXT")
                except sqlite3.OperationalError as e:
                    # Column already exists or other issue
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Failed to add name column: {e}")

                # Add is_premium column to users table if it doesn't exist (for migration)
                try:
                    cursor.execute("ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e).lower():
                        logger.warning(f"Failed to add is_premium column: {e}")
                
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
                
                # Create token_balances table for secure token storage
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS token_balances (
                        user_id TEXT PRIMARY KEY,
                        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create token_transactions table for audit trail
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS token_transactions (
                        transaction_id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
                        user_id TEXT NOT NULL,
                        transaction_type TEXT NOT NULL CHECK (
                            transaction_type IN ('purchase', 'spend', 'adjustment', 'refund')
                        ),
                        amount INTEGER NOT NULL,
                        balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
                        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
                        description TEXT NOT NULL,
                        metadata TEXT DEFAULT '{}',
                        revenuecat_transaction_id TEXT,
                        revenuecat_product_id TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create user_sessions table for JWT session management  
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS user_sessions (
                        session_id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
                        user_id TEXT NOT NULL,
                        jwt_token TEXT NOT NULL,
                        token_hash TEXT NOT NULL UNIQUE,
                        session_type TEXT NOT NULL DEFAULT 'user' CHECK (
                            session_type IN ('user', 'guest', 'admin')
                        ),
                        permissions TEXT DEFAULT '[]',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL,
                        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        user_agent TEXT,
                        ip_address TEXT
                    )
                """)
                
                # Create indexes on token tables
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id 
                    ON token_transactions(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at 
                    ON token_transactions(created_at DESC)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_token_transactions_type 
                    ON token_transactions(transaction_type)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_token_transactions_revenuecat 
                    ON token_transactions(revenuecat_transaction_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_token_balances_last_updated 
                    ON token_balances(last_updated)
                """)
                
                # Create indexes on session tables
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
                    ON user_sessions(user_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash 
                    ON user_sessions(token_hash)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at 
                    ON user_sessions(expires_at)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
                    ON user_sessions(is_active, expires_at)
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
    
    def _execute_query(self, query: str, params: tuple = (), fetch_one: bool = False, fetch_all: bool = False, return_cursor: bool = False) -> Any:
        """
        Execute a query with proper database-specific handling and environment validation.
        Automatically converts parameter binding style and handles database differences.
        
        Args:
            query: SQL query string (can use ? parameters for both DBs)
            params: Query parameters as tuple
            fetch_one: Return single row as dict
            fetch_all: Return all rows as list of dicts
            return_cursor: Return cursor for complex operations
            
        Returns:
            - If fetch_one: Dict or None
            - If fetch_all: List of dicts
            - If return_cursor: Database cursor
            - Otherwise: Number of affected rows
            
        Raises:
            DatabaseError: Categorized database errors with detailed logging
        """
        operation = "_execute_query"
        self._validate_database_operation(operation)
        
        try:
            with self._get_validated_connection(operation) as conn:
                if self.is_postgres:
                    # Convert SQLite-style ? parameters to PostgreSQL %s
                    converted_query = self._prepare_query(query)
                    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                    cursor.execute(converted_query, params)
                    
                    if return_cursor:
                        return cursor
                    elif fetch_one:
                        result = cursor.fetchone()
                        return dict(result) if result else None
                    elif fetch_all:
                        results = cursor.fetchall()
                        return [dict(row) for row in results]
                    else:
                        conn.commit()
                        return cursor.rowcount
                else:
                    logger.warning(f"Using SQLite fallback query execution in {self.environment.value} environment")
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    cursor.execute(query, params)
                    
                    if return_cursor:
                        return cursor
                    elif fetch_one:
                        result = cursor.fetchone()
                        return dict(result) if result else None
                    elif fetch_all:
                        results = cursor.fetchall()
                        return [dict(row) for row in results]
                    else:
                        conn.commit()
                        return cursor.rowcount
                        
        except Exception as e:
            # Handle and categorize the exception with detailed logging
            categorized_error = self._handle_database_exception(operation, e, query, params)
            raise categorized_error
    
    def _execute_upsert(self, table: str, data: Dict[str, Any], conflict_columns: List[str], update_columns: List[str] = None) -> int:
        """
        Execute an UPSERT operation (INSERT with conflict resolution).
        Automatically uses ON CONFLICT for PostgreSQL and INSERT OR REPLACE for SQLite.
        
        Args:
            table: Table name
            data: Dictionary of column -> value pairs
            conflict_columns: Columns to check for conflicts (primary/unique keys)
            update_columns: Columns to update on conflict (default: all except conflict_columns)
            
        Returns:
            Number of affected rows
        """
        if not data:
            raise ValueError("Data dictionary cannot be empty")
        
        columns = list(data.keys())
        values = list(data.values())
        placeholders = ['?' for _ in columns]
        
        if update_columns is None:
            update_columns = [col for col in columns if col not in conflict_columns]
        
        if self.is_postgres:
            # PostgreSQL: INSERT ... ON CONFLICT ... DO UPDATE
            conflict_clause = ', '.join(conflict_columns)
            update_clause = ', '.join([f"{col} = EXCLUDED.{col}" for col in update_columns])
            
            query = f"""
                INSERT INTO {table} ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT ({conflict_clause}) DO UPDATE SET {update_clause}
            """
        else:
            # SQLite: INSERT OR REPLACE
            query = f"""
                INSERT OR REPLACE INTO {table} ({', '.join(columns)})
                VALUES ({', '.join(placeholders)})
            """
        
        return self._execute_query(query, tuple(values))
    
    def _execute_insert(self, table: str, data: Dict[str, Any]) -> int:
        """
        Execute a simple INSERT operation.
        
        Args:
            table: Table name
            data: Dictionary of column -> value pairs
            
        Returns:
            Number of affected rows
        """
        if not data:
            raise ValueError("Data dictionary cannot be empty")
        
        columns = list(data.keys())
        values = list(data.values())
        placeholders = ['?' for _ in columns]
        
        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
        """
        
        return self._execute_query(query, tuple(values))
    
    def _execute_update(self, table: str, data: Dict[str, Any], where_clause: str, where_params: tuple = ()) -> int:
        """
        Execute an UPDATE operation.
        
        Args:
            table: Table name
            data: Dictionary of column -> value pairs to update
            where_clause: WHERE clause (without WHERE keyword)
            where_params: Parameters for WHERE clause
            
        Returns:
            Number of affected rows
        """
        if not data:
            raise ValueError("Data dictionary cannot be empty")
        
        set_clause = ', '.join([f"{col} = ?" for col in data.keys()])
        query = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"
        
        return self._execute_query(query, tuple(data.values()) + where_params)
    
    def _execute_select(self, query: str, params: tuple = (), fetch_one: bool = False) -> Union[Dict[str, Any], List[Dict[str, Any]], None]:
        """
        Execute a SELECT operation with comprehensive error handling.
        
        Args:
            query: SELECT query string
            params: Query parameters
            fetch_one: Return single row instead of list
            
        Returns:
            Single dict (if fetch_one=True) or list of dicts
            
        Raises:
            DatabaseError: Categorized database errors with detailed logging
        """
        try:
            return self._execute_query(query, params, fetch_one=fetch_one, fetch_all=not fetch_one)
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception("_execute_select", e, query, params)
            raise categorized_error
    
    def _prepare_query(self, query: str) -> str:
        """Convert SQLite-style queries to PostgreSQL if needed"""
        if self.is_postgres:
            # Convert SQLite parameter style (?) to PostgreSQL (%s)
            # This is a simple conversion - more complex queries might need custom handling
            converted = query.replace('?', '%s')
            
            # Convert SQLite AUTOINCREMENT to PostgreSQL SERIAL
            converted = converted.replace('AUTOINCREMENT', 'SERIAL')
            
            # Convert SQLite-specific types
            converted = converted.replace('TEXT', 'VARCHAR(255)')
            converted = converted.replace('TIMESTAMP DEFAULT CURRENT_TIMESTAMP', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            
            return converted
        return query
    
    def _verify_database_constraints(self):
        """Verify that all foreign key constraints and indexes are properly set up"""
        try:
            # Skip constraint verification for PostgreSQL - constraints are handled at table creation
            if self.database_mode == DatabaseMode.POSTGRESQL_ONLY:
                logger.info("PostgreSQL database - skipping SQLite-specific constraint verification")
                return
            elif self.database_mode == DatabaseMode.SQLITE_ONLY:
                self._ensure_not_production_for_sqlite("_verify_database_constraints")
                logger.warning(f"Verifying SQLite fallback database constraints in {self.environment.value} environment")
            elif self.environment == DatabaseEnvironment.PRODUCTION:
                raise EnvironmentMismatchError("Constraint verification for mixed mode not allowed in production")
            
            # Only proceed with SQLite constraint verification
            if self.is_postgres:
                return
                
            logger.warning(f"Verifying SQLite fallback database constraints in {self.environment.value} environment")
            with self._get_validated_connection("_verify_database_constraints") as conn:
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
        # bcrypt has a 72-byte limit, truncate if necessary
        # Ensure we're working with string characters, not bytes when counting
        if len(password.encode('utf-8')) > 72:
            # Truncate by bytes, not characters, to avoid encoding issues
            password_bytes = password.encode('utf-8')[:72]
            password = password_bytes.decode('utf-8', errors='ignore')
        
        if self.use_direct_bcrypt:
            import bcrypt
            # Encode password to bytes and hash directly
            password_bytes = password.encode('utf-8')[:72]  # Ensure byte limit
            salt = bcrypt.gensalt()
            return bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        else:
            # For passlib, also ensure password is within byte limits
            password_bytes = password.encode('utf-8')[:72]
            password = password_bytes.decode('utf-8', errors='ignore')
            return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        try:
            # bcrypt has a 72-byte limit, truncate if necessary
            # Handle by bytes, not characters, to match hash_password behavior
            if len(plain_password.encode('utf-8')) > 72:
                password_bytes = plain_password.encode('utf-8')[:72]
                plain_password = password_bytes.decode('utf-8', errors='ignore')
            
            if self.use_direct_bcrypt:
                import bcrypt
                # Use direct bcrypt verification
                password_bytes = plain_password.encode('utf-8')[:72]
                hash_bytes = hashed_password.encode('utf-8')
                return bcrypt.checkpw(password_bytes, hash_bytes)
            else:
                # For passlib, also ensure password is within byte limits
                password_bytes = plain_password.encode('utf-8')[:72]
                plain_password = password_bytes.decode('utf-8', errors='ignore')
                return self.pwd_context.verify(plain_password, hashed_password)
                
        except ValueError as e:
            if "password cannot be longer than 72 bytes" in str(e):
                # Final fallback: use direct bcrypt with truncation
                import bcrypt
                password_bytes = plain_password[:72].encode('utf-8')
                hash_bytes = hashed_password.encode('utf-8')
                return bcrypt.checkpw(password_bytes, hash_bytes)
            else:
                raise e
    
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
            DatabaseError: For database operation errors
        """
        operation = "create_user"
        self._validate_database_operation(operation)
        
        try:
            # Check if user already exists
            existing_user = self._execute_select(
                "SELECT id FROM users WHERE email = ?",
                (email,),
                fetch_one=True
            )
            
            if existing_user:
                logger.warning(f"User creation failed: email {email} already exists")
                return None
            
            # Hash password and create user
            password_hash = self.hash_password(password)
            current_time = datetime.utcnow()
            
            # Create user using unified query system
            user_data = {
                "email": email,
                "password_hash": password_hash,
                "name": name,
                "created_at": current_time,
                "updated_at": current_time,
                "is_active": True
            }
            
            if self.is_postgres:
                # PostgreSQL - use RETURNING to get the ID
                result = self._execute_query("""
                    INSERT INTO users (email, password_hash, name, created_at, updated_at, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                    RETURNING id
                """, (email, password_hash, name, current_time, current_time, True), fetch_one=True)
                user_id = result['id'] if result else None
            else:
                # SQLite - use _execute_insert which handles lastrowid
                user_id = self._execute_insert("users", user_data)
            
            if user_id:
                logger.info(f"Successfully created user {email} with ID {user_id}")
                # Return user data (without password hash)
                return {
                    "id": user_id,
                    "email": email,
                    "name": name,
                    "created_at": current_time.isoformat(),
                    "is_active": True
                }
            else:
                logger.error(f"Failed to get user ID after creation for {email}")
                return None
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate a user with email and password
        
        Args:
            email: User's email address
            password: Plain text password
            
        Returns:
            Dict with user data if authentication successful, None if failed
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "authenticate_user"
        self._validate_database_operation(operation)
        
        try:
            # Get user by email with password hash
            user_data = self._execute_select(
                "SELECT id, email, password_hash, name, score, is_premium, created_at, is_active, last_login FROM users WHERE email = ? AND is_active = TRUE",
                (email,),
                fetch_one=True
            )
            
            if not user_data:
                logger.warning(f"Authentication failed: user {email} not found")
                return None
            
            # Verify password
            if not self.verify_password(password, user_data["password_hash"]):
                logger.warning(f"Authentication failed: invalid password for {email}")
                return None
            
            # Update last login
            current_time = datetime.utcnow()
            self._execute_update(
                "users",
                {"last_login": current_time, "updated_at": current_time},
                "id = ?",
                (user_data["id"],)
            )
            
            logger.info(f"User {email} authenticated successfully")
            return {
                "id": user_data["id"],
                "email": user_data["email"],
                "name": user_data["name"],
                "score": user_data["score"],
                "is_premium": user_data["is_premium"],
                "created_at": user_data["created_at"],
                "is_active": bool(user_data["is_active"]),
                "last_login": current_time.isoformat()
            }
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user by ID (only active users)
        
        Args:
            user_id: User ID to look up
            
        Returns:
            User data dict or None if not found
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "get_user_by_id"
        try:
            user_data = self._execute_select(
                "SELECT id, email, name, score, is_premium, created_at, is_active, last_login FROM users WHERE id = ? AND is_active = TRUE",
                (user_id,),
                fetch_one=True
            )
            
            if not user_data:
                logger.debug(f"No active user found with ID {user_id}")
                return None
            
            return {
                "id": user_data["id"],
                "email": user_data["email"],
                "name": user_data["name"],
                "score": user_data["score"],
                "is_premium": user_data["is_premium"],
                "created_at": user_data["created_at"],
                "is_active": bool(user_data["is_active"]),
                "last_login": user_data["last_login"]
            }
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def get_user_by_id_all_status(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user by ID regardless of active status (for admin/debugging)
        
        Args:
            user_id: User ID to look up
            
        Returns:
            User data dict or None if not found
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "get_user_by_id_all_status"
        try:
            user_data = self._execute_select(
                "SELECT id, email, name, score, is_premium, created_at, is_active, last_login FROM users WHERE id = ?",
                (user_id,),
                fetch_one=True
            )
            
            if not user_data:
                logger.debug(f"No user found with ID {user_id}")
                return None
            
            return {
                "id": user_data["id"],
                "email": user_data["email"],
                "name": user_data["name"],
                "score": user_data["score"],
                "is_premium": user_data["is_premium"],
                "created_at": user_data["created_at"],
                "is_active": bool(user_data["is_active"]),
                "last_login": user_data["last_login"]
            }
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email
        
        Args:
            email: Email address to look up
            
        Returns:
            User data dict or None if not found
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "get_user_by_email"
        try:
            user_data = self._execute_select(
                "SELECT id, email, name, score, is_premium, created_at, is_active, last_login FROM users WHERE email = ? AND is_active = TRUE",
                (email,),
                fetch_one=True
            )
            
            if not user_data:
                logger.debug(f"No active user found with email {email}")
                return None
                
            return {
                "id": user_data["id"],
                "email": user_data["email"],
                "name": user_data["name"],
                "score": user_data["score"],
                "is_premium": user_data["is_premium"],
                "created_at": user_data["created_at"],
                "is_active": bool(user_data["is_active"]),
                "last_login": user_data["last_login"]
            }
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def update_user_last_login(self, user_id: int) -> bool:
        """Update user's last login timestamp"""
        try:
            current_time = datetime.utcnow()
            rows_affected = self._execute_update(
                "users",
                {"last_login": current_time, "updated_at": current_time},
                "id = ?",
                (user_id,)
            )
            
            return rows_affected > 0
                
        except Exception as e:
            logger.error(f"Failed to update last login for user {user_id}: {e}")
            raise
    
    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate a user account (soft delete for session invalidation)"""
        try:
            current_time = datetime.utcnow()
            rows_affected = self._execute_update(
                "users",
                {"is_active": False, "updated_at": current_time},
                "id = ?",
                (user_id,)
            )
            
            if rows_affected > 0:
                logger.info(f"User {user_id} deactivated successfully")
                return True
            else:
                logger.warning(f"User {user_id} not found or already deactivated")
                return False
                
        except Exception as e:
            logger.error(f"Failed to deactivate user {user_id}: {e}")
            raise
    
    def reactivate_user(self, user_id: int) -> bool:
        """Reactivate a user account"""
        try:
            current_time = datetime.utcnow()
            rows_affected = self._execute_update(
                "users",
                {"is_active": True, "updated_at": current_time},
                "id = ?",
                (user_id,)
            )
            
            if rows_affected > 0:
                logger.info(f"User {user_id} reactivated successfully")
                return True
            else:
                logger.warning(f"User {user_id} not found")
                return False
                
        except Exception as e:
            logger.error(f"Failed to reactivate user {user_id}: {e}")
            raise

    def increment_user_score(self, user_id: int, points: int) -> bool:
        """Increment user's score by a given amount of points."""
        try:
            current_time = datetime.utcnow()
            # Use an atomic update to prevent race conditions
            query = "UPDATE users SET score = score + ? WHERE id = ?"

            rows_affected = self._execute_query(
                query,
                (points, user_id)
            )

            if rows_affected > 0:
                logger.info(f"Incremented score for user {user_id} by {points} points.")
                return True
            else:
                logger.warning(f"Could not increment score for user {user_id}, user not found.")
                return False

        except Exception as e:
            logger.error(f"Failed to increment score for user {user_id}: {e}")
            raise
    
    def get_user_token_balance(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get token balance for a user directly from database"""
        try:
            result = self._execute_select(
                "SELECT balance, last_updated, created_at FROM token_balances WHERE user_id = ?",
                (user_id,),
                fetch_one=True
            )
            
            return result
                
        except Exception as e:
            logger.error(f"Failed to get token balance for user {user_id}: {e}")
            raise
    
    def get_user_token_transactions(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Get token transaction history for a user"""
        try:
            results = self._execute_select("""
                SELECT transaction_id, transaction_type, amount, balance_before, 
                       balance_after, description, metadata, revenuecat_transaction_id,
                       revenuecat_product_id, created_at
                FROM token_transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """, (user_id, limit, offset), fetch_one=False)
            
            return results or []
                
        except Exception as e:
            logger.error(f"Failed to get token transactions for user {user_id}: {e}")
            raise
    
    def create_token_balance_if_not_exists(self, user_id: str) -> bool:
        """Initialize token balance for a user if it doesn't exist"""
        try:
            # Use UPSERT to create balance entry without overwriting existing
            rows_affected = self._execute_upsert(
                "token_balances",
                {"user_id": user_id, "balance": 0},
                ["user_id"],  # conflict columns
                []  # don't update anything if exists (INSERT only)
            )
            
            return rows_affected > 0
                
        except Exception as e:
            logger.error(f"Failed to create token balance for user {user_id}: {e}")
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
            current_time = datetime.utcnow()
            
            # Check if user has already reported this challenge
            existing_report = self._execute_query(
                "SELECT id FROM user_reports WHERE challenge_id = %s AND user_id = %s" if self.is_postgres 
                else "SELECT id FROM user_reports WHERE challenge_id = ? AND user_id = ?",
                (challenge_id, user_id),
                fetch_one=True
            )
            
            if existing_report:
                logger.warning(f"Duplicate report attempt: user {user_id} already reported challenge {challenge_id}")
                return None
            
            # Create the report
            if self.is_postgres:
                # PostgreSQL version with RETURNING clause
                result = self._execute_query("""
                    INSERT INTO user_reports (challenge_id, user_id, reason, details, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (challenge_id, user_id, reason, details, current_time), fetch_one=True)
                report_id = result['id'] if result else None
            else:
                # SQLite version
                with self.get_connection() as conn:
                    conn.execute("PRAGMA foreign_keys = ON")
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO user_reports (challenge_id, user_id, reason, details, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    """, (challenge_id, user_id, reason, details, current_time))
                    report_id = cursor.lastrowid
                    conn.commit()
            
            if report_id:
                logger.info(f"User report created: ID {report_id}, user {user_id}, challenge {challenge_id}, reason: {reason}")
                
                return {
                    "id": report_id,
                    "challenge_id": challenge_id,
                    "user_id": user_id,
                    "reason": reason,
                    "details": details,
                    "created_at": current_time.isoformat()
                }
            else:
                logger.error("Failed to get report ID after creation")
                return None
                
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
            results = self._execute_query("""
                SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                       u.email, u.name
                FROM user_reports ur
                LEFT JOIN users u ON ur.user_id = u.id
                WHERE ur.challenge_id = %s
                ORDER BY ur.created_at DESC
            """ if self.is_postgres else """
                SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                       u.email, u.name
                FROM user_reports ur
                LEFT JOIN users u ON ur.user_id = u.id
                WHERE ur.challenge_id = ?
                ORDER BY ur.created_at DESC
            """, (challenge_id,), fetch_all=True)
            
            reports = []
            for row in results:
                reports.append({
                    "id": row["id"] if isinstance(row, dict) else row[0],
                    "challenge_id": row["challenge_id"] if isinstance(row, dict) else row[1],
                    "user_id": row["user_id"] if isinstance(row, dict) else row[2],
                    "reason": row["reason"] if isinstance(row, dict) else row[3],
                    "details": row["details"] if isinstance(row, dict) else row[4],
                    "created_at": row["created_at"] if isinstance(row, dict) else row[5],
                    "user_email": row["email"] if isinstance(row, dict) else row[6],
                    "user_name": row["name"] if isinstance(row, dict) else row[7]
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
            # PostgreSQL uses string_agg instead of GROUP_CONCAT
            if self.is_postgres:
                query = """
                    SELECT ur.challenge_id, 
                           COUNT(ur.id) as report_count,
                           MIN(ur.created_at) as first_report_at,
                           MAX(ur.created_at) as last_report_at,
                           string_agg(DISTINCT ur.reason, ',') as reasons
                    FROM user_reports ur
                    GROUP BY ur.challenge_id
                    ORDER BY MAX(ur.created_at) DESC
                    LIMIT %s OFFSET %s
                """
            else:
                query = """
                    SELECT ur.challenge_id, 
                           COUNT(ur.id) as report_count,
                           MIN(ur.created_at) as first_report_at,
                           MAX(ur.created_at) as last_report_at,
                           GROUP_CONCAT(DISTINCT ur.reason) as reasons
                    FROM user_reports ur
                    GROUP BY ur.challenge_id
                    ORDER BY MAX(ur.created_at) DESC
                    LIMIT ? OFFSET ?
                """
            
            results = self._execute_query(query, (limit, offset), fetch_all=True)
            
            reported_challenges = []
            for row in results:
                reported_challenges.append({
                    "challenge_id": row["challenge_id"] if isinstance(row, dict) else row[0],
                    "report_count": row["report_count"] if isinstance(row, dict) else row[1],
                    "first_report_at": row["first_report_at"] if isinstance(row, dict) else row[2],
                    "last_report_at": row["last_report_at"] if isinstance(row, dict) else row[3],
                    "reasons": (row["reasons"] if isinstance(row, dict) else row[4]).split(',') if (row["reasons"] if isinstance(row, dict) else row[4]) else []
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
            result = self._execute_query("""
                SELECT COUNT(DISTINCT ur.challenge_id) as total_count
                FROM user_reports ur
            """, fetch_one=True)
            
            return result["total_count"] if isinstance(result, dict) else result[0] if result else 0
                
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
            row = self._execute_query("""
                SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                       u.email, u.name
                FROM user_reports ur
                LEFT JOIN users u ON ur.user_id = u.id
                WHERE ur.id = %s
            """ if self.is_postgres else """
                SELECT ur.id, ur.challenge_id, ur.user_id, ur.reason, ur.details, ur.created_at,
                       u.email, u.name
                FROM user_reports ur
                LEFT JOIN users u ON ur.user_id = u.id
                WHERE ur.id = ?
            """, (report_id,), fetch_one=True)
            
            if not row:
                return None
                
            return {
                "id": row["id"] if isinstance(row, dict) else row[0],
                "challenge_id": row["challenge_id"] if isinstance(row, dict) else row[1],
                "user_id": row["user_id"] if isinstance(row, dict) else row[2],
                "reason": row["reason"] if isinstance(row, dict) else row[3],
                "details": row["details"] if isinstance(row, dict) else row[4],
                "created_at": row["created_at"] if isinstance(row, dict) else row[5],
                "user_email": row["email"] if isinstance(row, dict) else row[6],
                "user_name": row["name"] if isinstance(row, dict) else row[7]
            }
                
        except Exception as e:
            logger.error(f"Failed to get user report by ID {report_id}: {e}")
            raise
    
    def admin_delete_challenge_records(self, challenge_id: str) -> Dict[str, int]:
        """
        Delete all database records associated with a challenge (admin only)
        
        Args:
            challenge_id: ID of the challenge to delete records for
            
        Returns:
            Dict with counts of deleted records by table
        """
        try:
            deletion_counts = {}
            
            with self.get_connection() as conn:
                cursor = self.get_cursor(conn)
                
                # Delete user reports for this challenge
                if self.is_postgres:
                    cursor.execute("DELETE FROM user_reports WHERE challenge_id = %s", (challenge_id,))
                else:
                    cursor.execute("DELETE FROM user_reports WHERE challenge_id = ?", (challenge_id,))
                deletion_counts["user_reports"] = cursor.rowcount
                
                # Delete user challenge progress for this challenge (if table exists)
                try:
                    if self.is_postgres:
                        cursor.execute("DELETE FROM user_challenge_progress WHERE challenge_id = %s", (challenge_id,))
                    else:
                        cursor.execute("DELETE FROM user_challenge_progress WHERE challenge_id = ?", (challenge_id,))
                    deletion_counts["user_challenge_progress"] = cursor.rowcount
                except Exception:
                    # Table doesn't exist, skip
                    deletion_counts["user_challenge_progress"] = 0
                
                # Delete challenge records from challenges table (if it exists)
                try:
                    if self.is_postgres:
                        cursor.execute("DELETE FROM challenges WHERE challenge_id = %s", (challenge_id,))
                    else:
                        cursor.execute("DELETE FROM challenges WHERE id = ? OR challenge_id = ?", (challenge_id, challenge_id))
                    deletion_counts["challenges"] = cursor.rowcount
                except Exception:
                    # Table doesn't exist, skip
                    deletion_counts["challenges"] = 0
                
                # Delete guess submissions for this challenge (if table exists)
                try:
                    if self.is_postgres:
                        cursor.execute("DELETE FROM guesses WHERE challenge_id = %s", (challenge_id,))
                    else:
                        cursor.execute("DELETE FROM guesses WHERE challenge_id = ?", (challenge_id,))
                    deletion_counts["guesses"] = cursor.rowcount
                except Exception:
                    # Table doesn't exist, skip
                    deletion_counts["guesses"] = 0
                
                conn.commit()
                
                logger.info(f"Admin deleted database records for challenge {challenge_id}: {deletion_counts}")
                return deletion_counts
                
        except Exception as e:
            logger.error(f"Failed to delete database records for challenge {challenge_id}: {e}")
            raise
    
    def get_all_reported_challenge_ids(self) -> List[str]:
        """
        Get all unique challenge IDs that have reports
        
        Returns:
            List of challenge IDs that have been reported
        """
        try:
            results = self._execute_query("""
                SELECT DISTINCT challenge_id
                FROM user_reports
                ORDER BY challenge_id
            """, fetch_all=True)
            
            return [row["challenge_id"] if isinstance(row, dict) else row[0] for row in results]
                
        except Exception as e:
            logger.error(f"Failed to get reported challenge IDs: {e}")
            raise
    
    def remove_reports_for_challenge(self, challenge_id: str) -> int:
        """
        Remove all reports for a specific challenge
        
        Args:
            challenge_id: The challenge ID to remove reports for
            
        Returns:
            Number of reports removed
        """
        try:
            with self.get_connection() as conn:
                cursor = self.get_cursor(conn)
                
                if self.is_postgres:
                    cursor.execute("DELETE FROM user_reports WHERE challenge_id = %s", (challenge_id,))
                else:
                    cursor.execute("DELETE FROM user_reports WHERE challenge_id = ?", (challenge_id,))
                
                removed_count = cursor.rowcount
                conn.commit()
                
                logger.info(f"Removed {removed_count} reports for challenge {challenge_id}")
                return removed_count
                
        except Exception as e:
            logger.error(f"Failed to remove reports for challenge {challenge_id}: {e}")
            raise

    # Challenge persistence methods
    def save_challenge(self, challenge) -> bool:
        """Save a challenge to the database"""
        try:
            import json
            from datetime import datetime
            
            # Custom JSON encoder for datetime objects
            def datetime_serializer(obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
            
            # Prepare data for upsert
            data = {
                "challenge_id": challenge.challenge_id,
                "creator_id": challenge.creator_id,
                "title": challenge.title,
                "status": challenge.status.value if hasattr(challenge.status, 'value') else str(challenge.status),
                "lie_statement_id": challenge.lie_statement_id,
                "view_count": challenge.view_count,
                "guess_count": challenge.guess_count,
                "correct_guess_count": challenge.correct_guess_count,
                "is_merged_video": challenge.is_merged_video,
                "statements_json": json.dumps([stmt.model_dump() for stmt in challenge.statements], default=datetime_serializer),
                "merged_video_metadata_json": json.dumps(challenge.merged_video_metadata.model_dump(), default=datetime_serializer) if challenge.merged_video_metadata else None,
                "tags_json": json.dumps(challenge.tags) if challenge.tags else None,
                "created_at": challenge.created_at.isoformat() if challenge.created_at else None,
                "updated_at": challenge.updated_at.isoformat() if challenge.updated_at else None,
                "published_at": challenge.published_at.isoformat() if challenge.published_at else None
            }
            
            # Define conflict resolution
            conflict_columns = ["challenge_id"]
            update_columns = [
                "creator_id", "title", "status", "lie_statement_id", "view_count",
                "guess_count", "correct_guess_count", "is_merged_video",
                "statements_json", "merged_video_metadata_json", "tags_json",
                "updated_at", "published_at"
            ]
            
            self._execute_upsert("challenges", data, conflict_columns, update_columns)
            return True
                
        except Exception as e:
            logger.error(f"Error saving challenge {challenge.challenge_id}: {e}")
            return False
    
    def load_challenge(self, challenge_id: str):
        """Load a challenge from the database"""
        try:
            import json
            from models import Challenge, Statement, ChallengeStatus, MergedVideoMetadata
            from datetime import datetime
            
            row = self._execute_query("""
                SELECT challenge_id, creator_id, title, status, lie_statement_id,
                       view_count, guess_count, correct_guess_count, is_merged_video,
                       statements_json, merged_video_metadata_json, tags_json,
                       created_at, updated_at, published_at
                FROM challenges WHERE challenge_id = %s
            """ if self.is_postgres else """
                SELECT challenge_id, creator_id, title, status, lie_statement_id,
                       view_count, guess_count, correct_guess_count, is_merged_video,
                       statements_json, merged_video_metadata_json, tags_json,
                       created_at, updated_at, published_at
                FROM challenges WHERE challenge_id = ?
            """, (challenge_id,), fetch_one=True)
            
            if not row:
                return None
                
                # Parse the data - handle both dict and tuple row formats
                statements_json = row["statements_json"] if isinstance(row, dict) else row[9]
                metadata_json = row["merged_video_metadata_json"] if isinstance(row, dict) else row[10]
                tags_json = row["tags_json"] if isinstance(row, dict) else row[11]
                
                statements = [Statement(**stmt_data) for stmt_data in json.loads(statements_json)]
                merged_metadata = MergedVideoMetadata(**json.loads(metadata_json)) if metadata_json else None
                tags = json.loads(tags_json) if tags_json else []
                
                # Create challenge object
                challenge = Challenge(
                    challenge_id=row["challenge_id"] if isinstance(row, dict) else row[0],
                    creator_id=row["creator_id"] if isinstance(row, dict) else row[1],
                    title=row["title"] if isinstance(row, dict) else row[2],
                    status=ChallengeStatus(row["status"] if isinstance(row, dict) else row[3]) if (row["status"] if isinstance(row, dict) else row[3]) else ChallengeStatus.DRAFT,
                    lie_statement_id=row["lie_statement_id"] if isinstance(row, dict) else row[4],
                    statements=statements,
                    view_count=(row["view_count"] if isinstance(row, dict) else row[5]) or 0,
                    guess_count=(row["guess_count"] if isinstance(row, dict) else row[6]) or 0,
                    correct_guess_count=(row["correct_guess_count"] if isinstance(row, dict) else row[7]) or 0,
                    is_merged_video=bool(row["is_merged_video"] if isinstance(row, dict) else row[8]),
                    merged_video_metadata=merged_metadata,
                    tags=tags,
                    created_at=datetime.fromisoformat(row["created_at"] if isinstance(row, dict) else row[12]) if (row["created_at"] if isinstance(row, dict) else row[12]) else None,
                    updated_at=datetime.fromisoformat(row["updated_at"] if isinstance(row, dict) else row[13]) if (row["updated_at"] if isinstance(row, dict) else row[13]) else None,
                    published_at=datetime.fromisoformat(row["published_at"] if isinstance(row, dict) else row[14]) if (row["published_at"] if isinstance(row, dict) else row[14]) else None
                )
                
                return challenge
                
        except Exception as e:
            logger.error(f"Error loading challenge {challenge_id}: {e}")
            return None
    
    def load_all_challenges(self) -> dict:
        """Load all challenges from the database"""
        try:
            import json
            from models import Challenge, Statement, ChallengeStatus, MergedVideoMetadata
            from datetime import datetime
            
            challenges = {}
            
            results = self._execute_query("""
                SELECT challenge_id, creator_id, title, status, lie_statement_id,
                       view_count, guess_count, correct_guess_count, is_merged_video,
                       statements_json, merged_video_metadata_json, tags_json,
                       created_at, updated_at, published_at
                FROM challenges
            """, fetch_all=True)
            
            # DIAGNOSTIC LOGGING: Inspect first 5 rows to understand PostgreSQL data types
            logger.info("=== DIAGNOSTIC: First 5 challenge rows from PostgreSQL ===")
            for i, row in enumerate(results[:5]):
                logger.info(f"Row {i+1} type: {type(row)}")
                logger.info(f"Row {i+1} keys: {list(row.keys()) if isinstance(row, dict) else 'N/A (tuple)'}")
                logger.info(f"Row {i+1} data: {dict(row) if isinstance(row, dict) else row}")
                
                # Inspect specific fields that are causing issues
                statements_json = row["statements_json"] if isinstance(row, dict) else row[9]
                metadata_json = row["merged_video_metadata_json"] if isinstance(row, dict) else row[10]
                created_at = row["created_at"] if isinstance(row, dict) else row[12]
                
                logger.info(f"  statements_json type: {type(statements_json)}, value: {statements_json}")
                logger.info(f"  metadata_json type: {type(metadata_json)}, value: {metadata_json}")
                logger.info(f"  created_at type: {type(created_at)}, value: {created_at}")
                logger.info("---")
            logger.info("=== END DIAGNOSTIC ===")
                
            for row in results:
                # Robust error handling: wrap entire row processing in try-except
                challenge_id = None
                try:
                    # Extract challenge_id early for error logging
                    challenge_id = row["challenge_id"] if isinstance(row, dict) else row[0]
                    
                    # Parse the data - handle both dict and tuple row formats
                    statements_json = row["statements_json"] if isinstance(row, dict) else row[9]
                    metadata_json = row["merged_video_metadata_json"] if isinstance(row, dict) else row[10]
                    tags_json = row["tags_json"] if isinstance(row, dict) else row[11]
                    created_at_raw = row["created_at"] if isinstance(row, dict) else row[12]
                    updated_at_raw = row["updated_at"] if isinstance(row, dict) else row[13]
                    published_at_raw = row["published_at"] if isinstance(row, dict) else row[14]
                    
                    # ROBUST JSON PARSING: Handle PostgreSQL string fields that need JSON parsing
                    
                    # Parse statements_json
                    statements_data = []
                    if statements_json is not None and isinstance(statements_json, str):
                        try:
                            statements_data = json.loads(statements_json)
                        except json.JSONDecodeError as json_e:
                            logger.error(f"Invalid JSON in statements_json for challenge {challenge_id}: {json_e}")
                            statements_data = []
                    elif statements_json is not None:
                        statements_data = statements_json  # Already parsed
                    
                    # Parse metadata_json
                    metadata_data = None
                    if metadata_json is not None and isinstance(metadata_json, str):
                        try:
                            metadata_data = json.loads(metadata_json)
                        except json.JSONDecodeError as json_e:
                            logger.error(f"Invalid JSON in metadata_json for challenge {challenge_id}: {json_e}")
                            metadata_data = None
                    elif metadata_json is not None:
                        metadata_data = metadata_json  # Already parsed
                    
                    # Parse tags_json
                    tags_data = []
                    if tags_json is not None and isinstance(tags_json, str):
                        try:
                            tags_data = json.loads(tags_json)
                        except json.JSONDecodeError as json_e:
                            logger.error(f"Invalid JSON in tags_json for challenge {challenge_id}: {json_e}")
                            tags_data = []
                    elif tags_json is not None:
                        tags_data = tags_json  # Already parsed
                    
                    # POSTGRESQL FIX: Handle datetime objects vs ISO strings
                    def parse_datetime(dt_value):
                        if dt_value is None:
                            return None
                        elif isinstance(dt_value, datetime):
                            return dt_value  # Already a datetime object
                        elif isinstance(dt_value, str):
                            try:
                                return datetime.fromisoformat(dt_value)
                            except ValueError as dt_e:
                                logger.error(f"Invalid datetime format for challenge {challenge_id}: {dt_e}, value: {dt_value}")
                                return None
                        else:
                            logger.warning(f"Unexpected datetime type for challenge {challenge_id}: {type(dt_value)}, value: {dt_value}")
                            return None
                    
                    # HANDLE INCONSISTENT DATA TYPES: Ensure statements_data is a list and contains valid data
                    if not isinstance(statements_data, list):
                        logger.error(f"statements_data is not a list for challenge {challenge_id}: {type(statements_data)}, value: {statements_data}")
                        statements_data = []
                    
                    # Create Statement objects with robust error handling for inconsistent data formats
                    statements = []
                    for i, stmt_data in enumerate(statements_data):
                        try:
                            # Check if statement data is a dictionary (expected format)
                            if isinstance(stmt_data, dict):
                                # Validate required fields before creating Statement
                                required_fields = ['statement_id', 'statement_type', 'media_url', 'media_file_id', 'duration_seconds']
                                if all(field in stmt_data for field in required_fields):
                                    statements.append(Statement(**stmt_data))
                                else:
                                    missing_fields = [field for field in required_fields if field not in stmt_data]
                                    logger.error(f"Statement {i} for challenge {challenge_id} missing required fields: {missing_fields}")
                                    continue
                            
                            # Handle inconsistent legacy data where statements might be simple strings
                            elif isinstance(stmt_data, str):
                                logger.warning(f"Challenge {challenge_id} has legacy string-based statement data at index {i}: {stmt_data}")
                                # Skip legacy string-based statements as they can't be converted to Statement objects
                                continue
                            
                            else:
                                logger.error(f"Statement {i} for challenge {challenge_id} is not a dict or string: {type(stmt_data)}, value: {stmt_data}")
                                continue
                                
                        except Exception as stmt_e:
                            logger.error(f"Error creating Statement object {i} for challenge {challenge_id}: {stmt_e}, data: {stmt_data}")
                            continue
                    
                    # Skip challenges with no valid statements
                    if not statements:
                        logger.warning(f"Challenge {challenge_id} has no valid statements, skipping")
                        continue
                    
                    # Create MergedVideoMetadata with robust error handling
                    merged_metadata = None
                    if metadata_data:
                        try:
                            if isinstance(metadata_data, dict):
                                # Validate required fields for MergedVideoMetadata
                                required_meta_fields = ['total_duration', 'segments', 'video_file_id']
                                if all(field in metadata_data for field in required_meta_fields):
                                    merged_metadata = MergedVideoMetadata(**metadata_data)
                                else:
                                    missing_fields = [field for field in required_meta_fields if field not in metadata_data]
                                    logger.error(f"Metadata for challenge {challenge_id} missing required fields: {missing_fields}")
                            else:
                                logger.error(f"Metadata for challenge {challenge_id} is not a dict: {type(metadata_data)}, value: {metadata_data}")
                        except Exception as meta_e:
                            logger.error(f"Error creating MergedVideoMetadata for challenge {challenge_id}: {meta_e}, data: {metadata_data}")
                    
                    # Ensure tags_data is a list
                    if not isinstance(tags_data, list):
                        logger.warning(f"tags_data for challenge {challenge_id} is not a list: {type(tags_data)}, converting to empty list")
                        tags_data = []
                    
                    # Create challenge object with additional validation
                    challenge = Challenge(
                        challenge_id=challenge_id,
                        creator_id=row["creator_id"] if isinstance(row, dict) else row[1],
                        title=row["title"] if isinstance(row, dict) else row[2],
                        status=ChallengeStatus(row["status"] if isinstance(row, dict) else row[3]) if (row["status"] if isinstance(row, dict) else row[3]) else ChallengeStatus.DRAFT,
                        lie_statement_id=row["lie_statement_id"] if isinstance(row, dict) else row[4],
                        statements=statements,
                        view_count=(row["view_count"] if isinstance(row, dict) else row[5]) or 0,
                        guess_count=(row["guess_count"] if isinstance(row, dict) else row[6]) or 0,
                        correct_guess_count=(row["correct_guess_count"] if isinstance(row, dict) else row[7]) or 0,
                        is_merged_video=bool(row["is_merged_video"] if isinstance(row, dict) else row[8]),
                        merged_video_metadata=merged_metadata,
                        tags=tags_data,
                        created_at=parse_datetime(created_at_raw),
                        updated_at=parse_datetime(updated_at_raw),
                        published_at=parse_datetime(published_at_raw)
                    )
                    
                    challenges[challenge.challenge_id] = challenge
                    
                except Exception as e:
                    # Comprehensive error logging with challenge_id context
                    challenge_context = f" (challenge_id: {challenge_id})" if challenge_id else ""
                    logger.error(f"Error parsing challenge row{challenge_context}: {e}")
                    logger.error(f"Row data: {dict(row) if isinstance(row, dict) else row}")
                    
                    # Log additional context for debugging
                    if isinstance(row, dict) and 'statements_json' in row:
                        logger.error(f"statements_json type: {type(row['statements_json'])}, value: {str(row['statements_json'])[:200]}...")
                    
                    continue  # Skip this row and continue with the next one
                
            return challenges
            
        except Exception as e:
            logger.error(f"Error loading all challenges: {e}")
            return {}
    
    def delete_challenge(self, challenge_id: str) -> bool:
        """
        Delete a challenge and its associated records from the database.
        Relies on 'ON DELETE CASCADE' for related records like guesses.

        Args:
            challenge_id: The ID of the challenge to delete.

        Returns:
            True if the challenge was found and deleted, False otherwise.

        Raises:
            DatabaseError: For underlying database issues.
        """
        operation = "delete_challenge"
        self._validate_database_operation(operation)

        try:
            # The database schema uses ON DELETE CASCADE for guesses,
            # so we only need to delete from the challenges table.
            query = "DELETE FROM challenges WHERE challenge_id = ?"
            rows_affected = self._execute_query(query, (challenge_id,))

            if rows_affected > 0:
                logger.info(f"Successfully deleted challenge {challenge_id} and its associated records.")
                return True
            else:
                logger.warning(f"Attempted to delete challenge {challenge_id}, but it was not found.")
                return False

        except Exception as e:
            categorized_error = self._handle_database_exception(operation, e, query, (challenge_id,))
            raise categorized_error
    
    def save_guess(self, guess) -> bool:
        """Save a guess to the database"""
        try:
            # Prepare data for upsert
            data = {
                "guess_id": guess.guess_id,
                "challenge_id": guess.challenge_id,
                "user_id": guess.user_id,
                "guessed_lie_statement_id": guess.guessed_lie_statement_id,
                "is_correct": guess.is_correct,
                "response_time_seconds": guess.response_time_seconds,
                "submitted_at": guess.submitted_at.isoformat() if guess.submitted_at else None
            }
            
            # Define conflict resolution
            conflict_columns = ["guess_id"]
            update_columns = [
                "challenge_id", "user_id", "guessed_lie_statement_id",
                "is_correct", "response_time_seconds", "submitted_at"
            ]
            
            self._execute_upsert("guesses", data, conflict_columns, update_columns)
            return True
                
        except Exception as e:
            logger.error(f"Error saving guess {guess.guess_id}: {e}")
            return False
    
    def load_all_guesses(self) -> dict:
        """Load all guesses from the database"""
        try:
            from models import GuessSubmission
            from datetime import datetime
            
            guesses = {}
            
            results = self._execute_query("""
                SELECT guess_id, challenge_id, user_id, guessed_lie_statement_id,
                       is_correct, response_time_seconds, submitted_at
                FROM guesses
            """, fetch_all=True)
                
            for row in results:
                try:
                    guess = GuessSubmission(
                        guess_id=row["guess_id"] if isinstance(row, dict) else row[0],
                        challenge_id=row["challenge_id"] if isinstance(row, dict) else row[1],
                        user_id=row["user_id"] if isinstance(row, dict) else row[2],
                        guessed_lie_statement_id=row["guessed_lie_statement_id"] if isinstance(row, dict) else row[3],
                        is_correct=bool(row["is_correct"] if isinstance(row, dict) else row[4]),
                        response_time_seconds=row["response_time_seconds"] if isinstance(row, dict) else row[5],
                        submitted_at=datetime.fromisoformat(row["submitted_at"] if isinstance(row, dict) else row[6]) if (row["submitted_at"] if isinstance(row, dict) else row[6]) else None
                    )
                    
                    guesses[guess.guess_id] = guess
                    
                except Exception as e:
                    logger.error(f"Error parsing guess row: {e}")
                    continue
                
            return guesses
            
        except Exception as e:
            logger.error(f"Error loading all guesses: {e}")
            return {}

    # =============================================================================
    # Session Management Methods
    # =============================================================================
    
    def create_session(self, user_id: str, jwt_token: str, session_type: str = 'user', 
                      permissions: List[str] = None, expires_at: datetime = None,
                      user_agent: str = None, ip_address: str = None) -> Optional[str]:
        """
        Create a new session record for JWT token tracking
        
        Args:
            user_id: User ID for the session
            jwt_token: The JWT token to store
            session_type: Type of session ('user', 'guest', 'admin')
            permissions: List of user permissions
            expires_at: When the session expires
            user_agent: Client user agent string
            ip_address: Client IP address
            
        Returns:
            Session ID if successful, None if failed
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "create_session"
        try:
            import hashlib
            
            # Create hash of token for efficient lookups without storing full token
            token_hash = hashlib.sha256(jwt_token.encode()).hexdigest()
            
            # Default expiration if not provided
            if expires_at is None:
                expires_at = datetime.utcnow() + timedelta(hours=24)
            
            session_data = {
                "user_id": user_id,
                "jwt_token": jwt_token,  # Store full token for validation
                "token_hash": token_hash,
                "session_type": session_type,
                "permissions": json.dumps(permissions or []),
                "created_at": datetime.utcnow(),
                "expires_at": expires_at,
                "last_accessed": datetime.utcnow(),
                "is_active": True,
                "user_agent": user_agent,
                "ip_address": ip_address
            }
            
            if self.is_postgres:
                # PostgreSQL - use RETURNING to get the session_id
                result = self._execute_query("""
                    INSERT INTO user_sessions (user_id, jwt_token, token_hash, session_type, permissions, 
                                             created_at, expires_at, last_accessed, is_active, user_agent, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING session_id
                """, (user_id, jwt_token, token_hash, session_type, json.dumps(permissions or []),
                     datetime.utcnow(), expires_at, datetime.utcnow(), True, user_agent, ip_address), 
                     fetch_one=True)
                return result['session_id'] if result else None
            else:
                # SQLite - insert and get lastrowid
                self._execute_insert("user_sessions", session_data)
                # For SQLite, return the token_hash as session identifier since we can't get UUID easily
                return token_hash
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def get_session_by_token_hash(self, token_hash: str) -> Optional[Dict[str, Any]]:
        """
        Get session information by token hash
        
        Args:
            token_hash: SHA256 hash of the JWT token
            
        Returns:
            Session data dict or None if not found
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "get_session_by_token_hash"
        try:
            session_data = self._execute_select("""
                SELECT session_id, user_id, jwt_token, token_hash, session_type, permissions,
                       created_at, expires_at, last_accessed, is_active, user_agent, ip_address
                FROM user_sessions 
                WHERE token_hash = ? AND is_active = TRUE AND expires_at > ?
            """, (token_hash, datetime.utcnow()), fetch_one=True)
            
            if session_data:
                # Parse permissions JSON
                try:
                    session_data['permissions'] = json.loads(session_data['permissions'])
                except (json.JSONDecodeError, TypeError):
                    session_data['permissions'] = []
                
                logger.debug(f"Retrieved active session for token hash {token_hash[:16]}...")
                return session_data
            else:
                logger.debug(f"No active session found for token hash {token_hash[:16]}...")
                return None
                
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def update_session_access(self, token_hash: str) -> bool:
        """
        Update last accessed timestamp for a session
        
        Args:
            token_hash: SHA256 hash of the JWT token
            
        Returns:
            True if updated successfully, False if session not found
            
        Raises:
            DatabaseError: For database operation errors  
        """
        operation = "update_session_access"
        try:
            rows_affected = self._execute_update(
                "user_sessions",
                {"last_accessed": datetime.utcnow()},
                "token_hash = ? AND is_active = TRUE",
                (token_hash,)
            )
            
            success = rows_affected > 0
            if success:
                logger.debug(f"Updated session access for token hash {token_hash[:16]}...")
            else:
                logger.warning(f"No active session found to update for token hash {token_hash[:16]}...")
                
            return success
            
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def invalidate_session(self, token_hash: str) -> bool:
        """
        Invalidate a session (mark as inactive)
        
        Args:
            token_hash: SHA256 hash of the JWT token
            
        Returns:
            True if invalidated successfully, False if session not found
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "invalidate_session"
        try:
            rows_affected = self._execute_update(
                "user_sessions",
                {"is_active": False, "last_accessed": datetime.utcnow()},
                "token_hash = ?",
                (token_hash,)
            )
            
            success = rows_affected > 0
            if success:
                logger.info(f"Invalidated session for token hash {token_hash[:16]}...")
            else:
                logger.warning(f"No session found to invalidate for token hash {token_hash[:16]}...")
                
            return success
            
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def invalidate_user_sessions(self, user_id: str) -> int:
        """
        Invalidate all sessions for a user
        
        Args:
            user_id: User ID whose sessions to invalidate
            
        Returns:
            Number of sessions invalidated
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "invalidate_user_sessions"
        try:
            rows_affected = self._execute_update(
                "user_sessions",
                {"is_active": False, "last_accessed": datetime.utcnow()},
                "user_id = ? AND is_active = TRUE",
                (user_id,)
            )
            
            logger.info(f"Invalidated {rows_affected} sessions for user {user_id}")
            return rows_affected
            
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error
    
    def cleanup_expired_sessions(self) -> int:
        """
        Clean up expired sessions from the database
        
        Returns:
            Number of sessions cleaned up
            
        Raises:
            DatabaseError: For database operation errors
        """
        operation = "cleanup_expired_sessions"
        try:
            # Mark expired sessions as inactive
            rows_affected = self._execute_update(
                "user_sessions",
                {"is_active": False},
                "expires_at <= ? AND is_active = TRUE",
                (datetime.utcnow(),)
            )
            
            logger.info(f"Cleaned up {rows_affected} expired sessions")
            return rows_affected
            
        except DatabaseError:
            # Re-raise database errors (already logged and categorized)
            raise
        except Exception as e:
            # Handle any unexpected errors
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error

    def get_environment_info(self) -> Dict[str, Any]:
        """
        Get comprehensive information about the current database environment
        
        Returns:
            Dict containing environment and configuration details
        """
        return {
            "environment": self.environment.value,
            "database_mode": self.database_mode.value,
            "is_postgres": self.is_postgres,
            "database_url_type": "PostgreSQL" if self.is_postgres else "SQLite",
            "database_path": str(self.db_path) if self.db_path else None,
            "psycopg2_available": PSYCOPG2_AVAILABLE,
            "production_ready": self.environment != DatabaseEnvironment.PRODUCTION or self.database_mode == DatabaseMode.POSTGRESQL_ONLY,
            "validation_status": "VALIDATED" if self._validate_production_requirements() else "INVALID"
        }
    
    def _validate_production_requirements(self) -> bool:
        """
        Validate that all production requirements are met
        
        Returns:
            bool: True if production requirements are satisfied
        """
        if self.environment == DatabaseEnvironment.PRODUCTION:
            return (
                self.database_mode == DatabaseMode.POSTGRESQL_ONLY and 
                self.is_postgres and 
                PSYCOPG2_AVAILABLE and
                'postgresql://' in self.database_url.lower()
            )
        return True
    
    def validate_environment_compatibility(self) -> None:
        """
        Perform a comprehensive validation of environment compatibility
        
        Raises:
            EnvironmentMismatchError: If environment is not properly configured
        """
        env_info = self.get_environment_info()
        
        if not env_info["production_ready"]:
            raise EnvironmentMismatchError(
                f"Environment validation failed. Current config: {env_info}"
            )
        
        if self.environment == DatabaseEnvironment.PRODUCTION:
            if not self.is_postgres:
                raise EnvironmentMismatchError(
                    "Production environment requires PostgreSQL database"
                )
            if self.database_mode != DatabaseMode.POSTGRESQL_ONLY:
                raise EnvironmentMismatchError(
                    f"Production environment requires PostgreSQL-only mode, got: {self.database_mode.value}"
                )
            if not PSYCOPG2_AVAILABLE:
                raise EnvironmentMismatchError(
                    "Production environment requires psycopg2 to be installed"
                )
        
        logger.info(f"Environment validation passed: {env_info}")

    def add_guess_history_record(self, user_id: int, challenge_id: str, was_correct: bool) -> None:
        """Adds a new record to the guess_history table."""
        operation = "add_guess_history_record"
        self._validate_database_operation(operation)
        try:
            self._execute_insert(
                "guess_history",
                {
                    "user_id": user_id,
                    "challenge_id": challenge_id,
                    "was_correct": was_correct,
                },
            )
        except Exception as e:
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error

    def get_correctly_guessed_challenge_ids(self, user_id: int) -> List[str]:
        """Retrieves a list of challenge_ids for a given user_id where was_correct is true."""
        operation = "get_correctly_guessed_challenge_ids"
        self._validate_database_operation(operation)
        try:
            results = self._execute_select(
                "SELECT challenge_id FROM guess_history WHERE user_id = ? AND was_correct = TRUE",
                (user_id,),
            )
            return [row["challenge_id"] for row in results] if results else []
        except Exception as e:
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error

    def get_attempted_challenge_ids(self, user_id: int) -> List[str]:
        """Retrieves a list of challenge_ids for a given user_id regardless of whether the guess was correct or incorrect."""
        operation = "get_attempted_challenge_ids"
        self._validate_database_operation(operation)
        try:
            results = self._execute_select(
                "SELECT DISTINCT challenge_id FROM guess_history WHERE user_id = ?",
                (user_id,),
            )
            return [row["challenge_id"] for row in results] if results else []
        except Exception as e:
            categorized_error = self._handle_database_exception(operation, e)
            raise categorized_error


# Global instance - will be initialized when first accessed
db_service = None

def get_db_service():
    """Get or create the global database service instance with environment validation"""
    global db_service
    if db_service is None:
        db_service = DatabaseService()
        # Validate environment on first initialization
        db_service.validate_environment_compatibility()
    return db_service