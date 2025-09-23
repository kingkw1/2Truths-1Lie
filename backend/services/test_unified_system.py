#!/usr/bin/env python3
"""
Test script to verify unified query execution refactoring works correctly
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from unittest.mock import patch

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def test_unified_query_execution():
    """Test that the unified query execution system works"""
    
    with patch.dict(os.environ, {'ENVIRONMENT': 'development', 'DATABASE_URL': ''}, clear=False):
        try:
            from services.database_service import DatabaseService
            
            print("✅ Testing unified query execution system...")
            
            # Create service instance
            service = DatabaseService()
            
            print(f"✅ Service initialized: {service.database_mode.value}")
            print(f"✅ Parameter conversion test...")
            
            # Test parameter conversion
            query = "SELECT * FROM users WHERE id = ? AND email = ?"
            converted = service._prepare_query(query)
            
            if service.is_postgres:
                expected = "SELECT * FROM users WHERE id = %s AND email = %s"
                assert converted == expected, f"Expected {expected}, got {converted}"
                print("✅ PostgreSQL parameter conversion works")
            else:
                assert converted == query, f"SQLite should not change query, got {converted}"
                print("✅ SQLite parameter handling works")
            
            # Test new unified methods exist
            methods_to_test = [
                '_execute_query',
                '_execute_select', 
                '_execute_insert',
                '_execute_update',
                '_execute_upsert'
            ]
            
            for method_name in methods_to_test:
                assert hasattr(service, method_name), f"Method {method_name} not found"
                method = getattr(service, method_name)
                assert callable(method), f"Method {method_name} is not callable"
                print(f"✅ Method {method_name} exists and is callable")
            
            # Test that deprecated method exists with warning
            deprecated_method = getattr(service, 'execute_query_with_params')
            assert callable(deprecated_method), "Deprecated method should still exist"
            print("✅ Deprecated method exists for backward compatibility")
            
            # Test data structure for upsert
            test_data = {
                "id": 1,
                "email": "test@example.com",
                "name": "Test User"
            }
            
            # Test that upsert method handles data correctly
            conflict_columns = ["id"]
            update_columns = ["email", "name"]
            
            # This should not raise an error
            try:
                # Mock the actual database operation
                with patch.object(service, '_execute_query', return_value=1):
                    result = service._execute_upsert("test_table", test_data, conflict_columns, update_columns)
                    assert result == 1
                print("✅ Upsert method works correctly")
            except Exception as e:
                print(f"❌ Upsert test failed: {e}")
                return False
            
            print("\n🎉 All unified query execution tests passed!")
            return True
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = test_unified_query_execution()
    sys.exit(0 if success else 1)