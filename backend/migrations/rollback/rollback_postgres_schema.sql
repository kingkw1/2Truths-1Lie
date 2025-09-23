-- PostgreSQL Schema Rollback Script
-- ===================================
-- 
-- This script removes all PostgreSQL objects created during migration
-- WARNING: This will delete ALL data in the PostgreSQL database
-- 
-- Usage: psql -d your_database -f rollback_postgres_schema.sql

BEGIN;

-- Disable foreign key checks to allow dropping in any order
SET session_replication_role = replica;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;

-- Drop statistics
DROP STATISTICS IF EXISTS stat_challenges_creator_status;
DROP STATISTICS IF EXISTS stat_guesses_challenge_correct;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS migration_history CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS token_transactions CASCADE;
DROP TABLE IF EXISTS token_balances CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;
DROP TABLE IF EXISTS guesses CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop extensions (be careful - other applications might use these)
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

COMMIT;

-- Log completion
\echo 'PostgreSQL schema rollback completed'
\echo 'All tables, functions, triggers, and statistics have been removed'
\echo 'Extensions uuid-ossp and pg_trgm were NOT removed for safety'