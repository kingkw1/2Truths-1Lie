# **Master Development Plan: 2Truths-1Lie (Final Push)**

**Project Status**: ACTIVE SPRINT - Final Submission Push
**Current Date**: September 25, 2025
**KiRo Hackathon**: ✅ COMPLETED
**Shipaton Hackathon Deadline**: September 30, 2025
**App Status**: ✅ BACKEND STABLE, ANDROID PURCHASES WORKING

---
## 🎯 Executive Summary & Status Update

After successfully resolving critical backend networking and client-side video playback issues, the project is now stable. The focus for the final 6 days of the Shipaton shifts entirely to completing the core submission requirements and polishing the user experience. This updated plan prioritizes the mandatory iOS submission and the implementation of the monetization features to ensure a competitive entry for the hackathon.

## 🚀 ACTIVE SPRINT: Final Push (Sept 25 - Sept 30)

**Goal**: To finalize and ship a fully functional, monetized, cross-platform app. The primary targets are the **HAMM** and **Design** awards, supported by a strong entry for the **Build & Grow** and **#BuildInPublic** awards.

### **Updated 6-Day Sprint Schedule**

#### **Final Week: Implementation, Polish, and Submission**

* **Day 8 (Thurs, Sept 25): iOS Launch Push & Critical Flow Validation**
    * **Development Focus**:
        * [ ] Begin the iOS port and complete the Expo iOS setup.
        * [ ] Generate the first iOS TestFlight beta build.
        * [ ] Wire up the RevenueCat SDK on the iOS side, ensuring 100% feature parity.
        * [ ] Submit in-app purchase items for review in App Store Connect.
        * [ ] **Critical Milestone**: Conduct a full, practice run-through of test purchase flows on both Android and iOS TestFlight.
        * [ ] Finalize the iOS build for submission.
        * [ ] **Submit the app to the Apple App Store for review**.
    * **Public Focus**:
        * [ ] Document and share challenges from the iOS porting process (e.g., provisioning profiles, build issues).
        * [ ] Post a screenshot of the "Waiting for Review" status in App Store Connect.

* **Day 9 (Fri, Sept 26): MONETIZATION FUNCTIONALITY & POLISH SPRINT**
    * **Development Focus**:
        * [ ] **Implement Subscription Perks:** Make the `isPremium` status unlock features. Start with the easiest, highest-impact ones:
            * [ ] Remove the daily limit on challenge creation for Pro users.
            * [ ] Add a visual "Pro" badge next to the user's name.
        * [ ] **Implement Token Spending:** Implement the "Wizard of Oz" 50/50 hint. This involves creating a "Use Hint" button, wiring it to a backend endpoint that decrements the user's token balance, and showing the hint in the UI.
        * [ ] **UI/UX Polish:** If time permits, refine animations and screen transitions for the **Design Award**.
    * **Public Focus**:
        * [ ] Post a video/GIF of the newly working premium features with the caption: "It's alive! The subscription now unlocks perks, and tokens can be spent on hints. Bringing the monetization model to life for the @RevenueCat #Shipaton."

* **Day 10 (Sat, Sept 27): Growth & Onboarding**
    * **Development Focus**:
        * [ ] Refine the new-user onboarding flow to clearly introduce the premium features and the 7-day free trial.
    * **Public Focus**:
        * [ ] Document your growth story for the **Build & Grow Award** submission. Write about the challenges you've overcome (like the video bug!) and any early user feedback.

* **Day 11 (Sun, Sept 28): Rapid Bug Bash & Narrative Assembly**
    * **Development Focus**:
        * [ ] **Rapid Bug Bash**: Dedicate a focused block of time to fixing critical bugs on both platforms, especially in the purchase and gameplay flows.
    * **Public Focus**:
        * [ ] Draft the written submission essays for each targeted award category on Devpost (HAMM, Design, Build & Grow, etc.).

* **Day 12 (Mon, Sept 29): Final Assets & Video Production**
    * **Development Focus**:
        * [ ] Conduct a final, full QA pass on both the Android and iOS versions of the app.
    * **Public Focus**:
        * [ ] Record and edit the final 3-minute demo video. Ensure it clearly shows the purchase flow, the unlocked premium features, and the polished UI.

* **Day 13 (Tues, Sept 30): SUBMISSION DAY**
    * **Development Focus**:
        * [ ] Perform a final smoke test on both platforms.
        * [ ] Assemble and double-check all submission materials (video URL, app URLs, icons, screenshots, promo code/trial info).
    * **Public Focus**:
        * [ ] **Submit the project on Devpost before the 11:45 pm Pacific Time deadline**.
        * [ ] Post the final "WE SHIPPED!" update on social channels.

---
## 🏆 Bonus Features (To Tackle If Time Allows)

This is a prioritized list of extra features. If you find yourself waiting for the iOS review or you finish a day's tasks early, tackle these in order to make your submission even more competitive.

1.  **High-Impact Polish (For the Design Award)**
    * **Dark Mode:** Implementing a dark theme is a highly visible feature that shows design maturity.
    * **Haptic Feedback:** Adding subtle vibrations on button presses and key interactions makes the app feel more responsive and premium.
    * **Refine Animations:** Smooth out screen transitions and add a subtle animation to the "Correct!" / "Fooled You!" screens.

2.  **Community & Trust Features**
    * **Edit Profile (Name):** Implement the UI and backend endpoint to allow users to change their display name.
    * **"Report" Confirmation:** Add the user-facing confirmation modal after a user reports a challenge, making the moderation system feel more complete.

3.  **Advanced Account Management (Lower Priority)**
    * **Change Password Flow:** Building the dedicated screen and backend endpoint for password changes.
    * **Password Recovery Flow:** This requires integrating an email service and is a lower priority for the hackathon itself.