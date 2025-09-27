# Admin Tools

This directory contains administrative scripts for managing user accounts and database operations.

## Scripts

### `set_premium_production.py`
Railway-specific script to set premium status for users in the production database.

**Usage:**
```bash
railway run python tools/admin/set_premium_production.py
```

**Features:**
- Finds user by ID 10 (or by email fallback)
- Sets premium status to `true`
- Verifies the change
- Includes debugging for user lookup

### `set_user_premium.py`
General-purpose script to set premium status with enhanced debugging.

**Usage:**
```bash
railway run python tools/admin/set_user_premium.py
```

**Features:**
- Direct database connection via Railway
- User lookup by ID and email
- Lists available users for debugging
- Error handling for connection issues

## Purpose
These scripts were created to manage premium user status in production when the normal admin UI is not available or when bulk operations are needed.

## Security Notes
- These scripts require Railway CLI access to production database
- They should only be run by authorized administrators
- Always verify changes after running
- Consider removing or securing these scripts in production environments

## Usage Context
Originally created to fix an issue where premium users were hitting rate limits due to stale JWT tokens. The fix required updating the database premium status, which these scripts facilitate.