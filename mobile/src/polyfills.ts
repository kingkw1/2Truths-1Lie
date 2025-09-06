// React Native polyfills for Hermes engine
// Provide FormData polyfill for environments where it's not available

// Simple FormData polyfill for React Native
class SimpleFormData {
  private items: Array<{ name: string; value: any; filename?: string; type?: string }> = [];

  append(name: string, value: any, filename?: string) {
    if (typeof value === 'object' && value.uri) {
      // Handle React Native file objects
      this.items.push({
        name,
        value,
        filename: filename || value.name || 'file',
        type: value.type || 'application/octet-stream'
      });
    } else {
      // Handle string values
      this.items.push({ name, value: String(value) });
    }
  }

  get(name: string) {
    const item = this.items.find(item => item.name === name);
    return item ? item.value : null;
  }

  getAll(name: string) {
    return this.items.filter(item => item.name === name).map(item => item.value);
  }

  has(name: string) {
    return this.items.some(item => item.name === name);
  }

  delete(name: string) {
    this.items = this.items.filter(item => item.name !== name);
  }

  entries() {
    return this.items.map(item => [item.name, item.value]);
  }

  keys() {
    return this.items.map(item => item.name);
  }

  values() {
    return this.items.map(item => item.value);
  }

  // React Native specific method for compatibility
  _parts() {
    return this.items;
  }
}

// Ensure FormData is available globally with proper Hermes compatibility
if (typeof global !== 'undefined' && typeof global.FormData === 'undefined') {
  console.log('🔧 Installing FormData polyfill for Hermes');
  global.FormData = SimpleFormData as any;
} else {
  console.log('🔧 FormData already available in global scope');
}

// Also ensure it's available without global prefix
if (typeof FormData === 'undefined') {
  try {
    (globalThis as any).FormData = SimpleFormData;
    console.log('🔧 FormData polyfill installed on globalThis');
  } catch (e) {
    // Fallback for environments without globalThis
    (global as any).FormData = SimpleFormData;
    console.log('🔧 FormData polyfill installed on global');
  }
}

// Console info to verify environment
console.log('🔧 React Native environment status:', {
  FormData: typeof FormData !== 'undefined',
  globalFormData: typeof global.FormData !== 'undefined',
  fetch: typeof fetch !== 'undefined',
  URL: typeof URL !== 'undefined',
});
