#!/usr/bin/env python3
"""
Clean up test challenges from the database
Removes all challenges created by 'test-user-123'
"""

import sqlite3
import os
from pathlib import Path

def clean_test_challenges():
    """Remove all test challenges from the database"""
    db_path = Path("challenges.db")
    
    if not db_path.exists():
        print("❌ Database file not found: challenges.db")
        return
    
    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # First, count test challenges
        cursor.execute("SELECT COUNT(*) FROM challenges WHERE creator_id = 'test-user-123'")
        count = cursor.fetchone()[0]
        
        if count == 0:
            print("✅ No test challenges found to clean")
            return
        
        print(f"🗑️  Found {count} test challenges to remove")
        
        # Get challenge IDs for reference
        cursor.execute("SELECT challenge_id, created_at FROM challenges WHERE creator_id = 'test-user-123'")
        challenges = cursor.fetchall()
        
        print("📋 Test challenges to be removed:")
        for challenge_id, created_at in challenges:
            print(f"   - {challenge_id} (created: {created_at})")
        
        # Remove test challenges
        cursor.execute("DELETE FROM challenges WHERE creator_id = 'test-user-123'")
        deleted_count = cursor.rowcount
        
        # Remove associated statements
        cursor.execute("DELETE FROM statements WHERE challenge_id NOT IN (SELECT challenge_id FROM challenges)")
        deleted_statements = cursor.rowcount
        
        # Commit changes
        conn.commit()
        conn.close()
        
        print(f"✅ Successfully removed:")
        print(f"   - {deleted_count} test challenges")
        print(f"   - {deleted_statements} associated statements")
        print("🎯 Database is now clean and ready for real challenges!")
        
    except Exception as e:
        print(f"❌ Error cleaning database: {e}")

if __name__ == "__main__":
    print("🧹 Cleaning test challenges from database...")
    clean_test_challenges()
