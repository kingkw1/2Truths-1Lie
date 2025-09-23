"""
Unit tests for DATABASE_URL parsing and validation in database_service.py
"""
import pytest
import os
from unittest.mock import patch, MagicMock

from database_service import (
    DatabaseURLInfo, DatabaseURLError, DatabaseEnvironment,
    parse_database_url, validate_database_url_for_environment,
    determine_database_mode, DatabaseMode
)


class TestDatabaseURLParsing:
    """Test DATABASE_URL parsing functionality"""
    
    def test_parse_postgresql_url_basic(self):
        """Test parsing basic PostgreSQL URL"""
        url = "postgresql://user:pass@localhost:5432/mydb"
        result = parse_database_url(url)
        
        assert result.scheme == "postgresql"
        assert result.hostname == "localhost"
        assert result.port == 5432
        assert result.username == "user"
        assert result.password == "pass"
        assert result.database == "mydb"
        assert result.is_postgres is True
        assert result.is_sqlite is False
    
    def test_parse_postgresql_url_no_port(self):
        """Test parsing PostgreSQL URL without port"""
        url = "postgresql://user:pass@localhost/mydb"
        result = parse_database_url(url)
        
        assert result.hostname == "localhost"
        assert result.port is None
        assert result.database == "mydb"
        assert result.is_postgres is True
    
    def test_parse_postgresql_url_no_credentials(self):
        """Test parsing PostgreSQL URL without credentials"""
        url = "postgresql://localhost:5432/mydb"
        result = parse_database_url(url)
        
        assert result.hostname == "localhost"
        assert result.port == 5432
        assert result.username is None
        assert result.password is None
        assert result.database == "mydb"
        assert result.is_postgres is True
    
    def test_parse_postgres_scheme(self):
        """Test parsing URL with 'postgres' scheme"""
        url = "postgres://user:pass@localhost:5432/mydb"
        result = parse_database_url(url)
        
        assert result.scheme == "postgres"
        assert result.is_postgres is True
        assert result.is_sqlite is False
    
    def test_parse_sqlite_url_absolute_path(self):
        """Test parsing SQLite URL with absolute path"""
        url = "sqlite:///tmp/test.db"
        result = parse_database_url(url)
        
        assert result.scheme == "sqlite"
        assert result.hostname == ""
        assert result.port is None
        assert result.username is None
        assert result.password is None
        assert result.database == "tmp/test.db"
        assert result.is_postgres is False
        assert result.is_sqlite is True
    
    def test_parse_sqlite_url_relative_path(self):
        """Test parsing SQLite URL with relative path"""
        url = "sqlite://app.db"
        result = parse_database_url(url)
        
        assert result.database == "app.db"
        assert result.is_sqlite is True
    
    def test_parse_sqlite3_scheme(self):
        """Test parsing URL with 'sqlite3' scheme"""
        url = "sqlite3:///test.db"
        result = parse_database_url(url)
        
        assert result.scheme == "sqlite3"
        assert result.is_sqlite is True
    
    def test_parse_empty_url(self):
        """Test parsing empty URL raises error"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL is empty or missing"):
            parse_database_url("")
    
    def test_parse_none_url(self):
        """Test parsing None URL raises error"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL is empty or missing"):
            parse_database_url(None)
    
    def test_parse_whitespace_url(self):
        """Test parsing whitespace-only URL raises error"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL is empty or missing"):
            parse_database_url("   ")
    
    def test_parse_no_scheme(self):
        """Test parsing URL without scheme raises error"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL missing scheme"):
            parse_database_url("localhost:5432/mydb")
    
    def test_parse_unsupported_scheme(self):
        """Test parsing URL with unsupported scheme raises error"""
        with pytest.raises(DatabaseURLError, match="Unsupported database scheme: mysql"):
            parse_database_url("mysql://localhost:3306/mydb")
    
    def test_parse_postgresql_missing_hostname(self):
        """Test parsing PostgreSQL URL without hostname raises error"""
        with pytest.raises(DatabaseURLError, match="PostgreSQL DATABASE_URL missing hostname"):
            parse_database_url("postgresql:///mydb")
    
    def test_parse_postgresql_missing_database(self):
        """Test parsing PostgreSQL URL without database name raises error"""
        with pytest.raises(DatabaseURLError, match="PostgreSQL DATABASE_URL missing database name"):
            parse_database_url("postgresql://localhost:5432/")
    
    def test_parse_postgresql_invalid_database_name(self):
        """Test parsing PostgreSQL URL with invalid database name raises error"""
        with pytest.raises(DatabaseURLError, match="Invalid PostgreSQL database name"):
            parse_database_url("postgresql://localhost:5432/my-db")
    
    def test_parse_postgresql_invalid_port(self):
        """Test parsing PostgreSQL URL with invalid port raises error"""
        with pytest.raises(DatabaseURLError, match="Invalid port number"):
            parse_database_url("postgresql://localhost:99999/mydb")
    
    def test_parse_sqlite_missing_path(self):
        """Test parsing SQLite URL without path raises error"""
        with pytest.raises(DatabaseURLError, match="SQLite DATABASE_URL missing file path"):
            parse_database_url("sqlite://")
    
    def test_parse_malformed_url(self):
        """Test parsing completely malformed URL raises error"""
        with pytest.raises(DatabaseURLError, match="Failed to parse DATABASE_URL"):
            parse_database_url("not-a-url://[invalid")


