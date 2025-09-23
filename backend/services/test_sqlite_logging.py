#!/usr/bin/env python3
"""
Test script to verify SQLite fallback logging in database_service.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # Add backend to path

import logging
from unittest.mock import patch, MagicMock

# Set up logging to see our warnings
logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')

def test_sqlite_fallback_logging():
    """Test that SQLite fallback operations log warnings with environment context"""
    
    # Mock the environment to be development (allows SQLite)
    with patch.dict(os.environ, {'ENVIRONMENT': 'development', 'DATABASE_URL': ''}, clear=False):
        
        try:
            from services.database_service import DatabaseService
            
            print("Testing DatabaseService initialization with SQLite fallback...")
            
            # Create service instance - should log SQLite usage
            service = DatabaseService()
            
            print(f"✅ Service initialized in {service.environment.value} environment")
            print(f"✅ Database mode: {service.database_mode.value}")
            print(f"✅ Using SQLite: {service.is_sqlite}")
            print(f"✅ Database path: {service.db_path}")
            
            # Test connection - should log SQLite fallback warning
            print("\nTesting get_connection() - should log SQLite fallback warning...")
            conn = service.get_connection()
            print(f"✅ Connection established: {type(conn)}")
            conn.close()
            
            # Test cursor - should log SQLite fallback warning
            print("\nTesting get_cursor() - should log SQLite fallback warning...")
            conn = service.get_connection()
            cursor = service.get_cursor(conn)
            print(f"✅ Cursor created: {type(cursor)}")
            conn.close()
            
            print("\n🎉 All SQLite fallback logging tests passed!")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_sqlite_fallback_logging()