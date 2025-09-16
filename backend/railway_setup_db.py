#!/usr/bin/env python3
"""
Railway deployment script to set up PostgreSQL database
This script is designed to run on Railway after PostgreSQL addon is added
"""
import os
import sys
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    """Main setup function for Railway environment"""
    print("🎯 Railway PostgreSQL Database Setup")
    print("=" * 50)
    
    # Check if we're in Railway environment
    database_url = os.getenv("DATABASE_URL")
    railway_env = os.getenv("RAILWAY_ENVIRONMENT")
    
    if not database_url:
        logger.error("❌ DATABASE_URL environment variable not found")
        logger.info("📝 Make sure you've added PostgreSQL service to Railway:")
        logger.info("1. Railway Dashboard → Add Service → Database → PostgreSQL")
        logger.info("2. Wait for PostgreSQL to be ready (green status)")
        logger.info("3. Redeploy your application")
        return 1
    
    if not database_url.startswith(('postgresql://', 'postgres://')):
        logger.error(f"❌ DATABASE_URL is not PostgreSQL: {database_url[:50]}...")
        return 1
    
    logger.info(f"✅ PostgreSQL URL detected: {database_url[:50]}...")
    
    # Import and initialize database service
    try:
        # Add backend directory to path
        sys.path.append('/app')  # Railway app directory
        sys.path.append('/app/backend')  # Backend subdirectory
        
        from services.database_service import DatabaseService
        
        logger.info("🔧 Initializing PostgreSQL database...")
        db_service = DatabaseService()
        
        # Test database connection
        logger.info("🧪 Testing database connection...")
        test_result = db_service._execute_query(
            "SELECT COUNT(*) as count FROM users",
            fetch_one=True
        )
        
        logger.info("✅ PostgreSQL database setup completed!")
        logger.info("✅ All tables created successfully")
        logger.info(f"✅ Database test passed - User count: {test_result.get('count', 0)}")
        logger.info("🎯 Challenges will now persist across deployments!")
        
        return 0
        
    except Exception as e:
        logger.error(f"❌ Database setup failed: {e}")
        logger.info("💡 Common solutions:")
        logger.info("1. Ensure PostgreSQL service is running in Railway")
        logger.info("2. Wait a few minutes and try again")
        logger.info("3. Check Railway logs for detailed errors")
        return 1

if __name__ == "__main__":
    sys.exit(main())