class TestDatabaseURLValidation:
    """Test DATABASE_URL validation for different environments"""
    
    def test_validate_production_requires_database_url(self):
        """Test that production environment requires DATABASE_URL"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL is required in production"):
            validate_database_url_for_environment(None, DatabaseEnvironment.PRODUCTION)
    
    def test_validate_production_requires_postgresql(self):
        """Test that production environment requires PostgreSQL"""
        sqlite_url = "sqlite:///app.db"
        with pytest.raises(DatabaseURLError, match="Production environment requires PostgreSQL"):
            validate_database_url_for_environment(sqlite_url, DatabaseEnvironment.PRODUCTION)
    
    def test_validate_production_valid_postgresql(self):
        """Test valid PostgreSQL URL in production"""
        pg_url = "postgresql://user:pass@localhost:5432/mydb"
        result = validate_database_url_for_environment(pg_url, DatabaseEnvironment.PRODUCTION)
        
        assert result is not None
        assert result.is_postgres is True
    
    def test_validate_production_invalid_url(self):
        """Test invalid URL in production fails fast"""
        invalid_url = "postgresql://missing-database"
        with pytest.raises(DatabaseURLError, match="Invalid DATABASE_URL in production"):
            validate_database_url_for_environment(invalid_url, DatabaseEnvironment.PRODUCTION)
    
    def test_validate_staging_requires_database_url(self):
        """Test that staging environment requires DATABASE_URL"""
        with pytest.raises(DatabaseURLError, match="DATABASE_URL is required in staging"):
            validate_database_url_for_environment(None, DatabaseEnvironment.STAGING)
    
    def test_validate_staging_accepts_postgresql(self):
        """Test staging accepts PostgreSQL URL"""
        pg_url = "postgresql://user:pass@localhost:5432/mydb"
        result = validate_database_url_for_environment(pg_url, DatabaseEnvironment.STAGING)
        
        assert result is not None
        assert result.is_postgres is True
    
    def test_validate_staging_accepts_sqlite(self):
        """Test staging accepts SQLite URL"""
        sqlite_url = "sqlite:///app.db"
        result = validate_database_url_for_environment(sqlite_url, DatabaseEnvironment.STAGING)
        
        assert result is not None
        assert result.is_sqlite is True
    
    def test_validate_development_no_url(self):
        """Test development works without DATABASE_URL"""
        result = validate_database_url_for_environment(None, DatabaseEnvironment.DEVELOPMENT)
        assert result is None
    
    def test_validate_development_valid_url(self):
        """Test development accepts valid URL"""
        pg_url = "postgresql://user:pass@localhost:5432/mydb"
        result = validate_database_url_for_environment(pg_url, DatabaseEnvironment.DEVELOPMENT)
        
        assert result is not None
        assert result.is_postgres is True
    
    def test_validate_development_invalid_url_fallback(self):
        """Test development falls back gracefully on invalid URL"""
        invalid_url = "postgresql://invalid-url"
        result = validate_database_url_for_environment(invalid_url, DatabaseEnvironment.DEVELOPMENT)
        
        # Should return None and log warning, not raise exception
        assert result is None
    
    def test_validate_testing_no_url(self):
        """Test testing works without DATABASE_URL"""
        result = validate_database_url_for_environment(None, DatabaseEnvironment.TESTING)
        assert result is None
    
    def test_validate_testing_valid_url(self):
        """Test testing accepts valid URL"""
        sqlite_url = "sqlite:///test.db"
        result = validate_database_url_for_environment(sqlite_url, DatabaseEnvironment.TESTING)
        
        assert result is not None
        assert result.is_sqlite is True


class TestDatabaseModeSelection:
    """Test database mode determination logic"""
    
    def test_production_requires_postgresql(self):
        """Test production environment requires PostgreSQL"""
        pg_info = DatabaseURLInfo(
            scheme="postgresql", hostname="localhost", port=5432,
            username="user", password="pass", database="mydb",
            is_postgres=True, is_sqlite=False
        )
        
        mode = determine_database_mode(DatabaseEnvironment.PRODUCTION, pg_info)
        assert mode == DatabaseMode.POSTGRESQL_ONLY
    
    def test_production_rejects_sqlite(self):
        """Test production environment rejects SQLite"""
        sqlite_info = DatabaseURLInfo(
            scheme="sqlite", hostname="", port=None,
            username=None, password=None, database="app.db",
            is_postgres=False, is_sqlite=True
        )
        
        with pytest.raises(Exception):  # EnvironmentMismatchError
            determine_database_mode(DatabaseEnvironment.PRODUCTION, sqlite_info)
    
    def test_production_rejects_no_url(self):
        """Test production environment rejects no DATABASE_URL"""
        with pytest.raises(Exception):  # EnvironmentMismatchError
            determine_database_mode(DatabaseEnvironment.PRODUCTION, None)
    
    def test_staging_prefers_postgresql(self):
        """Test staging environment prefers PostgreSQL"""
        pg_info = DatabaseURLInfo(
            scheme="postgresql", hostname="localhost", port=5432,
            username="user", password="pass", database="mydb",
            is_postgres=True, is_sqlite=False
        )
        
        mode = determine_database_mode(DatabaseEnvironment.STAGING, pg_info)
        assert mode == DatabaseMode.POSTGRESQL_ONLY
    
    def test_staging_accepts_sqlite(self):
        """Test staging environment accepts SQLite"""
        sqlite_info = DatabaseURLInfo(
            scheme="sqlite", hostname="", port=None,
            username=None, password=None, database="app.db",
            is_postgres=False, is_sqlite=True
        )
        
        mode = determine_database_mode(DatabaseEnvironment.STAGING, sqlite_info)
        assert mode == DatabaseMode.SQLITE_ONLY
    
    def test_staging_fallback_no_url(self):
        """Test staging environment falls back to SQLite when no URL"""
        mode = determine_database_mode(DatabaseEnvironment.STAGING, None)
        assert mode == DatabaseMode.SQLITE_ONLY
    
    def test_testing_prefers_sqlite(self):
        """Test testing environment prefers SQLite for speed"""
        mode = determine_database_mode(DatabaseEnvironment.TESTING, None)
        assert mode == DatabaseMode.SQLITE_ONLY
    
    def test_testing_accepts_postgresql(self):
        """Test testing environment accepts PostgreSQL when configured"""
        pg_info = DatabaseURLInfo(
            scheme="postgresql", hostname="localhost", port=5432,
            username="user", password="pass", database="testdb",
            is_postgres=True, is_sqlite=False
        )
        
        mode = determine_database_mode(DatabaseEnvironment.TESTING, pg_info)
        assert mode == DatabaseMode.POSTGRESQL_ONLY
    
    def test_development_accepts_both(self):
        """Test development environment accepts both database types"""
        # Test PostgreSQL
        pg_info = DatabaseURLInfo(
            scheme="postgresql", hostname="localhost", port=5432,
            username="user", password="pass", database="devdb",
            is_postgres=True, is_sqlite=False
        )
        
        mode = determine_database_mode(DatabaseEnvironment.DEVELOPMENT, pg_info)
        assert mode == DatabaseMode.POSTGRESQL_ONLY
        
        # Test SQLite fallback
        mode = determine_database_mode(DatabaseEnvironment.DEVELOPMENT, None)
        assert mode == DatabaseMode.SQLITE_ONLY


class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    def test_railway_postgresql_url(self):
        """Test parsing Railway PostgreSQL URL format"""
        url = "postgresql://postgres:password@monorail.proxy.rlwy.net:12345/railway"
        result = parse_database_url(url)
        
        assert result.scheme == "postgresql"
        assert result.hostname == "monorail.proxy.rlwy.net"
        assert result.port == 12345
        assert result.database == "railway"
        assert result.is_postgres is True
    
    def test_complex_password_url(self):
        """Test URL with complex password containing special characters"""
        url = "postgresql://user:p@ssw0rd!@localhost:5432/mydb"
        result = parse_database_url(url)
        
        assert result.username == "user"
        assert result.password == "p@ssw0rd!"
        assert result.database == "mydb"
    
    def test_url_with_query_parameters(self):
        """Test URL with query parameters (should be ignored for basic parsing)"""
        url = "postgresql://user:pass@localhost:5432/mydb?sslmode=require"
        result = parse_database_url(url)
        
        assert result.database == "mydb"
        assert result.is_postgres is True
    
    def test_sqlite_memory_database(self):
        """Test SQLite in-memory database URL"""
        url = "sqlite:///:memory:"
        result = parse_database_url(url)
        
        assert result.database == ":memory:"
        assert result.is_sqlite is True
    
    def test_very_long_database_name(self):
        """Test database name length validation"""
        long_name = "a" * 100
        url = f"postgresql://localhost:5432/{long_name}"
        
        # Should parse successfully (PostgreSQL supports long names)
        result = parse_database_url(url)
        assert result.database == long_name
    
    def test_unicode_in_url(self):
        """Test URL with unicode characters"""
        url = "postgresql://üser:päss@localhost:5432/mydb"
        result = parse_database_url(url)
        
        assert result.username == "üser"
        assert result.password == "päss"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])