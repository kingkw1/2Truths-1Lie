# 🤝 Contributing to 2Truths-1Lie

Thank you for your interest in contributing to our AI-powered mobile social game! We welcome bug fixes, feature improvements, mobile optimizations, and AI enhancements.

## 📚 Before You Start

**Read the consolidated documentation first!**

- **[📚 Documentation Index](docs/consolidated/README.md)** - Find the right guide for your area
- **[🎯 Project Overview](docs/consolidated/PROJECT_OVERVIEW.md)** - Understand the project
- **[📱 Mobile Guide](docs/consolidated/MOBILE_GUIDE.md)** - Mobile development setup
- **[🖥 Backend Guide](docs/consolidated/BACKEND_GUIDE.md)** - Backend development setup
- **[🧪 Testing Guide](docs/consolidated/TESTING_GUIDE.md)** - Testing requirements

## 🚀 Quick Start for Contributors

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g @expo/cli`)
- Python 3.12+ for backend development
- Android Studio or iOS development setup

### Development Setup
```bash
# Clone and setup
git clone https://github.com/kingkw1/2Truths-1Lie.git
cd 2Truths-1Lie
npm run demo  # Quick setup for all dependencies

# Start development
npm run start:dev  # Launches both mobile and backend
```

## 📱 Mobile Development

### Code Contributions
- Fork the repository and create your branch from `main`:
```bash
git checkout -b feature/mobile-enhancement
```

- Follow mobile-first coding standards in `.kiro/steering/code-conventions.md`
- Focus on React Native/Expo best practices and native performance
- Write mobile-specific tests with React Native Testing Library
- Test on both iOS and Android platforms where possible

### Mobile-Specific Guidelines
- Commit your changes with descriptive messages.
- Submit a pull request explaining what you’ve changed and why.

### Development Setup
- Refer to our README for environment setup and running the project locally.
- Run tests before submitting PRs:

npm test

text

### Code of Conduct
- Be respectful and open-minded.
- Report unacceptable behavior to the maintainers.
- Remember we all are here to learn and build great software together.

---

Thanks for helping make 2Truths-1Lie awesome!
