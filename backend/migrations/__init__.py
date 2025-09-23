"""
Database Migration System
========================

This directory contains database migration files for converting from SQLite to PostgreSQL
and handling schema evolution.

Migration Structure:
- 001_initial_schema.py: Initial PostgreSQL schema creation
- 002_sqlite_to_postgres_migration.py: SQLite to PostgreSQL data migration
- migration_manager.py: Migration orchestration and rollback support

Migration Naming Convention:
- {version_number}_{description}.py
- Version numbers are zero-padded (001, 002, etc.)
- Use descriptive names for the migration purpose

Files:
- __init__.py: This file
- migration_manager.py: Core migration orchestration
- schema/: PostgreSQL schema definitions
- data/: Data migration scripts
- rollback/: Rollback scripts for each migration
"""

__version__ = "1.0.0"
__all__ = ["MigrationManager", "BaseMigration"]