## Combined Development & Deployment Plan for Shipaton and KiRo Hackathons

### Overview & Context

- **KiRo Hackathon Deadline:** September 15, 2025  
- **Shipaton Hackathon Deadline:** September 30, 2025 (app must be published/newly uploaded between Aug 1–Sept 30)  
- **Key Shipaton Requirement:** Early publish of a functional app on Google Play (or Apple App Store) to start the required 14-day testing window.

***

### 1. **Immediate Actions (Week of Aug 25 – Sept 01)**

**Goal:** Lock in early Play Store deployment and stabilize core mobile features.

- Prepare and finalize a **minimal but functional app build** for Android via Expo or native tools.
- Upload **first developer app build to Google Play Console closed testing track** to satisfy 14-day testing policy.
- Add testers to closed track & start early testing—collect and address issues ASAP.
- Continue **developing mobile media capture**:
  - Integrate Expo Camera for real device video + audio recording.
  - Implement permissions handling, error fallback, and intuitive UI on mobile.
- Stabilize **mobile navigation and state management sync** (Redux integration).
- ✅ **Mobile app successfully running on Android device** (version 1.1.0 with versionCode 20)
- ✅ **Web app code archived** and project converted to mobile-only focus  
- 🔧 **IN PROGRESS: Comprehensive unit and integration testing** targeting media capture and gameplay flows - fixing Jest configuration and mocking issues
- Start lightweight **documentation of mobile workflows** for team and judges.

***

### 2. **Feature Completion Sprint (Sept 01 – Sept 08)**

**Goal:** Finalize core gameplay, polish mobile flow, and continue stabilizing published app.

- Complete **all remaining media capture tasks** across web & mobile, ensuring full compliance with:
  - Required video + audio capture on all statements
  - Smooth preview and retry workflows
  - Efficient client-side compression & local blob handling
- Advance **guessing engine enhancements**:
  - Refine UI responsiveness, hints, animations, and scoring feedback.
- Increase **test coverage**—unit, integration, and begin **end-to-end test scripting** (Cypress, Playwright).
- Resolve initial feedback from Play Store closed testing.
- Prepare draft **Hackathon presentation materials** (video outline + demo flow).

***

### 3. **Hardening and Submission Prep (Sept 08 – Sept 15)**

**Goal:** Submit to KiRo with top-notch MVP and solid demonstration.

- Conduct **full end-to-end testing** with emphasis on mobile device play.
- Polish **UI/UX and bug fixes**, focusing on smooth interactive experiences.
- Finalize **test coverage goals (>80%)**; complete accessibility & responsiveness audits.
- Record and edit MVP **demo video** showcasing:
  - Core gameplay loop
  - Mobile app experience and media capture
  - AI-assist process (Kiro integration & logs)
- **Submit KiRo hackathon** entry by Sept 15 (include public repo with .kiro, video, documentation, links).
- Share progress publicly with #BuildInPublic and #hookedonkiro tags.

***

### 4. **Post-KiRo / Shipaton Focus (Sept 15 – Sept 29)**

**Goal:** Deliver full production readiness for Shipaton submission & Play Store publication.

- Integrate **backend persistent media upload** with queueing, validation, and cloud storage (e.g., S3).
- Complete **user authentication** flows: registration, login, password reset.
- Implement **monetization features** per Shipaton requirements:
  - RevenueCat SDK integration, purchase flows, restore purchases, promo/free trials.
- Expand **progression & rewards systems**: leveling, badges, cosmetics, leaderboards.
- Optimize **performance & scalability**:
  - Load testing with Artillery/JMeter
  - Responsive frontend rendering & caching improvements.
- Harden **error handling and resilience** for offline mode, network failure, retries.
- Finalize app metadata, privacy & security compliance.
- Publish **final Play Store versions** of Android (and Apple if applicable):
  - Complete required items: icons, screenshots, compliance docs, privacy policy.
- Prepare and submit **Shipaton hackathon** package with:
  - Store listing links (Android/iOS)
  - Promo codes for judges
  - Updated demo videos and documentation
- Continue **analytics, monitoring & logging** setup and dashboard building.

***

### Feature Prioritization Breakdown

| Priority | Feature Area                        | Reason                                        |
|----------|-----------------------------------|-----------------------------------------------|
| 1        | Early Android Play Store deployment| Required to start Shipaton 14-day test clock  |
| 2        | Mobile Media Capture & Permissions | Core MVP feature; enables meaningful mobile testing |
| 3        | Redux Sync & Mobile Navigation     | Ensures smooth cross-platform shared state and UX |
| 4        | Core Gameplay Polish & Testing     | Critical for playable, bug-free MVP experience |
| 5        | Full End-to-End Tests & Accessibility | Ensures stability and compliance for judging |
| 6        | Demo Video & Public Presentation   | Vital for winning hackathon; demonstrates progress |
| 7        | Backend Media Upload Integration   | Required for persistent content, production readiness |
| 8        | User Authentication & Security    | Builds user trust and supports multi-device sync |
| 9        | Monetization Integration           | Meets Shipaton criteria; drives engagement/revenue |
| 10       | Progression / Rewards Systems      | Enhances long-term engagement and retention   |
| 11       | Performance & Resilience           | Ensures app scalability and user satisfaction |
| 12       | Analytics & Monitoring Setup       | Provides data-driven insights post-launch     |

***

### Summary Table

| Week       | Key Activities                                      | Deliverables & Milestones                    |
|------------|----------------------------------------------------|----------------------------------------------|
| Aug 23–29  | Initial Android build & Play Store upload           | Play Store closed test track deployment      |
|            | Mobile media capture integration                     | Basic video/audio recording on mobile        |
| Aug 30–Sept 5 | Complete media capture & mobile app polish          | Stabilized MVP, tested media features         |
|            | Start comprehensive testing                          | Bug fixes and UI improvements                 |
| Sept 6–12  | Finalize gameplay, tests, and demo video             | KiRo hackathon submission package prepared   |
| Sept 13–15 | Submit KiRo challenge                                | Public repo, demo video, submission           |
| Sept 16–29 | Backend upload, auth, monetization integration       | Play Store publication, Shipaton submission   |
|            | Performance, analytics, and polish                   | User engagement and stability                  |
