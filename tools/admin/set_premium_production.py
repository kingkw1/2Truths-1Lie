#!/usr/bin/env python3
"""
Script to set premium status directly in production database via Railway
Run this with: railway run python set_premium_production.py
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent / 'backend'
sys.path.append(str(backend_dir))

try:
    from services.database_service import get_db_service
    
    def main():
        print("🔧 Setting premium status for user in production database...")
        
        db_service = get_db_service()
        
        # Try to find the user by ID 10 (from the logs)
        user = db_service.get_user_by_id(10)
        if user:
            print(f"Found user: ID={user['id']}, Email={user['email']}, Premium={user['is_premium']}")
            
            # Set premium status to True
            success = db_service.set_user_premium_status(user['id'], True)
            if success:
                print("✅ Successfully set premium status to True")
                
                # Verify the change
                updated_user = db_service.get_user_by_id(10)
                print(f"Updated user: ID={updated_user['id']}, Email={updated_user['email']}, Premium={updated_user['is_premium']}")
            else:
                print("❌ Failed to set premium status")
        else:
            print("❌ User with ID 10 not found")
            
            # Let's also try to find by email
            user_by_email = db_service.get_user_by_email('fake1@gmail.com')
            if user_by_email:
                print(f"Found user by email: ID={user_by_email['id']}, Email={user_by_email['email']}, Premium={user_by_email['is_premium']}")
                success = db_service.set_user_premium_status(user_by_email['id'], True)
                if success:
                    print("✅ Successfully set premium status to True via email lookup")
                else:
                    print("❌ Failed to set premium status via email lookup")
            else:
                print("❌ User with email fake1@gmail.com also not found")

    if __name__ == "__main__":
        main()
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("This script should be run in the Railway environment with: railway run python set_premium_production.py")