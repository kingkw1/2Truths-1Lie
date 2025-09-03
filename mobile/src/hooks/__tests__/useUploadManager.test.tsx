/**
 * Upload Manager Hook Tests
 * Basic tests for upload state management
 */

import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useUploadManager } from '../useUploadManager';
import challengeCreationReducer from '../../store/slices/challengeCreationSlice';

// Simple mocks
const mockUploadVideo = jest.fn();
const mockCancelUpload = jest.fn();
const mockAlert = jest.fn();

jest.mock('../../services/uploadService', () => ({
  videoUploadService: {
    uploadVideo: mockUploadVideo,
    cancelUpload: mockCancelUpload,
  },
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: mockAlert,
  },
}));

describe('useUploadManager', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationSlice.reducer,
      },
      preloadedState: {
        challengeCreation: {
          currentChallenge: {
            id: 'test-challenge',
            statements: ['Statement 1', 'Statement 2', 'Statement 3'],
            mediaData: {},
          },
          uploadState: {},
          mediaRecordingState: {},
          previewMode: false,
        },
      },
    });

    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  const renderUploadManager = (statementIndex = 0, options = {}) => {
    return renderHook(() => useUploadManager(statementIndex, options), { wrapper });
  };

  describe('Initial State', () => {
    it('should return initial state correctly', () => {
      const { result } = renderUploadManager();

      expect(result.current.state).toEqual({
        isUploading: false,
        progress: 0,
        error: null,
        retryCount: 0,
        canRetry: false,
        canCancel: false,
      });
    });

    it('should provide upload functions', () => {
      const { result } = renderUploadManager();

      expect(typeof result.current.startUpload).toBe('function');
      expect(typeof result.current.retryUpload).toBe('function');
      expect(typeof result.current.cancelUpload).toBe('function');
      expect(typeof result.current.resetUpload).toBe('function');
    });
  });

  describe('State Management', () => {
    it('should reflect Redux upload state', () => {
      // Manually update Redux state
      store.dispatch({
        type: 'challengeCreation/startUpload',
        payload: { statementIndex: 0, sessionId: 'test-session' },
      });

      const { result } = renderUploadManager();

      expect(result.current.state.isUploading).toBe(true);
    });

    it('should reflect upload progress', () => {
      store.dispatch({
        type: 'challengeCreation/updateUploadProgress',
        payload: { statementIndex: 0, progress: 50 },
      });

      const { result } = renderUploadManager();

      expect(result.current.state.progress).toBe(50);
    });

    it('should reflect upload errors', () => {
      store.dispatch({
        type: 'challengeCreation/setUploadError',
        payload: { statementIndex: 0, error: 'Upload failed' },
      });

      const { result } = renderUploadManager();

      expect(result.current.state.error).toBe('Upload failed');
      expect(result.current.state.canRetry).toBe(true);
    });
  });
});