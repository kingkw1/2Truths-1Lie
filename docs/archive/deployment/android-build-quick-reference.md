<!-- ARCHIVED - DO NOT USE - Moved to archive September 10, 2025 -->
<!-- This file is historical documentation only. See main docs/ folder for current information -->

# Android Build Quick Reference

## 🚀 Pre-EAS Testing Commands (Save Credits!)

```bash
# 1. Test dependencies
yarn install

# 2. Test prebuild (MUST work before EAS)
npx expo prebuild --platform android

# 3. Test local Android build
cd android && ./gradlew bundleRelease

# 4. Verify outputs exist
ls -lh app/build/outputs/bundle/release/app-release.aab
```

## ✅ Successful EAS Build Command

```bash
# ALWAYS use production profile for Play Store
npx eas build --platform android --profile production
```

## 🔧 Key Configuration Files

### `eas.json`
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "autoIncrement": true
    }
  }
}
```

### `app.json`
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourapp"
    }
  }
}
```

## 🔑 Verify Release Signing

```bash
# Check credentials are release (not debug)
npx eas credentials

# Look for:
# - Type: JKS
# - Proper SHA256 fingerprint
# - Recent update timestamp
```

## 📱 Google Play Upload

1. **Download AAB** from EAS build URL
2. **Upload to Play Console** (Closed Testing)
3. **Verify** no "debug mode" errors

## 💡 Troubleshooting

| Problem | Solution |
|---------|----------|
| "expo command not found" | `yarn add expo` then use `npx expo` |
| EAS prebuild fails | Test `npx expo prebuild` locally first |
| Debug signing error | Use `--profile production` |
| Build credits wasted | Always validate locally first |

## 📋 Release Checklist

- [ ] Local prebuild works: `npx expo prebuild --platform android`
- [ ] Local build works: `cd android && ./gradlew bundleRelease`
- [ ] Using production profile: `--profile production`
- [ ] Credentials are release keystore (not debug)
- [ ] Package name matches Play Console
- [ ] Version incremented
