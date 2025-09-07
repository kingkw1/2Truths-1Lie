/**
 * Upload Manager Hook Tests
 * Basic tests for upload state management
 */

import React from 'react';
import { renderHook } from '@testing-library/react-native';
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
        challengeCreation: challengeCreationReducer,
      },
      preloadedState: {
        challengeCreation: {
          currentChallenge: {
            id: 'test-challenge',
            statements: [
              { id: 'stmt_1', text: 'Statement 1', isLie: false, confidence: 0 },
              { id: 'stmt_2', text: 'Statement 2', isLie: false, confidence: 0 },
              { id: 'stmt_3', text: 'Statement 3', isLie: false, confidence: 0 },
            ],
            mediaData: [],
            isPublic: true,
            creatorId: '',
          },
          isRecording: false,
          recordingType: null,
          currentStatementIndex: 0,
          validationErrors: [],
          isSubmitting: false,
          submissionSuccess: false,
          uploadState: {},
          mediaRecordingState: {},
          previewMode: false,
          individualRecordings: {},
        },
      },
    });

    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(Provider, { store, children });
  };

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
      // First set up upload state
      store.dispatch({
        type: 'challengeCreation/setUploadState',
        payload: { 
          statementIndex: 0, 
          state: { isUploading: true, uploadProgress: 0, uploadError: null, sessionId: 'test' }
        },
      });
      
      // Then update progress
      store.dispatch({
        type: 'challengeCreation/updateUploadProgress',
        payload: { statementIndex: 0, progress: 50 },
      });

      const { result } = renderUploadManager();

      expect(result.current.state.progress).toBe(50);
    });

    it('should reflect upload errors', () => {
      // First set up upload state
      store.dispatch({
        type: 'challengeCreation/setUploadState',
        payload: { 
          statementIndex: 0, 
          state: { isUploading: true, uploadProgress: 0, uploadError: null, sessionId: 'test' }
        },
      });
      
      // Then set error
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