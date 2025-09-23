# Database Migration Guide: SQLite to PostgreSQL

## Overview

This migration system provides comprehensive tools for converting your 2Truths-1Lie application from SQLite to PostgreSQL with full data preservation, validation, and rollback capabilities.

## Migration Architecture

### Key Components

1. **Migration Manager** (`migration_manager.py`) - Core orchestration
2. **Data Migrator** (`data/data_migrator.py`) - Data transformation and transfer
3. **Schema Definitions** (`schema/postgres_schema.py`) - PostgreSQL schema with optimizations
4. **CLI Tool** (`migrate.py`) - Command-line interface
5. **Rollback System** (`rollback/`) - Comprehensive rollback support

### Migration Features

- ✅ **Complete Schema Conversion**: SQLite → PostgreSQL with type optimization
- ✅ **Data Integrity**: Comprehensive validation and constraint preservation
- ✅ **PostgreSQL Optimizations**: UUIDs, JSONB, INET types, GIN indexes
- ✅ **Rollback Support**: Safe rollback with backup creation
- ✅ **Batch Processing**: Efficient large dataset handling
- ✅ **Validation**: Pre/post migration data validation
- ✅ **Logging**: Comprehensive migration tracking

## Schema Differences: SQLite vs PostgreSQL

### Data Type Conversions

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` | Auto-incrementing integers |
| `TEXT` | `VARCHAR(255)` or `TEXT` | Length-constrained where appropriate |
| `TEXT` (JSON) | `JSONB` | Native JSON with indexing |
| `TEXT` (UUID) | `UUID` | Native UUID type with functions |
| `TEXT` (IP Address) | `INET` | Native IP address type |
| `BOOLEAN` | `BOOLEAN` | Native boolean type |

### Enhanced Features in PostgreSQL

1. **UUID Generation**: Uses `gen_random_uuid()` for security
2. **JSONB Support**: Native JSON with indexing for metadata/permissions
3. **INET Type**: Proper IP address validation and storage
4. **GIN Indexes**: Full-text search on names and titles
5. **Triggers**: Automatic timestamp updates
6. **Statistics**: Query optimization for common patterns
7. **Constraints**: Enhanced data validation

## Migration Process

### Prerequisites

```bash
# Install required dependencies
pip install psycopg2-binary

# Ensure PostgreSQL extensions
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### Step 1: Environment Validation

```bash
cd backend/migrations
python migrate.py validate \
  --sqlite ../app.db \
  --postgres "postgresql://user:password@localhost:5432/dbname"
```

**Checks performed:**
- SQLite database accessibility
- PostgreSQL connection and extensions
- Required permissions
- Disk space availability

### Step 2: Schema Migration

```bash
python migrate.py schema \
  --sqlite ../app.db \
  --postgres "postgresql://user:password@localhost:5432/dbname"
```

**Creates:**
- All PostgreSQL tables with optimized schema
- Indexes for performance
- Constraints for data integrity
- Triggers for automation
- Functions for maintenance

### Step 3: Data Migration

```bash
python migrate.py data \
  --sqlite ../app.db \
  --postgres "postgresql://user:password@localhost:5432/dbname"
```

**Migrates in dependency order:**
1. `users` - User accounts and authentication
2. `challenges` - Challenge data with JSON validation
3. `guesses` - User guesses and responses
4. `user_reports` - Content moderation reports
5. `token_balances` - User token balances
6. `token_transactions` - Token transaction history with UUID conversion
7. `user_sessions` - Active sessions with JSONB conversion

### Step 4: Validation

```bash
python migrate.py check \
  --sqlite ../app.db \
  --postgres "postgresql://user:password@localhost:5432/dbname"
```

**Validates:**
- Row count matching between databases
- Data integrity preservation
- Foreign key relationships
- JSON format validation

### Step 5: Full Migration (Recommended)

```bash
python migrate.py full \
  --sqlite ../app.db \
  --postgres "postgresql://user:password@localhost:5432/dbname"
```

**Performs complete migration:**
- Schema creation
- Data migration with validation
- Rollback script generation
- Migration history tracking

## Data Transformations

### JSON Field Conversions

#### Token Transactions Metadata
```sql
-- SQLite (TEXT)
metadata TEXT DEFAULT '{}'

-- PostgreSQL (JSONB)
metadata JSONB DEFAULT '{}'
```

#### User Sessions Permissions
```sql
-- SQLite (TEXT)
permissions TEXT DEFAULT '[]'

-- PostgreSQL (JSONB)  
permissions JSONB DEFAULT '[]'
```

### UUID Conversions

#### Token Transactions
```sql
-- SQLite
transaction_id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16)))

-- PostgreSQL
transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

#### User Sessions
```sql
-- SQLite
session_id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16)))

-- PostgreSQL
session_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### IP Address Handling
```sql
-- SQLite
ip_address TEXT

-- PostgreSQL
ip_address INET  -- Validates format automatically
```

## Performance Optimizations

### Enhanced Indexing Strategy

```sql
-- GIN indexes for full-text search
CREATE INDEX idx_users_name_gin ON users USING gin(name gin_trgm_ops);
CREATE INDEX idx_challenges_title_gin ON challenges USING gin(title gin_trgm_ops);

-- JSONB indexes for metadata queries
CREATE INDEX idx_token_transactions_metadata_gin ON token_transactions USING gin(metadata);

-- Partial indexes for common queries
CREATE INDEX idx_challenges_active_published 
  ON challenges(published_at DESC, view_count DESC) 
  WHERE status = 'published';

-- Composite indexes for frequent joins
CREATE INDEX idx_guesses_challenge_user ON guesses(challenge_id, user_id);
```

