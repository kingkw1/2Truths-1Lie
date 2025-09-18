### **The 13-Day Unified Shipaton Sprint Plan (Enhanced Version)**

#### **WEEK 1: Foundational Sprint (Monetization & Core Systems)**

**Day 1: (Today, Sept 18) - Strategy & Setup**
* **💻 Development Focus**:
    * Set up your RevenueCat account and configure your initial products/entitlements in the dashboard.
    * Strategize your monetization model for the **HAMM Award**. A strong option is selling packs of "AI Lie Detector" hints, leveraging your planned "Emotion Analysis API" feature mentioned in your development plan and video script.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Post your official "Shipaton Kickoff" on Twitter/X, LinkedIn, or Devpost.
    * State your goals clearly: "Pivoting my Kiro Hackathon winner for the #Shipaton! Focusing on creative monetization with @RevenueCat and launching on iOS. Follow along for the #BuildInPublic journey!".

**Day 2 & 3: (Sept 19-20) - RevenueCat Integration (Android)**
* **💻 Development Focus**:
    * Integrate the RevenueCat SDK into your live Android build.
    * Build and polish the UI for the in-app store, purchase flow, and "premium" modals. This directly contributes to the **RevenueCat Design Award**.
    * Implement and thoroughly test the purchase, restore, and promo code flows for judges.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Post a screenshot of your new paywall UI, asking for feedback. This shows you're engaging with the community for the **#BuildInPublic Award**.
    * Share a code snippet or a quick story about how an AI tool (like Kiro or Gemini) helped scaffold the purchase logic. This is perfect content for the **Best Vibes Award**.

**Day 4 & 5: (Sept 21-22) - iOS Integration & Cross-Platform Validation**
* **💻 Development Focus**:
    * Begin the iOS port. Complete the Expo iOS setup and generate your first TestFlight beta build.
    * Wire up the RevenueCat SDK on the iOS side, ensuring 100% feature parity with Android for purchases and premium features.
    * Submit your in-app purchase items for review in App Store Connect.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Document the process of porting to iOS. Share a challenge you faced and how you overcame it (e.g., "TIL about iOS provisioning profiles... #xcode #reactnative"). This is authentic and valuable content.

**Day 6: (Sept 23) - Polished User Authentication**
* **💻 Development Focus**:
    * **Upgrade User Authentication**: Instead of a full overhaul, focus on the most critical user-facing improvements from your list.
        * **Implement Password Recovery**: This is a core user expectation. Integrate an email service to handle password reset links.
        * **Build a Basic User Profile Screen**: Create a simple screen where a user can see their username and email, with a "Log Out" button. This adds a necessary layer of polish.
        * **Defer for now**: Biometric login and advanced session refresh are technically complex. We'll add them to the post-hackathon roadmap.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Post about the upgrade: "Moving beyond a basic login. Today's focus is on adding crucial features like password recovery to make the app feel more secure and professional for our first users. #indiedev #security"

**Day 7: (Sept 24) - Enhanced Moderation & Stability**
* **💻 Development Focus**:
    * **Enhance Content Moderation**: Build upon your existing "Report" button.
        * **Backend Logic for Reports**: Ensure that when a user reports a video, it gets clearly flagged in your database for manual review.
        * **User-Facing Feedback**: Add a simple confirmation modal ("Thanks for your report, we'll review it shortly.") to let users know their action was successful.
        * **Defer for now**: An admin dashboard and automated abuse detection are significant undertakings. We'll highlight the functional reporting system in the demo.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Post an end-of-week recap video or thread. Show off the new password recovery flow and the confirmation after reporting a video. Frame it as "Building trust and safety into the core experience before we scale."
---

#### **WEEK 2: Polish, Launch & Submission Sprint**

**Day 8: (Sept 25) - iOS Launch Push & Critical Flow Validation**
* **💻 Development Focus**:
    * **Critical Milestone**: Conduct a full, practice run-through of the test purchase and promo code flows on both a physical Android device and an iOS TestFlight build. This is to catch any platform-specific sandbox issues or App Store Connect/Play Console configuration gotchas early.
    * Finalize the iOS build for submission.
    * **Submit the app to the Apple App Store for review**. The sooner, the better, as review times can be unpredictable.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Celebrate this milestone! Post a screenshot of the "Waiting for Review" status. This is a classic, high-engagement post for any indie developer journey.

**Day 9: (Sept 26) - The Design & Polish Sprint**
* **💻 Development Focus**:
    * Dedicate today to visual excellence for the **RevenueCat Design Award**.
    * Review every screen. Refine animations, clean up transitions, and ensure your branding is cohesive.
    * Create your final 1024x1024 app icon and high-resolution screenshots (1179x2556px without frames) for both stores.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Post before-and-after GIFs or screenshots showing a UI element you polished. Explain your design thinking.

**Day 10: (Sept 27) - Growth & Onboarding**
* **💻 Development Focus**:
    * Refine the user onboarding flow. How do you introduce the premium features to a new user? This is key for the **Build & Grow Award**.
    * Analyze any early data you have. To bootstrap metrics, get friends and family to install and use the app. Even tiny numbers ("We grew 200% from 5 to 15 users!") can be used to build a growth narrative.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Share your download numbers, no matter how small. "Just hit 50 downloads on the Play Store! Small wins. Now working on improving the first-time user experience based on early feedback from our first users."

**Day 11: (Sept 28) - Rapid Bug Bash & Narrative Assembly**
* **💻 Development Focus**:
    * **Rapid Bug Bash**: Dedicate a focused block of time to fixing only the most critical, high-impact, or visually jarring bugs found during testing. This is your final stability lock before recording the demo.
    * Write the documentation and instructions for the judges, especially how to use the promo code to test premium features.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * Draft your submission essays. Start writing the story for each award, weaving together your social media posts, development challenges, and strategic decisions.

**Day 12: (Sept 29) - Final Assets & Award-Winning Video Production**
* **💻 Development Focus**:
    * Conduct a final, full QA pass on both the iOS and Android versions of the app.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * **Record & Edit Demo Video with a Shot List**: Your 3-minute video is your pitch. Ensure your footage explicitly highlights the awards criteria:
        * **For the Design Award:** Show off your most polished UI, smoothest animations, and the clean onboarding flow.
        * **For the HAMM Award:** Clearly demonstrate the intuitive, non-intrusive purchase flow and the value of the premium features.
        * **For the Best Vibes Award:** Briefly show a "before/after" of a feature Kiro/Gemini helped build, or a screen where AI-generated content is used.
        * **For General Quality:** Show the content moderation ("Report" button) to demonstrate the app is community-safe and thoughtfully designed.

**Day 13: (Sept 30) - SUBMISSION DAY**
* **💻 Development Focus**:
    * Perform a final smoke test on both platforms. Double-check all submission requirements: URLs, icon, screenshots, promo code, and video link.
* **📣 Public Focus (#BuildInPublic & Storytelling)**:
    * **Submit your project on Devpost before the 11:45 pm Pacific Time deadline**.
    * Make your final, celebratory "WE SHIPPED!" post on all your social channels. Thank the community and the hackathon organizers.