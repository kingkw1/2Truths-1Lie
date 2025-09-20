# RevenueCat Configuration Guide

## 🔑 Setting Up API Keys

### **Local Development**

1. **Copy the template**: Use the `.env` file in the mobile directory
2. **Get your API keys** from RevenueCat Dashboard:
   - Go to [RevenueCat Dashboard](https://app.revenuecat.com)
   - Navigate to **Projects** > **Your Project** > **Apps**
   - Copy the **API Key** for each platform:
     - **iOS**: Copy the API key from your iOS app configuration
     - **Android**: Copy the API key from your Android app configuration

3. **Update `.env` file**:
   ```env
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxxxxxxxxxxxxxxxxxxxx
   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxxxxxxxxxxxxxxx
   ```

### **Production Builds (EAS)**

For production builds, set environment variables in EAS:

```bash
# Set iOS API Key
eas secret:create --scope project --name REVENUECAT_IOS_API_KEY --value "appl_xxxxxxxxxxxxxxxxxxxxx"

# Set Android API Key  
eas secret:create --scope project --name REVENUECAT_ANDROID_API_KEY --value "goog_xxxxxxxxxxxxxxxxxxxxx"
```

### **Environment Variables Reference**

| Variable | Description | Platform | Required |
|----------|-------------|----------|----------|
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat iOS API Key | iOS | ✅ |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Android API Key | Android | ✅ |

## 🔒 Security Notes

- **Never commit** actual API keys to version control
- API keys are **public** in client apps (use RevenueCat's client-side keys)
- Use **different keys** for development/staging vs production
- Monitor usage in RevenueCat Dashboard

## 🚀 Testing Configuration

Run the app and check logs for:
- ✅ `RevenueCat configured for iOS` 
- ✅ `RevenueCat configured for Android`
- ❌ Error messages indicating missing keys

## 📱 Platform-Specific Notes

### iOS
- Use the **App Store** API key from RevenueCat
- Starts with `appl_`

### Android  
- Use the **Google Play** API key from RevenueCat
- Starts with `goog_`