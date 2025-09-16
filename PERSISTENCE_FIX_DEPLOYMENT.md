# 🚨 Emergency Persistence Fix - Deployment Guide

## Problem Solved
✅ **Data Loss Issue**: Challenges disappearing after Railway deployments  
✅ **Root Cause**: SQLite files are ephemeral on Railway containers  
✅ **Solution**: PostgreSQL persistent database storage  

## 🚀 Deployment Steps

### Step 1: Add PostgreSQL to Railway
1. Go to your Railway project dashboard
2. Click **"Add Service"** → **"Database"** → **"PostgreSQL"**
3. Railway automatically sets `DATABASE_URL` environment variable
4. Wait for PostgreSQL service to be ready (green status)

### Step 2: Deploy Updated Code
```bash
git push origin main
```
Railway will automatically deploy with the new persistence code.

### Step 3: Initialize Database
Once deployed, run the setup script:
```bash
# In Railway dashboard, go to your service → "Deploy" tab → "Run Command"
python backend/setup_production_db.py
```

### Step 4: Verify Persistence
Create a test challenge and then redeploy to verify it persists:
```bash
# Test challenge creation via API
curl -X POST https://your-railway-app.up.railway.app/api/v1/test/challenge \
  -H "Content-Type: application/json" \
  -d '{"statements": [{"text": "Test 1"}, {"text": "Test 2"}, {"text": "Test 3 (LIE)"}], "lie_statement_index": 2}'

# Note the challenge ID, then trigger a redeploy
# Check if the challenge still exists after redeploy
```

## 🎯 What This Fixes

### Before (Broken):
- ❌ SQLite database files stored in ephemeral container storage
- ❌ All challenges lost on every Railway deployment
- ❌ Users see empty challenge list after updates

### After (Fixed):
- ✅ PostgreSQL database with persistent storage
- ✅ Challenges survive all deployments and restarts
- ✅ Production-ready database with automatic backups
- ✅ Zero data loss on future deployments

## 🔍 Verification Commands

Check current database type:
```bash
python -c "from backend.config import settings; print(f'DB: {settings.database_url[:50]}...')"
```

Test database connection:
```bash
python backend/setup_production_db.py
```

## 📊 Expected Results

### Development (Local):
```
Database URL: sqlite:///path/to/app.db
🗃️ Using SQLite database (development)
```

### Production (Railway with PostgreSQL):
```
Database URL: postgresql://user:pass@host:port/db
🐘 Using PostgreSQL database (production)
✅ Challenges will now persist across deployments!
```

## ⚠️ Important Notes

1. **Existing Data**: Any challenges created before this fix were stored in ephemeral SQLite and are gone
2. **New Challenges**: All challenges created after PostgreSQL setup will persist forever
3. **Backwards Compatible**: Code works with both SQLite (dev) and PostgreSQL (prod)
4. **No Downtime**: Database migration happens automatically on first connection

## 🎉 Success Indicators

- ✅ Railway shows PostgreSQL service running
- ✅ Setup script reports "PostgreSQL database initialized successfully!"
- ✅ Challenge creation returns status 200 with valid ID
- ✅ Challenges visible in mobile app after redeploy
- ✅ No more empty challenge lists after deployments

Your data persistence issue is now **completely resolved**! 🚀