# Mobile Core Gameplay Flow - Requirements

## Introduction

Defines mobile game mechanics and progression driving mobile engagement: core loop, mobile video challenge creation, native mobile guessing experience, mobile-optimized feedback, progression, and mobile emotion recognition.

***

## Requirements

### Requirement 1: Native Mobile Game Loop (MVP Mandatory)

- Present native mobile UI for lie selection among three video statements on mobile screens
- **Require native mobile video with audio recording for all statements** - leveraging device camera and microphone
- Immediate native mobile visual/haptic feedback on core actions using device capabilities
- Mobile-friendly guidance on invalid input or missing camera/microphone permissions
- Mobile-appropriate idle detection and re-engagement after 30 seconds with push notifications

***

### Requirement 2: Mobile Progress and Achievement Feedback

- Real-time mobile progress updates with native notifications and badges
- Mobile celebration animations and unlockable mobile-specific cosmetics
- Native mobile progress screen optimized for touch interaction and portrait/landscape modes
- Highlight personal bests with mobile sharing capabilities (social media integration)

***

### Requirement 3: Mobile Game Difficulty and Engagement

- Progressive difficulty increase over rounds.
- New game elements for advanced players.
- Optional assistance and adaptive difficulty.

***

### Requirement 4: Social Guessing and Interaction

- Display other players' statements and media.
- Record guesses with immediate feedback, scoring.
- Reveal correct lies visually.
- Update leaderboards globally and for friends.

***

### Requirement 5: Resource Earning and Monetization

- Award currency and cosmetics for success.
- In-app shop with purchasable items.
- Instant inventory updates.
- Instructions for earning more resources.

***

### Requirement 6: Auto-Save and Cross-Device Sync

- Save game state within 5 seconds of player actions.
- Sync and restore progress on new devices.
- Retry and notify on failure.

***

### Requirement 7: Performance and Responsiveness

- UI response within 100ms.
- Maintain 30+ FPS.
- Handle multiple concurrent inputs.
- Auto-reduce load if performance drops.

***

### Requirement 8: Media Capture (MVP Mandatory)

- Full controls: start, pause, resume, cancel recording.
- Real-time preview and option to re-record before submission, integrated seamlessly into challenge creation UI.
- Enforce duration limits and media validation with user-friendly guidance.
- **Video recording is mandatory for all three statements** - no text fallback options.
- Local blob URL handling with robust error handling and validation.
- Capturing and previewing media must be intuitive and accessible via the challenge creation interface, with state synchronization to the main app state and submission pipeline.
- **Explicit Mobile Platform Considerations:**
  - Implement seamless **camera and microphone access on mobile devices** (using Expo Camera or equivalent) including permission requests, denials, and retries.
  - Provide **mobile-optimized recording UI** with responsive touch controls, real-time video preview, and haptic/visual feedback.
  - Handle **mobile-specific errors** such as hardware unavailability, low storage, or interrupted recordings gracefully.
  - Integrate mobile media capture fully with Redux state and cross-platform code sharing to maintain consistent challenge creation workflow.
  - Ensure local storage and offline support for recorded media on mobile devices with smooth sync to backend on reconnect.
  - Include testing for permission workflows, device compatibility, and mobile UI ergonomics.

***

### Requirement 9: Error Handling and Resilience

- Network retry with exponential backoff.
- Offline queuing and sync-on-reconnect.
- Graceful degradation of AI and media.
- User-friendly error messages.

***

### Requirement 10: Code Quality and Completion Criteria

- All code generated or modified must result in a project state where the application compiles successfully with no build errors.
- Code changes must not break local development workflows, including `npm run start`, `npm run build`, and `npm run type-check`.
- Automated tests relevant to the modified/added features must pass before considering the task complete.
- Failure to build or pass tests should trigger task rework until compliance is met.
- Developers and AI automation alike should use this criterion as a gate to finalize tasks.

***

### Requirement 11: Testing and Quality Assurance

- Unit and integration tests for all modules.
- End-to-end typical session tests.
- Cross-browser and device compatibility, including mobile device testing.
- Accessibility and fallback checks.