# RevenueCat Webhook Setup Guide

## Overview
This guide explains how to configure RevenueCat webhooks to automatically grant tokens to Pro subscribers.

## Current Status
✅ Backend webhook endpoint deployed: `/api/webhooks/revenuecat`  
✅ Health check endpoint available: `/api/webhooks/revenuecat/health`  
✅ Webhook secret configured in Railway environment  
✅ Product IDs configured: `pro_monthly`, `pro_annual`  
❌ RevenueCat not sending webhooks (needs configuration)  

## RevenueCat Dashboard Configuration

### 1. Access RevenueCat Dashboard
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Select your project: "Two Truths and a Lie"
3. Navigate to **Project Settings** → **Webhooks**

### 2. Add Webhook URL
1. Click **Add webhook URL**
2. Set URL to: `https://2truths-1lie-production.up.railway.app/api/webhooks/revenuecat`
3. Set webhook secret (should match `REVENUECAT_WEBHOOK_SECRET` in Railway)

### 3. Configure Events
Enable the following webhook events:
- ✅ **INITIAL_PURCHASE** - When user first subscribes
- ✅ **RENEWAL** - When subscription renews
- ⚠️ **CANCELLATION** (optional) - For future token revocation
- ⚠️ **EXPIRATION** (optional) - For future token cleanup

### 4. Test Webhook
1. Use RevenueCat's webhook test feature in the dashboard
2. Or use our testing tool: `python tools/test_revenuecat_webhook.py`

## Environment Variables

Ensure these are set in Railway:
```bash
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

## Testing the Integration

### Option 1: Manual Test (Recommended)
```bash
# Set your webhook secret
export REVENUECAT_WEBHOOK_SECRET="your_secret_from_revenuecat"

# Run the test script
cd /path/to/2Truths-1Lie
python tools/test_revenuecat_webhook.py
```

### Option 2: RevenueCat Dashboard Test
1. In RevenueCat dashboard, go to Webhooks section
2. Click "Test" next to your webhook URL
3. Send a test INITIAL_PURCHASE event

### Option 3: Real Purchase Test
1. Make a test purchase in your app
2. Check Railway logs for webhook activity
3. Verify token balance increased

## Debugging Webhook Issues

### Check Webhook Health
```bash
curl https://2truths-1lie-production.up.railway.app/api/webhooks/revenuecat/health
```

Expected response:
```json
{
  "status": "healthy",
  "webhook_secret_configured": true,
  "supported_products": ["pro_monthly", "pro_annual"],
  "tokens_per_subscription": 10
}
```

### Common Issues & Solutions

#### 1. No Webhook Calls Received
- ❌ **Cause**: Webhook URL not configured in RevenueCat
- ✅ **Solution**: Add webhook URL in RevenueCat dashboard

#### 2. Signature Verification Failed
- ❌ **Cause**: Webhook secret mismatch
- ✅ **Solution**: Ensure `REVENUECAT_WEBHOOK_SECRET` matches RevenueCat dashboard

#### 3. Wrong Product ID
- ❌ **Cause**: Product ID doesn't match configured IDs
- ✅ **Solution**: Verify product IDs in RevenueCat match our configuration

#### 4. User Not Found
- ❌ **Cause**: RevenueCat user ID doesn't match database user
- ✅ **Solution**: Ensure user sync between RevenueCat and database

## Expected Workflow

1. **User subscribes** in mobile app
2. **RevenueCat processes** the subscription
3. **RevenueCat sends webhook** to our backend
4. **Backend verifies** signature and processes event
5. **TokenService grants** 10 tokens to user
6. **User sees increased** token balance

## Monitoring

Check Railway logs for webhook activity:
- `🎯 RevenueCat webhook received` - Webhook call received
- `✅ Webhook signature verified successfully` - Signature OK  
- `💰 Processing purchase/renewal event` - Processing subscription
- `✅ Successfully granted 10 tokens to user` - Success!

## Next Steps

1. **Configure webhook URL** in RevenueCat dashboard
2. **Test webhook** using provided tools
3. **Monitor logs** during test purchases
4. **Verify token grants** work correctly

## Support

If issues persist:
1. Check RevenueCat webhook logs in dashboard
2. Review Railway deployment logs
3. Test webhook endpoint manually
4. Verify environment variables are set correctly