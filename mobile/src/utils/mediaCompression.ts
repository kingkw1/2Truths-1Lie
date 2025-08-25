/**
 * Mobile media compression utilities - React Native compatible
 * Re-exports the mobile-optimized implementation
 */

// Re-export everything from the mobile-specific implementation
export * from './mediaCompression.mobile';

// Default export for backward compatibility
export { mediaCompressor as default } from './mediaCompression.mobile';