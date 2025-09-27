#!/usr/bin/env python3
"""
Run the score migration on production database
"""

import os
import sys
import psycopg2
from urllib.parse import urlparse

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def run_score_migration():
    """Run the score migration on production PostgreSQL database"""
    
    # Get the DATABASE_URL from environment or use Railway's default
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return False
    
    try:
        print("🚀 Running score migration on production database...")
        print(f"Database URL: {database_url[:50]}...")
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Check if score column already exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'score'
        """)
        
        if cursor.fetchone():
            print("✅ Score column already exists")
            return True
        
        # Add score column
        print("📝 Adding score column to users table...")
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
        """)
        
        # Commit the changes
        conn.commit()
        
        # Verify the column was added
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'score'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"✅ Score column added successfully: {result}")
        else:
            print("❌ Failed to verify score column")
            return False
        
        cursor.close()
        conn.close()
        
        print("🎉 Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = run_score_migration()
    sys.exit(0 if success else 1)