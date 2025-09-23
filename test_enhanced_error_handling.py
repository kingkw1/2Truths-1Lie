#!/usr/bin/env python3
"""
Test script for enhanced database error handling
"""
import os
import sys
import logging
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from services.database_service import DatabaseService, DatabaseError, DatabaseConnectionError, DatabaseQueryError

def test_error_handling():
    """Test the enhanced error handling system"""
    
    # Setup logging to see error details
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logger = logging.getLogger(__name__)
    
    logger.info("Testing Enhanced Database Error Handling")
    logger.info("=" * 50)
    
    try:
        # Test 1: Initialize database service (should work)
        logger.info("Test 1: Initialize DatabaseService")
        db = DatabaseService()
        logger.info("✓ Database service initialized successfully")
        
        # Test 2: Test valid query
        logger.info("\nTest 2: Execute valid query")
        result = db._execute_select("SELECT 1 as test", fetch_one=True)
        logger.info(f"✓ Valid query executed successfully: {result}")
        
        # Test 3: Test invalid SQL (should trigger DatabaseQueryError)
        logger.info("\nTest 3: Execute invalid SQL query")
        try:
            db._execute_select("SELECT FROM invalid_syntax", fetch_one=True)
            logger.error("✗ Invalid query should have failed!")
        except DatabaseError as e:
            logger.info(f"✓ Invalid query properly caught as {type(e).__name__}: {e}")
        
        # Test 4: Test nonexistent table (should trigger DatabaseQueryError)
        logger.info("\nTest 4: Query nonexistent table")
        try:
            db._execute_select("SELECT * FROM nonexistent_table", fetch_one=True)
            logger.error("✗ Nonexistent table query should have failed!")
        except DatabaseError as e:
            logger.info(f"✓ Nonexistent table query properly caught as {type(e).__name__}: {e}")
        
        # Test 5: Test authentication methods with error handling
        logger.info("\nTest 5: Test authentication method error handling")
        try:
            # This should handle any database errors gracefully
            user = db.get_user_by_email("nonexistent@example.com")
            logger.info(f"✓ Authentication query handled gracefully: {user}")
        except DatabaseError as e:
            logger.info(f"✓ Authentication error properly caught as {type(e).__name__}: {e}")
            
        logger.info("\n" + "=" * 50)
        logger.info("Enhanced error handling test completed successfully!")
        
    except Exception as e:
        logger.error(f"Unexpected error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = test_error_handling()
    sys.exit(0 if success else 1)