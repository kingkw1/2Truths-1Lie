#!/bin/bash

# Enhanced Video Merging Dependencies Installation Script
# This script adds the necessary dependencies for true video concatenation

echo "🎬 Installing enhanced video merging dependencies..."

# Add FFmpeg support for React Native (optional but recommended)
echo "📦 Adding FFmpeg support..."
npm install --save ffmpeg-kit-react-native

# Add additional video processing utilities
echo "📦 Adding video processing utilities..."
npm install --save react-native-video-processing
npm install --save react-native-ffmpeg

# Add native module linking utilities
echo "📦 Adding native module utilities..."
npm install --save react-native-fs

# Add enhanced media library support
echo "📦 Enhancing media library support..."
npm install --save @react-native-async-storage/async-storage
npm install --save react-native-background-job

# Install development dependencies
echo "📦 Installing development dependencies..."
npm install --save-dev @types/react-native-video

# Platform-specific configurations
echo "🔧 Configuring platform-specific settings..."

# Create metro config updates
cat > metro.config.enhanced.js << 'EOF'
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for FFmpeg native modules
config.resolver.assetExts.push(
  // Video formats
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  // Audio formats  
  'm4a', 'aac', 'mp3',
  // FFmpeg specific
  'so', 'a', 'dylib'
);

// Configure for React Native video processing
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'jsx', 'js', 'ts', 'tsx'
];

module.exports = config;
EOF

# Create FFmpeg configuration
cat > ffmpeg.config.js << 'EOF'
// FFmpeg configuration for React Native
export const FFmpegConfig = {
  // Enable hardware acceleration where available
  enableHardwareAcceleration: true,
  
  // Logging level for debugging
  logLevel: 'info',
  
  // Default video settings
  defaultVideoCodec: 'libx264',
  defaultAudioCodec: 'aac',
  
  // Quality presets
  qualityPresets: {
    high: {
      crf: 18,
      preset: 'slow',
      bitrate: '4M'
    },
    medium: {
      crf: 23,
      preset: 'medium', 
      bitrate: '2M'
    },
    low: {
      crf: 28,
      preset: 'fast',
      bitrate: '1M'
    }
  },
  
  // Platform-specific settings
  ios: {
    enableMetalRenderer: true,
    enableHardwareDecoding: true
  },
  
  android: {
    enableOpenGLRenderer: true,
    enableHardwareDecoding: true,
    enableMediaCodec: true
  }
};
EOF

# Create enhanced package.json additions
cat > package.enhanced.json << 'EOF'
{
  "dependencies": {
    "ffmpeg-kit-react-native": "^6.0.2",
    "react-native-video-processing": "^2.2.0", 
    "react-native-ffmpeg": "^0.5.2",
    "react-native-fs": "^2.20.0",
    "react-native-background-job": "^0.0.6"
  },
  "devDependencies": {
    "@types/react-native-video": "^5.0.14"
  },
  "scripts": {
    "postinstall:ios": "cd ios && pod install",
    "postinstall:android": "cd android && ./gradlew clean",
    "ffmpeg:info": "npx react-native run-android --variant=release --verbose",
    "video:test": "jest src/**/*video*.test.ts"
  },
  "react-native": {
    "ffmpeg-kit-react-native": "ffmpeg-kit-react-native"
  }
}
EOF

echo "📱 Configuring iOS settings..."
cat > ios-config.md << 'EOF'
# iOS Configuration for Enhanced Video Merging

## Podfile additions:
```ruby
pod 'ffmpeg-kit-react-native-min', :subspecs => ['https-gpl'], :path => '../node_modules/ffmpeg-kit-react-native'
```

## Info.plist additions:
```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to record video statements</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access to record audio with videos</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs photo library access to save and retrieve videos</string>
```

## Build settings:
- Enable bitcode: NO
- Enable modules: YES
- Always embed swift standard libraries: YES
EOF

echo "🤖 Configuring Android settings..."
cat > android-config.md << 'EOF'
# Android Configuration for Enhanced Video Merging

## android/app/build.gradle additions:
```gradle
android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsc.so'
        pickFirst '**/libfb.so'
    }
}

dependencies {
    implementation 'com.arthenica:ffmpeg-kit-min-gpl:4.5.1'
}
```

## AndroidManifest.xml permissions:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```
EOF

echo "✅ Enhanced video merging dependencies installation complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to install the new dependencies"
echo "2. For iOS: cd ios && pod install"
echo "3. For Android: cd android && ./gradlew clean"
echo "4. Review ios-config.md and android-config.md for platform-specific setup"
echo "5. Update your metro.config.js with the enhanced configuration"
echo ""
echo "⚠️  Note: FFmpeg integration requires native code changes."
echo "   Make sure to test thoroughly on both platforms."
