const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Simplified config - polyfill is now in index.js directly
// No need for additional module loading since we handle it in entry point

// Enable React Native 0.81 features
config.resolver = {
  ...config.resolver,
  platforms: ['native', 'android', 'ios', 'web'],
};

// SDK 54 transformer settings
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: true,
      inlineRequires: false, // Ensure polyfills load properly
    },
  }),
};

module.exports = config;
