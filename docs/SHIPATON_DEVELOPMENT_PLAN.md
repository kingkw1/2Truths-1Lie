# **Master Development Plan: 2Truths-1Lie (Final Battle Plan)**

**Project Status**: ACTIVE SPRINT - Final 6-Day Push (Android-Only)
**Current Date**: September 25, 2025
**Shipaton Hackathon Deadline**: September 30, 2025
**App Status**: ✅ BACKEND STABLE, ANDROID PURCHASES WORKING

---
## 🎯 Executive Summary & Status Update

After resolving all major backend and video playback issues, the project is stable and enters its final 6-day sprint. The strategy has been refined to focus exclusively on a flawless Android submission. The following "battle plan" prioritizes tasks into tiers, ensuring that mission-critical features are completed first, followed by high-impact polish, to create the most competitive entry possible for the RevenueCat Shipaton.

## 🚀 ACTIVE SPRINT: Final Push (Sept 25 - Sept 30)

**Goal**: To ship a flawless Android app with a fully functional monetization model. The primary targets are the **HAMM** and **Design** awards, with a strong supporting entry for the **Build & Grow** and **#BuildInPublic** awards.

### **Updated 6-Day Sprint Schedule**

#### **Final Week: The Battle Plan**

* **Day 8-9 (Thurs, Sept 25 - Fri, Sept 26): TIER 1 - MONETIZATION FUNCTIONALITY SPRINT**
    * **Development Focus**: This is the #1 priority. Make the purchase flows deliver tangible value.
        * [ ] **Implement Subscription Perks:**
            * [ ] Unlock unlimited challenge creation for `isPremium` users.
            * [ ] Display a visual "Pro" badge in the UI for subscribers.
        * [ ] **Implement Token Spending:**
            * [ ] Implement the "Wizard of Oz" 50/50 hint functionality.
            * [ ] Create the "Use Hint" button and wire it to the backend to decrement the token balance.
    * **Public Focus**:
        * [ ] Post about the strategic pivot to Android-only.
        * [ ] On Friday, post a video/GIF of the newly working premium features with a compelling caption for the **#BuildInPublic Award**.

* **Day 10 (Sat, Sept 27): TIER 2 - HIGH-IMPACT POLISH SPRINT (DESIGN AWARD)**
    * **Development Focus**: Focus on features that provide the most "wow" factor for the **Design Award**.
        * [ ] Implement a Dark Mode theme.
        * [ ] Add subtle haptic feedback to key interactions.
        * [ ] Refine any jarring screen transitions or animations.
    * **Public Focus**:
        * [ ] Post a video showcasing the new Dark Mode and polished animations.

* **Day 11 (Sun, Sept 28): TIER 3 (COMPLETENESS) & TIER 1 (STABILITY)**
    * **Development Focus (Morning)**: Implement "app completeness" features that build user trust.
        * [ ] Implement the "Edit Profile (Name)" feature.
        * [ ] Implement the ability for a user to delete their own challenges.
    * **Development Focus (Afternoon)**:
        * [ ] **Rapid Bug Bash**: Hunt down and fix any remaining crashes or major bugs in the core user flow.
    * **Public Focus**:
        * [ ] Draft the written submission essays for each targeted award category on Devpost.

* **Day 12 (Mon, Sept 29): TIER 1 - FINAL ASSETS & VIDEO**
    * **Development Focus**:
        * [ ] Conduct a final, full QA pass on the Android app.
    * **Public Focus**:
        * [ ] Record and edit the new 3-minute demo video. It must showcase the polished Android app, the purchase flow, and the unlocked premium features.
        * [ ] Finalize all visual assets (icon, high-res screenshots).

* **Day 13 (Tues, Sept 30): TIER 1 - SUBMISSION DAY**
    * **Development Focus**:
        * [ ] Perform a final smoke test and submit the updated build to the Google Play Store.
        * [ ] Assemble and double-check all submission materials (video URL, Google Play URL, assets, promo code info).
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
### ⛔ **Deferred Features (Post-Hackathon Roadmap)**

The following features are now officially out of scope for the hackathon submission and will be part of the long-term roadmap:
* Full Emotion Analysis API Integration
* Progression, Rewards, and Leaderboards
* Advanced Account Management (Password Recovery)
* Comprehensive Content Moderation Tools (Admin Dashboards)
* Swipe Navigation