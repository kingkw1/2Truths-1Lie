## From Hackathon Prototype to Monetized Social Game

### Inspiration
Initially created for the Kiro Hackathon as a technical demo, 2Truths-1Lie evolved into a full-featured, monetized Android app for the RevenueCat Shipaton. The goal: turn a fun video game into a sustainable business while preserving a delightful, user-first experience.

### How We Built It
We began by fixing the core game loop—implementing persistent scoring and challenge completion—to ensure users had a compelling reason to keep playing. The recent sprint focused on delivering a seamless Android experience and a monetization model designed for the **HAMM Award**.

* **Subscriptions** unlock unlimited challenge creation and a "Pro" badge for premium users.
* **Tokens** can be spent for "Wizard of Oz" 50/50 hints, adding a strategic layer to gameplay.
* **High-Impact Polish** like Dark Mode, haptic feedback, and smooth animations were added to compete for the **Design Award**.
* **AI Partnership:** Our development was supercharged by a multi-layered AI team. We used **Google Gemini and Perplexity** as "AI Project Managers" to strategize and craft expert prompts for our "AI Developers"—Google Jules and VSC Copilot. This workflow was critical for accelerating our sprint and is core to our **Best Vibes Award** entry.

### Challenges Faced
Our journey was a trial by fire. We battled two major, multi-day roadblocks that nearly derailed the project:

1.  **Database Migration Madness:** A switch to PostgreSQL on our cloud provider failed unexpectedly due to private networking issues, forcing us to create and migrate to an entirely new database service mid-sprint.
2.  **The Elusive Video Timing Bug:** A persistent bug where video segments played incorrectly survived multiple fix attempts. We finally discovered the root cause was a data mismatch between the video's actual duration (from FFmpeg) and the metadata being saved to the database.

### What We Learned
Our biggest lesson was strategic: **a compelling game loop with real stakes and progression *must* come before monetization.** We pivoted our entire weekend plan to fix the core game first, because perks have no value in a game that isn't fun to play. Overcoming the major technical challenges also reinforced the power of our AI partnership, which was essential for debugging complex, unfamiliar systems under a tight deadline.