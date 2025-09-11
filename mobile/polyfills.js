/**
 * Global polyfills for React Native / Hermes
 * This file is loaded before any other modules
 */

// FormData polyfill for React Native
if (typeof global !== 'undefined' && typeof global.FormData === 'undefined') {
  console.log('🔧 Loading FormData polyfill...');
  
  class FormDataPolyfill {
    constructor() {
      this._parts = [];
    }

    append(name, value, filename) {
      if (typeof value === 'object' && value && value.uri) {
        // React Native file object
        this._parts.push({
          name,
          value,
          filename: filename || value.name || 'file',
          type: value.type || 'application/octet-stream'
        });
      } else {
        // String or other primitive value
        this._parts.push({ name, value: String(value) });
      }
    }

    get(name) {
      const part = this._parts.find(p => p.name === name);
      return part ? part.value : null;
    }

    getAll(name) {
      return this._parts.filter(p => p.name === name).map(p => p.value);
    }

    has(name) {
      return this._parts.some(p => p.name === name);
    }

    delete(name) {
      this._parts = this._parts.filter(p => p.name !== name);
    }

    keys() {
      return this._parts.map(p => p.name);
    }

    values() {
      return this._parts.map(p => p.value);
    }

    entries() {
      return this._parts.map(p => [p.name, p.value]);
    }

    // For React Native fetch compatibility
    getParts() {
      return this._parts;
    }

    [Symbol.iterator]() {
      return this.entries()[Symbol.iterator]();
    }
  }

  // Install globally for all contexts
  global.FormData = FormDataPolyfill;
  
  if (typeof globalThis !== 'undefined') {
    globalThis.FormData = FormDataPolyfill;
  }
  
  if (typeof window !== 'undefined') {
    window.FormData = FormDataPolyfill;
  }
  
  console.log('✅ FormData polyfill installed globally');
}

// Additional polyfills that might be needed for SDK 54
if (typeof global !== 'undefined') {
  // Ensure fetch is available
  if (typeof global.fetch === 'undefined') {
    console.warn('⚠️ fetch is not available - this may cause issues');
  }
  
  // Ensure URL constructor is available
  if (typeof global.URL === 'undefined') {
    console.warn('⚠️ URL constructor is not available');
  }
}

console.log('🚀 Polyfills loaded successfully');
