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
- Keep one primary React Native component per file in `src/components/`
- Separate mobile utilities into `src/utils/`
- Mobile API client logic in `src/services/`
- Core game rules and mechanics in `src/game/` (mobile-optimized)
- Screen components in `src/screens/`
- Media processing utilities in `src/media/` (compression, merging, segment handling)
- Navigation configuration in dedicated navigation files
- Avoid large mobile files: refactor into smaller reusable modules optimized for mobile
- **Note**: Project structure is flattened - mobile app is directly in `mobile/` directory

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
- **CRITICAL**: All mobile code changes must compile successfully with Expo CLI and React Native
- **MANDATORY**: Run `npx tsc --noEmit` to verify TypeScript compilation before task completion
- **Current Status**: Known TypeScript compilation issues in network resilience tests need resolution
- The mobile app should run correctly with `npm start` or `expo start`
- TypeScript checking must pass for NEW mobile code (existing issues being addressed)
- New tasks must not introduce additional compilation errors beyond known network resilience issues
- Mobile builds must succeed: EAS Build for Android/iOS without errors
- React Native Metro bundler must complete without errors
- Mobile-specific tests must pass before completing tasks
- **NO EXCEPTIONS**: Failed mobile builds or compiler errors must trigger immediate fixes
- Tasks cannot be marked "complete" until all compilation errors are resolved

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