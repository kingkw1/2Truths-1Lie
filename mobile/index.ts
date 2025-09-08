// MINIMAL ENTRY POINT - NO FORMDATA DEPENDENCIES
console.log('=== MINIMAL APP ENTRY POINT ===');

import { registerRootComponent } from 'expo';
import App from './App';

console.log('=== REGISTERING ROOT COMPONENT ===');
registerRootComponent(App);
console.log('=== ROOT COMPONENT REGISTERED ===');
