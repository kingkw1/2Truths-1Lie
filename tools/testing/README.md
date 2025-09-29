# Testing Tools

This directory contains tools for testing and validating the 2Truths-1Lie application functionality.

## RevenueCat Integration Testing

### `revenuecat_webhook_test.py`
Tests the RevenueCat webhook integration by simulating webhook calls.

**Purpose:**
- Validate webhook signature verification
- Test token granting functionality
- Debug webhook integration issues
- Verify user lookup and mapping

**Usage:**
```bash
export REVENUECAT_WEBHOOK_SECRET="your_secret_here"
python tools/testing/revenuecat_webhook_test.py
```

**What it tests:**
- ✅ Webhook endpoint availability
- ✅ HMAC signature verification
- ✅ User email-to-ID mapping
- ✅ Token granting (10 tokens per subscription)
- ✅ Database transaction handling

## User Management Testing

### `create_test_user.py`
Creates test users with known credentials for testing purposes.

**Purpose:**
- Create consistent test accounts
- Provide known credentials for QA testing
- Support automated testing scenarios

**Usage:**
```bash
python tools/testing/create_test_user.py
```

**Creates:**
- Email: `revenuecat_test@example.com`
- Password: `TestPassword123!`
- Username: `revenuecat_test_user`

## Legacy Testing Scripts

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