# 📚 2Trut---

## 🏆 **RevenueCat Shipaton Submission**

This project evolved from a hackathon prototype into a **production-ready monetized mobile app**, demonstrating the complete journey from concept to Google Play Store deployment with integrated RevenueCat monetization.

### 🎯 **Submission Materials**
- **🎬 Demo Video**: [submission_materials/](../submission_materials/) 
- **📱 Live App**: Google Play Store with QR code access
- **💰 Monetization**: Full RevenueCat integration with subscriptions and consumables
- **📊 Analytics**: Complete revenue tracking and user engagement metrics

### 🚀 **Production Achievements**
- **✅ Google Play Store**: Live deployment with working monetization
- **✅ RevenueCat Integration**: Subscriptions, consumables, and webhooks
- **✅ Production Backend**: Railway deployment with comprehensive APIs
- **✅ Complete Game Loop**: Recording, challenges, scoring, and progression

---ation Hub

> **Production-Ready Mobile Social Game** | **Google Play Store Live** | **RevenueCat Shipaton Winner**

**Quick Navigation**: [🏆 Project Overview](#-what-is-2truths-1lie) • [🚀 Get Started](#-quick-start) • [🏗 Architecture](#-technical-architecture) • [⚙️ Admin Guide](ADMIN_GUIDE.md) • [📋 API Docs](api.md)*Quick Navigation**: [🏆 Hackathon Submission](#-hackathon-submission) • [🚀 Get Started](#-quick-start) • [🏗 Architecture](#-technical-architecture) • [⚙️ Admin Guide](ADMIN_GUIDE.md) • [🤖 Kiro Integration](#-kiro-integration)2Truths-1Lie: Documentation Hub

> **Kiro-Powered Mobile Social Game** | **Production Ready** | **Google Play Store Live**

**Quick Navigation**: [🏆 Hackathon Submission](#-hackathon-submission) • [� Get Started](#-quick-start) • [🏗 Architecture](#-technical-architecture) • [🤖 Kiro Integration](#-kiro-integration)

---

## � **Hackathon Submission**

This project was built for the **Code with Kiro Hackathon**, demonstrating how Kiro's spec-driven development transforms ideas into production-ready code.

### 🎯 **Submission Materials**
- **🎬 Demo Video**: [submission_materials/DEMO_VIDEO_LINK](../submission_materials/) 
- **📱 Live App**: Google Play Store submission with QR code access
- **� All Assets**: [submission_materials/](../submission_materials/) directory

### 🤖 **Kiro Integration Evidence**
- **📋 Complete Specs**: [`.kiro/specs/`](../.kiro/specs/) - All major features spec-driven
- **🔧 Agent Hooks**: [`.kiro/hooks/`](../.kiro/hooks/) - Future automation setup
- **📖 Steering Docs**: [`.kiro/steering/`](../.kiro/steering/) - Technical guidance

---

## 🎮 **What is 2Truths-1Lie?**

A **production-ready mobile social game** that modernizes the classic party icebreaker with sophisticated video recording and processing. Players create video challenges combining true and false statements, with community voting and engagement features.

### ✨ **Core Features**
- **📹 Advanced Video Recording**: expo-camera integration with permission handling and validation
- **� Real-time Video Processing**: FFmpeg-powered backend for seamless video merging
- **� Secure Authentication**: JWT-based user system with production deployment
- **☁️ Production Backend**: FastAPI server deployed on Railway with SQLite database
- **📱 Mobile App**: React Native with EAS Build for Google Play Store deployment

### 🏆 **Production Achievements**
- **✅ Live Google Play Store App**: Successfully deployed with working video features
- **✅ Railway Backend**: Production FastAPI server with monitoring
- **✅ Video Pipeline**: Complete recording → upload → processing → viewing workflow
- **✅ EAS Build Integration**: Proper signing credentials and deployment automation

---

## 🚀 **Quick Start**

Get the project running on your local machine in under 5 minutes.

**Prerequisites:** Node.js (v18+), Python (v3.10+), and the Expo Go app on your mobile device.

```bash
# Clone repository
git clone https://github.com/kingkw1/2Truths-1Lie.git
cd 2Truths-1Lie

# Start backend server
cd backend
pip install -r requirements.txt
python run.py

# Launch mobile app
cd mobile
npm install
npx expo start
```

**📱 Scan QR code with Expo Go app to test immediately**

---

## 🏗 **Technical Architecture**

Modern, decoupled architecture designed for scalability:

```mermaid
graph TD
    A[📱 Mobile App <br> React Native, Expo, expo-camera] -->|REST API| B(🌐 Backend API <br> Python FastAPI, Railway);
    B -->|Challenge Data| C[(🗄️ Database <br> SQLite)];
    B -->|Video Files| D[📁 Local Storage <br> Backend uploads/];
    B -->|Video Processing| E[🎬 FFmpeg Service <br> Video Merging];
    A -->|Video Upload| B;
    E -->|Merged Videos| D;
    B -->|JWT Auth| F[� Authentication <br> Secure Tokens];
```

**Key Technical Achievements:**
- **Mobile Video Pipeline**: Complex expo-camera workflows with validation
- **Backend Processing**: FFmpeg integration for professional video merging  
- **Production Deployment**: Railway + EAS Build for scalable hosting
- **Security**: JWT authentication with proper mobile integration

---

## 💰 **Monetization & RevenueCat**

Complete monetization strategy implemented for sustainable growth:

### � **Premium Features**
- **Pro Subscriptions**: Unlimited challenge creation + Pro badge
- **Token System**: Consumable hints with "Wizard of Oz" 50/50 functionality
- **Progressive Rewards**: Score-based progression and achievements
- **Social Features**: Enhanced sharing and community engagement

### 🔗 **RevenueCat Integration**
- **Subscription Management**: Monthly/Annual Pro plans
- **Webhook Processing**: Real-time purchase verification and token grants
- **Analytics**: Revenue tracking and user engagement metrics
- **Cross-Platform**: Consistent monetization across iOS/Android

---

## 📚 **Documentation Structure**

### 📍 **Essential Starting Points**
| Document | Purpose |
|----------|---------|
| **[API Documentation](api.md)** | Complete REST API reference |
| **[Technical Architecture](TECHNICAL_ARCHITECTURE.md)** | System design and component relationships |
| **[Security Checklist](SECURITY_CHECKLIST.md)** | Production security implementation |

### 🏗️ **Architecture & Development**
- **[Mobile Development Guide](MOBILE_GUIDE.md)** - React Native setup and patterns
- **[Backend Guide](BACKEND_GUIDE.md)** - Python FastAPI development guide
- **[Admin Guide](ADMIN_GUIDE.md)** - System administration and moderation tools
- **[API Documentation](api.md)** - Complete REST API reference
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment processes

### 🧪 **Testing & Quality**
- **[Testing Guide](TESTING_GUIDE.md)** - Comprehensive testing strategies
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to the project

### 🎯 **Project Context**
- **[Product Overview](PRODUCT_OVERVIEW.md)** - Business case and features
- **[Development Plan](DEVELOPMENT_PLAN.md)** - Project roadmap and milestones

---

## 📁 **Repository Structure**

```
2Truths-1Lie/
├── README.md                    # 🏠 Main project homepage
├── .kiro/                       # 🤖 Kiro spec-driven development
│   ├── specs/                   # 📋 Complete feature specifications
│   ├── hooks/                   # � Agent automation hooks
│   └── steering/                # 📖 Technical guidance docs
├── mobile/                      # 📱 React Native mobile app
├── backend/                     # 🖥 Python FastAPI server
├── docs/                        # 📚 This documentation hub
├── submission_materials/        # 🏆 Hackathon submission assets
├── scripts/                     # � Development and testing scripts
├── tools/                       # 🔧 Utilities and validation tools
└── assets/                      # � App icons and graphics
```

---

## 🎯 **For Different Audiences**

### 🏆 **Hackathon Judges**
1. **Start here**: [Main README](../README.md) for project overview
2. **Kiro Integration**: [`.kiro/specs/README.md`](../.kiro/specs/README.md) for spec-driven evidence
3. **Technical Details**: [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
4. **Live Demo**: [submission_materials/](../submission_materials/) for QR code and access

### � **Developers**
1. **Getting Started**: [Developer Quick Start](DEVELOPER_QUICK_START.md)
2. **Mobile Development**: [Mobile Guide](MOBILE_GUIDE.md) 
3. **Backend Development**: [Backend Guide](BACKEND_GUIDE.md)
4. **API Integration**: [API Documentation](api.md)

### 🔧 **Contributors**
1. **How to Contribute**: [Contributing Guidelines](CONTRIBUTING.md)
2. **Testing Strategy**: [Testing Guide](TESTING_GUIDE.md)
3. **Deployment Process**: [Deployment Guide](DEPLOYMENT_GUIDE.md)

---

## � **Project Status**

### ✅ **Production Ready**
- **Mobile App**: Live on Google Play Store with video recording
- **Backend API**: Deployed on Railway with JWT authentication  
- **Video Processing**: FFmpeg-powered merging and validation
- **EAS Build**: Automated deployment with proper signing

### 🎯 **Key Differentiators**
- **Spec-First Development**: Every feature started as Kiro specification
- **Production Quality**: Real app with working video features deployed to store
- **Advanced Video Processing**: Sophisticated mobile camera + backend FFmpeg integration
- **Full-Stack**: Complete React Native + FastAPI + Railway deployment

---

## 🔗 **External Resources**

### 🛠 **Development Tools**
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)

### ☁️ **Deployment Platforms**
- [Railway Documentation](https://docs.railway.app/)
- [Google Play Console](https://play.google.com/console/)

---

**Last Updated**: September 14, 2025  
**Documentation Version**: 4.0 (Kiro Hackathon)  
**Status**: Production Ready ✅

---

<div align="center">
Built with ❤️ and a Kiro 🤖 Partnership
</div>
