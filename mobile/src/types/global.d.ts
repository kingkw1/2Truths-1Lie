/**
 * Global type declarations for mobile app
 */

declare global {
  var __TEST_SCENARIO__: string;
  var __MEDIA_LIBRARY_PERMISSION_GRANTED__: boolean;
  
  namespace NodeJS {
    interface Global {
      __TEST_SCENARIO__: string;
      __MEDIA_LIBRARY_PERMISSION_GRANTED__: boolean;
    }
  }
}

export {};
