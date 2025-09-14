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
| **📱 Polished Mobile Experience**| Kiro's spec-to-code capabilities for React Native generated the foundational UI components and state management hooks, letting us spend more time on polishing the user experience and gesture controls. |
| **🤖 Responsible AI & Moderation**| We used Kiro to spec out and implement a full content moderation system, including user reporting APIs and a backend service, ensuring the platform was community-ready from day one. |

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
    A[📱 Mobile App <br> React Native, Expo, Redux] -->|REST API Requests| B(🌐 Backend API <br> Python, FastAPI);
    B -->|User Data| C{DB <br> SQLite/PostgreSQL};
    B -->|Media Files| D[☁️ Cloud Storage <br> AWS S3];
    B -->|AI Analysis| E[🤖 AI Service <br> TensorFlow.js Model];
    D -->|Cached Content| F[🌍 Global CDN];
    F --> A;
````

**👉 [Dive into the Full Technical Details](docs/TECHNICAL_ARCHITECTURE.md)**

## 🚀 Quick Start

Get the project running on your local machine in under 5 minutes.

**Prerequisites:** Node.js (v18+), Python (v3.10+), and the Expo Go app on your mobile device.

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/kingkw1/2Truths-1Lie.git](https://github.com/kingkw1/2Truths-1Lie.git)
    cd 2Truths-1Lie
    ```

2.  **Start the backend server:**

    ```bash
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8001
    ```

3.  **Launch the mobile app:**

    ```bash
    cd mobile
    npm install
    npm start
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
- **Backend Authentication**: JWT token system generated from Kiro specs
- **Mobile State Management**: Redux store and hooks generated with Kiro assistance
- **API Documentation**: Auto-generated from Kiro design specifications
- **Testing Framework**: Comprehensive test suites built using Kiro patterns

**🚀 Production Readiness:**
- ✅ **Deployed Backend**: Live FastAPI server with monitoring
- ✅ **Mobile App Store**: Google Play Store submission ready
- ✅ **Security Compliance**: JWT authentication, input validation, content moderation
- ✅ **Scalable Architecture**: Cloud storage, CDN, database optimization

**📱 Judge Access:**
- **Live App**: Available on Google Play Store (scan QR in [`submission_materials/`](submission_materials/))
- **Demo Video**: 3-minute walkthrough following submission script
- **Source Code**: Full repository with organized documentation

### 🎯 Key Differentiators

1. **Spec-First Development**: Every major feature started as a Kiro specification
2. **Production Quality**: Real app with paying users potential, not just a prototype
3. **AI Integration**: Content moderation and video processing with AI assistance
4. **Mobile + Backend**: Full-stack application with sophisticated architecture
5. **Developer Experience**: Comprehensive tooling and documentation for future development

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.

-----

<div align="center">
Built with ❤️ and a Kiro 🤖 Partnership
</div>
