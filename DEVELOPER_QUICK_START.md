# 🚀 Developer Quick Start Guide

## ⚡ Get Running in 5 Minutes

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```
**Result**: Backend running on http://192.168.50.111:8001

### 2. Mobile Setup
```bash
cd mobile
npm install
npm start
```
**Result**: Scan QR code with Expo Go app

### 3. Test Complete Flow
1. **Record Statements**: Use mobile app to record 3 individual statement videos
2. **Auto-Merge**: App automatically merges videos with segment metadata
3. **Upload**: Merged video uploads to S3 with segment information
4. **Create Challenge**: Submit challenge with merged video data
5. **Test Playback**: Use segmented video player to test individual statement playback

## 🎯 What's Working Now

✅ **Segment-Based Video System**: Record 3 statements, auto-merge with metadata  
✅ **Video Upload System**: 15+ successful uploads to AWS S3  
✅ **Challenge Creation**: Backend integration with merged video support  
✅ **Segmented Playback**: Interactive statement selection and playback  
✅ **Mobile App**: Local builds and deployment  
✅ **Network Integration**: App connects to local backend  

## 🔧 Current Development Focus

**Priority**: Debug authenticated challenge endpoints  
**Next**: Implement challenge browse and gameplay screens  
**Goal**: Complete end-to-end gameplay experience  

## 📋 Quick Commands

```bash
# Check backend health
curl "http://192.168.50.111:8001/api/v1/s3-media/health/s3"

# Generate test auth token
cd backend && python -c "from services.auth_service import AuthService; print(AuthService().create_access_token({'sub': 'test-user'}))"

# Build and deploy mobile app
cd mobile && ./build-and-deploy.sh

# Monitor mobile app logs
adb logcat | grep -E "(CHALLENGE:|UPLOAD:)"
```

## 🐛 Common Issues

### Backend not starting
```bash
# Check dependencies
cd backend && pip install -r requirements.txt

# Verify AWS credentials
aws s3 ls s3://2truths1lie-media-uploads
```

### Mobile app not connecting
```bash
# Check IP address
hostname -I | awk '{print $1}'

# Update mobile API URL in realChallengeAPI.ts
```

### Upload failures
```bash
# Check S3 permissions
aws s3api head-bucket --bucket 2truths1lie-media-uploads

# Monitor backend logs
cd backend && tail -f logs/upload.log
```

## 📚 Documentation

- **[Backend Integration Plan](../BACKEND_INTEGRATION_PLAN.md)** - Complete development roadmap
- **[Media System Guide](docs/MEDIA_SYSTEM_COMPLETE_GUIDE.md)** - Video upload and streaming system
- **[Mobile Testing](docs/mobile-testing.md)** - Mobile app testing workflows

## 🎯 Current Status

**Media System**: Production Ready ✅  
**Challenge Creation**: Working via test endpoints ✅  
**Challenge Retrieval**: Needs debugging 🔄  
**Gameplay**: Ready for implementation 🔄  

**Ready to build the gameplay experience!** 🎮
