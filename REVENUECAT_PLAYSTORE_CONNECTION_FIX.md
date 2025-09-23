# RevenueCat/Google Play Console Integration Fix

## 🚨 Current Issue
**Store status warning**: "Could not check -- Connection issue. Make sure the Service Account Credentials JSON is configured properly."

## 🔧 Fix Steps

### Step 1: Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Play Console project
3. **IAM & Admin** → **Service Accounts**
4. **Create Service Account**:
   - Name: "RevenueCat Integration"
   - Skip role assignment initially
   - Click **Done**

### Step 2: Service Account Key
1. Click on the created service account
2. **Keys** tab → **Add Key** → **Create New Key**
3. Choose **JSON** format
4. **Download** the JSON file (keep secure!)

### Step 3: Google Play Console Permissions
1. [Google Play Console](https://play.google.com/console)
2. **Setup** → **API access**
3. Find your service account → **Grant Access**
4. Grant permissions:
   - ✅ View app information and download bulk reports
   - ✅ View financial data, orders, and cancellation survey responses
   - ✅ Manage orders and subscriptions

### Step 4: RevenueCat Configuration
1. RevenueCat dashboard → **Project Settings** → **Service Credentials**
2. **Google Play Console** section
3. Upload the JSON file
4. **Save**

### Step 5: Add Products to Offering (CRITICAL!)
1. RevenueCat → **Offerings**
2. Edit **"current"** offering
3. Add your products:
   - `pro_monthly`
   - `pro_annual` 
   - `token_pack_small` ← **THIS IS MISSING!**
4. Ensure offering is marked as **current**

## 🎯 Expected Result
- Store status warning disappears
- `token_pack_small` appears in your app's offerings
- Token purchasing section becomes visible

## 📱 Test Verification
After setup, your app debug logs should show:
```
🔍 DEBUG: Available packages count: 3 (or more)
🔍 DEBUG: Package X: { identifier: 'token_pack_small', productType: 'CONSUMABLE', ... }
```

## ⚠️ Important Notes
- **Service account JSON contains private keys** - never commit to Git
- Changes may take **5-10 minutes** to propagate
- Test with **Google Play Console sandbox environment**
- Your `token_pack_small` product is already created in Play Console ($1.99) ✅
- The issue is the **RevenueCat ↔ Play Console connection** and **missing offering association**