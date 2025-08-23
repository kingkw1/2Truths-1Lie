/**
 * Basic Mobile Integration Test
 * Verifies core functionality of mobile media integration service
 */

import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer, {
  startNewChallenge,
  validateChallenge,
} from '../store/slices/challengeCreationSlice';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';

// Mock external dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 * 1024 }),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024),
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024),
  documentDirectory: '/mock/documents/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
}));

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

describe('Mobile Integration Basic Tests', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    mobileMediaIntegration.initialize(store.dispatch);
    jest.clearAllMocks();
  });

  it('should initialize Redux store correctly', () => {
    store.dispatch(startNewChallenge());
    
    const state = store.getState().challengeCreation;
    
    expect(state.currentChallenge.statements).toHaveLength(3);
    expect(state.currentChallenge.mediaData).toEqual([]);
    expect(state.mediaRecordingState).toEqual({});
    expect(state.validationErrors).toEqual([]);
  });

  it('should start recording and update Redux state', async () => {
    await mobileMediaIntegration.startRecording(0);
    
    const state = store.getState().challengeCreation;
    
    expect(state.mediaRecordingState[0]).toBeDefined();
    expect(state.mediaRecordingState[0].isRecording).toBe(true);
    expect(state.mediaRecordingState[0].mediaType).toBe('video');
    expect(state.isRecording).toBe(true);
    expect(state.recordingType).toBe('video');
  });

  it('should update recording duration', () => {
    const testDuration = 5000;
    
    mobileMediaIntegration.updateDuration(0, testDuration);
    
    const state = store.getState().challengeCreation;
    expect(state.mediaRecordingState[0]?.duration).toBe(testDuration);
  });

  it('should complete recording and store media', async () => {
    const mockUri = '/mock/video.mp4';
    const mockDuration = 10000;
    
    const processedMedia = await mobileMediaIntegration.stopRecording(
      0,
      mockUri,
      mockDuration
    );
    
    expect(processedMedia).toBeDefined();
    expect(processedMedia.type).toBe('video');
    expect(processedMedia.url).toBe(mockUri);
    expect(processedMedia.duration).toBe(mockDuration);
    
    const state = store.getState().challengeCreation;
    expect(state.currentChallenge.mediaData?.[0]).toEqual(processedMedia);
  });

  it('should validate challenge correctly', () => {
    store.dispatch(startNewChallenge());
    store.dispatch(validateChallenge());
    
    const state = store.getState().challengeCreation;
    
    // Should have validation errors for missing video recordings
    expect(state.validationErrors).toContain('All statements must have video recordings');
  });

  it('should provide correct configuration', () => {
    const config = mobileMediaIntegration.getConfig();
    
    expect(config.maxFileSize).toBe(50 * 1024 * 1024);
    expect(config.maxDuration).toBe(60 * 1000);
    expect(config.supportedFormats).toContain('video/mp4');
  });

  it('should handle errors gracefully', async () => {
    // Mock file system error
    const mockFileSystem = require('expo-file-system');
    mockFileSystem.getFreeDiskStorageAsync.mockRejectedValueOnce(new Error('Storage error'));
    
    await expect(mobileMediaIntegration.startRecording(0)).rejects.toThrow();
    
    const state = store.getState().challengeCreation;
    expect(state.mediaRecordingState[0]?.error).toBeTruthy();
  });
});

describe('Integration Service Configuration', () => {
  it('should provide recording statistics', () => {
    const stats = mobileMediaIntegration.getRecordingStats();
    
    expect(stats.platform).toBeDefined();
    expect(stats.supportedFormats).toBeDefined();
    expect(stats.maxFileSize).toBeDefined();
    expect(stats.maxDuration).toBeDefined();
    expect(stats.compressionThreshold).toBeDefined();
  });

  it('should handle cleanup operations', async () => {
    await expect(mobileMediaIntegration.cleanupTempFiles()).resolves.not.toThrow();
  });
});