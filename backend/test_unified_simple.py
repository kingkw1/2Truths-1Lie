#!/usr/bin/env python3
"""
Simple test runner for unified query execution
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from unittest.mock import Mock, patch, MagicMock
import sqlite3
from datetime import datetime

def run_simple_tests():
    """Run basic tests for unified query execution"""
    print("🧪 Running unified query execution tests...")
    
    # Test 1: Database Service imports correctly
    try:
        from services.database_service import DatabaseService
        print("✅ DatabaseService imports successfully")
    except Exception as e:
        print(f"❌ Failed to import DatabaseService: {e}")
        return False
    
    # Test 2: Service initializes in test environment
    try:
        with patch.dict(os.environ, {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}, clear=False):
            service = DatabaseService()
            print(f"✅ Service initializes in {service.database_mode.value} mode")
    except Exception as e:
        print(f"❌ Failed to initialize service: {e}")
        return False
    
    # Test 3: Parameter conversion works
    try:
        query = "SELECT * FROM users WHERE id = ? AND email = ?"
        converted = service._prepare_query(query)
        if service.is_postgres:
            expected = "SELECT * FROM users WHERE id = %s AND email = %s"
            assert converted == expected
            print("✅ PostgreSQL parameter conversion works")
        else:
            assert converted == query
            print("✅ SQLite parameter handling works")
    except Exception as e:
        print(f"❌ Parameter conversion failed: {e}")
        return False
    
    # Test 4: New unified methods exist
    try:
        methods = ['_execute_query', '_execute_select', '_execute_insert', '_execute_update', '_execute_upsert']
        for method in methods:
            assert hasattr(service, method) and callable(getattr(service, method))
        print("✅ All unified methods exist and are callable")
    except Exception as e:
        print(f"❌ Unified methods test failed: {e}")
        return False
    
    # Test 5: UPSERT query generation
    try:
        data = {"id": 1, "name": "test", "email": "test@example.com"}
        conflict_cols = ["id"]
        update_cols = ["name", "email"]
        
        with patch.object(service, '_execute_query') as mock_execute:
            mock_execute.return_value = 1
            result = service._execute_upsert("users", data, conflict_cols, update_cols)
            
            assert mock_execute.called
            query = mock_execute.call_args[0][0]
            
            if service.is_postgres:
                assert "ON CONFLICT" in query
                print("✅ PostgreSQL UPSERT query generated correctly")
            else:
                assert "INSERT OR REPLACE" in query
                print("✅ SQLite UPSERT query generated correctly")
    except Exception as e:
        print(f"❌ UPSERT test failed: {e}")
        return False
    
    # Test 6: Refactored methods work
    try:
        # Test save_challenge
        mock_challenge = Mock()
        mock_challenge.challenge_id = "test123"
        mock_challenge.creator_id = 1
        mock_challenge.title = "Test"
        mock_challenge.status.value = "active"
        mock_challenge.lie_statement_id = 1
        mock_challenge.view_count = 0
        mock_challenge.guess_count = 0
        mock_challenge.correct_guess_count = 0
        mock_challenge.is_merged_video = False
        mock_challenge.statements = []
        mock_challenge.merged_video_metadata = None
        mock_challenge.tags = None
        mock_challenge.created_at = datetime.now()
        mock_challenge.updated_at = datetime.now()
        mock_challenge.published_at = datetime.now()
        
        with patch.object(service, '_execute_upsert') as mock_upsert:
            mock_upsert.return_value = 1
            result = service.save_challenge(mock_challenge)
            assert result is True
            assert mock_upsert.called
        
        print("✅ save_challenge uses unified system")
    except Exception as e:
        print(f"❌ save_challenge test failed: {e}")
        return False
    
    # Test 7: Error handling
    try:
        with patch.object(service, '_get_validated_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Test error")
            
            try:
                service._execute_query("SELECT * FROM users")
                print("❌ Expected error was not raised")
                return False
            except sqlite3.Error:
                print("✅ Database errors are properly propagated")
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False
    
    # Test 8: Deprecated method exists
    try:
        with patch.object(service, '_execute_query') as mock_execute:
            mock_execute.return_value = []
            service.execute_query_with_params("SELECT * FROM users")
            assert mock_execute.called
        print("✅ Deprecated method works for backward compatibility")
    except Exception as e:
        print(f"❌ Deprecated method test failed: {e}")
        return False
    
    print("\n🎉 All tests passed! Unified query execution system is working correctly.")
    return True

if __name__ == "__main__":
    success = run_simple_tests()
    sys.exit(0 if success else 1)