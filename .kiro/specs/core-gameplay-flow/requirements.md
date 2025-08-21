# Core Gameplay Flow - Requirements

## Introduction

Defines game mechanics and progression driving engagement: core loop, challenge creation with media, guessing, feedback, progression, and optional emotion recognition.

***

## Requirements

### Requirement 1: Intuitive Core Game Loop (MVP Mandatory)

- Present UI for three statements and lie selection.
- Support primarily video with audio recording with preview and re-record; text input allowed only as fallback option.
- Immediate visual/audio feedback on core actions.
- Helpful guidance on invalid input.
- Subtle hints on player idle after 30 seconds.

***

### Requirement 2: Progress and Achievement Feedback

- Real-time progress and achievement updates.
- Celebrations and unlockable cosmetics.
- Progress screen with level and goals.
- Highlight personal bests.

***

### Requirement 3: Game Difficulty and Engagement

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
- Secure chunked, resumable media uploads with upload progress and cancel/retry controls.
- Robust error handling.
- Capturing and previewing media must be intuitive and accessible via the challenge creation interface, with state synchronization to the main app state and submission pipeline.

***

### Requirement 9: Error Handling and Resilience

- Network retry with exponential backoff.
- Offline queuing and sync-on-reconnect.
- Graceful degradation of AI and media.
- User-friendly error messages.

***

### Requirement 10: Testing and Quality Assurance

- Unit and integration tests for all modules.
- End-to-end typical session tests.
- Cross-browser and device compatibility.
- Accessibility and fallback checks.

***