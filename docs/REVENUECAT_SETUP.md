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

---

## 🍎 Post-iOS Configuration Checklist

### **When iOS Development is Ready (In a Few Days)**

#### **1. iOS App Store Connect Setup**
- [ ] **Create App Store Connect app** (if not already done)
- [ ] **Configure In-App Purchases** in App Store Connect:
  - Navigate to **Features** > **In-App Purchases** 
  - Create products matching your RevenueCat offerings
  - Set **Product IDs** that match your RevenueCat configuration
  - Submit for review (can take 24-48 hours)

#### **2. RevenueCat iOS Configuration**
- [ ] **Add iOS app** to RevenueCat Dashboard:
  - Go to **Projects** > **Your Project** > **Apps**
  - Click **+ New App** > **iOS**
  - Enter your **Bundle ID** (from `app.json`)
  - Upload **App Store Connect API Key** or connect manually
- [ ] **Get iOS API Key**:
  - Copy the generated iOS API key (starts with `appl_`)
  - Update your `.env` file with the actual key

#### **3. Local Development Testing**
- [ ] **Update `.env` file**:
  ```env
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_[your_actual_ios_key]
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_[your_actual_android_key]
  ```
- [ ] **Test on iOS Simulator**:
  ```bash
  cd mobile
  npx expo run:ios
  ```
- [ ] **Verify logs show**: `RevenueCat configured for iOS`
- [ ] **Test purchase flows** (will use sandbox environment)

#### **4. iOS Device Testing**
- [ ] **Create development build**:
  ```bash
  eas build --platform ios --profile development
  ```
- [ ] **Install on device** and test with **sandbox Apple ID**
- [ ] **Test restore purchases** functionality
- [ ] **Test trial period** behavior (if applicable)

#### **5. Production Deployment Setup**
- [ ] **Set EAS secrets** for production:
  ```bash
  # Update with your actual iOS API key
  eas secret:create --scope project --name REVENUECAT_IOS_API_KEY --value "appl_[your_actual_ios_key]"
  
  # Verify Android key is still set
  eas secret:list
  ```
- [ ] **Create production builds**:
  ```bash
  # iOS App Store build
  eas build --platform ios --profile production
  
  # Android Play Store build  
  eas build --platform android --profile production
  ```

#### **6. App Store Submission**
- [ ] **Upload iOS build** to App Store Connect
- [ ] **Configure App Store listing**:
  - Screenshots showing premium features
  - Description mentioning in-app purchases
  - Privacy policy URL (required for subscriptions)
- [ ] **Submit for review** (typically 24-48 hours)

#### **7. Cross-Platform Production Testing**
- [ ] **Test both platforms** in production environment
- [ ] **Verify subscription sync** across devices
- [ ] **Test restore purchases** on both platforms
- [ ] **Monitor RevenueCat Dashboard** for incoming transactions

### **🚨 Important Reminders**

#### **App Store Connect Requirements**
- **Sandbox Testing**: Use test Apple IDs for development testing
- **Review Process**: In-app purchases need separate review (can be done in parallel)
- **Privacy Policy**: Required for apps with subscriptions
- **Age Rating**: Must accommodate purchase content

#### **RevenueCat Dashboard Monitoring**
- **Customer View**: Check customer purchase history
- **Analytics**: Monitor conversion rates and revenue
- **Webhooks**: Set up for real-time purchase notifications
- **Charts**: Track trial conversions and churn

#### **Common iOS-Specific Issues**
- **StoreKit Testing**: Ensure you're using sandbox environment for testing
- **Receipt Validation**: RevenueCat handles this automatically
- **Family Sharing**: May affect subscription behavior
- **App Review**: Provide test account if app requires authentication

### **🔧 Troubleshooting iOS Setup**

#### **If iOS API Key Not Working**
1. Verify Bundle ID matches between App Store Connect and RevenueCat
2. Check App Store Connect API key permissions
3. Ensure In-App Purchase products are approved
4. Restart app after changing API keys

#### **If Purchases Not Working on iOS**
1. Check you're using sandbox Apple ID for testing
2. Verify product IDs match between App Store Connect and RevenueCat
3. Check iOS device date/time settings
4. Review RevenueCat Dashboard for error logs

### **📋 Final Pre-Launch Checklist**
- [ ] Both iOS and Android API keys configured in EAS secrets
- [ ] Both platforms tested with production builds
- [ ] In-app purchases working on both platforms
- [ ] Restore purchases working on both platforms
- [ ] RevenueCat Dashboard showing transactions from both platforms
- [ ] App Store and Play Store listings ready
- [ ] Privacy policy updated with purchase information

---

## 📚 Additional Resources

- [RevenueCat iOS Integration Guide](https://docs.revenuecat.com/docs/ios)
- [App Store Connect In-App Purchase Guide](https://developer.apple.com/app-store-connect/help/#/devb57be10e7)
- [RevenueCat Testing Guide](https://docs.revenuecat.com/docs/sandbox)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)