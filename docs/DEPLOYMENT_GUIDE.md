# 🚀 Deployment Guide

## Overview
Production deployment guide for the **2Truths-1Lie** project, covering both mobile app deployment to Google Play Store and backend server deployment on Railway. This guide reflects the **live production deployment** with integrated RevenueCat monetization for the Shipaton program.

> **💰 RevenueCat Deployment**: This deployment process includes RevenueCat subscription management and premium feature deployment. All monetization features have been validated in production environments.

## 📱 Mobile App Deployment

### Current Production Status
**✅ Live on Google Play Store**: Successfully deployed using EAS Build infrastructure

### Development Deployment

#### Expo Development Build
```bash
cd mobile
npm install

# Start development server
npm start
# Scan QR code with Expo Go app for instant testing
```

#### Local Development Testing
```bash
# Run on connected Android device
npx expo run:android

# Run on Android emulator
npx expo run:android --device
```

### Production Deployment (Google Play Store)

#### EAS Build Setup (Production-Ready)
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Authenticate with Expo account
eas login

# Initialize project configuration
eas build:configure
```

#### Production Build Configuration (`eas.json`)
```json
{
  "cli": {
    "version": ">= 8.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"  // Required for Google Play Store
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

#### Production Build Commands
```bash
# Development build for testing
eas build --platform android --profile development

# Preview APK for manual testing
eas build --platform android --profile preview

# Production AAB for Google Play Store (USED IN PRODUCTION)
eas build --platform android --profile production
```

### Google Play Store Deployment (Live Production)

#### Prerequisites Completed
1. **✅ Google Play Developer Account**: $25 registration fee paid
2. **✅ App Signing Key**: Managed by Google Play App Signing
3. **✅ App Bundle**: Generated via EAS Build system
4. **✅ Production Credentials**: Configured in EAS

#### Production Deployment Process
1. **Build Production AAB**:
   ```bash
   cd mobile
   eas build --platform android --profile production
   ```

2. **Upload to Google Play Console**:
   - Navigate to Google Play Console
   - Select app → Production → Create Release
   - Upload AAB file from EAS Build
   - Complete store listing details

3. **Store Listing Configuration**:
   - **App Name**: "2Truths 1 Lie"
   - **Short Description**: "Create video challenges mixing truths and lies"
   - **Full Description**: Emphasizes video creation, social gameplay, and premium features
   - **Category**: Social/Entertainment
   - **Target Audience**: 13+ (Teen)

#### App Store Assets (Production)
- **📱 App Icon**: 512x512 high-resolution adaptive icon
- **📸 Screenshots**: 
  - Phone screenshots (1080x1920)
  - Tablet screenshots (optional)
  - Feature graphic (1024x500)
- **🎥 App Preview Video**: Optional promotional video
- **📋 Privacy Policy**: Required for data collection compliance

### Version Management (Production)
```json
// mobile/app.json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1,
      "package": "com.revenuecat.twotruthsonelie"
    }
  }
}
```

```bash
# Update version for new release
npm version patch  # Updates package.json
# Manually update app.json versionCode

# Build new version
eas build --platform android --profile production
```

## 🖥 Backend Deployment

### Current Production Status
**✅ Live on Railway**: https://2truths-1lie-production.up.railway.app

### Development Environment
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start development server
python run.py
# Server available at http://localhost:8001
```

### Production Deployment (Railway - Current)

#### Railway Setup Process
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

#### Production Configuration
```toml
# nixpacks.toml (Railway build configuration)
[phases.setup]
nixPkgs = ['python312', 'ffmpeg']

[phases.install]
cmds = ['pip install -r requirements.txt']

[phases.build]
cmds = ['echo "Build completed"']

[start]
cmd = 'python run.py'
```

#### Environment Variables (Production)
```bash
# Set in Railway dashboard
DATABASE_URL=sqlite:///challenges.db
JWT_SECRET_KEY=<production-secret-key>
UPLOAD_FOLDER=uploads/
MAX_UPLOAD_SIZE=104857600
FFMPEG_PATH=/usr/bin/ffmpeg
PORT=8001
```

#### Deployment Commands
```bash
# Deploy to Railway (automatic from git push)
git push origin main

# Manual deployment
railway up

# View logs
railway logs

# Connect to production environment
railway connect
```

### Alternative Deployment Options

#### Option 1: Docker Deployment
```dockerfile
# Dockerfile
FROM python:3.12-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8001

CMD ["python", "run.py"]
```

```bash
# Build and run
docker build -t 2truths-backend .
docker run -p 8001:8001 -e JWT_SECRET_KEY=your-secret 2truths-backend
```

#### Option 2: Traditional VPS Deployment
```bash
# Install dependencies
sudo apt update
sudo apt install python3.12 python3-pip ffmpeg

# Clone repository
git clone <repository-url>
cd 2Truths-1Lie/backend

# Install Python dependencies
pip install -r requirements.txt

# Install process manager
pip install gunicorn

# Start production server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

## 🔧 Production Configuration

### Database Setup
```python
# config.py (Production)
DATABASE_URL = "sqlite:///challenges.db"  # File-based SQLite for simplicity
SQLALCHEMY_DATABASE_URI = DATABASE_URL
SQLALCHEMY_TRACK_MODIFICATIONS = False
```

### File Storage Configuration
```python
# Local file storage (production-ready for current scale)
UPLOAD_FOLDER = "uploads/"
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB limit
ALLOWED_EXTENSIONS = {'mp4', 'mov', 'avi'}
```

### Security Configuration
```python
# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')  # Must be set in production
JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

# CORS Configuration
CORS_ORIGINS = [
    "https://2truths-1lie-production.up.railway.app",
    "exp://192.168.*.*:*",  # Expo development
]
```

## 📊 Production Monitoring

### Health Checks
```bash
# API Health Check
curl https://2truths-1lie-production.up.railway.app/

# Database Health
curl https://2truths-1lie-production.up.railway.app/docs

# Video Processing Health
curl -X POST https://2truths-1lie-production.up.railway.app/api/challenge-videos/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.mp4"
```

### Performance Monitoring
- **Railway Dashboard**: Built-in metrics and logging
- **Response Times**: API endpoint performance tracking
- **Error Rates**: Automatic error detection and alerting
- **Resource Usage**: CPU, memory, and storage monitoring

### Logging and Debugging
```bash
# View Railway logs
railway logs --tail

# Enable debug logging
railway variables set LOG_LEVEL=DEBUG

# View specific service logs
railway logs --service backend
```

## 🔐 Production Security

### SSL/TLS Configuration
- **Railway**: Automatic HTTPS with Let's Encrypt certificates
- **Custom Domain**: Configure via Railway dashboard
- **CORS**: Properly configured for mobile app origins

### Environment Security
- **Secrets Management**: All sensitive data in environment variables
- **JWT Security**: Production-grade secret key rotation
- **File Upload Security**: Size limits and format validation
- **API Rate Limiting**: Built-in protection against abuse

## 🚨 Troubleshooting Production Issues

### Common Mobile Deployment Issues
1. **Build Failures**: Check EAS build logs for detailed error messages
2. **Signing Issues**: Ensure proper Google Play App Signing configuration
3. **Upload Rejections**: Verify app bundle meets Google Play requirements
4. **Version Conflicts**: Increment versionCode for each release

### Common Backend Deployment Issues
1. **FFmpeg Not Found**: Ensure FFmpeg is installed in production environment
2. **Database Connection**: Check SQLite file permissions and path
3. **File Upload Failures**: Verify upload directory exists and is writable
4. **Authentication Errors**: Validate JWT_SECRET_KEY configuration

### Debug Commands
```bash
# Test video processing locally
python -c "from services.video_merge_service import VideoMergeService; print('FFmpeg OK')"

# Validate database
python -c "from models import db; db.create_all(); print('Database OK')"

# Test API endpoints
curl -X GET https://2truths-1lie-production.up.railway.app/docs
```

## 🔗 Related Documentation
- [Backend Development Guide](BACKEND_GUIDE.md) - Server development and configuration
- [Mobile Development Guide](MOBILE_GUIDE.md) - React Native app development
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md) - System architecture overview
- [API Documentation](api.md) - Complete API reference
- [Main README](../README.md) - Project overview and RevenueCat integration

```bash
# Build and run
docker build -t 2truths-backend .
docker run -p 8001:8001 -e DATABASE_URL=... 2truths-backend
```

#### Option 3: Railway/Heroku Deployment
```bash
# Railway deployment
railway login
railway link
railway up

# Heroku deployment
heroku create 2truths-1lie-api
git push heroku main
```

### Environment Configuration

#### Production Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
SQLITE_URL=sqlite:///./production.db

# AWS S3
S3_BUCKET_NAME=your-production-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Application
ENVIRONMENT=production
DEBUG=false
ALLOWED_ORIGINS=https://yourdomain.com
```

#### SSL/HTTPS Setup
```nginx
# Nginx configuration
server {
    listen 443 ssl;
    server_name api.2truths1lie.app;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🌐 Infrastructure Setup

### Domain & DNS
1. **Domain Registration**: Register domain (e.g., 2truths1lie.app)
2. **DNS Configuration**: Point to server IP
3. **SSL Certificate**: Use Let's Encrypt or CloudFlare

### Cloud Storage (AWS S3)
```bash
# Create S3 bucket
aws s3 mb s3://2truths-1lie-media

# Configure CORS
aws s3api put-bucket-cors --bucket 2truths-1lie-media --cors-configuration file://cors.json
```

### CDN Setup (CloudFlare)
1. **Add Domain**: Add domain to CloudFlare
2. **Configure DNS**: Update nameservers
3. **Enable CDN**: Automatic global distribution
4. **SSL/TLS**: Enable flexible SSL

## 📊 Monitoring & Analytics

### Application Monitoring
```python
# Health check endpoints
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/health/database")
async def database_health():
    # Check database connectivity
    pass

@app.get("/health/s3")
async def s3_health():
    # Check S3 connectivity
    pass
```

### Error Tracking
- **Sentry**: Error tracking and performance monitoring
- **LogRocket**: Session replay for debugging
- **DataDog**: Infrastructure monitoring

### Analytics
- **Google Analytics**: User behavior tracking
- **Mixpanel**: Event tracking and funnels
- **Custom Analytics**: In-app game statistics

## 🔧 CI/CD Pipeline

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend && python -m pytest
          cd mobile && npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Deploy backend to server
          
  build-mobile:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build mobile app
        run: |
          cd mobile
          eas build --platform android --profile production --non-interactive
```

