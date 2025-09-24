#!/usr/bin/env python3
"""
PostgreSQL Data Type Debugging Script
====================================

This script helps diagnose PostgreSQL data type issues by connecting
to your database and inspecting the actual data types returned.
"""

import os
import sys
import json
import logging
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def setup_logging():
    """Setup logging to see diagnostic output"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def test_challenge_data_types():
    """Test the load_all_challenges function with diagnostic output"""
    try:
        from services.database_service import DatabaseService
        
        # Initialize database service
        db_service = DatabaseService()
        
        print("Testing PostgreSQL data types in challenges...")
        print("=" * 60)
        
        # This will trigger the diagnostic logging we added
        challenges = db_service.load_all_challenges()
        
        print(f"\nResults:")
        print(f"Successfully loaded {len(challenges)} challenges")
        
        if challenges:
            # Show first challenge details
            first_challenge = next(iter(challenges.values()))
            print(f"\nFirst challenge loaded successfully:")
            print(f"  ID: {first_challenge.challenge_id}")
            print(f"  Title: {first_challenge.title}")
            print(f"  Status: {first_challenge.status}")
            print(f"  Statements: {len(first_challenge.statements)}")
            print(f"  Created at: {first_challenge.created_at} (type: {type(first_challenge.created_at)})")
            print(f"  Has metadata: {first_challenge.merged_video_metadata is not None}")
        
        return True
        
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_raw_query():
    """Test raw database query to see exactly what PostgreSQL returns"""
    try:
        from services.database_service import DatabaseService
        
        db_service = DatabaseService()
        
        print("\nTesting raw database query...")
        print("=" * 40)
        
        # Execute raw query
        results = db_service._execute_query("""
            SELECT challenge_id, statements_json, merged_video_metadata_json, 
                   created_at, updated_at
            FROM challenges 
            LIMIT 2
        """, fetch_all=True)
        
        for i, row in enumerate(results):
            print(f"\nRow {i+1}:")
            print(f"  Type: {type(row)}")
            print(f"  Keys: {list(row.keys()) if hasattr(row, 'keys') else 'No keys'}")
            
            # Check specific fields
            if isinstance(row, dict):
                statements_json = row.get('statements_json')
                created_at = row.get('created_at')
                
                print(f"  statements_json:")
                print(f"    Type: {type(statements_json)}")
                print(f"    Value: {statements_json}")
                
                print(f"  created_at:")
                print(f"    Type: {type(created_at)}")
                print(f"    Value: {created_at}")
                
                # Try parsing JSON if it's a string
                if isinstance(statements_json, str):
                    try:
                        parsed = json.loads(statements_json)
                        print(f"    Parsed JSON type: {type(parsed)}")
                        print(f"    Parsed JSON length: {len(parsed) if isinstance(parsed, list) else 'Not a list'}")
                    except Exception as e:
                        print(f"    JSON parse error: {e}")
        
        return True
        
    except Exception as e:
        print(f"Error in raw query test: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    setup_logging()
    
    print("PostgreSQL Data Type Diagnostic Tool")
    print("=" * 50)
    
    # Test 1: Raw query to see data types
    print("\n1. Testing raw database query...")
    raw_success = test_raw_query()
    
    # Test 2: Load challenges with diagnostic output
    print("\n2. Testing load_all_challenges with diagnostics...")
    load_success = test_challenge_data_types()
    
    # Summary
    print("\n" + "=" * 50)
    print("SUMMARY:")
    print(f"Raw query test: {'✅ PASSED' if raw_success else '❌ FAILED'}")
    print(f"Load challenges test: {'✅ PASSED' if load_success else '❌ FAILED'}")
    
    if raw_success and load_success:
        print("\n🎉 All tests passed! Your PostgreSQL integration is working.")
    else:
        print("\n⚠️  Some tests failed. Check the output above for details.")
        print("\nCommon fixes needed:")
        print("- JSON fields might need json.loads() if they're strings")
        print("- Datetime fields might already be datetime objects")
        print("- Check for None values in optional fields")
    
    return 0 if (raw_success and load_success) else 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)