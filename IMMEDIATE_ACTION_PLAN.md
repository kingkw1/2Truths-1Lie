# 🚀 IMMEDIATE TESTING & DEPLOYMENT PLAN

## ✅ Current Status
- **Backend**: ✅ Running on `http://127.0.0.1:8001`
- **Mobile App**: ✅ Running with Expo at `exp://192.168.50.111:8081`
- **S3 Integration**: ✅ Configured and ready
- **API Endpoints**: ✅ Available at `http://127.0.0.1:8001/docs`

## 🎯 NEXT STEPS (Recommended Order)

### Step 1: Quick Backend Test (5 minutes)
```bash
# Test S3 health endpoint
curl "http://127.0.0.1:8001/api/v1/s3-media/health/s3"

# Should return:
# {"success": true, "service": "S3 Media Service", "bucket": "2truths1lie-media-uploads", "region": "us-east-1", "status": "healthy"}
```

### Step 2: Update Mobile API Configuration (10 minutes)
Your mobile app is running on `192.168.50.111:8081`. You need to:

1. **Find your mobile API config file:**
   ```bash
   find /home/kevin/Documents/2Truths-1Lie/mobile -name "*.ts" -o -name "*.js" | xargs grep -l "localhost\|127.0.0.1\|api" | head -5
   ```

2. **Update the API base URL** to use your computer's IP address:
   ```typescript
   // Instead of: http://localhost:8001
   // Use: http://192.168.50.111:8001
   ```

3. **Find your computer's IP:**
   ```bash
   hostname -I | awk '{print $1}'
   ```

### Step 3: Test Mobile-Backend Connection (10 minutes)
1. **Scan the QR code** with your phone using Expo Go app
2. **Try making an API call** from your mobile app to the backend
3. **Check if the mobile app can reach** `http://[YOUR-IP]:8001/api/v1/s3-media/health/s3`

### Step 4: Test Video Upload Flow (15 minutes)
1. **Use your mobile app** to record a short video
2. **Attempt to upload** it through the challenge creation flow
3. **Check S3 bucket** to see if the video was uploaded
4. **Verify streaming** by accessing the returned URL

### Step 5: Deploy to Phone for Real Testing (30 minutes)

#### Option A: Build APK for Direct Installation
```bash
cd /home/kevin/Documents/2Truths-1Lie/mobile

# Build development APK
eas build --platform android --profile preview

# Download and install APK on your phone
# (EAS will provide download link)
```

#### Option B: Use Expo Go (Immediate)
Since your app is already running, you can:
1. **Install Expo Go** on your phone from Play Store
2. **Scan the QR code** shown in terminal
3. **Test immediately** without building

## 🔧 Quick Fixes You Might Need

### If Mobile Can't Reach Backend:
```bash
# 1. Check firewall
sudo ufw allow 8001

# 2. Start backend with external access
cd /home/kevin/Documents/2Truths-1Lie/backend
python -m uvicorn main:app --reload --port 8001 --host 0.0.0.0
```

### If Authentication Fails:
```bash
# Temporarily disable auth for testing (in s3_media_endpoints.py)
# Comment out: current_user: str = Depends(get_current_user)
# Add: current_user: str = "test-user"
```

### If S3 Upload Fails:
1. **Check AWS credentials** in `.env` file
2. **Verify S3 bucket exists** and permissions are correct
3. **Test S3 access** with AWS CLI: `aws s3 ls s3://2truths1lie-media-uploads`

## 📱 IMMEDIATE TESTING WORKFLOW

### Test 1: Health Check from Phone
```javascript
// In your mobile app, test this endpoint:
fetch('http://192.168.50.111:8001/api/v1/s3-media/health/s3')
  .then(response => response.json())
  .then(data => console.log('Backend connection:', data))
  .catch(error => console.error('Connection failed:', error));
```

### Test 2: Video Upload
Use your existing challenge creation flow, but ensure it calls:
```javascript
// POST http://192.168.50.111:8001/api/v1/s3-media/upload
// With FormData containing the video file
```

### Test 3: Video Streaming
After upload, test that you can play the video using the returned signed URL.

## 🎯 SUCCESS CRITERIA

✅ **Backend Health Check** - Mobile app can reach backend API  
✅ **Video Upload** - Can successfully upload video from phone to S3  
✅ **Video Streaming** - Can play uploaded video from S3 URL  
✅ **Challenge Flow** - Complete challenge creation and sharing works  

## 🚀 PRODUCTION DEPLOYMENT (After Testing)

Once local testing works:

1. **Deploy Backend** to Railway/Render/DigitalOcean
2. **Update Mobile API URL** to production domain
3. **Build Production APK/iOS** with `eas build --platform android --profile production`
4. **Test Production Flow** end-to-end

## ⚡ START HERE RIGHT NOW:

1. **Open a new terminal** and run:
   ```bash
   curl "http://127.0.0.1:8001/api/v1/s3-media/health/s3"
   ```

2. **Find your IP address:**
   ```bash
   hostname -I | awk '{print $1}'
   ```

3. **Update your mobile app** to use that IP instead of localhost

4. **Scan the QR code** with Expo Go and test!

This will get you testing your complete video upload flow on your actual phone within the next 30 minutes! 🎉
