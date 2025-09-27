#!/usr/bin/env python3
"""
Simple script to set premium status via Railway console
Run this with: railway run python set_user_premium.py
"""
import os
import sys
from pathlib import Path

# Add backend directory to path for Railway environment
backend_dir = Path(__file__).parent / 'backend'
sys.path.append(str(backend_dir))

def main():
    try:
        from services.database_service import get_db_service
        
        print("🔧 Setting premium status for user 10...")
        
        db_service = get_db_service()
        
        # Check if user 10 exists
        user = db_service.get_user_by_id(10)
        if user:
            print(f"Found user: ID={user['id']}, Email={user['email']}, Premium={user['is_premium']}")
            
            # Set premium status to True
            success = db_service.set_user_premium_status(user['id'], True)
            if success:
                print("✅ Successfully set premium status to True")
                
                # Verify the change
                updated_user = db_service.get_user_by_id(10)
                print(f"Updated user: Premium={updated_user['is_premium']}")
            else:
                print("❌ Failed to set premium status")
        else:
            print("❌ User with ID 10 not found")
            
            # Try to list first few users to debug
            import psycopg2
            conn = db_service._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, email, is_premium FROM users LIMIT 5")
            users = cursor.fetchall()
            print("Available users:")
            for user_row in users:
                print(f"  ID: {user_row[0]}, Email: {user_row[1]}, Premium: {user_row[2]}")
            cursor.close()

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("This script should be run in the Railway environment")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()