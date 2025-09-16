#!/usr/bin/env python3
"""
Simple PostgreSQL connection test for Railway
"""
import os
import sys

def test_connection():
    """Test PostgreSQL connection directly"""
    try:
        import psycopg2
        print("✅ psycopg2 imported successfully")
    except ImportError:
        print("❌ psycopg2 not available")
        return False
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found")
        return False
    
    print(f"📊 Database URL: {database_url[:50]}...")
    
    try:
        # Test direct connection
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ PostgreSQL connected: {version[0][:50]}...")
        
        # Test creating a simple table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_connection (
                id SERIAL PRIMARY KEY,
                test_field VARCHAR(100)
            );
        """)
        
        cursor.execute("INSERT INTO test_connection (test_field) VALUES ('Railway connection test');")
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) FROM test_connection;")
        count = cursor.fetchone()[0]
        print(f"✅ Test table created with {count} records")
        
        cursor.close()
        conn.close()
        
        print("🎯 PostgreSQL is working correctly on Railway!")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)