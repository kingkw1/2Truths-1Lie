/**
 * React Native specific type extensions
 */

import { ReactNode } from 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    testID?: string;
  }
  
  interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    testID?: string;
    onPress?: () => void;
  }
}

export {};
