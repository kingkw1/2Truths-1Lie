---
include: conditional
pattern: "**/*.test.*"
---

# Mobile Testing Standards

## Mobile Testing Scope
- Write unit tests for all game logic functions in `src/game/`
- Integration tests for mobile API client services in `src/services/`
- React Native component tests for critical mobile UI flows and screens
- E2E tests for complete mobile user journeys using Detox or similar
- Unit tests for video compression and merging utilities in `src/media/`
- Integration tests for upload progress tracking and background processing
- Tests for segment metadata handling and video playback controls
- **Current Status**: 77.3% test coverage with known TypeScript compilation issues in network resilience tests

## Mobile Testing Tools
- Use Jest and React Native Testing Library as the base mobile testing framework
- Use msw (Mock Service Worker) to mock API calls in mobile component tests
- Expo Testing Tools for Expo-specific functionality testing
- Detox for end-to-end mobile app testing on real devices and simulators

## Mobile Test Writing Practices
- Test one mobile behavior or function per test case
- Use descriptive mobile-focused test names:  
  `test('GameScreen correctly displays score when mobile game completes', () => {...})`
- Mock React Native modules and Expo APIs where appropriate
- Include mobile-specific boundary cases (network connectivity, device permissions)
- Test both iOS and Android platform behaviors where different

## Mobile Test Coverage
- Aim for at least 80% coverage on mobile business logic and API client services
- Review mobile test coverage reports as part of CI
- Focus on critical mobile user paths (camera access, game flow, offline scenarios)
- Include comprehensive testing of video compression, merging, and upload workflows
- Test segment metadata accuracy and video playback functionality
- Test error recovery scenarios for failed compressions and interrupted uploads

## Mobile Build and Test Validation
- Tests must run successfully with Expo CLI and EAS Build processes
- Mobile-specific build validation: `npm run build:mobile` or `expo build`
- TypeScript checking for mobile code: `npm run type-check:mobile`
- Test mobile app builds on both Android and iOS platforms
- Mobile test failures or build errors must prevent task closure until resolved
- Maintain CI integration for mobile-specific automated checks

## Running Mobile Tests
- Mobile tests runnable via `npm test` in the mobile directory (no dedicated test:mobile script)
- Include mobile test scripts in both root and mobile `package.json`
- Run mobile tests before every commit to ensure mobile app stability
- Test on real devices periodically for native functionality validation
- **Known Issues**: NetworkResilienceService test compilation errors need resolution

## Mobile Test Data
- Use mobile-specific fixture files for camera/media testing
- Create mobile test factories for device state and app navigation
- Avoid hard-coded mobile data across multiple tests
- Mock device-specific APIs (camera, storage, notifications) consistently
- Include test video files with known compression ratios and segment boundaries
- Mock video processing libraries for unit testing without actual file operations

## Server side merging
- Add unit and integration tests for backend merging services, including handling video uploads, FFmpeg execution, and error conditions.
- Test merge status and progress API endpoints with various scenarios, including failure and retry logic.
- Perform thorough e2e testing of client upload of multiple videos to merge endpoint and playing back merged video segments.
- Include mobile component tests covering playback UI controls for segmented merged videos.
- Validate server-side compression effectiveness and metadata accuracy.
- Use mock video files with known segment boundaries to verify segmentation correctness.
