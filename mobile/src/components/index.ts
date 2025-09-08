// Re-enabled safe components (no FormData dependencies)
export { MobileCameraRecorder } from './MobileCameraRecorder';
export { EnhancedMobileCameraIntegration } from './EnhancedMobileCameraIntegration';
export { default as SafeEnhancedChallengeCreation } from './SafeEnhancedChallengeCreation';
export { default as MergeProgressIndicator } from './MergeProgressIndicator';
export { default as SimpleVideoPlayer } from './SimpleVideoPlayer';
export { default as SegmentedVideoPlayer } from './SegmentedVideoPlayer';
export { ErrorDisplay } from './ErrorDisplay';
export { default as PlaybackErrorHandler } from './PlaybackErrorHandler';
export { ErrorBoundary } from './ErrorBoundary';

// KEEP DISABLED: Upload-related exports that cause FormData issues
// TODO: Re-enable these after implementing proper FormData polyfills
// export { default as UploadProgressIndicator } from './UploadProgressIndicator';
// export { default as EnhancedUploadUI } from './EnhancedUploadUI';
// export { default as EnhancedChallengeCreation } from './EnhancedChallengeCreation';
// export { default as UploadErrorHandler } from './UploadErrorHandler';