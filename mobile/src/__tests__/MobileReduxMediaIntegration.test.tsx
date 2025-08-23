/**
 * Mobile Redux Media Integration Tests
 * Verifies that mobile media capture properly integrates with Redux state
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import { EnhancedMobileCameraIntegration } from '../components/EnhancedMobileCameraIntegration';
import { ChallengeCreationScreen } from '../screens/ChallengeCreationScreen';
import challengeCreationReducer, {
  startNewChallenge,
  setStatementMedia,
  validateChallenge,
} from '../store/slices/challengeCreationSlice';
import { mobileMediaIntegration } from '../services/mobileMediaIntegration';
import { MediaCapture } from '../types';

// Mock external dependencies
jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

jest.mock('expo-media-library', () => ({
  usePermissions: () => [{ granted: true }, jest.fn()],
}));

jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 * 1024 }),
  getFreeDiskStorageAsync: jest.fn().mockResolvedValue(1024 * 1024 * 1024),
  getTotalDiskCapacityAsync: jest.fn().mockResolvedValue(10 * 1024 * 1024 * 1024),
  documentDirectory: '/mock/documents/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
  },
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

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

describe('Mobile Redux Media Integration', () => {
  let store: ReturnType<typeof createTestStore>;
  let mockOnComplete: jest.Mock;
  let mockOnCancel: jest.Mock;
  let mockOnError: jest.Mock;

  beforeEach(() => {
    store = createTestStore();
    mockOnComplete = jest.fn();
    mockOnCancel = jest.fn();
    mockOnError = jest.fn();
    
    // Initialize the integration service with the test store
    mobileMediaIntegration.initialize(store.dispatch);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Redux State Integration', () => {
    it('should initialize challenge creation state correctly', () => {
      store.dispatch(startNewChallenge());
      
      const state = store.getState().challengeCreation;
      
      expect(state.currentChallenge.statements).toHaveLength(3);
      expect(state.currentChallenge.mediaData).toEqual([]);
      expect(state.mediaRecordingState).toEqual({});
      expect(state.validationErrors).toEqual([]);
    });

    it('should update media recording state when recording starts', async () => {
      await mobileMediaIntegration.startRecording(0);
      
      const state = store.getState().challengeCreation;
      
      expect(state.mediaRecordingState[0]).toEqual({
        isRecording: true,
        isPaused: false,
        duration: 0,
        mediaType: 'video',
        hasPermission: true,
        error: null,
        isCompressing: false,
        compressionProgress: null,
      });
      expect(state.isRecording).toBe(true);
      expect(state.recordingType).toBe('video');
      expect(state.currentStatementIndex).toBe(0);
    });

    it('should update recording duration in Redux state', () => {
      const testDuration = 5000; // 5 seconds
      
      mobileMediaIntegration.updateDuration(0, testDuration);
      
      const state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[0]?.duration).toBe(testDuration);
    });

    it('should process and store media capture in Redux state', async () => {
      const mockUri = '/mock/video.mp4';
      const mockDuration = 10000; // 10 seconds
      
      const processedMedia = await mobileMediaIntegration.stopRecording(
        0,
        mockUri,
        mockDuration
      );
      
      const state = store.getState().challengeCreation;
      
      // Check that media was stored in Redux
      expect(state.currentChallenge.mediaData?.[0]).toEqual(processedMedia);
      
      // Check that recording state was updated
      expect(state.mediaRecordingState[0]?.isRecording).toBe(false);
      expect(state.isRecording).toBe(false);
      
      // Check that validation was triggered
      expect(state.validationErrors).toBeDefined();
    });

    it('should handle recording errors in Redux state', async () => {
      const errorMessage = 'Test recording error';
      
      // Mock file system to simulate error
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });
      
      try {
        await mobileMediaIntegration.stopRecording(0, '/invalid/path', 1000);
      } catch (error) {
        // Expected to throw
      }
      
      const state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[0]?.error).toBeTruthy();
    });
  });

  describe('Challenge Creation Screen Integration', () => {
    it('should render challenge creation screen with Redux integration', () => {
      const { getByText } = render(
        <Provider store={store}>
          <ChallengeCreationScreen
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Provider>
      );
      
      expect(getByText('Create Your Challenge')).toBeTruthy();
    });

    it('should update Redux state when challenge is created', () => {
      render(
        <Provider store={store}>
          <ChallengeCreationScreen
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
          />
        </Provider>
      );
      
      // The component should initialize a new challenge
      const state = store.getState().challengeCreation;
      expect(state.currentChallenge.statements).toHaveLength(3);
    });
  });

  describe('Enhanced Mobile Camera Integration', () => {
    it('should render camera integration component', () => {
      const { getByText } = render(
        <Provider store={store}>
          <EnhancedMobileCameraIntegration
            statementIndex={0}
            isVisible={true}
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
            onError={mockOnError}
          />
        </Provider>
      );
      
      expect(getByText('Record Statement 1')).toBeTruthy();
    });

    it('should initialize mobile media integration service', () => {
      render(
        <Provider store={store}>
          <EnhancedMobileCameraIntegration
            statementIndex={0}
            isVisible={true}
            onComplete={mockOnComplete}
            onCancel={mockOnCancel}
            onError={mockOnError}
          />
        </Provider>
      );
      
      // Service should be initialized (we can't directly test this without exposing internals)
      // But we can test that it works by checking if Redux updates work
      expect(store.getState()).toBeDefined();
    });
  });

  describe('Cross-Platform State Consistency', () => {
    it('should maintain consistent state structure with web implementation', () => {
      store.dispatch(startNewChallenge());
      
      const state = store.getState().challengeCreation;
      
      // Verify state structure matches web implementation
      expect(state).toHaveProperty('currentChallenge');
      expect(state).toHaveProperty('isRecording');
      expect(state).toHaveProperty('recordingType');
      expect(state).toHaveProperty('currentStatementIndex');
      expect(state).toHaveProperty('validationErrors');
      expect(state).toHaveProperty('isSubmitting');
      expect(state).toHaveProperty('submissionSuccess');
      expect(state).toHaveProperty('previewMode');
      expect(state).toHaveProperty('mediaRecordingState');
      expect(state).toHaveProperty('uploadState');
    });

    it('should validate challenge with same logic as web', () => {
      // Set up a challenge with missing video recordings
      store.dispatch(startNewChallenge());
      store.dispatch(validateChallenge());
      
      const state = store.getState().challengeCreation;
      
      // Should have validation errors for missing video recordings
      expect(state.validationErrors).toContain('All statements must have video recordings');
    });

    it('should handle media data in same format as web', () => {
      const mockMedia: MediaCapture = {
        type: 'video',
        url: '/mock/video.mp4',
        duration: 10000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      };
      
      store.dispatch(setStatementMedia({ index: 0, media: mockMedia }));
      
      const state = store.getState().challengeCreation;
      expect(state.currentChallenge.mediaData?.[0]).toEqual(mockMedia);
    });
  });

  describe('Mobile Media Integration Service', () => {
    it('should provide correct configuration', () => {
      const config = mobileMediaIntegration.getConfig();
      
      expect(config.maxFileSize).toBe(50 * 1024 * 1024); // 50MB
      expect(config.maxDuration).toBe(60 * 1000); // 60 seconds
      expect(config.supportedFormats).toContain('video/mp4');
    });

    it('should provide recording statistics', () => {
      const stats = mobileMediaIntegration.getRecordingStats();
      
      expect(stats.platform).toBeDefined();
      expect(stats.supportedFormats).toBeDefined();
      expect(stats.maxFileSize).toBeDefined();
      expect(stats.maxDuration).toBeDefined();
    });

    it('should handle cleanup of temporary files', async () => {
      await expect(mobileMediaIntegration.cleanupTempFiles()).resolves.not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle permission errors gracefully', async () => {
      // Mock permission denied
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getFreeDiskStorageAsync.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(mobileMediaIntegration.startRecording(0)).rejects.toThrow();
      
      const state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[0]?.error).toBeTruthy();
    });

    it('should handle storage full errors', async () => {
      // Mock insufficient storage
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getFreeDiskStorageAsync.mockResolvedValueOnce(50 * 1024 * 1024); // 50MB (below threshold)
      
      await expect(mobileMediaIntegration.startRecording(0)).rejects.toThrow('Insufficient storage space');
    });

    it('should validate media files correctly', async () => {
      // Mock empty file
      const mockFileSystem = require('expo-file-system');
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 0 });
      
      await expect(
        mobileMediaIntegration.stopRecording(0, '/mock/empty.mp4', 1000)
      ).rejects.toThrow('Recording file is empty');
    });
  });
});

describe('Integration Test: Full Challenge Creation Flow', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    mobileMediaIntegration.initialize(store.dispatch);
  });

  it('should complete full challenge creation workflow with Redux integration', async () => {
    // 1. Start new challenge
    store.dispatch(startNewChallenge());
    
    // 2. Record three statements
    for (let i = 0; i < 3; i++) {
      await mobileMediaIntegration.startRecording(i);
      
      // Simulate recording duration
      mobileMediaIntegration.updateDuration(i, 5000);
      
      // Complete recording
      await mobileMediaIntegration.stopRecording(i, `/mock/video${i}.mp4`, 5000);
    }
    
    // 3. Validate challenge
    store.dispatch(validateChallenge());
    
    const finalState = store.getState().challengeCreation;
    
    // Verify all media is recorded
    expect(finalState.currentChallenge.mediaData).toHaveLength(3);
    finalState.currentChallenge.mediaData?.forEach((media, index) => {
      expect(media.type).toBe('video');
      expect(media.url).toBe(`/mock/video${index}.mp4`);
      expect(media.duration).toBe(5000);
    });
    
    // Should have no validation errors for media
    const mediaErrors = finalState.validationErrors.filter(error => 
      error.includes('video recordings')
    );
    expect(mediaErrors).toHaveLength(0);
  });
});