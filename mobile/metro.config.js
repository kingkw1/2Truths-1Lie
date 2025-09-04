const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfills for FormData and other Web APIs that Hermes doesn't support
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Ensure polyfills are loaded before other modules
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
