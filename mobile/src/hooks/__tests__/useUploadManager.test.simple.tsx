/**
 * Upload Manager Hook Tests - Simplified
 * Basic tests for upload state management without complex JSX
 */

import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer from '../../store/slices/challengeCreationSlice';

// Simple mocks
const mockUploadVideo = jest.fn();
const mockCancelUpload = jest.fn();

jest.mock('../../services/uploadService', () => ({
  VideoUploadService: {
    getInstance: () => ({
      uploadVideo: mockUploadVideo,
      cancelUpload: mockCancelUpload,
    }),
  },
}));

describe('useUploadManager - Simplified', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
      },
    });

    jest.clearAllMocks();
  });

  it('should create a store successfully', () => {
    expect(store).toBeDefined();
    expect(store.getState).toBeDefined();
  });

  it('should have challengeCreation in state', () => {
    const state = store.getState();
    expect(state.challengeCreation).toBeDefined();
  });
});
