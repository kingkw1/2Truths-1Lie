#!/usr/bin/env python3
"""
Test both old and new PostgreSQL hostnames
"""
import os
import sys

def test_hostname(hostname, description):
    """Test PostgreSQL connection with specific hostname"""
    print(f"\n🧪 Testing {description}: {hostname}")
    
    try:
        import psycopg2
        
        # Get the current DATABASE_URL and replace the hostname
        original_url = os.getenv("DATABASE_URL", "")
        if not original_url:
            print("❌ No DATABASE_URL found")
            return False
            
        # Extract password and other parts, replace hostname
        if "@" in original_url and ".railway.internal" in original_url:
            before_hostname = original_url.split("@")[0]
            after_hostname = original_url.split(".railway.internal")[1]
            test_url = f"{before_hostname}@{hostname}.railway.internal{after_hostname}"
        else:
            print("❌ Unexpected DATABASE_URL format")
            return False
            
        print(f"📊 Testing URL: {test_url[:60]}...")
        
        # Test connection
        conn = psycopg2.connect(test_url)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ SUCCESS! Connected to: {version[0][:50]}...")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        return False

def main():
    """Test both hostnames"""
    print("🎯 PostgreSQL Hostname Connection Test")
    print("=" * 50)
    
    # Test original hostname from environment
    original_url = os.getenv("DATABASE_URL", "")
    print(f"📋 Current DATABASE_URL: {original_url[:60]}...")
    
    # Test old hostname
    old_success = test_hostname("postgres-wqzl", "Old hostname (postgres-wqzl)")
    
    # Test new hostname
    new_success = test_hostname("postgres-sql", "New hostname (postgres-sql)")
    
    if old_success:
        print("\n✅ Old hostname still works - DATABASE_URL hasn't updated yet")
        return 0
    elif new_success:
        print("\n✅ New hostname works - Environment variable needs to be updated")
        return 0
    else:
        print("\n❌ Neither hostname works - Check PostgreSQL service status")
        return 1

if __name__ == "__main__":
    sys.exit(main())