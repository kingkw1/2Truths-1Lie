# Basic ProGuard rules for React Native / Expo app
# Keep React Native components
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Keep Expo modules
-keep class expo.modules.** { *; }
-keep class com.** { *; }

# Keep AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Keep camera and media library classes
-keep class expo.modules.camera.** { *; }
-keep class expo.modules.medialibrary.** { *; }

# Don't warn about missing classes that are platform-specific
-dontwarn java.nio.file.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# Keep line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable

# Keep annotation classes
-keepattributes *Annotation*

# Standard Android optimizations
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose
