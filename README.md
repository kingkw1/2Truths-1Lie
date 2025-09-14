# 🎭 2Truths-1Lie: A Kiro-Powered Social Game

<div align="center">

*This project was built for the **Code with Kiro Hackathon**, demonstrating how Kiro's spec-driven development transforms ideas into production-ready code.*

---

<img src="https://placehold.co/600x300?text=Insert+App+Demo+GIF+Here" alt="App Demo GIF" width="80%">

[![Kiro Spec-Driven](https://img.shields.io/badge/Kiro-Spec--Driven-blueviolet.svg)](#-our-kiro-workflow)
[![Project Status](https://img.shields.io/badge/status-production_ready-brightgreen.svg)](#-project-status)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

**Hackathon Category**: Games & Entertainment

**[View the Demo Video](#-live-demo) · [Explore our Kiro Specs](#-our-kiro-workflow) · [Quick Start](#-quick-start)**

</div>

## 🎯 A Partnership with Kiro

The Code with Kiro Hackathon challenged us to "turn ideas into production-ready code" by using Kiro as a development partner. We took that challenge to heart. **2Truths-1Lie** is a fully functional, AI-enhanced mobile game, but more importantly, it's a testament to a modern development workflow where an AI partner doesn't just write code faster—it helps you make better architectural decisions.

This project was built from the ground up with Kiro, moving from high-level concepts to a robust, deployed application. Kiro was our partner throughout the entire process, from architecting systems with spec-driven development to implementing the production-ready code.

## ✨ Core Features (Enabled by Kiro)

| Feature | How Kiro Made It Possible |
| :--- | :--- |
| **🎮 Secure, Scalable Backend** | We described the requirements for our JWT authentication and video processing APIs, and Kiro generated the production-grade FastAPI services. This allowed us to focus on the core game logic instead of backend boilerplate. |
| **📱 Advanced Video Recording**| Kiro helped us implement sophisticated video recording with expo-camera, including permission handling, validation, and corruption detection - solving complex mobile video challenges. |
| **🎬 Real-time Video Processing**| We leveraged Kiro to build FFmpeg-powered video merging on the backend, enabling seamless combination of multiple video segments into final challenge videos. |
| **☁️ Production Deployment**| Kiro guided us through Railway deployment and EAS Build configuration, ensuring our app scales properly with proper signing credentials and environment management. |

## 🏆 Our Kiro Workflow: From Spec to Production

The hackathon rules emphasize showing *how* we built with Kiro. Our entire process was centered around Kiro's spec-driven development, which is fully documented in the `/.kiro/specs` directory of this repository.

-   **✅ Requirements Phase**: We started by defining user stories and acceptance criteria for complex features like User Authentication and Content Moderation in `requirements.md` files. This ensured our goals were clear and testable from the start.
-   **✅ Design Phase**: Kiro helped translate these requirements into technical `design.md` files, complete with data models, API contracts, and sequence diagrams. This is where Kiro helped us make "better architecture decisions."
-   **✅ Implementation Phase**: With a solid design, Kiro's code generation automated over 70% of the foundational code. The most impressive code generation was the entire secure authentication backend, which saved us days of complex, security-critical work.
-   **✅ Future-Ready Hooks**: We've set up agent hooks (see `/.kiro/hooks`) to automate future tasks like documentation updates and test generation, showing how Kiro can assist throughout the project's entire lifecycle.

This workflow allowed us to bridge the gap between idea and implementation, creating a polished, production-ready app in a fraction of the typical time.

## 🎬 Live Demo & App Access

Our 3-minute demo video showcases the final application and walks through our Kiro-driven development process.

**[Watch the Full Submission Video Here]** (<- Link Your YouTube Video)

The app is currently in **Open Beta** on the Google Play Store. It is also pending review with the store, but you can download the app directly for testing.

**[Download the App for Testing]** (<- Link to your APK/AAB)

## 🏗️ Technical Architecture

The system is a modern, decoupled architecture designed for scalability.

```mermaid
graph TD
    A[📱 Mobile App <br> React Native, Expo, expo-camera] -->|REST API| B(🌐 Backend API <br> Python FastAPI, Railway);
    B -->|Challenge Data| C[(🗄️ Database <br> SQLite)];
    B -->|Video Files| D[📁 Local Storage <br> Backend uploads/];
    B -->|Video Processing| E[🎬 FFmpeg Service <br> Video Merging];
    A -->|Video Upload| B;
    E -->|Merged Videos| D;
    B -->|JWT Auth| F[🔐 Authentication <br> Secure Tokens];
````

**👉 [Dive into the Full Technical Details](docs/TECHNICAL_ARCHITECTURE.md)**

## 🚀 Quick Start

Get the project running on your local machine in under 5 minutes.

**Prerequisites:** Node.js (v18+), Python (v3.10+), and the Expo Go app on your mobile device.

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/kingkw1/2Truths-1Lie.git
    cd 2Truths-1Lie
    ```

2.  **Start the backend server:**

    ```bash
    cd backend
    pip install -r requirements.txt
    python run.py
    ```

3.  **Launch the mobile app:**

    ```bash
    cd mobile
    npm install
    npx expo start
    ```

    Scan the QR code with the Expo Go app on your phone.

## 🗺️ Quick Repository Roadmap

### 📍 Essential Starting Points
| What You Need | Where to Find It |
|---------------|------------------|
| **🚀 Get Started** | [`docs/DEVELOPER_QUICK_START.md`](docs/DEVELOPER_QUICK_START.md) - 5-minute setup guide |
| **📖 Documentation** | [`docs/`](docs/) directory - Complete project documentation |
| **💻 Source Code** | [`mobile/`](mobile/) (React Native) & [`backend/`](backend/) (Python FastAPI) |
| **🏆 Submission Materials** | [`submission_materials/`](submission_materials/) - Video scripts, QR codes, demo assets |

### 🏗️ Architecture & Design
- **[Technical Architecture](docs/ARCHITECTURE.md)** - System design and component relationships
- **[API Documentation](docs/api.md)** - Complete REST API reference
- **[Mobile Development Guide](docs/MOBILE_GUIDE.md)** - React Native setup and patterns
- **[Backend Guide](docs/BACKEND_GUIDE.md)** - Python FastAPI development guide

### 🧪 Testing & Quality
- **[Testing Guide](docs/TESTING_GUIDE.md)** - Comprehensive testing strategies
- **[Backend Tests](backend/tests/)** - Organized test suites with documentation
- **[Development Tools](tools/)** - Utilities for testing, validation, and debugging

### 📋 Contributing & Policies
- **[Contributing Guidelines](docs/CONTRIBUTING.md)** - How to contribute to the project
- **[Privacy Policy](docs/privacy-policy.html)** - User privacy and data handling

## 🏆 Hackathon Submission Checklist

### ✅ Kiro Integration Highlights for Judges

**🔍 Spec-Driven Development Evidence:**
- **[`.kiro/specs/`](.kiro/specs/)** - Complete specification files for all major features
  - User Authentication spec with requirements, design, and tasks
  - Content Moderation spec with AI integration details  
  - Media Upload spec with cloud storage architecture
- **[`.kiro/hooks/`](.kiro/hooks/)** - Automated development hooks for future maintenance
- **[`.kiro/steering/`](.kiro/steering/)** - Technical steering documents and policies

**📊 Kiro-Generated Code Examples:**
- **Backend Video Processing**: FFmpeg integration and video merging service
- **Mobile Camera Integration**: expo-camera setup with permission handling and validation
- **API Architecture**: Complete FastAPI backend with JWT authentication
- **Production Deployment**: EAS Build configuration and Railway deployment setup

**🚀 Production Readiness:**
- ✅ **Deployed Backend**: Live FastAPI server on Railway with monitoring
- ✅ **Mobile App Store**: Google Play Store submission with EAS Build
- ✅ **Video Processing**: FFmpeg-powered video recording and merging
- ✅ **Robust Architecture**: JWT authentication, input validation, error handling

**📱 Judge Access:**
- **Live App**: Available on Google Play Store (scan QR in [`submission_materials/`](submission_materials/))
- **Demo Video**: 3-minute walkthrough following submission script
- **Source Code**: Full repository with organized documentation

### 🎯 Key Differentiators

1. **Spec-First Development**: Every major feature started as a Kiro specification
2. **Production Quality**: Real app deployed to Google Play Store with working video features
3. **Advanced Video Processing**: FFmpeg-powered backend with sophisticated mobile camera integration
4. **Mobile + Backend**: Full-stack application with Railway deployment and EAS Build
5. **Developer Experience**: Comprehensive debugging and validation throughout the video pipeline

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.

-----

<div align="center">
Built with ❤️ and a Kiro 🤖 Partnership
</div>
