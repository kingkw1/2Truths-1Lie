# Development Setup - Optimized for Speed 🚀

## Overview
This project supports both **web** and **mobile** development with shared code to maximize development speed.

## Quick Start Commands

### Web Development
```bash
npm start                 # Start web development server
open http://localhost:3000
```

### Mobile Development  
```bash
npm run mobile           # Start mobile development server
# Scan QR code with Expo Go app on your phone
```

### Both Platforms
```bash
npm start &              # Start web in background
npm run mobile           # Start mobile (will use different port)
```

## Shared Code Structure

**✅ Shared Between Web & Mobile:**
- `src/types/` - All TypeScript interfaces
- `src/store/` - Redux store and slices  
- `src/shared/` - Shared components (symlinked)

**📱 Mobile-Specific:**
- `2Truths-1Lie-mobile/src/screens/` - Mobile screens
- `2Truths-1Lie-mobile/src/components/` - Mobile-specific components

**🌐 Web-Specific:**
- `src/components/` - Web React components
- `src/hooks/` - Web-specific hooks

## Benefits of This Setup

1. **⚡ Fast Development**: Changes to types/store automatically apply to both platforms
2. **🔄 No Code Duplication**: Single source of truth for business logic
3. **🐛 Easier Debugging**: One codebase for core logic
4. **📦 Simple Deployment**: Web and mobile can be built independently

## File Changes Impact

| File Changed | Web Impact | Mobile Impact |
|--------------|------------|---------------|
| `src/types/*` | ✅ Auto-reloads | ✅ Auto-reloads |
| `src/store/*` | ✅ Auto-reloads | ✅ Auto-reloads |  
| `src/components/*` | ✅ Web only | ❌ No impact |
| `2Truths-1Lie-mobile/src/*` | ❌ No impact | ✅ Mobile only |

## Development Tips

- **Start both servers** during development for the fastest iteration
- **Make type changes** in `src/types/` - they'll apply everywhere
- **Test on mobile** frequently using Expo Go
- **Use the web version** for rapid UI prototyping

## Production Builds

```bash
npm run build            # Web production build
cd 2Truths-1Lie-mobile && npx expo build:android  # Mobile build
```
