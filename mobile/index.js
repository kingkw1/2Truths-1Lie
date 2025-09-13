// IMMEDIATE GLOBAL POLYFILL INSTALLATION
// This MUST run before any other code
console.log('� [INDEX] IMMEDIATE polyfill installation starting...');

// Install FormData polyfill IMMEDIATELY using an IIFE
(function installFormDataPolyfill() {
  'use strict';
  
  console.log('🔧 [POLYFILL] Checking global environment...');
  
  // Find the global object in any environment
  let globalObj;
  try {
    if (typeof global !== 'undefined') {
      globalObj = global;
      console.log('🔧 [POLYFILL] Using global object');
    } else if (typeof globalThis !== 'undefined') {
      globalObj = globalThis;
      console.log('🔧 [POLYFILL] Using globalThis object');
    } else if (typeof window !== 'undefined') {
      globalObj = window;
      console.log('🔧 [POLYFILL] Using window object');
    } else if (typeof self !== 'undefined') {
      globalObj = self;
      console.log('🔧 [POLYFILL] Using self object');
    } else {
      throw new Error('No global object found!');
    }
  } catch (e) {
    console.error('❌ [POLYFILL] Failed to find global object:', e);
    return;
  }

  // Check if FormData already exists
  if (typeof globalObj.FormData !== 'undefined') {
    console.log('✅ [POLYFILL] FormData already exists, skipping polyfill');
    return;
  }

  console.log('🔧 [POLYFILL] FormData not found, installing polyfill...');

  // Define FormData polyfill
  function FormDataPolyfill() {
    this._parts = [];
    console.log('🔧 [POLYFILL] New FormData instance created');
  }

  FormDataPolyfill.prototype.append = function(name, value, filename) {
    this._parts.push({
      name: String(name),
      value: value,
      filename: filename || (value && value.name) || 'file'
    });
  };

  FormDataPolyfill.prototype.get = function(name) {
    const part = this._parts.find(function(p) { return p.name === name; });
    return part ? part.value : null;
  };

  FormDataPolyfill.prototype.getAll = function(name) {
    return this._parts
      .filter(function(p) { return p.name === name; })
      .map(function(p) { return p.value; });
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

  // Install on ALL possible global objects
  try {
    globalObj.FormData = FormDataPolyfill;
    if (typeof global !== 'undefined') global.FormData = FormDataPolyfill;
    if (typeof globalThis !== 'undefined') globalThis.FormData = FormDataPolyfill;
    if (typeof window !== 'undefined') window.FormData = FormDataPolyfill;
    if (typeof self !== 'undefined') self.FormData = FormDataPolyfill;
    
    console.log('✅ [POLYFILL] FormData polyfill installed successfully on all global objects');
    
    // Verify installation
    if (typeof FormData !== 'undefined') {
      console.log('✅ [POLYFILL] FormData is now globally accessible');
    } else {
      console.error('❌ [POLYFILL] FormData polyfill installation failed - not globally accessible');
    }
    
  } catch (e) {
    console.error('❌ [POLYFILL] Failed to install FormData polyfill:', e);
  }
})();

// MAIN APP ENTRY POINT
console.log('🚀 [INDEX] App starting...');

// Ensure all polyfills are loaded before importing React Native
console.log('🔧 [INDEX] Verifying FormData availability...');
if (typeof FormData !== 'undefined') {
  console.log('✅ [INDEX] FormData verified available');
} else {
  console.error('❌ [INDEX] FormData still not available!');
}

import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

console.log('🚀 [INDEX] Registering root component...');
try {
  registerRootComponent(App);
  console.log('✅ [INDEX] App registered successfully');
} catch (error) {
  console.error('❌ [INDEX] Failed to register app:', error);
}
