import os
import pytest
import sys
import sqlite3
from pathlib import Path

# Add the backend directory to the Python path to allow for absolute imports
backend_dir = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(backend_dir))

from config import settings
from migrations.migration_manager import MigrationManager

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Pytest fixture to set up a clean test database for the session.

    This fixture runs once per test session. It performs the following steps:
    1. Checks if the environment is set to "TESTING". If not, it skips the setup.
    2. Constructs the path to the test database file (`test.db`).
    3. Deletes the old test database file if it exists, ensuring a clean slate.
    4. Programmatically runs the database migrations to create a fresh schema
       using the MigrationManager.
    5. Yields control to the test session.
    """
    # Only run this fixture if in the testing environment
    if os.getenv("TESTING") != "true":
        yield
        return

    db_path = settings.BACKEND_DIR / "test.db"

    # 1. Delete the old test database file if it exists
    if db_path.exists():
        try:
            os.remove(db_path)
            print(f"Removed old test database: {db_path}")
        except OSError as e:
            pytest.fail(f"Could not remove test database: {e}")

    # 2. Run database migrations to create a fresh schema
    try:
        print("Initializing new test database and creating schema...")
        
        # Initialize the database service to create the schema
        from services.database_service import DatabaseService
        db_service = DatabaseService()
        db_service._init_sqlite_database()

        print("Test database schema created successfully.")
    except Exception as e:
        print(f"Error creating test database schema: {e}")
        pytest.fail(f"Test database schema creation failed: {e}")

    yield