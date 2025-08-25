/**
 * Mobile Redux Integration Tests
 * 
 * Tests Redux state management integration for mobile media capture including:
 * - Challenge creation slice state management
 * - Media recording state synchronization
 * - Cross-component state sharing
 * - State persistence and recovery
 * - Action dispatching and state updates
 * - Error state management
 */

import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer, {
  startNewChallenge,
  startMediaRecording,
  stopMediaRecording,
  pauseMediaRecording,
  resumeMediaRecording,
  setMediaRecordingError,
  setStatementMedia,
  updateRecordingDuration,
  setLieStatement,
  validateChallenge,
  startSubmission,
  completeSubmission,
  enterPreviewMode,
  exitPreviewMode,
} from '../store/slices/challengeCreationSlice';
import { MediaCapture } from '../types';

const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
  });
};

describe('Mobile Redux Integration', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe('Challenge Creation State Management', () => {
    test('should initialize new challenge with correct state', () => {
      store.dispatch(startNewChallenge());

      const state = store.getState().challengeCreation;
      
      expect(state.currentChallenge).toBeDefined();
      expect(state.currentChallenge.statements).toHaveLength(3);
      expect(state.currentChallenge.mediaData).toHaveLength(3);
      expect(state.mediaRecordingState).toHaveLength(3);
      expect(state.validationErrors).toHaveLength(0);
      expect(state.isSubmitting).toBe(false);
      expect(state.submissionSuccess).toBe(false);
    });

    test('should handle multiple challenge creation cycles', () => {
      // First challenge
      store.dispatch(startNewChallenge());
      let state = store.getState().challengeCreation;
      const firstChallengeCreatorId = state.currentChallenge.creatorId;

      // Add some data to first challenge
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'mock://video1.mp4',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/mp4',
      };

      store.dispatch(setStatementMedia({ index: 0, media: mockMedia }));
      store.dispatch(setLieStatement(0));

      // Start new challenge
      store.dispatch(startNewChallenge());
      state = store.getState().challengeCreation;

      // Should have new challenge with clean state
      expect(state.currentChallenge.creatorId).not.toBe(firstChallengeCreatorId);
      expect(state.currentChallenge.mediaData?.[0]).toBeUndefined();
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(false);
    });

    test('should maintain challenge state consistency', () => {
      store.dispatch(startNewChallenge());

      const mockMediaData: MediaCapture[] = [
        {
          type: 'video',
          url: 'mock://video1.mp4',
          duration: 15000,
          fileSize: 2048,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video2.mp4',
          duration: 12000,
          fileSize: 1800,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video3.mp4',
          duration: 18000,
          fileSize: 2500,
          mimeType: 'video/mp4',
        },
      ];

      // Add all media data
      mockMediaData.forEach((media, index) => {
        store.dispatch(setStatementMedia({ index, media }));
      });

      // Set lie statement
      store.dispatch(setLieStatement(1));

      const state = store.getState().challengeCreation;
      
      // Verify all data is correctly stored
      expect(state.currentChallenge.mediaData).toHaveLength(3);
      expect(state.currentChallenge.mediaData?.[0]).toEqual(mockMediaData[0]);
      expect(state.currentChallenge.mediaData?.[1]).toEqual(mockMediaData[1]);
      expect(state.currentChallenge.mediaData?.[2]).toEqual(mockMediaData[2]);
      expect(state.currentChallenge.statements?.[1]?.isLie).toBe(true);
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[2]?.isLie).toBe(false);
    });
  });

  describe('Media Recording State Management', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should handle recording start for specific statement', () => {
      const statementIndex = 0;
      
      store.dispatch(startMediaRecording({ 
        statementIndex, 
        mediaType: 'video' 
      }));

      const state = store.getState().challengeCreation;
      const recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.isRecording).toBe(true);
      expect(recordingState?.mediaType).toBe('video');
      expect(recordingState?.hasPermission).toBe(true);
      expect(recordingState?.error).toBeNull();
      expect(recordingState?.duration).toBe(0);
    });

    test('should handle recording stop for specific statement', () => {
      const statementIndex = 1;
      
      // Start recording first
      store.dispatch(startMediaRecording({ 
        statementIndex, 
        mediaType: 'video' 
      }));

      // Stop recording
      store.dispatch(stopMediaRecording({ statementIndex }));

      const state = store.getState().challengeCreation;
      const recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.isRecording).toBe(false);
      expect(recordingState?.isPaused).toBe(false);
    });

    test('should handle recording pause and resume', () => {
      const statementIndex = 2;
      
      // Start recording
      store.dispatch(startMediaRecording({ 
        statementIndex, 
        mediaType: 'video' 
      }));

      // Pause recording
      store.dispatch(pauseMediaRecording({ statementIndex }));

      let state = store.getState().challengeCreation;
      let recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.isPaused).toBe(true);
      expect(recordingState?.isRecording).toBe(true);

      // Resume recording
      store.dispatch(resumeMediaRecording({ statementIndex }));

      state = store.getState().challengeCreation;
      recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.isPaused).toBe(false);
      expect(recordingState?.isRecording).toBe(true);
    });

    test('should handle recording duration updates', () => {
      const statementIndex = 0;
      const duration = 5000; // 5 seconds

      store.dispatch(startMediaRecording({ 
        statementIndex, 
        mediaType: 'video' 
      }));

      store.dispatch(updateRecordingDuration({ 
        statementIndex, 
        duration 
      }));

      const state = store.getState().challengeCreation;
      const recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.duration).toBe(duration);
    });

    test('should handle recording errors', () => {
      const statementIndex = 1;
      const errorMessage = 'Camera permission denied';

      store.dispatch(setMediaRecordingError({ 
        statementIndex, 
        error: errorMessage 
      }));

      const state = store.getState().challengeCreation;
      const recordingState = state.mediaRecordingState[statementIndex];

      expect(recordingState?.error).toBe(errorMessage);
    });

    test('should clear recording errors', () => {
      const statementIndex = 0;
      const errorMessage = 'Test error';

      // Set error
      store.dispatch(setMediaRecordingError({ 
        statementIndex, 
        error: errorMessage 
      }));

      let state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[statementIndex]?.error).toBe(errorMessage);

      // Clear error
      store.dispatch(setMediaRecordingError({ 
        statementIndex, 
        error: null 
      }));

      state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[statementIndex]?.error).toBeNull();
    });

    test('should handle concurrent recording states for different statements', () => {
      // Start recording for statement 0
      store.dispatch(startMediaRecording({ 
        statementIndex: 0, 
        mediaType: 'video' 
      }));

      // Set error for statement 1
      store.dispatch(setMediaRecordingError({ 
        statementIndex: 1, 
        error: 'Permission denied' 
      }));

      // Update duration for statement 2
      store.dispatch(updateRecordingDuration({ 
        statementIndex: 2, 
        duration: 3000 
      }));

      const state = store.getState().challengeCreation;

      // Each statement should have independent state
      expect(state.mediaRecordingState[0]?.isRecording).toBe(true);
      expect(state.mediaRecordingState[0]?.error).toBeNull();

      expect(state.mediaRecordingState[1]?.isRecording).toBe(false);
      expect(state.mediaRecordingState[1]?.error).toBe('Permission denied');

      expect(state.mediaRecordingState[2]?.isRecording).toBe(false);
      expect(state.mediaRecordingState[2]?.duration).toBe(3000);
    });
  });

  describe('Media Data Management', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should store media data for specific statement index', () => {
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'mock://video.mp4',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/mp4',
      };

      store.dispatch(setStatementMedia({ index: 1, media: mockMedia }));

      const state = store.getState().challengeCreation;
      expect(state.currentChallenge.mediaData?.[1]).toEqual(mockMedia);
      expect(state.currentChallenge.mediaData?.[0]).toBeUndefined();
      expect(state.currentChallenge.mediaData?.[2]).toBeUndefined();
    });

    test('should update existing media data', () => {
      const originalMedia: MediaCapture = {
        type: 'video',
        url: 'mock://original.mp4',
        duration: 10000,
        fileSize: 1024,
        mimeType: 'video/mp4',
      };

      const updatedMedia: MediaCapture = {
        type: 'video',
        url: 'mock://updated.mp4',
        duration: 20000,
        fileSize: 4096,
        mimeType: 'video/mp4',
      };

      // Set original media
      store.dispatch(setStatementMedia({ index: 0, media: originalMedia }));

      let state = store.getState().challengeCreation;
      expect(state.currentChallenge.mediaData?.[0]).toEqual(originalMedia);

      // Update media
      store.dispatch(setStatementMedia({ index: 0, media: updatedMedia }));

      state = store.getState().challengeCreation;
      expect(state.currentChallenge.mediaData?.[0]).toEqual(updatedMedia);
    });

    test('should handle media data for all three statements', () => {
      const mockMediaData: MediaCapture[] = [
        {
          type: 'video',
          url: 'mock://video1.mp4',
          duration: 15000,
          fileSize: 2048,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video2.mp4',
          duration: 12000,
          fileSize: 1800,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video3.mp4',
          duration: 18000,
          fileSize: 2500,
          mimeType: 'video/mp4',
        },
      ];

      mockMediaData.forEach((media, index) => {
        store.dispatch(setStatementMedia({ index, media }));
      });

      const state = store.getState().challengeCreation;
      expect(state.currentChallenge.mediaData).toHaveLength(3);
      mockMediaData.forEach((expectedMedia, index) => {
        expect(state.currentChallenge.mediaData?.[index]).toEqual(expectedMedia);
      });
    });
  });

  describe('Lie Statement Management', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should set lie statement correctly', () => {
      store.dispatch(setLieStatement(1));

      const state = store.getState().challengeCreation;
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[1]?.isLie).toBe(true);
      expect(state.currentChallenge.statements?.[2]?.isLie).toBe(false);
    });

    test('should change lie statement selection', () => {
      // Set initial lie statement
      store.dispatch(setLieStatement(0));

      let state = store.getState().challengeCreation;
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(true);
      expect(state.currentChallenge.statements?.[1]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[2]?.isLie).toBe(false);

      // Change lie statement
      store.dispatch(setLieStatement(2));

      state = store.getState().challengeCreation;
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[1]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[2]?.isLie).toBe(true);
    });

    test('should handle invalid lie statement index', () => {
      // This should not crash or cause issues
      store.dispatch(setLieStatement(5));

      const state = store.getState().challengeCreation;
      // All statements should remain false for invalid index
      expect(state.currentChallenge.statements?.[0]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[1]?.isLie).toBe(false);
      expect(state.currentChallenge.statements?.[2]?.isLie).toBe(false);
    });
  });

  describe('Challenge Validation', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should validate incomplete challenge', () => {
      store.dispatch(validateChallenge());

      const state = store.getState().challengeCreation;
      expect(state.validationErrors.length).toBeGreaterThan(0);
      expect(state.validationErrors).toContain('All statements must have video recordings');
    });

    test('should validate challenge with missing media', () => {
      // Add only one media file
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'mock://video1.mp4',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/mp4',
      };

      store.dispatch(setStatementMedia({ index: 0, media: mockMedia }));
      store.dispatch(validateChallenge());

      const state = store.getState().challengeCreation;
      expect(state.validationErrors).toContain('Statements 2, 3 must have video recordings');
    });

    test('should validate challenge with missing lie statement', () => {
      // Add all media but no lie statement
      const mockMediaData: MediaCapture[] = [
        {
          type: 'video',
          url: 'mock://video1.mp4',
          duration: 15000,
          fileSize: 2048,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video2.mp4',
          duration: 12000,
          fileSize: 1800,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video3.mp4',
          duration: 18000,
          fileSize: 2500,
          mimeType: 'video/mp4',
        },
      ];

      mockMediaData.forEach((media, index) => {
        store.dispatch(setStatementMedia({ index, media }));
      });

      store.dispatch(validateChallenge());

      const state = store.getState().challengeCreation;
      expect(state.validationErrors).toContain('Please select which statement is the lie');
    });

    test('should validate complete challenge successfully', () => {
      // Add all media
      const mockMediaData: MediaCapture[] = [
        {
          type: 'video',
          url: 'mock://video1.mp4',
          duration: 15000,
          fileSize: 2048,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video2.mp4',
          duration: 12000,
          fileSize: 1800,
          mimeType: 'video/mp4',
        },
        {
          type: 'video',
          url: 'mock://video3.mp4',
          duration: 18000,
          fileSize: 2500,
          mimeType: 'video/mp4',
        },
      ];

      mockMediaData.forEach((media, index) => {
        store.dispatch(setStatementMedia({ index, media }));
      });

      // Set lie statement
      store.dispatch(setLieStatement(1));

      // Validate
      store.dispatch(validateChallenge());

      const state = store.getState().challengeCreation;
      expect(state.validationErrors).toHaveLength(0);
    });
  });

  describe('Submission State Management', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should handle submission start', () => {
      store.dispatch(startSubmission());

      const state = store.getState().challengeCreation;
      expect(state.isSubmitting).toBe(true);
      expect(state.submissionSuccess).toBe(false);
    });

    test('should handle successful submission', () => {
      store.dispatch(startSubmission());
      store.dispatch(completeSubmission({ success: true }));

      const state = store.getState().challengeCreation;
      expect(state.isSubmitting).toBe(false);
      expect(state.submissionSuccess).toBe(true);
    });

    test('should handle failed submission', () => {
      store.dispatch(startSubmission());
      store.dispatch(completeSubmission({ success: false }));

      const state = store.getState().challengeCreation;
      expect(state.isSubmitting).toBe(false);
      expect(state.submissionSuccess).toBe(false);
    });
  });

  describe('Preview Mode Management', () => {
    beforeEach(() => {
      store.dispatch(startNewChallenge());
    });

    test('should enter preview mode', () => {
      store.dispatch(enterPreviewMode());

      const state = store.getState().challengeCreation;
      expect(state.previewMode).toBe(true);
    });

    test('should exit preview mode', () => {
      store.dispatch(enterPreviewMode());
      store.dispatch(exitPreviewMode());

      const state = store.getState().challengeCreation;
      expect(state.previewMode).toBe(false);
    });

    test('should handle preview mode transitions', () => {
      let state = store.getState().challengeCreation;
      expect(state.previewMode).toBe(false);

      store.dispatch(enterPreviewMode());
      state = store.getState().challengeCreation;
      expect(state.previewMode).toBe(true);

      store.dispatch(exitPreviewMode());
      state = store.getState().challengeCreation;
      expect(state.previewMode).toBe(false);
    });
  });

  describe('State Persistence and Recovery', () => {
    test('should maintain state across store recreations', () => {
      // Create initial store and add data
      let store1 = createTestStore();
      store1.dispatch(startNewChallenge());
      
      const mockMedia: MediaCapture = {
        type: 'video',
        url: 'mock://video.mp4',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/mp4',
      };

      store1.dispatch(setStatementMedia({ index: 0, media: mockMedia }));
      store1.dispatch(setLieStatement(0));

      const state1 = store1.getState().challengeCreation;

      // Create new store (simulating app restart)
      let store2 = createTestStore();
      store2.dispatch(startNewChallenge());

      // Restore state manually (in real app, this would be from persistence)
      store2.dispatch(setStatementMedia({ index: 0, media: mockMedia }));
      store2.dispatch(setLieStatement(0));

      const state2 = store2.getState().challengeCreation;

      // States should be equivalent
      expect(state2.currentChallenge.mediaData?.[0]).toEqual(state1.currentChallenge.mediaData?.[0]);
      expect(state2.currentChallenge.statements?.[0]?.isLie).toBe(state1.currentChallenge.statements?.[0]?.isLie);
    });

    test('should handle state recovery from errors', () => {
      store.dispatch(startNewChallenge());

      // Set error state
      store.dispatch(setMediaRecordingError({ 
        statementIndex: 0, 
        error: 'Test error' 
      }));

      let state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[0]?.error).toBe('Test error');

      // Recover from error
      store.dispatch(setMediaRecordingError({ 
        statementIndex: 0, 
        error: null 
      }));

      store.dispatch(startMediaRecording({ 
        statementIndex: 0, 
        mediaType: 'video' 
      }));

      state = store.getState().challengeCreation;
      expect(state.mediaRecordingState[0]?.error).toBeNull();
      expect(state.mediaRecordingState[0]?.isRecording).toBe(true);
    });
  });
});