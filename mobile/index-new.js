// CRITICAL: FormData polyfill MUST be first
console.log('🔧 [INDEX] Installing FormData polyfill...');

// Manual FormData polyfill that works with Expo Go
if (typeof global.FormData === 'undefined') {
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

  // Install globally
  global.FormData = FormDataPolyfill;
  if (typeof globalThis !== 'undefined') globalThis.FormData = FormDataPolyfill;
  if (typeof window !== 'undefined') window.FormData = FormDataPolyfill;
  
  console.log('✅ [INDEX] FormData polyfill installed');
} else {
  console.log('✅ [INDEX] FormData already available');
}

// MAIN APP ENTRY POINT
console.log('🚀 [INDEX] App starting...');

import { registerRootComponent } from 'expo';
import App from './App';

console.log('🚀 [INDEX] Registering root component...');
registerRootComponent(App);
console.log('✅ [INDEX] App registered successfully');
