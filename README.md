# 🎭 2Truths-1Lie: A Kiro-Powered Social Game

<div align="center">

*This project was built for the **Code with Kiro Hackathon**, demonstrating how Kiro's spec-driven development transforms ideas into production-ready code.*

---

<img src="https://github.com/kingkw1/public_media/raw/main/gifs/kiro_full_gameplay_condensed.gif" alt="App Demo GIF" width="25%">

[![Kiro Spec-Driven](https://img.shields.io/badge/Kiro-Spec--Driven-blueviolet.svg)](#-our-kiro-workflow)
[![Project Status](https://img.shields.io/badge/status-production_ready-brightgreen.svg)](#-project-status)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

**Hackathon Category**: Games & Entertainment

**[Watch the Demo Video](https://youtu.be/Y97sCqtQKB8) · [Explore our Kiro Specs](#-our-kiro-workflow-from-spec-to-production) · [Quick Start](#-quick-start)**

</div>

> **Kiro Integration:**  
> This repository features a fully populated [`.kiro/specs/`](.kiro/specs/) directory for requirements, designs, and tasks, plus agent hooks and steering docs in [`.kiro/hooks/`](.kiro/hooks/) and [`.kiro/steering/`](.kiro/steering/). All major architecture and code decisions were executed via Kiro's spec-driven workflow. See below for direct links and usage details.

## 🏆 Hackathon Submission Materials

| Resource               | Link/Access                                      |
|------------------------|-------------------------------------------------|
| 🎬 Demo Video          | [Watch on YouTube](https://youtu.be/Y97sCqtQKB8)   |
| 📱 QR Code / App Access | <img src="submission_materials/playstore-qr-code.png" alt="QR Code" width="150"/> <br>[Download on Google Play Store](https://play.google.com/store/apps/details?id=com.kingkw1.twotruthsoneliegame) |
| 📂 Submission Assets    | [Browse folder](submission_materials/)          |

## 🎯 A Partnership with Kiro

The Code with Kiro Hackathon challenged us to "turn ideas into production-ready code" by using Kiro as a development partner. We took that challenge to heart. **2Truths-1Lie** is a fully functional, AI-enhanced mobile game, but more importantly, it's a testament to a modern development workflow where an AI partner doesn't just write code faster—it helps you make better architectural decisions.

This project was built from the ground up with Kiro, moving from high-level concepts to a robust, deployed application. Kiro was our partner throughout the entire process, from architecting systems with spec-driven development to implementing the production-ready code.

## ✨ Core Features (Enabled by Kiro)

| Feature | How Kiro Made It Possible |
| :--- | :--- |
| **🎮 Production Backend (Spec-to-Code)** | **Generated a FastAPI/JWT backend instantly from Kiro specs. Sped up design, improved security, zero boilerplate.** |
| **📱 Advanced Video Recording**| Kiro scaffolded complicated expo-camera workflows, permission handling, and validation. |
| **🎬 Real-time Video Processing**| FFmpeg backend built from high-level specs for seamless merging and optimization. |
| **☁️ Production Deployment**| Railway deployment and EAS Build configuration scripted from architectural specs. |

## 🏆 Our Kiro Workflow: From Spec to Production
Our entire process was centered around Kiro's spec-driven development, which is fully documented in the [`/.kiro/specs/`](.kiro/specs/) directory of this repository. Explore the full journey from requirements to production code in our [Kiro Specs Overview](.kiro/specs/README.md).

-   **✅ Requirements Phase**: We started by defining user stories and acceptance criteria for complex features like User Authentication and Content Moderation in `requirements.md` files. This ensured our goals were clear and testable from the start.
-   **✅ Design Phase**: Kiro helped translate these requirements into technical `design.md` files, complete with data models, API contracts, and sequence diagrams. This is where Kiro helped us make "better architecture decisions."
-   **✅ Implementation Phase**: With a solid design, Kiro's code generation automated over 70% of the foundational code. The most impressive code generation was the entire secure authentication backend, which saved us days of complex, security-critical work.
-   **✅ Future-Ready Hooks**: We've set up agent hooks (see [`.kiro/hooks/`](.kiro/hooks/)) to automate future tasks like documentation updates and test generation, showing how Kiro can assist throughout the project's entire lifecycle.

This workflow allowed us to bridge the gap between idea and implementation, creating a polished, production-ready app in a fraction of the typical time.

## ️ Technical Architecture

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

## 🗺️ Navigating This Repository

### 📍 Essential Starting Points
| What You Need | Where to Find It |
|---------------|------------------|
| **🤖 How We Used Kiro** | [`KIRO_WORKFLOW.md`](KIRO_WORKFLOW.md) — AI-assisted development journey and spec-driven process |
| **🌟 Kiro Specifications** | [`.kiro/specs/README.md`](.kiro/specs/README.md) — Overview of all specs & mapping to code |
| **🚀 Get Started** | [`docs/DEVELOPER_QUICK_START.md`](docs/DEVELOPER_QUICK_START.md) - 5-minute setup guide |
| **📖 Documentation** | [`docs/`](docs/) directory - Complete project documentation |
| **💻 Source Code** | [`mobile/`](mobile/) (React Native) & [`backend/`](backend/) (Python FastAPI) |
| **🏆 Submission Materials** | [`submission_materials/`](submission_materials/) - Video scripts, QR codes, demo assets |

### 🏗️ Architecture & Design
- **[Kiro Specs Overview](.kiro/specs/README.md)** — Learn how structured requirements and designs map to code and tests
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

## ✅ Kiro Hackathon Submission Checklist

| Requirement             | Where/How We Fulfill It                                                |
|-------------------------|------------------------------------------------------------------------|
| **/.kiro Directory**    | All specs, agent hooks, and steering documents present at project root |
| **Kiro Usage**          | Complete spec-driven workflow; hooks set for future maintainability    |
| **Kiro Development Process** | Detailed AI development journey: [`KIRO_WORKFLOW.md`](KIRO_WORKFLOW.md) |
| **Demo Video Linked**   | [Watch on YouTube](https://youtu.be/Y97sCqtQKB8) & [submission_materials/](submission_materials/)          |
| **Live App for Review** | Download and judge via QR code and public APK in `submission_materials/` |
| **Open Source License** | MIT License in root and docs                                           |

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
- ✅ **Mobile App Store**: [Google Play Store submission](https://play.google.com/store/apps/details?id=com.kingkw1.twotruthsoneliegame) with EAS Build
- ✅ **Video Processing**: FFmpeg-powered video recording and merging
- ✅ **Robust Architecture**: JWT authentication, input validation, error handling

**📱 Judge Access:**
- **Live App**: Available on [Google Play Store](https://play.google.com/store/apps/details?id=com.kingkw1.twotruthsoneliegame) (or scan QR in [`submission_materials/`](submission_materials/))
- **Demo Video**: [3-minute walkthrough on YouTube](https://youtu.be/Y97sCqtQKB8) following submission script
- **Source Code**: Full repository with organized documentation

### 🎯 Key Differentiators

1. **Spec-First Development**: Every major feature started as a Kiro specification
2. **Production Quality**: Real app deployed to [Google Play Store](https://play.google.com/store/apps/details?id=com.kingkw1.twotruthsoneliegame) with working video features
3. **Advanced Video Processing**: FFmpeg-powered backend with sophisticated mobile camera integration
4. **Mobile + Backend**: Full-stack application with Railway deployment and EAS Build
5. **Developer Experience**: Comprehensive debugging and validation throughout the video pipeline

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

-----

<div align="center">
Built with ❤️ and a Kiro 🤖 Partnership
</div>
