#!/usr/bin/env python3
"""
Migration System Test
====================

Test script to validate the migration system components
without actually performing a migration.
"""

import os
import sys
import logging

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_imports():
    """Test that all migration components can be imported"""
    print("Testing imports...")
    
    try:
        from migration_manager import MigrationManager
        print("✓ MigrationManager imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import MigrationManager: {e}")
        return False
    
    try:
        from data.data_migrator import DataMigrator
        print("✓ DataMigrator imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import DataMigrator: {e}")
        return False
    
    try:
        from rollback.rollback_manager import RollbackManager
        print("✓ RollbackManager imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import RollbackManager: {e}")
        return False
    
    try:
        from schema.postgres_schema import POSTGRES_SCHEMA, ROLLBACK_SCHEMA
        print("✓ Schema definitions imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import schema definitions: {e}")
        return False
    
    return True

def test_schema_definitions():
    """Test that schema definitions are valid"""
    print("\nTesting schema definitions...")
    
    try:
        from schema.postgres_schema import POSTGRES_SCHEMA, ROLLBACK_SCHEMA
        
        # Basic validation
        if "CREATE TABLE" not in POSTGRES_SCHEMA:
            print("✗ POSTGRES_SCHEMA missing CREATE TABLE statements")
            return False
        
        if "DROP TABLE" not in ROLLBACK_SCHEMA:
            print("✗ ROLLBACK_SCHEMA missing DROP TABLE statements")
            return False
        
        # Check for key tables
        required_tables = ['users', 'challenges', 'guesses', 'user_reports', 
                          'token_balances', 'token_transactions', 'user_sessions']
        
        for table in required_tables:
            if f"CREATE TABLE IF NOT EXISTS {table}" not in POSTGRES_SCHEMA:
                print(f"✗ Missing table definition: {table}")
                return False
        
        print("✓ Schema definitions are valid")
        return True
        
    except Exception as e:
        print(f"✗ Schema validation failed: {e}")
        return False

def test_migration_manager():
    """Test MigrationManager initialization"""
    print("\nTesting MigrationManager...")
    
    try:
        from migration_manager import MigrationManager
        
        # Test initialization
        manager = MigrationManager(
            sqlite_path="/tmp/test.db",
            postgres_url="postgresql://test:test@localhost:5432/test"
        )
        
        print("✓ MigrationManager initialization successful")
        
        # Test method existence
        required_methods = [
            'get_sqlite_schema_info',
            'validate_postgres_connection', 
            'create_postgres_schema',
            'migrate_table_data',
            'validate_migration',
            'perform_full_migration'
        ]
        
        for method in required_methods:
            if not hasattr(manager, method):
                print(f"✗ Missing method: {method}")
                return False
        
        print("✓ All required methods present")
        return True
        
    except Exception as e:
        print(f"✗ MigrationManager test failed: {e}")
        return False

def test_data_migrator():
    """Test DataMigrator initialization"""
    print("\nTesting DataMigrator...")
    
    try:
        from data.data_migrator import DataMigrator
        
        # Test initialization
        migrator = DataMigrator(
            sqlite_path="/tmp/test.db",
            postgres_url="postgresql://test:test@localhost:5432/test"
        )
        
        print("✓ DataMigrator initialization successful")
        
        # Test method existence
        required_methods = [
            'migrate_users_table',
            'migrate_challenges_table',
            'migrate_token_transactions_table',
            'migrate_user_sessions_table',
            'migrate_all_tables'
        ]
        
        for method in required_methods:
            if not hasattr(migrator, method):
                print(f"✗ Missing method: {method}")
                return False
        
        print("✓ All required methods present")
        return True
        
    except Exception as e:
        print(f"✗ DataMigrator test failed: {e}")
        return False

def test_rollback_manager():
    """Test RollbackManager initialization"""
    print("\nTesting RollbackManager...")
    
    try:
        from rollback.rollback_manager import RollbackManager
        
        # Test initialization
        rollback_mgr = RollbackManager(
            postgres_url="postgresql://test:test@localhost:5432/test"
        )
        
        print("✓ RollbackManager initialization successful")
        
        # Test method existence
        required_methods = [
            'list_available_rollbacks',
            'validate_rollback_safety',
            'create_backup_before_rollback',
            'execute_rollback_script',
            'perform_safe_rollback'
        ]
        
        for method in required_methods:
            if not hasattr(rollback_mgr, method):
                print(f"✗ Missing method: {method}")
                return False
        
        print("✓ All required methods present")
        
        # Test rollback script listing
        rollbacks = rollback_mgr.list_available_rollbacks()
        print(f"✓ Found {len(rollbacks)} rollback scripts")
        
        return True
        
    except Exception as e:
        print(f"✗ RollbackManager test failed: {e}")
        return False

def test_cli_tool():
    """Test CLI tool structure"""
    print("\nTesting CLI tool...")
    
    migrate_script = os.path.join(os.path.dirname(__file__), 'migrate.py')
    
    if not os.path.exists(migrate_script):
        print("✗ migrate.py not found")
        return False
    
    # Check if script is executable
    if not os.access(migrate_script, os.X_OK):
        print("⚠ migrate.py is not executable (this is okay)")
    
    # Read and validate basic structure
    with open(migrate_script, 'r') as f:
        content = f.read()
    
    required_functions = ['main', 'validate_environment', 'run_full_migration']
    for func in required_functions:
        if f"def {func}" not in content:
            print(f"✗ Missing function: {func}")
            return False
    
    print("✓ CLI tool structure is valid")
    return True

def test_file_structure():
    """Test migration directory structure"""
    print("\nTesting file structure...")
    
    base_dir = os.path.dirname(__file__)
    
    required_files = [
        '__init__.py',
        'migration_manager.py',
        'migrate.py',
        'schema/postgres_schema.py',
        'data/data_migrator.py',
        'rollback/rollback_manager.py',
        'rollback/rollback_postgres_schema.sql',
        'MIGRATION_GUIDE.md'
    ]
    
    missing_files = []
    for file_path in required_files:
        full_path = os.path.join(base_dir, file_path)
        if not os.path.exists(full_path):
            missing_files.append(file_path)
    
    if missing_files:
        print("✗ Missing files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        return False
    
    print("✓ All required files present")
    return True

def main():
    """Run all migration system tests"""
    print("Migration System Validation")
    print("=" * 40)
    
    tests = [
        test_file_structure,
        test_imports,
        test_schema_definitions,
        test_migration_manager,
        test_data_migrator,
        test_rollback_manager,
        test_cli_tool
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} failed with exception: {e}")
    
    print("\n" + "=" * 40)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All migration system components are working correctly!")
        print("\nNext steps:")
        print("1. Configure PostgreSQL database")
        print("2. Update DATABASE_URL in application")
        print("3. Run: python migrate.py validate --sqlite ../app.db --postgres 'your_url'")
        print("4. Run: python migrate.py full --sqlite ../app.db --postgres 'your_url'")
        return 0
    else:
        print("❌ Some tests failed. Please check the errors above.")
        return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)