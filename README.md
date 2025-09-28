# 🎭 2Truths-1Lie: A Social Video Game

<div align="center">

*This project is a submission for the **RevenueCat Shipaton 2025**, transforming a functional prototype into a polished, monetized, and feature-complete Android application.*

---

<img src="https://github.com/kingkw1/public_media/raw/main/gifs/kiro_full_gameplay_condensed.gif" alt="App Demo GIF" width="25%">

[![RevenueCat Shipaton](https://img.shields.io/badge/RevenueCat-Shipaton_2025-blueviolet.svg)](#)
[![Project Status](https://img.shields.io/badge/status-Live_on_Play_Store-brightgreen.svg)](#-submission-materials)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

**[Watch the Demo Video](#) · [Download on Google Play](#-submission-materials) · [View Devpost Submission](#)**

</div>

> **Shipaton Goal:** This project's journey for the Shipaton was to take a working app and answer the critical question: "How do you turn a fun idea into a sustainable business?" We focused on implementing a compelling core game loop and a thoughtful, user-first monetization model powered by RevenueCat.

## 🏆 Submission Materials

| Resource               | Link/Access                                      |
|------------------------|-------------------------------------------------|
| 🎬 **Demo Video** | `[Link to your new 3-minute YouTube video]`   |
| 📱 **Live App** | <img src="submission_materials/playstore-qr-code.png" alt="QR Code" width="150"/> <br>[Download on Google Play Store](https://play.google.com/store/apps/details?id=com.kingkw1.twotruthsoneliegame) |
| 🚀 **Devpost Project** | [https://devpost.com/software/2truths-1-lie](https://devpost.com/software/2truths-1-lie)          |

## ✨ Core Features

* **🎥 Video-Based Gameplay:** The classic social game of deception, brought to life with short, user-created videos.
* **🏆 Persistent Scoring & Progression:** Correct guesses earn points that are tracked on your user profile. The game has real stakes!
* **🧩 Challenge Completion:** A dynamic feed that hides challenges you've already solved, ensuring a fresh experience every time.
* **✨ Premium Features:** A "Pro" subscription that unlocks valuable perks for our most dedicated players.
* **💎 Consumable Hints:** Spendable "Tokens" provide a 50/50 hint to help you spot the lie.
* **🌙 Polished UI/UX:** A beautiful, responsive interface featuring a hand-tuned Dark Mode and satisfying haptic feedback.

## 💰 Monetization Model (for the HAMM Award)

We implemented a hybrid freemium model designed for player choice and long-term value, directly targeting the **HAMM (Help Apps Make Money) Award**.

* **Subscriptions ("Pro"):** Our monthly/yearly subscription is for power users. It unlocks unlimited challenge creation, provides a "Pro" status badge 🕵️, and grants a monthly stipend of Tokens.
* **Consumables ("Tokens"):** Any player can purchase packs of Tokens to spend on in-game "50/50" hints, allowing them to pay for meaningful moments of gameplay.

This strategy, powered by RevenueCat, provides a scalable foundation that respects free players while offering compelling value for users who wish to invest deeper in the game.

## ️ Technical Architecture

The system is a modern, full-stack application built for a production environment.

```mermaid
graph TD
    subgraph Mobile Client
        A[📱 Android App <br> React Native, Expo, Redux];
    end
    subgraph Backend Services
        B(🌐 Backend API <br> Python FastAPI, Railway);
        C[(🗄️ Database <br> PostgreSQL)];
        D[📁 Media Storage <br> AWS S3];
        E[🎬 Video Processing <br> FFmpeg];
    end
    subgraph Third-Party Services
        F[💰 RevenueCat <br> IAP Management];
    end

    A -->|REST API| B;
    A -->|IAP Flow| F;
    B -->|Challenge/User Data| C;
    B -->|Media URLs| D;
    B -->|Video Merging| E;
    F -->|Webhooks| B;
````

## 🏆 Shipaton Award Eligibility

We focused our sprint on features that would make us highly competitive for the following awards:

  * **HAMM Award:** For our robust hybrid freemium model.
  * **Design Award:** For our polished, card-based UI, dark mode, and haptic feedback.
  * **\#BuildInPublic Award:** For documenting our entire journey, including major technical pivots and bug fixes.
  * **Best Vibes Award:** For our development partnership with AI assistants like Google Gemini and Jules to strategize, debug, and accelerate our workflow.

## 🚀 Quick Start

Get the project running on your local machine.

**Prerequisites:** Node.js (v18+), Python (v3.9+), and the Expo Go app on your mobile device.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/kingkw1/2Truths-1Lie.git
    cd 2Truths-1Lie
    ```
2.  **Start the backend server:**
    ```bash
    cd backend
    pip install -r requirements.txt
    # Set up your .env file with necessary keys
    python run.py  # Runs on http://localhost:8001
    ```
3.  **Launch the mobile app:**
    ```bash
    cd mobile
    npm install
    npx expo start
    ```
    Scan the QR code with the Expo Go app on your phone.

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

-----
<div align="center">
Built for the ❤️ of Shipping
</div>