# 🚀 Deployment Guide

## Overview
Comprehensive deployment guide for the 2Truths-1Lie project, covering mobile app deployment and backend server deployment.

## 📱 Mobile App Deployment

### Development Deployment

#### Expo Development Build
```bash
cd mobile
npm install
npm start
# Scan QR code with Expo Go app
```

#### Local Android Build
```bash
# Prerequisites: Android SDK and JDK 17
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### Production Deployment

#### EAS Build Setup
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build profiles
eas build:configure
```

#### Build Configuration (`eas.json`)
```json
{
  "cli": {
    "version": ">= 8.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
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

#### Build Commands
```bash
# Development build
eas build --platform android --profile development

# Preview build (APK for testing)
eas build --platform android --profile preview

# Production build (AAB for Google Play)
eas build --platform android --profile production
```

### App Store Deployment

#### Google Play Store Setup
1. **Create Developer Account**: $25 registration fee
2. **Create App Listing**: App details, screenshots, descriptions
3. **Upload Signed AAB**: Use EAS build output
4. **Configure Release Tracks**: Internal testing → Alpha → Beta → Production

#### App Store Optimization
- **App Name**: "2Truths-1Lie: AI Social Game"
- **Description**: Focus on AI features and social gameplay
- **Keywords**: "social game", "video", "AI", "truth", "lie detection"
- **Screenshots**: Show recording interface, gameplay, results
- **Privacy Policy**: Required for data collection

### Version Management
```bash
# Update version in app.json
{
  "expo": {
    "version": "1.2.0",
    "android": {
      "versionCode": 21
    }
  }
}

# Build with new version
eas build --platform android --profile production
```

## 🖥 Backend Deployment

### Development Deployment
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Production Deployment Options

#### Option 1: VPS/Cloud Server
```bash
# Install dependencies
pip install -r requirements.txt
pip install gunicorn

# Production server
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8001
```

#### Option 2: Docker Deployment
```dockerfile
# Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8001

CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8001"]
```

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

### Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] CDN configured
- [ ] Monitoring setup
- [ ] Backup systems in place
- [ ] Performance testing completed

## 🐛 Troubleshooting

### Common Mobile Deployment Issues
1. **Build Failures**: Check dependencies and environment
2. **Signing Issues**: Verify certificates and provisioning profiles
3. **App Store Rejection**: Review guidelines and fix issues
4. **Version Conflicts**: Ensure proper version bumping

### Common Backend Deployment Issues
1. **Database Connection**: Check connection strings and firewall
2. **Environment Variables**: Verify all required variables are set
3. **SSL/HTTPS**: Ensure proper certificate configuration
4. **File Permissions**: Check read/write permissions for uploads

### Performance Optimization
- **Database**: Index optimization and query analysis
- **API**: Response caching and compression
- **Media**: Image/video optimization and CDN
- **Mobile**: Bundle size optimization and lazy loading

## 🔗 Related Documentation
- [Mobile Development Guide](MOBILE_GUIDE.md)
- [Backend Development Guide](BACKEND_GUIDE.md)
- [API Documentation](api.md)
- [Testing Guide](TESTING_GUIDE.md)
