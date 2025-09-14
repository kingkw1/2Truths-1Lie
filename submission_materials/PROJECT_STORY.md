# Project Story: 2 Truths & a Lie

### Our Inspiration

At its core, **2 Truths & a Lie** draws inspiration from the timeless social game where players share two truths and one lie for others to guess. We wanted to transform this classic icebreaker into a modern digital experience, allowing users to create and share engaging video-based challenges. The app fosters genuine storytelling and social connection, inviting a global community to interact through laughter and shared moments.

Our app lets users record three short video statements—two truths and one lie—which the community then watches and votes on to guess the lie.

### How We Built It: A Partnership with Kiro

From day one, our goal was to build a production-grade application, not just a prototype. To achieve this within the hackathon timeline, we fully embraced **Kiro’s AI-powered, spec-driven development workflow**.

Instead of writing boilerplate, we invested our time in creating detailed specifications for each core feature—from user authentication and content moderation to the complex video processing pipeline. We treated these specs as the source of truth, allowing Kiro to translate our architectural decisions directly into code.

> Kiro automatically generated **over 70% of our backend and frontend code**. This freed us to focus on what truly matters: refining the user experience, polishing interactions, and building a secure, stable platform.

This AI-assisted approach allowed us to move with incredible speed without sacrificing quality, using agent hooks to automate documentation and scaffold tests along the way.

### Challenges We Faced

Building a media-rich social app comes with significant technical hurdles. Our main challenges included:
* Orchestrating multi-segment video capture to ensure flawless, "no-bleed" playback transitions.
* Engineering a robust upload pipeline resilient to variable network conditions.
* Implementing secure, JWT-based authentication with a strong focus on user privacy.

We navigated these challenges by pairing Kiro's automated code generation for foundational systems with rigorous human oversight and testing, ensuring a production-grade result.

### Key Accomplishments & Learnings

We are incredibly proud to have delivered a **fully operational, scalable, and polished mobile social game** within the hackathon timeline. Our key accomplishments include:

* A secure FastAPI backend, architected and generated through Kiro specs.
* Real-time, server-side video merging using FFmpeg.
* A responsive, cross-platform mobile app with over 75% automated test coverage.

> **What We Learned:** Our biggest takeaway was the power of a specification-first mindset. We learned firsthand that by investing time in detailed requirements upfront, an AI partner like Kiro can dramatically accelerate delivery without compromising quality or security. This project proved that speed and stability are not mutually exclusive in modern development.

### What’s Next for 2 Truths & a Lie

We're excited about the future of the project and plan to continue our AI-driven collaboration. Our roadmap includes:
* Enhancing content moderation with AI-driven detection tools.
* Introducing personalization features and smart recommendations.
* Rolling out monetization through RevenueCat-powered subscriptions.
* Expanding platform parity with full iOS support.