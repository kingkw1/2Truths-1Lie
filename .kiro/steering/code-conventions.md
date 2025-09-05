---
include: always
---

# Mobile Code Conventions

## Mobile Naming
- Use **camelCase** for variables and functions: `calculateMobileScore()`
- Use **PascalCase** for React Native components: `GameScreen`, `CameraView`
- Use **kebab-case** for folder names: `game-logic/`, `mobile-utils/`
- Screen components suffixed with "Screen": `GameScreen.tsx`, `HomeScreen.tsx`
- Use meaningful, descriptive names; avoid abbreviations unless widely understood in mobile context

## Mobile File Organization
- Keep one primary React Native component per file in `mobile/src/components/`
- Separate mobile utilities into `mobile/src/utils/`
- Mobile API client logic in `mobile/src/services/`
- Core game rules and mechanics in `mobile/src/game/` (mobile-optimized)
- Screen components in `mobile/src/screens/`
- Media processing utilities in `mobile/src/media/` (compression, merging, segment handling)
- Navigation configuration in dedicated navigation files
- Avoid large mobile files: refactor into smaller reusable modules optimized for mobile

## Mobile Style & Formatting
- Use Prettier with 2-space indentation for React Native code
- Always include TypeScript type annotations for mobile props and state
- Use ESLint with React Native recommended rules for mobile code quality
- Comment mobile-specific logic (camera handling, navigation, platform differences)

## React Native Patterns
- Use functional components with React Native hooks
- Use React Navigation for mobile screen navigation
- Prefer React Native's StyleSheet for styling over inline styles
- Use React Native's Dimensions API for responsive mobile layouts
- Handle platform differences with Platform.OS conditionals
- Optimize for mobile performance with React.memo and useCallback where appropriate

## Mobile Error Handling
- Gracefully handle mobile-specific errors (camera permissions, network connectivity)
- Display mobile-friendly error messages with appropriate UI feedback
- Handle app backgrounding and foregrounding states during video operations
- Implement offline error states for mobile network issues
- Handle video compression and merging failures with user-friendly recovery options
- Provide meaningful progress feedback during long-running media operations

## Mobile Code Quality and Build Compliance
- All mobile code changes must compile successfully with Expo CLI and React Native
- The mobile app should run correctly with `npm run start:mobile` or `expo start`
- TypeScript checking must pass for mobile code: `npm run type-check:mobile`
- Mobile builds must succeed: EAS Build for Android/iOS without errors
- React Native Metro bundler must complete without errors
- Mobile-specific tests must pass before completing tasks
- Failed mobile builds must trigger immediate fixes for native compilation issues

## Mobile Platform Considerations
- Test on both iOS and Android platforms for compatibility
- Use React Native's Platform module for platform-specific code
- Follow platform-specific UI guidelines (iOS Human Interface, Material Design)
- Handle different screen sizes and orientations appropriately
- Optimize for mobile performance and battery usage

## Mobile Commit Messages
- Use clear, mobile-focused imperative style: `Add camera permission handling to GameScreen`
- Include platform context when relevant: `Fix Android navigation bar spacing`

---