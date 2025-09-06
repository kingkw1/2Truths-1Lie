// IMMEDIATE FormData polyfill for Hermes - must be first
if (!global.FormData) {
  global.FormData = class FormData {
    private items: Array<{name: string; value: any}> = [];
    
    append(name: string, value: any) {
      this.items.push({ name, value });
    }
    
    get(name: string) {
      const item = this.items.find(i => i.name === name);
      return item ? item.value : null;
    }
    
    _parts() {
      return this.items;
    }
  } as any;
}

// Also ensure it's available as FormData (without global prefix)
if (typeof FormData === 'undefined') {
  globalThis.FormData = global.FormData;
}

console.log('🔧 FormData polyfill installed');

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
