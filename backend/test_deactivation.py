#!/usr/bin/env python3
"""
Quick test for user deactivation issue
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import uuid
from unittest.mock import patch

def test_user_deactivation():
    """Test user deactivation specifically"""
    print("🧪 Testing user deactivation...")
    
    with patch.dict(os.environ, {'ENVIRONMENT': 'testing', 'DATABASE_URL': ''}, clear=False):
        from services.database_service import DatabaseService
        
        db_service = DatabaseService()
        
        # Create unique user for this test
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"deactivate_test_{unique_id}@example.com"
        test_password = "securepassword123"
        
        # 1. Create user
        user_data = db_service.create_user(test_email, test_password, "Test User")
        assert user_data is not None, "User creation failed"
        user_id = user_data["id"]
        print(f"✅ User created with ID: {user_id}")
        
        # 2. Test authentication works initially
        auth_before = db_service.authenticate_user(test_email, test_password)
        assert auth_before is not None, "Initial authentication should work"
        print(f"✅ Initial auth works: {auth_before['is_active']}")
        
        # 3. Check user status before deactivation
        user_before = db_service.get_user_by_id_all_status(user_id)
        print(f"🔍 User before deactivation: is_active = {user_before['is_active']} (type: {type(user_before['is_active'])})")
        
        # 4. Deactivate user
        deactivated = db_service.deactivate_user(user_id)
        assert deactivated, "User deactivation failed"
        print("✅ User deactivation completed")
        
        # 5. Check user status after deactivation
        user_after = db_service.get_user_by_id_all_status(user_id)
        print(f"🔍 User after deactivation: {user_after}")
        
        if user_after:
            print(f"🔍 is_active = {user_after['is_active']} (type: {type(user_after['is_active'])})")
        else:
            print("🔍 User not found after deactivation")
        
        # 6. Test authentication after deactivation
        auth_after = db_service.authenticate_user(test_email, test_password)
        print(f"🔍 Auth result after deactivation: {auth_after}")
        
        if auth_after is None:
            print("✅ Deactivated user correctly cannot authenticate")
            return True
        else:
            print("❌ Deactivated user can still authenticate - this is a bug!")
            return False

if __name__ == "__main__":
    success = test_user_deactivation()
    sys.exit(0 if success else 1)