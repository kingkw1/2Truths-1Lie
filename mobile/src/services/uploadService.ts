// TEMPORARILY DISABLED TO AVOID FORMDATA ISSUES
console.log('uploadService.ts: This file is temporarily disabled for debugging');

// Mock all exports to prevent import errors
export const videoUploadService = {
  uploadVideo: () => Promise.resolve({ success: false, error: 'Service disabled' }),
  mergeVideos: () => Promise.resolve({ success: false, error: 'Service disabled' }),
  uploadSignedVideo: () => Promise.resolve({ success: false, error: 'Service disabled' }),
  syncMediaState: () => Promise.resolve({ syncedCount: 0, errors: [] }),
  uploadVideosForMerge: () => Promise.resolve({ success: false, error: 'Service disabled' }),
};

export class VideoUploadService {
  uploadVideo() { return Promise.resolve({ success: false, error: 'Service disabled' }); }
  mergeVideos() { return Promise.resolve({ success: false, error: 'Service disabled' }); }
  uploadSignedVideo() { return Promise.resolve({ success: false, error: 'Service disabled' }); }
  syncMediaState() { return Promise.resolve({ syncedCount: 0, errors: [] }); }
  uploadVideosForMerge() { return Promise.resolve({ success: false, error: 'Service disabled' }); }
}

export interface UploadProgress {
  type: string;
  progress: number;
}

export interface UploadResult {
  success: boolean;
  error?: string;
}

export interface UploadOptions {}

console.log('uploadService.ts: All exports mocked successfully');