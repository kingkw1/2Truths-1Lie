"""
Comprehensive unit tests for unified database query execution in database_service.py
"""
import pytest
import sqlite3
from unittest.mock import patch, MagicMock, Mock
from datetime import datetime

# Mock PostgreSQL imports for testing
import sys
sys.modules['psycopg2'] = Mock()
sys.modules['psycopg2.extras'] = Mock()

from database_service import DatabaseService, DatabaseEnvironment, DatabaseMode, DatabaseError


class TestUnifiedQueryExecution:
    """Test the unified query execution system"""
    
    @pytest.fixture
    def sqlite_service(self):
        """Create a DatabaseService instance configured for SQLite"""
        with patch.dict('os.environ', {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}):
            service = DatabaseService()
            service.is_postgres = False
            service.is_sqlite = True
            service.database_mode = DatabaseMode.SQLITE_ONLY
            return service
    
    @pytest.fixture
    def postgres_service(self):
        """Create a DatabaseService instance configured for PostgreSQL"""
        with patch.dict('os.environ', {'ENVIRONMENT': 'development', 'DATABASE_URL': 'postgresql://user:pass@localhost:5432/test'}):
            with patch('psycopg2.connect') as mock_connect:
                service = DatabaseService()
                service.is_postgres = True
                service.is_sqlite = False
                service.database_mode = DatabaseMode.POSTGRESQL_ONLY
                return service
    
    def test_prepare_query_parameter_conversion(self, sqlite_service, postgres_service):
        """Test that query parameter conversion works correctly"""
        query = "SELECT * FROM users WHERE id = ? AND email = ?"
        
        # SQLite should return query unchanged
        sqlite_result = sqlite_service._prepare_query(query)
        assert sqlite_result == query
        
        # PostgreSQL should convert ? to %s
        postgres_result = postgres_service._prepare_query(query)
        assert postgres_result == "SELECT * FROM users WHERE id = %s AND email = %s"
    
    def test_prepare_query_type_conversion(self, postgres_service):
        """Test that PostgreSQL type conversions work"""
        query = "CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
        result = postgres_service._prepare_query(query)
        
        assert "SERIAL" in result
        assert "VARCHAR(255)" in result
        assert "AUTOINCREMENT" not in result
        assert "TEXT" not in result
    
    def test_execute_select_fetch_one(self, sqlite_service):
        """Test _execute_select with fetch_one=True"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = {"id": 1, "email": "test@example.com"}
            
            result = sqlite_service._execute_select(
                "SELECT * FROM users WHERE id = ?",
                (1,),
                fetch_one=True
            )
            
            mock_execute.assert_called_once_with(
                "SELECT * FROM users WHERE id = ?",
                (1,),
                fetch_one=True,
                fetch_all=False
            )
            assert result == {"id": 1, "email": "test@example.com"}
    
    def test_execute_select_fetch_all(self, sqlite_service):
        """Test _execute_select with fetch_one=False (fetch_all)"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = [{"id": 1}, {"id": 2}]
            
            result = sqlite_service._execute_select(
                "SELECT * FROM users",
                (),
                fetch_one=False
            )
            
            mock_execute.assert_called_once_with(
                "SELECT * FROM users",
                (),
                fetch_one=False,
                fetch_all=True
            )
            assert result == [{"id": 1}, {"id": 2}]
    
    def test_execute_insert(self, sqlite_service):
        """Test _execute_insert method"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            
            data = {"email": "test@example.com", "name": "Test User"}
            result = sqlite_service._execute_insert("users", data)
            
            expected_query = "INSERT INTO users (email, name) VALUES (?, ?)"
            mock_execute.assert_called_once_with(expected_query, ("test@example.com", "Test User"))
            assert result == 1
    
    def test_execute_insert_empty_data(self, sqlite_service):
        """Test _execute_insert with empty data raises ValueError"""
        with pytest.raises(ValueError, match="Data dictionary cannot be empty"):
            sqlite_service._execute_insert("users", {})
    
    def test_execute_update(self, sqlite_service):
        """Test _execute_update method"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            
            data = {"name": "Updated Name", "email": "new@example.com"}
            result = sqlite_service._execute_update("users", data, "id = ?", (1,))
            
            expected_query = "UPDATE users SET name = ?, email = ? WHERE id = ?"
            mock_execute.assert_called_once_with(expected_query, ("Updated Name", "new@example.com", 1))
            assert result == 1
    
    def test_execute_update_empty_data(self, sqlite_service):
        """Test _execute_update with empty data raises ValueError"""
        with pytest.raises(ValueError, match="Data dictionary cannot be empty"):
            sqlite_service._execute_update("users", {}, "id = ?", (1,))
    
    def test_execute_upsert_postgresql(self, postgres_service):
        """Test _execute_upsert for PostgreSQL (ON CONFLICT)"""
        with patch.object(postgres_service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            
            data = {"id": 1, "email": "test@example.com", "name": "Test"}
            result = postgres_service._execute_upsert(
                "users", 
                data, 
                conflict_columns=["id"],
                update_columns=["email", "name"]
            )
            
            # Verify ON CONFLICT syntax was used
            call_args = mock_execute.call_args[0]
            query = call_args[0]
            assert "ON CONFLICT (id) DO UPDATE SET" in query
            assert "email = EXCLUDED.email" in query
            assert "name = EXCLUDED.name" in query
            assert result == 1
    
    def test_execute_upsert_sqlite(self, sqlite_service):
        """Test _execute_upsert for SQLite (INSERT OR REPLACE)"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            
            data = {"id": 1, "email": "test@example.com", "name": "Test"}
            result = sqlite_service._execute_upsert(
                "users", 
                data, 
                conflict_columns=["id"],
                update_columns=["email", "name"]
            )
            
            # Verify INSERT OR REPLACE syntax was used
            call_args = mock_execute.call_args[0]
            query = call_args[0]
            assert "INSERT OR REPLACE INTO users" in query
            assert "VALUES (?, ?, ?)" in query
            assert result == 1
    
    def test_execute_upsert_default_update_columns(self, sqlite_service):
        """Test _execute_upsert with default update columns"""
        with patch.object(sqlite_service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            
            data = {"id": 1, "email": "test@example.com", "name": "Test"}
            sqlite_service._execute_upsert("users", data, conflict_columns=["id"])
            
            # Should exclude conflict columns from updates by default
            call_args = mock_execute.call_args[0]
            query = call_args[0]
            assert "INSERT OR REPLACE" in query
    
    def test_execute_upsert_empty_data(self, sqlite_service):
        """Test _execute_upsert with empty data raises ValueError"""
        with pytest.raises(ValueError, match="Data dictionary cannot be empty"):
            sqlite_service._execute_upsert("users", {}, ["id"])
    
    def test_execute_query_with_return_cursor(self, sqlite_service):
        """Test _execute_query with return_cursor=True"""
        mock_cursor = Mock()
        
        with patch.object(sqlite_service, '_get_validated_connection') as mock_conn:
            mock_conn.return_value.__enter__.return_value = Mock()
            with patch.object(sqlite_service, 'get_cursor', return_value=mock_cursor):
                result = sqlite_service._execute_query(
                    "SELECT * FROM users",
                    (),
                    return_cursor=True
                )
                
                assert result == mock_cursor
    
    def test_execute_query_fetch_modes(self, sqlite_service):
        """Test _execute_query different fetch modes"""
        mock_cursor = Mock()
        mock_cursor.fetchone.return_value = {"id": 1}
        mock_cursor.fetchall.return_value = [{"id": 1}, {"id": 2}]
        mock_cursor.rowcount = 5
        
        with patch.object(sqlite_service, '_get_validated_connection') as mock_conn:
            mock_conn.return_value.__enter__.return_value = Mock()
            with patch.object(sqlite_service, 'get_cursor', return_value=mock_cursor):
                
                # Test fetch_one
                result = sqlite_service._execute_query("SELECT *", (), fetch_one=True)
                assert result == {"id": 1}
                
                # Test fetch_all
                result = sqlite_service._execute_query("SELECT *", (), fetch_all=True)
                assert result == [{"id": 1}, {"id": 2}]
                
                # Test rowcount (default)
                result = sqlite_service._execute_query("UPDATE users SET name = ?", ("test",))
                assert result == 5
    
    def test_execute_query_parameter_conversion_postgres(self, postgres_service):
        """Test that PostgreSQL parameter conversion happens automatically"""
        mock_cursor = Mock()
        
        with patch.object(postgres_service, '_get_validated_connection') as mock_conn:
            mock_conn.return_value.__enter__.return_value = Mock()
            with patch.object(postgres_service, 'get_cursor', return_value=mock_cursor):
                with patch.object(postgres_service, '_prepare_query') as mock_prepare:
                    mock_prepare.return_value = "SELECT * FROM users WHERE id = %s"
                    
                    postgres_service._execute_query("SELECT * FROM users WHERE id = ?", (1,))
                    
                    mock_prepare.assert_called_once_with("SELECT * FROM users WHERE id = ?")
                    mock_cursor.execute.assert_called_once_with("SELECT * FROM users WHERE id = %s", (1,))


class TestQueryExecutionIntegration:
    """Integration tests for query execution with real operations"""
    
    @pytest.fixture
    def test_service(self):
        """Create a test service with SQLite"""
        with patch.dict('os.environ', {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}):
            service = DatabaseService()
            return service
    
    def test_save_challenge_integration(self, test_service):
        """Test save_challenge uses the unified system"""
        mock_challenge = Mock()
        mock_challenge.challenge_id = "test123"
        mock_challenge.creator_id = 1
        mock_challenge.title = "Test Challenge"
        mock_challenge.status.value = "active"
        mock_challenge.lie_statement_id = 2
        mock_challenge.view_count = 10
        mock_challenge.guess_count = 5
        mock_challenge.correct_guess_count = 3
        mock_challenge.is_merged_video = False
        mock_challenge.statements = []
        mock_challenge.merged_video_metadata = None
        mock_challenge.tags = None
        mock_challenge.created_at = datetime.now()
        mock_challenge.updated_at = datetime.now()
        mock_challenge.published_at = datetime.now()
        
        with patch.object(test_service, '_execute_upsert') as mock_upsert:
            mock_upsert.return_value = 1
            
            result = test_service.save_challenge(mock_challenge)
            
            assert result is True
            mock_upsert.assert_called_once()
            call_args = mock_upsert.call_args
            assert call_args[0][0] == "challenges"  # table name
            assert "challenge_id" in call_args[0][1]  # data dict
            assert call_args[0][2] == ["challenge_id"]  # conflict columns
    
    def test_save_guess_integration(self, test_service):
        """Test save_guess uses the unified system"""
        mock_guess = Mock()
        mock_guess.guess_id = "guess123"
        mock_guess.challenge_id = "challenge123"
        mock_guess.user_id = 1
        mock_guess.guessed_lie_statement_id = 2
        mock_guess.is_correct = True
        mock_guess.response_time_seconds = 15.5
        mock_guess.submitted_at = datetime.now()
        
        with patch.object(test_service, '_execute_upsert') as mock_upsert:
            mock_upsert.return_value = 1
            
            result = test_service.save_guess(mock_guess)
            
            assert result is True
            mock_upsert.assert_called_once()
            call_args = mock_upsert.call_args
            assert call_args[0][0] == "guesses"  # table name
            assert "guess_id" in call_args[0][1]  # data dict
            assert call_args[0][2] == ["guess_id"]  # conflict columns
    
    def test_get_user_by_email_integration(self, test_service):
        """Test get_user_by_email uses the unified system"""
        with patch.object(test_service, '_execute_select') as mock_select:
            mock_select.return_value = {
                "id": 1,
                "email": "test@example.com",
                "name": "Test User",
                "created_at": "2023-01-01T00:00:00",
                "is_active": True,
                "last_login": None
            }
            
            result = test_service.get_user_by_email("test@example.com")
            
            assert result is not None
            assert result["email"] == "test@example.com"
            mock_select.assert_called_once()
            call_args = mock_select.call_args
            assert "WHERE email = ?" in call_args[0][0]
            assert call_args[0][1] == ("test@example.com",)
            assert call_args[1]["fetch_one"] is True


class TestErrorHandling:
    """Test error handling in unified query execution"""
    
    @pytest.fixture
    def error_service(self):
        """Create a service that will raise errors"""
        with patch.dict('os.environ', {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}):
            service = DatabaseService()
            return service
    
    def test_execute_query_database_error(self, error_service):
        """Test that database errors are properly handled and logged"""
        with patch.object(error_service, '_get_validated_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(sqlite3.Error):
                error_service._execute_query("SELECT * FROM users")
    
    def test_execute_upsert_invalid_table(self, error_service):
        """Test upsert with invalid table name"""
        with patch.object(error_service, '_execute_query') as mock_execute:
            mock_execute.side_effect = sqlite3.Error("no such table: invalid_table")
            
            with pytest.raises(sqlite3.Error):
                error_service._execute_upsert("invalid_table", {"id": 1}, ["id"])
    
    def test_deprecated_method_warning(self, error_service):
        """Test that deprecated execute_query_with_params shows warning"""
        with patch.object(error_service, '_execute_query') as mock_execute:
            mock_execute.return_value = []
            
            with patch('database_service.logger') as mock_logger:
                error_service.execute_query_with_params("SELECT * FROM users")
                
                mock_logger.warning.assert_called_once()
                warning_message = mock_logger.warning.call_args[0][0]
                assert "deprecated" in warning_message.lower()


class TestDatabaseSpecificBehavior:
    """Test database-specific behavior differences"""
    
    def test_sqlite_vs_postgres_upsert_syntax(self):
        """Test that SQLite and PostgreSQL generate different upsert syntax"""
        # Test data
        data = {"id": 1, "name": "test"}
        conflict_cols = ["id"]
        update_cols = ["name"]
        
        # SQLite service
        with patch.dict('os.environ', {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}):
            sqlite_service = DatabaseService()
            sqlite_service.is_postgres = False
            
            with patch.object(sqlite_service, '_execute_query') as mock_execute:
                sqlite_service._execute_upsert("test", data, conflict_cols, update_cols)
                
                query = mock_execute.call_args[0][0]
                assert "INSERT OR REPLACE" in query
                assert "ON CONFLICT" not in query
        
        # PostgreSQL service
        with patch.dict('os.environ', {'ENVIRONMENT': 'development', 'DATABASE_URL': 'postgresql://test'}):
            with patch('psycopg2.connect'):
                postgres_service = DatabaseService()
                postgres_service.is_postgres = True
                
                with patch.object(postgres_service, '_execute_query') as mock_execute:
                    postgres_service._execute_upsert("test", data, conflict_cols, update_cols)
                    
                    query = mock_execute.call_args[0][0]
                    assert "ON CONFLICT" in query
                    assert "INSERT OR REPLACE" not in query
    
    def test_parameter_binding_conversion(self):
        """Test that parameter binding is converted correctly for each database"""
        query = "SELECT * FROM users WHERE id = ? AND name = ?"
        
        # SQLite - should remain unchanged
        with patch.dict('os.environ', {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}):
            sqlite_service = DatabaseService()
            sqlite_result = sqlite_service._prepare_query(query)
            assert sqlite_result == query
        
        # PostgreSQL - should convert ? to %s
        with patch.dict('os.environ', {'ENVIRONMENT': 'development', 'DATABASE_URL': 'postgresql://test'}):
            with patch('psycopg2.connect'):
                postgres_service = DatabaseService()
                postgres_service.is_postgres = True
                postgres_result = postgres_service._prepare_query(query)
                assert postgres_result == "SELECT * FROM users WHERE id = %s AND name = %s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])