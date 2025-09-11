// Root entry point that properly delegates to mobile app
// This allows running expo commands from root while using mobile dependencies

// Load polyfills first
import 'react-native-polyfill-globals/auto';
import '@react-native/js-polyfills';

// Import and run the mobile app directly
// The mobile/index.js has all the proper polyfills and setup
require('./mobile/index.js');