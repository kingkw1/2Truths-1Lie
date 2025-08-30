---
include: always
---

# Mobile Design System Guidelines

## Mobile Typography
- Use React Native's platform-specific system fonts for optimal native performance
- Maintain consistent font sizes and weights across mobile components:
  - Headers: Bold, 28px+ (mobile-optimized for touch targets)
  - Body text: 18px regular (mobile-readable on smaller screens)
  - Button text: 16px medium (thumb-friendly sizing)

## Mobile Colors
- Primary palette: vibrant, engaging tones optimized for mobile screens
- Support both light and dark mode for native mobile experience
- Use accessible contrast ratios (WCAG AA) for mobile readability in various lighting
- Feedback colors: green for correct guesses, red for incorrect, yellow for warnings
- Native platform colors where appropriate (iOS blue, Android material colors)

## Mobile Layout & Spacing
- Follow React Native's flexbox layout system with consistent spacing
- Use 4px or 8px baseline grid for mobile margins and paddings
- Mobile-first responsive layouts that adapt to different screen sizes and orientations
- Safe area handling for notched devices (iPhone X+) and navigation bars

## Mobile UI Components
- Buttons: Native-style with platform-appropriate touch feedback and sizing (44px+ touch targets)
- Inputs: Mobile-optimized with proper keyboard types and native styling
- Navigation: React Navigation patterns with native mobile transitions
- Feedback Animations: React Native Animated API for smooth 60fps mobile animations

## Mobile Iconography
- Use React Native Vector Icons or Expo Vector Icons for scalable mobile icons
- Platform-specific icon styles (iOS SF Symbols, Android Material Icons where appropriate)
- Icons sized appropriately for mobile touch targets (24px+ interactive elements)

## Mobile Accessibility
- VoiceOver (iOS) and TalkBack (Android) screen reader support
- Proper accessibility labels and hints for all interactive elements
- Native mobile accessibility APIs through React Native Accessibility
- High contrast support and dynamic text sizing

## Mobile Animation and Interactions
- Use React Native Animated and Reanimated for performant mobile animations
- Native mobile gesture handling (swipe, pinch, long press) where appropriate
- 60fps animations with proper easing curves for native feel
- Haptic feedback for important interactions using Expo Haptics

## Mobile-Specific Considerations
- Camera and video recording UI patterns optimized for portrait orientation
- Native mobile navigation patterns (tab bar, stack navigation, modal presentation)
- Platform-specific design guidelines (iOS Human Interface Guidelines, Material Design)
- Battery and performance optimization for continuous camera usage

---