// POLYFILL ENTRY POINT FOR EXPO GO COMPATIBILITY
// This file loads polyfills and then the main app

console.log('🔧 [EXPO-ENTRY] Installing targeted polyfills...');

// Instead of using the full 'auto' polyfill, let's be more selective
// and only install the polyfills we actually need

// Manual FormData polyfill that doesn't require external dependencies
if (typeof global.FormData === 'undefined') {
  console.log('🔧 [EXPO-ENTRY] Installing FormData polyfill...');
  
  function FormDataPolyfill() {
    this._parts = [];
  }
  
  FormDataPolyfill.prototype.append = function(name, value, filename) {
    this._parts.push({
      name: name,
      value: value,
      filename: filename || (value && value.name) || 'file'
    });
  };
  
  FormDataPolyfill.prototype.get = function(name) {
    const part = this._parts.find(function(p) { return p.name === name; });
    return part ? part.value : null;
  };
  
  FormDataPolyfill.prototype.getAll = function(name) {
    return this._parts.filter(function(p) { return p.name === name; }).map(function(p) { return p.value; });
  };
  
  FormDataPolyfill.prototype.has = function(name) {
    return this._parts.some(function(p) { return p.name === name; });
  };
  
  FormDataPolyfill.prototype.delete = function(name) {
    this._parts = this._parts.filter(function(p) { return p.name !== name; });
  };
  
  FormDataPolyfill.prototype.keys = function() {
    return this._parts.map(function(p) { return p.name; });
  };
  
  FormDataPolyfill.prototype.values = function() {
    return this._parts.map(function(p) { return p.value; });
  };
  
  FormDataPolyfill.prototype.entries = function() {
    return this._parts.map(function(p) { return [p.name, p.value]; });
  };

  FormDataPolyfill.prototype[Symbol.iterator] = function() {
    return this.entries()[Symbol.iterator]();
  };

  // Install globally
  global.FormData = FormDataPolyfill;
  if (typeof globalThis !== 'undefined') globalThis.FormData = FormDataPolyfill;
  if (typeof window !== 'undefined') window.FormData = FormDataPolyfill;
  
  console.log('✅ [EXPO-ENTRY] FormData polyfill installed');
} else {
  console.log('✅ [EXPO-ENTRY] FormData already available');
}

console.log('✅ [EXPO-ENTRY] Targeted polyfills installed');

// Verify FormData is now available
if (typeof global.FormData !== 'undefined') {
  console.log('✅ [EXPO-ENTRY] FormData is available');
} else {
  console.error('❌ [EXPO-ENTRY] FormData still not available!');
}

// Load the main app
console.log('🚀 [EXPO-ENTRY] Loading main app...');
require('./index.js');
