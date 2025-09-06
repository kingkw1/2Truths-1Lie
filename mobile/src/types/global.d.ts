/**
 * Global type declarations for mobile app
 */

declare global {
  var __TEST_SCENARIO__: string;
  var __MEDIA_LIBRARY_PERMISSION_GRANTED__: boolean;
  
  // FormData type declaration for React Native
  interface FormData {
    append(name: string, value: any, filename?: string): void;
    get(name: string): any;
    getAll(name: string): any[];
    has(name: string): boolean;
    delete(name: string): void;
    entries(): any[];
    keys(): string[];
    values(): any[];
    _parts?(): any[];
  }

  var FormData: {
    prototype: FormData;
    new(): FormData;
  };
  
  namespace NodeJS {
    interface Global {
      __TEST_SCENARIO__: string;
      __MEDIA_LIBRARY_PERMISSION_GRANTED__: boolean;
      FormData: typeof FormData;
    }
  }
}

export {};
