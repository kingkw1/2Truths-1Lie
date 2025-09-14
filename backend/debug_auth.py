#!/usr/bin/env python3
"""
Debug authentication issues
"""
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from services.auth_service import AuthService
from services.database_service import DatabaseService

def debug_auth():
    """Debug authentication token creation and verification"""
    
    # Initialize services
    auth_service = AuthService()
    db_service = DatabaseService()
    
    # Create test user
    test_email = "debug_user@example.com"
    test_password = "testpass123"
    
    user_data = db_service.create_user(test_email, test_password, "Debug User")
    if not user_data:
        user_data = db_service.authenticate_user(test_email, test_password)
    
    print(f"User data: {user_data}")
    
    # Create token
    token = auth_service.create_access_token(
        data={
            "sub": str(user_data["id"]),
            "permissions": ["media:read", "media:upload", "media:delete"]
        }
    )
    
    print(f"Created token: {token}")
    
    # Try to verify token
    try:
        payload = auth_service.verify_token(token)
        print(f"✅ Token verified successfully: {payload}")
        return True
    except Exception as e:
        print(f"❌ Token verification failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    debug_auth()