# Development Setup - Optimized for Speed 🚀

## Overview
This project supports both **web** and **mobile** development with a **sync-based shared code architecture** to maximize development speed while maintaining platform-specific optimizations.

## Quick Start Commands

### Web Development
```bash
npm start                 # Start web development server
# Open http://localhost:3000
```

### Mobile Development (Manual Sync)
```bash
npm run sync              # Sync shared code to mobile project
npm run mobile            # Start Expo development server (offline mode)
# Scan QR code with Expo Go app on your phone
```

### Mobile Development (Auto-sync)
```bash
npm run dev:mobile        # Auto-sync + start mobile server (offline mode)
# Scan QR code with Expo Go app on your phone
```

### Both Platforms
```bash
npm start &               # Start web in background
npm run dev:mobile        # Sync and start mobile (foreground)
```

## Project Architecture

### 📁 **Directory Structure**
```
2Truths-1Lie/                  # Main web project
├── src/
│   ├── types/                 # 🔄 Shared TypeScript interfaces
│   ├── store/                 # 🔄 Shared Redux store & slices
│   ├── components/            # 🌐 Web-specific React components
│   └── hooks/                 # 🌐 Web-specific hooks
│
└── mobile/                    # Separate mobile project
    ├── src/
    │   ├── types/             # 🔄 Synced from main project
    │   ├── store/             # 🔄 Synced from main project
    │   ├── screens/           # 📱 Mobile-specific screens
    │   ├── components/        # 📱 Mobile-specific components
    │   └── shared/            # 🔄 Selected shared components
    └── package.json           # Independent mobile dependencies
```

### 🔄 **Sync-Based Code Sharing**

**✅ Shared Between Web & Mobile:**
- `src/types/` - All TypeScript interfaces  
- `src/store/` - Redux store and slices
- Selected components (AnimatedFeedback, etc.)

**📱 Mobile-Specific:**
- `2Truths-1Lie-mobile/src/screens/` - React Native screens
- `2Truths-1Lie-mobile/src/components/` - Mobile-specific components
- Expo configuration and mobile-optimized store setup

**🌐 Web-Specific:**
- `src/components/` - Web React components
- `src/hooks/` - Web-specific hooks  
- React Scripts configuration

## Sync Workflow

### Manual Sync Process
```bash
npm run sync              # Run sync script manually
# - Copies src/types/ → mobile/src/types/
# - Copies src/store/ → mobile/src/store/
# - Copies selected shared components
```

### When to Sync
- ✅ After modifying TypeScript interfaces in `src/types/`
- ✅ After updating Redux store/slices in `src/store/`
- ✅ After changes to shared components
- ✅ Before testing mobile functionality

## Benefits of This Architecture

1. **⚡ Fast Development**: Manual sync when needed, no complex tooling
2. **🔄 No Code Duplication**: Single source of truth for business logic  
3. **🐛 Easier Debugging**: Shared core logic, platform-specific UI
4. **📦 Simple Deployment**: Web and mobile built completely independently
5. **🛠️ Platform Optimization**: Mobile-specific Redux configuration for performance

## Development Workflow

### File Changes Impact

| File Changed | Action Required | Web Impact | Mobile Impact |
|--------------|----------------|------------|---------------|
| `src/types/*` | `npm run sync` | ✅ Auto-reloads | ✅ After sync |
| `src/store/*` | `npm run sync` | ✅ Auto-reloads | ✅ After sync |
| `src/components/*` | None | ✅ Web only | ❌ No impact |
| `mobile/src/*` | None | ❌ No impact | ✅ Mobile only |

### Development Tips

- **Use `npm run dev:mobile`** for the fastest mobile iteration (auto-sync + start)
- **Make type/store changes** in the main `src/` directory, then sync
- **Test on mobile frequently** using Expo Go QR code scanning  
- **Use web version** for rapid UI prototyping of shared logic
- **Mobile store is simplified** for performance - fewer slices than web version

## Production Builds

```bash
# Web production build
npm run build

# Mobile production build  
cd mobile
npx expo build:android    # Android APK
npx expo build:ios        # iOS IPA (requires Apple Developer account)
```

## Mobile-Specific Notes

- **Expo SDK 53** with React Native
- **Simplified Redux store** for mobile performance
- **Offline-first development** using `npx expo start --offline`
- **Metro bundler** for React Native module resolution
- **Mobile-optimized** component architecture
