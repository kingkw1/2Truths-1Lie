# **Master Development Plan: 2Truths-1Lie (Final Push - Android Focus)**

**Project Status**: ACTIVE SPRINT - Final Submission Push (Android-Only)
**Current Date**: September 25, 2025
**Shipaton Hackathon Deadline**: September 30, 2025
**App Status**: ✅ BACKEND STABLE, ANDROID PURCHASES WORKING

---
## 🎯 Executive Summary & Status Update

Following a strategic decision to focus all resources on a single platform, the project's goal for the final 6 days is to create a polished, feature-complete, and highly competitive **Android application**. After resolving critical backend and video playback issues, the app is stable. This updated plan reallocates the time from the iOS port to implement high-impact design features and community-focused functionality, maximizing our chances for a winning submission.

## 🚀 ACTIVE SPRINT: Final Push (Sept 25 - Sept 30)

**Goal**: To finalize and ship a flawless Android app with a fully functional Hybrid Freemium model. The primary targets are the **HAMM** and **Design** awards, supported by a strong entry for the **Build & Grow** and **#BuildInPublic** awards.

### **Updated 6-Day Sprint Schedule**

#### **Final Week: Deep Polish and Flawless Execution on Android**

* **Day 8 (Thurs, Sept 25): MONETIZATION FUNCTIONALITY SPRINT**
    * **Development Focus**:
        * [ ] **Implement Subscription Perks:** Make the `isPremium` status unlock features:
            * [ ] Remove the daily limit on challenge creation for Pro users.
            * [ ] Add a visual "Pro" badge next to the user's name in the UI.
        * [ ] **Implement Token Spending:** Implement the "Wizard of Oz" 50/50 hint.
            * [ ] Create the "Use Hint" button in the gameplay UI.
            * [ ] Wire it to a backend endpoint that decrements the user's token balance.
    * **Public Focus**:
        * [ ] Post about the strategic pivot: "Update on my #Shipaton journey: I've decided to focus 100% on a flawless Android submission to make it as polished as possible. iOS will be 'Coming Soon!' Today's goal: making the in-app purchases actually unlock cool features. #BuildInPublic".

* **Day 9 (Fri, Sept 26): HIGH-IMPACT POLISH (DESIGN AWARD FOCUS)**
    * **Development Focus**:
        * [ ] **Implement Dark Mode:** A highly visible feature that shows design maturity.
        * [ ] **Add Haptic Feedback:** Integrate subtle vibrations for button presses and key interactions to make the app feel more responsive.
        * [ ] **Refine Animations:** Smooth out screen transitions and polish the "Correct!" / "Fooled You!" animations.
    * **Public Focus**:
        * [ ] Post a video/GIF showcasing the new Dark Mode and animations with the caption: "Polishing for the @RevenueCat #DesignAward! Added a dark mode and smoothed out some animations. #Shipaton #AndroidDev".

* **Day 10 (Sat, Sept 27): COMMUNITY & TRUST SPRINT**
    * **Development Focus**:
        * [ ] **Implement Edit Profile (Name):** Build the UI and backend endpoint to allow users to change their display name.
        * [ ] **Refine the New-User Onboarding Flow:** Ensure the first-time experience is smooth and clearly introduces the app's value and premium features.
    * **Public Focus**:
        * [ ] Document your growth story for the **Build & Grow Award** submission. Write about the challenges overcome and how you're now focused on community-building features.

* **Day 11 (Sun, Sept 28): Rapid Bug Bash & Narrative Assembly**
    * **Development Focus**:
        * [ ] **Rapid Bug Bash**: Dedicate a focused block of time to fixing any remaining bugs in the purchase, gameplay, and new feature flows on Android.
    * **Public Focus**:
        * [ ] Draft the written submission essays for each targeted award category on Devpost (HAMM, Design, Build & Grow, etc.).

* **Day 12 (Mon, Sept 29): Final Assets & Video Production**
    * **Development Focus**:
        * [ ] Conduct a final, full QA pass on the Android app.
    * **Public Focus**:
        * [ ] Record and edit the final 3-minute demo video, showcasing the polished Android app, the purchase flow, and all the new features like dark mode and profile editing.

* **Day 13 (Tues, Sept 30): SUBMISSION DAY**
    * **Development Focus**:
        * [ ] Perform a final smoke test and update the app on the Google Play Store.
        * [ ] Assemble and double-check all submission materials (video URL, Google Play URL, icons, screenshots, promo code/trial info).
    * **Public Focus**:
        * [ ] **Submit the project on Devpost before the 11:45 pm Pacific Time deadline**.
        * [ ] Post the final "WE SHIPPED!" update on social channels.

---
### 🎯 **Updated Shipaton Success Metrics (KPIs)**

* **Development Metrics**:
    * [ ] 100% completion of RevenueCat SDK and feature unlocking on Android.
    * [ ] Successful submission of the updated, feature-complete build to the Google Play Store.
    * [ ] Implementation of at least two "High-Impact Polish" features (e.g., Dark Mode, Haptics).
    * [ ] Zero critical bugs in the purchase or core gameplay flows at submission.
* **Hackathon Metrics**:
    * [ ] All submission materials completed by Day 13.
    * [ ] A final submission that is highly competitive for the HAMM and Design awards.

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