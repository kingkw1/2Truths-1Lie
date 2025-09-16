#!/usr/bin/env python3
"""
Script to set up PostgreSQL database on Railway for persistent storage
Run this after deploying to Railway with PostgreSQL addon
"""
import os
import sys
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from services.database_service import DatabaseService
from config import settings

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_postgresql_connection():
    """Check if PostgreSQL connection is available"""
    database_url = settings.database_url
    
    if not database_url.startswith(('postgresql://', 'postgres://')):
        logger.error("❌ DATABASE_URL is not set or not PostgreSQL")
        logger.info("📝 To fix this:")
        logger.info("1. Go to your Railway project dashboard")
        logger.info("2. Click 'Add Service' → 'Database' → 'PostgreSQL'")
        logger.info("3. Railway will automatically set DATABASE_URL environment variable")
        logger.info("4. Redeploy your application")
        return False
    
    logger.info(f"✅ PostgreSQL URL detected: {database_url[:50]}...")
    return True

def setup_railway_postgres():
    """Set up PostgreSQL database on Railway"""
    logger.info("🚀 Setting up persistent PostgreSQL database on Railway...")
    
    # Check if DATABASE_URL is available (Railway PostgreSQL addon)
    if not check_postgresql_connection():
        return False
    
    try:
        # Initialize the database service (will create tables)
        logger.info("🔧 Initializing database service...")
        db_service = DatabaseService()
        
        logger.info("✅ PostgreSQL database initialized successfully!")
        logger.info("✅ All tables created")
        logger.info("🎯 Challenges will now persist across deployments!")
        
        # Test the connection by creating a test query
        logger.info("🧪 Testing database connection...")
        test_result = db_service._execute_query(
            "SELECT COUNT(*) as count FROM users",
            fetch_one=True
        )
        logger.info(f"✅ Database test successful! Current user count: {test_result['count']}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error setting up database: {e}")
        logger.error("💡 This might be a temporary connection issue. Try running this script again in a few minutes.")
        return False

def check_current_database():
    """Check what database is currently being used"""
    database_url = settings.database_url
    
    if database_url.startswith(('postgresql://', 'postgres://')):
        logger.info("🐘 Using PostgreSQL database (production)")
    else:
        logger.info("🗃️  Using SQLite database (development)")
    
    logger.info(f"📍 Database URL: {database_url[:50]}...")

def main():
    """Main setup function"""
    print("🎯 2Truths-1Lie Database Setup for Railway")
    print("=" * 50)
    
    # Show current configuration
    check_current_database()
    print()
    
    # Set up PostgreSQL if available
    success = setup_railway_postgres()
    
    print()
    print("=" * 50)
    if success:
        print("🎉 Database setup completed successfully!")
        print("✅ Your challenges will now persist across deployments")
        print("🚀 Deploy your application to start using persistent storage")
    else:
        print("❌ Database setup failed")
        print("📖 Check the instructions above to add PostgreSQL to Railway")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())