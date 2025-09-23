# RevenueCat Token Products Setup Guide

## 🎯 Current Issue
Your StoreScreen shows subscription packages but no token purchasing options. This is because the token pack products are not configured in your RevenueCat dashboard yet.

## 🔍 Debug Information
Based on your code, you're looking for these token products:
- `token_pack_small` - 5 tokens
- `token_pack_medium` - 500 tokens  
- `token_pack_large` - 25 tokens

## 🛠️ Setup Steps

### 1. Access RevenueCat Dashboard
- Go to [RevenueCat Dashboard](https://app.revenuecat.com)
- Navigate to your project
- Go to **Products** section

### 2. Create Token Pack Products

#### Product 1: Small Token Pack
- **Product ID**: `token_pack_small`
- **Type**: Non-Consumable or Consumable (your choice)
- **Price**: $0.99 (or your preferred price)
- **Title**: "5 Tokens"
- **Description**: "Get 5 tokens to play more challenges"

#### Product 2: Medium Token Pack
- **Product ID**: `token_pack_medium`
- **Type**: Non-Consumable or Consumable
- **Price**: $4.99 (or your preferred price)
- **Title**: "500 Tokens"
- **Description**: "Great value - 500 tokens for extended play"

#### Product 3: Large Token Pack  
- **Product ID**: `token_pack_large`
- **Type**: Non-Consumable or Consumable
- **Price**: $9.99 (or your preferred price)
- **Title**: "25 Tokens"
- **Description**: "Most popular - 25 tokens pack"

### 3. Create or Update Offering
- Go to **Offerings** in RevenueCat dashboard
- Either create a new offering or edit your existing "current" offering
- Add all 5 products to this offering:
  - `pro_monthly` (subscription)
  - `pro_annual` (subscription)
  - `token_pack_small` (token pack)
  - `token_pack_medium` (token pack)
  - `token_pack_large` (token pack)

### 4. Verify Configuration
After setup, your app's debug logs should show:
```
🔍 DEBUG: Available packages count: 5
🔍 DEBUG: Package 1: { identifier: 'pro_monthly', productType: 'SUBSCRIPTION', ... }
🔍 DEBUG: Package 2: { identifier: 'pro_annual', productType: 'SUBSCRIPTION', ... }
🔍 DEBUG: Package 3: { identifier: 'token_pack_small', productType: 'CONSUMABLE', ... }
🔍 DEBUG: Package 4: { identifier: 'token_pack_medium', productType: 'CONSUMABLE', ... }
🔍 DEBUG: Package 5: { identifier: 'token_pack_large', productType: 'CONSUMABLE', ... }
```

## 🔧 Alternative Quick Test

If you want to test immediately without setting up all products:

1. **Temporarily modify the filtering logic** to show ANY non-subscription products
2. **Check what products you DO have** in RevenueCat
3. **Update your product identifiers** to match what's actually available

## 🎮 Token Values in Backend

Your backend (`backend/api/token_endpoints.py`) is already configured with:
```python
PRODUCT_TOKEN_MAP = {
    "pro_monthly": 500,       # Subscription
    "pro_annual": 6000,       # Subscription  
    "token_pack_small": 5,    # ← Need this in RevenueCat
    "token_pack_medium": 500, # ← Need this in RevenueCat
    "token_pack_large": 25,   # ← Need this in RevenueCat
}
```

## ✅ Expected Result
Once configured, your StoreScreen will show:
1. **Hero Section**: Subscription packages with benefits
2. **À La Carte Section**: Token purchasing options with per-unit pricing
3. **Visual badges**: "Best Value" and "Most Popular" badges

## 🚨 Important Notes
- Products may take a few minutes to propagate after creation
- For testing, use Google Play Console sandbox environment
- RevenueCat webhook will automatically add tokens to user balance upon purchase