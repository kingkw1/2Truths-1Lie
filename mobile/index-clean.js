// BULLETPROOF FormData polyfill - MUST run before ANY imports
console.log('🔄 FormData polyfill starting...');

// Create FormData immediately
(function() {
  'use strict';
  
  // Simple, reliable FormData polyfill
  function FormData() {
    this._parts = [];
  }
  
  FormData.prototype.append = function(name, value, filename) {
    this._parts.push({
      name: String(name),
      value: value,
      filename: filename || 'file'
    });
  };
  
  FormData.prototype.get = function(name) {
    const part = this._parts.find(p => p.name === name);
    return part ? part.value : null;
  };
  
  FormData.prototype.getAll = function(name) {
    return this._parts.filter(p => p.name === name).map(p => p.value);
  };
  
  FormData.prototype.has = function(name) {
    return this._parts.some(p => p.name === name);
  };
  
  FormData.prototype.delete = function(name) {
    this._parts = this._parts.filter(p => p.name !== name);
  };
  
  FormData.prototype.keys = function() {
    return this._parts.map(p => p.name);
  };
  
  FormData.prototype.values = function() {
    return this._parts.map(p => p.value);
  };
  
  FormData.prototype.entries = function() {
    return this._parts.map(p => [p.name, p.value]);
  };
  
  // Install FormData on EVERY possible global scope
  try {
    if (typeof global !== 'undefined') global.FormData = FormData;
    if (typeof globalThis !== 'undefined') globalThis.FormData = FormData;
    if (typeof window !== 'undefined') window.FormData = FormData;
    if (typeof self !== 'undefined') self.FormData = FormData;
    
    // Also assign directly to ensure availability
    if (typeof global !== 'undefined' && !global.FormData) global.FormData = FormData;
    
    console.log('✅ FormData polyfill installed successfully');
  } catch (e) {
    console.error('❌ FormData polyfill failed:', e);
  }
})();

// Verify FormData is available
if (typeof FormData !== 'undefined') {
  console.log('✅ FormData verified available');
} else {
  console.error('❌ FormData NOT available after polyfill!');
}

// Main app entry
console.log('🚀 App starting...');

import { registerRootComponent } from 'expo';
import App from './App';

console.log('🚀 Registering app...');
registerRootComponent(App);
console.log('✅ App registered');