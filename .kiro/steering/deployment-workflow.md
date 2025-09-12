---
include: always
---

# Mobile App Deployment Process

## Development and Testing Environments
- Use Expo Go for rapid development and real-device testing
- EAS Build for staging and production builds
- Use environment variables for API endpoints and secrets; never hard-code credentials in mobile app
- Test on both iOS Simulator and Android Emulator plus real devices

## Mobile CI/CD Pipeline
- Use GitHub Actions or EAS to automate:
  - **MANDATORY**: TypeScript compilation validation (`npx tsc --noEmit`)
  - **MANDATORY**: Syntax and import validation for all modified files
  - **Current Status**: Known TypeScript issues in network resilience tests being addressed
  - Running mobile tests on every push (77.3% coverage achieved)
  - Running lint and TypeScript checks for mobile code
  - Building Android APK/AAB and iOS IPA files
  - Deploying test builds to internal testing tracks
  - Publishing to app stores after approval
- **CRITICAL**: Pipeline must fail if any NEW compilation errors are detected
- **Production Status**: Backend deployed on Railway, full end-to-end workflow operational

## Mobile Build Processes
- **Development**: Expo Go for instant preview and iteration
- **Preview Builds**: EAS Build for internal testing and stakeholder review
- **Production**: EAS Build with app store optimization and code signing
- **Backend**: Docker containers deployed to mobile-optimized cloud services

## App Store Deployment
- **Android**: Google Play Console with staged rollout capability
- **iOS**: App Store Connect with TestFlight for beta testing
- **Version Management**: Semantic versioning with automatic versionCode increments
- **Store Assets**: Screenshots, descriptions, and metadata optimized for mobile app stores

## Mobile-Specific Rollback and Recovery
- Maintain previous successful mobile builds for emergency rollback
- Use app store rollback features if critical mobile bugs are discovered
- Monitor mobile app crash reporting and performance metrics
- Backend rollback procedures to maintain mobile API compatibility

## Mobile Monitoring & Analytics
- Integrate mobile-specific monitoring (Bugsnag, Sentry for mobile crash reporting)
- App store analytics and user feedback monitoring
- Set up alerts for mobile app crashes, API failures, and performance issues
- Track mobile-specific metrics (app launches, screen navigation, game completion rates)

## Configuration Management
- Keep EAS configuration and mobile deployment scripts version controlled
- Document manual app store submission steps for emergency releases
- Maintain mobile app signing certificates and provisioning profiles securely
- Backend deployment docs focused on mobile API requirements

## Backend Deployment Notes for FFmpeg Merging Service
- Ensure hosting environment supports native FFmpeg binaries (Railway, Render, AWS EC2 with FFmpeg installed).
- Use Docker containers if possible to encapsulate FFmpeg environment for consistent builds.
- Monitor FFmpeg process logs and resource usage to tune performance.
- Test merge endpoint under staging environments before production.
- Configure CI/CD pipelines to validate FFmpeg build and backend integration.