### Query Statistics
```sql
-- Multi-column statistics for better query planning
CREATE STATISTICS stat_challenges_creator_status 
  ON creator_id, status FROM challenges;

CREATE STATISTICS stat_guesses_challenge_correct 
  ON challenge_id, is_correct FROM guesses;
```

## Rollback Procedures

### Safety Validation

```bash
# Check rollback safety
python -c "
from rollback.rollback_manager import RollbackManager
rm = RollbackManager('postgresql://user:pass@localhost/db')
safety = rm.validate_rollback_safety()
print(f'Safe to rollback: {safety[\"safe_to_rollback\"]}')
for warning in safety['warnings']:
    print(f'Warning: {warning}')
"
```

### Create Backup Before Rollback

```bash
# Automatic backup creation
python -c "
from rollback.rollback_manager import RollbackManager
rm = RollbackManager('postgresql://user:pass@localhost/db')
backup = rm.create_backup_before_rollback()
print(f'Backup created: {backup}')
"
```

### Execute Rollback

```bash
# Safe rollback with backup
python -c "
from rollback.rollback_manager import RollbackManager
rm = RollbackManager('postgresql://user:pass@localhost/db')
result = rm.perform_safe_rollback('rollback_postgres_schema.sql')
print(f'Rollback success: {result[\"success\"]}')
"
```

### Manual Rollback
```sql
-- Execute SQL rollback script directly
psql -d your_database -f rollback/rollback_postgres_schema.sql
```

## Troubleshooting

### Common Issues

#### 1. Connection Errors
```bash
# Test PostgreSQL connection
psql "postgresql://user:password@localhost:5432/dbname" -c "SELECT version();"
```

#### 2. Extension Missing
```sql
-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

#### 3. Permission Issues
```sql
-- Grant necessary permissions
GRANT CREATE, USAGE ON SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;
```

#### 4. Large Dataset Migration
```bash
# Use verbose logging for monitoring
python migrate.py full --verbose \
  --sqlite ../app.db \
  --postgres "postgresql://user:pass@localhost/db"
```

#### 5. JSON Validation Errors
- Invalid JSON in SQLite will be replaced with defaults
- Check migration logs for data transformation warnings

### Data Validation Failures

#### Row Count Mismatches
1. Check for duplicate key violations
2. Verify constraint validation
3. Review transformation logic
4. Check for NULL constraint violations

#### Foreign Key Violations
1. Ensure parent records exist
2. Check migration order
3. Validate referential integrity

## Production Migration Checklist

### Pre-Migration
- [ ] **Backup Current Database**: Full SQLite backup
- [ ] **Test Migration**: Run on copy of production data
- [ ] **Verify Dependencies**: Check all application components
- [ ] **Resource Planning**: Ensure adequate disk space and memory
- [ ] **Downtime Planning**: Schedule maintenance window

### During Migration
- [ ] **Application Shutdown**: Stop all application processes
- [ ] **Database Connections**: Verify no active connections
- [ ] **Migration Execution**: Run full migration with verbose logging
- [ ] **Validation**: Comprehensive data validation
- [ ] **Application Testing**: Verify application functionality

### Post-Migration
- [ ] **Performance Testing**: Query performance validation
- [ ] **Application Monitoring**: Monitor for issues
- [ ] **Backup Strategy**: Implement PostgreSQL backup procedures
- [ ] **Cleanup**: Archive old SQLite database
- [ ] **Documentation**: Update connection strings and configurations

## Monitoring and Maintenance

### Migration Status Monitoring
```bash
# Check migration history
python migrate.py status --postgres "postgresql://user:pass@localhost/db"
```

### Performance Monitoring
```sql
-- Monitor query performance
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Session Cleanup
```sql
-- Manual session cleanup
SELECT cleanup_expired_sessions();

-- Check active sessions
SELECT COUNT(*) FROM user_sessions 
WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;
```

## Configuration Updates

### Application Configuration

Update your application's database configuration:

```python
# Before (SQLite)
DATABASE_URL = "sqlite:///app.db"

# After (PostgreSQL)
DATABASE_URL = "postgresql://user:password@localhost:5432/dbname"
```

### Environment Variables
```bash
# Update environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
export DATABASE_TYPE="postgresql"
```

## Support and Recovery

### Emergency Rollback
```bash
# Quick rollback (emergency)
psql -d your_database -f rollback/rollback_postgres_schema.sql
```

### Data Recovery
```bash
# Restore from backup
psql -d your_database -f postgres_backup_before_rollback_YYYYMMDD_HHMMSS.sql
```

### Migration Logs
- Migration logs are saved to `migration_YYYYMMDD_HHMMSS.log`
- Check logs for detailed error information
- Use verbose mode for maximum detail

## Summary

This migration system provides enterprise-grade database migration capabilities with:
- **Zero Data Loss**: Comprehensive validation and backup procedures
- **Performance Optimization**: PostgreSQL-specific optimizations
- **Safety**: Rollback capabilities with validation
- **Monitoring**: Complete audit trail and status reporting
- **Production Ready**: Tested procedures for live system migration

The migration preserves all data integrity while upgrading to PostgreSQL's advanced features for improved performance, scalability, and maintainability.