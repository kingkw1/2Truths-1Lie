# Testing Tools

This directory contains scripts for testing premium user functionality and rate limiting.

## Scripts

### `test_premium_fix.py`
Tests the premium user rate limiting fix by attempting to:
- Login as a premium user
- Check user profile via auth validation
- Create a challenge to verify rate limiting bypass

**Usage:**
```bash
python tools/testing/test_premium_fix.py
```

### `test_premium_bypass.py`
Comprehensive test for premium user rate limiting bypass functionality.
Tests that premium users can create challenges without hitting rate limits.

**Usage:**
```bash
python tools/testing/test_premium_bypass.py
```

## Purpose
These scripts were created to verify the fix for issue where premium users were still hitting rate limits due to stale JWT tokens. The fix ensures the API checks the current database premium status instead of relying on JWT token data.

## Notes
- These scripts test against the production API at `https://2truths-1lie-production.up.railway.app`
- They can be used for regression testing when making changes to authentication or rate limiting
- Update the `BASE_URL` constant if testing against different environments