// React Native polyfills for Hermes engine
import 'react-native-url-polyfill/auto';

// Use proper FormData implementation
const FormDataPolyfill = require('form-data');

// Ensure FormData is available globally with proper methods
if (typeof global.FormData === 'undefined' || !global.FormData.prototype.append) {
  global.FormData = FormDataPolyfill;
}

// Ensure fetch is available (should be by default in RN)
if (typeof global.fetch === 'undefined') {
  const fetchImpl = require('react-native/Libraries/Network/fetch');
  global.fetch = fetchImpl.fetch;
}

// Console warning to verify polyfills are loaded
console.log('🔧 Polyfills loaded:', {
  FormData: typeof global.FormData !== 'undefined',
  FormDataAppend: typeof global.FormData?.prototype?.append !== 'undefined',
  fetch: typeof global.fetch !== 'undefined',
});
