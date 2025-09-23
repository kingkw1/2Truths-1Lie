# RevenueCat Webhook Configuration - URGENT

## 🚨 Current Issue
Your token purchase went through RevenueCat successfully but your backend doesn't know about it because **no webhook is configured**.

## 📊 Purchase Evidence (from your logs):
- ✅ Purchase completed: Order `GPA.3391-4886-9299-61167`
- ✅ RevenueCat API: `POST /v1/receipts 200` (success)
- ❌ Backend never notified (no webhook configured)

## 🛠️ Fix Steps

### Step 1: Configure Webhook in RevenueCat Dashboard

1. **Go to RevenueCat Dashboard** → Your Project
2. **Navigate to**: **Integrations** → **Webhooks**
3. **Click**: **Add Webhook**
4. **Set Webhook URL**: 
   ```
   https://2truths-1lie-production.up.railway.app/api/v1/tokens/webhook/revenuecat
   ```
5. **Select Events**:
   - ✅ `INITIAL_PURCHASE`
   - ✅ `NON_RENEWING_PURCHASE` 
   - ✅ `RENEWAL` (optional for subscriptions)
6. **Click Save**

### Step 2: Test Webhook (Optional)
RevenueCat should have a "Test Webhook" button - use it to verify the connection.

## 🔍 Expected Behavior After Fix

When you make another token purchase:

1. **RevenueCat processes purchase** ✅ (already working)
2. **RevenueCat sends webhook** → Your backend 
3. **Backend adds tokens** to user account
4. **App shows updated balance** 

## 🎯 Product Mapping (Already Configured in Backend)

Your backend is ready with these mappings:
```python
PRODUCT_TOKEN_MAP = {
    "token_pack_small": 5,     # $1.99 → 5 tokens
    "token_pack_large": 25,    # $7.99 → 25 tokens
}
```

## ⚠️ Additional Issue: Anonymous User

Your app is using anonymous RevenueCat ID: `$RCAnonymousID:b402d8113ac342fe8de82f3701be9a4d`

This user doesn't exist in your backend database, causing 500 errors.

**Options:**
1. **Login with existing user** (like `fake2@gmail.com`) 
2. **Register new user** in your app
3. **Modify backend** to auto-create users from webhook events

## 🚀 Quick Test After Webhook Setup

1. Configure webhook (Step 1 above)
2. Login to your app with `fake2@gmail.com` / `test123`
3. Make another token purchase
4. Check if tokens appear in balance

The webhook will automatically create the purchase event and add tokens to the user's balance!