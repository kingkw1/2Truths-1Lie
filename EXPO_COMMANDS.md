# Expo Commands - VS Code Copilot Compatible

## 🎯 **The Solution**

VS Code Copilot often suggests `npx expo start`, but this fails when run from the root directory due to dependency conflicts. This project now provides **multiple ways** to run Expo commands correctly:

## 📋 **Available Commands**

### Option 1: Use npm scripts (Recommended)
```bash
npm start                 # Start in Expo Go mode
npm run start:clear       # Start with cache cleared  
npm run expo:start        # Alternative expo start
npm run expo:start-clear  # Expo start with cache cleared
npm run expo:dev          # Development build mode
```

### Option 2: Use custom expo script
```bash
./expo start              # Works from root, automatically uses mobile directory
./expo start --clear      # With cache clearing
./expo start --dev-client # Development build mode
```

### Option 3: Manual command (Always works)
```bash
cd mobile && npx expo start --go
```

## 🤖 **For VS Code Copilot Users**

When Copilot suggests `npx expo start`:

**❌ Don't use:** `npx expo start` (from root)
- Causes dependency conflicts
- Gets FormData errors on device
- Shows TypeScript version warnings

**✅ Use instead:** `npm start` or `./expo start`
- Always works from any directory
- Uses correct dependencies
- Defaults to Expo Go mode
- No version conflicts

## 📊 **Command Comparison**

| Command | Working Directory | Dependencies Used | Result |
|---------|------------------|-------------------|---------|
| `npm start` | ✅ Changes to mobile | ✅ Mobile deps | ✅ Works |
| `./expo start` | ✅ Changes to mobile | ✅ Mobile deps | ✅ Works |
| `npx expo start` (root) | ❌ Stays in root | ❌ Root deps | ❌ Fails |
| `cd mobile && npx expo start` | ✅ In mobile | ✅ Mobile deps | ✅ Works |

## 🔧 **What's the Problem?**

**Root directory issues:**
```bash
npx expo start --go
# Starting project at /home/kevin/Documents/2Truths-1Lie  ❌
# The following packages should be updated for best compatibility...
# typescript@5.8.3 - expected version: ~5.9.2  ❌
# FormData errors on device  ❌
```

**Mobile directory (correct):**
```bash
cd mobile && npx expo start --go
# Starting project at /home/kevin/Documents/2Truths-1Lie/mobile  ✅
# No version warnings  ✅
# FormData works on device  ✅
```

## 🛠️ **Technical Implementation**

The custom `./expo` script:
1. **Always runs from mobile directory** - ensures correct dependencies
2. **Auto-adds --go flag** - defaults to Expo Go mode  
3. **Forwards all arguments** - supports any expo command
4. **Shows clear feedback** - displays which directory it's using

## 💡 **Pro Tips**

1. **Bookmark this:** When Copilot suggests expo commands, use `npm start` instead
2. **VS Code Terminal:** The `./expo` script works great in VS Code's integrated terminal
3. **Muscle Memory:** Train yourself to type `npm start` instead of `npx expo start`
4. **Team Communication:** Share this with your team to avoid the same confusion

## 📱 **Verification**

To verify it's working correctly, look for:
- ✅ `Starting project at .../mobile` (not root)
- ✅ No TypeScript version warnings
- ✅ `Using Expo Go` message
- ✅ App loads without FormData errors on your phone

---

**Bottom line:** The `npx expo start` command from root is fundamentally broken due to dependency conflicts. Use the alternatives provided above! 🎉
