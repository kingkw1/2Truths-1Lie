/**
 * Enhanced Upload UI Component Tests
 * Basic tests for upload UI functionality
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { EnhancedUploadUI } from '../EnhancedUploadUI';
import { VideoUploadService } from '../../services/uploadService';
import challengeCreationReducer from '../../store/slices/challengeCreationSlice';

// Mock dependencies
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
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  Platform: {
    select: jest.fn(() => 'video/mp4'),
    OS: 'ios',
  },
  Animated: {
    Value: jest.fn(() => ({
      setValue: jest.fn(),
    })),
    timing: jest.fn(() => ({
      start: jest.fn(),
    })),
    spring: jest.fn(() => ({
      start: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn(),
    })),
    View: 'Animated.View',
  },
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  Text: 'Text',
  Modal: 'Modal',
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

describe('EnhancedUploadUI', () => {
  let store: any;
  let mockOnUploadComplete: jest.Mock;
  let mockOnUploadError: jest.Mock;
  let mockOnCancel: jest.Mock;

  const defaultProps = {
    statementIndex: 0,
    videoUri: 'file://test-video.mp4',
    filename: 'test-video.mp4',
    duration: 5000,
  };

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
          videoMerging: {
            isInProgress: false,
            progress: 0,
            stage: null,
            currentSegment: null,
            error: null,
          },
          mergedVideo: null,
        },
      },
    });

    mockOnUploadComplete = jest.fn();
    mockOnUploadError = jest.fn();
    mockOnCancel = jest.fn();

    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={store}>
        <EnhancedUploadUI
          {...defaultProps}
          onUploadComplete={mockOnUploadComplete}
          onUploadError={mockOnUploadError}
          onCancel={mockOnCancel}
          {...props}
        />
      </Provider>
    );
  };

  describe('Initial State', () => {
    it('should render start upload button when not uploading', () => {
      const { getByText } = renderComponent();
      
      expect(getByText('Start Upload')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('should show video information in header', () => {
      const { getByText } = renderComponent();
      
      expect(getByText('Uploading Video')).toBeTruthy();
      expect(getByText('test-video.mp4 • 5s')).toBeTruthy();
    });
  });

  describe('Upload Process', () => {
    it('should render start upload button', () => {
      const { getByText } = renderComponent();
      
      expect(getByText('Start Upload')).toBeTruthy();
    });

    it('should call upload service when start button is pressed', () => {
      mockUploadVideo.mockResolvedValue({
        success: true,
        mediaId: 'test-media-id',
      });

      const { getByText } = renderComponent();
      
      fireEvent.press(getByText('Start Upload'));

      expect(mockUploadVideo).toHaveBeenCalled();
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button', () => {
      const { getByText } = renderComponent();
      
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('should show cancel confirmation dialog when pressed', () => {
      const { getByText } = renderComponent();
      
      fireEvent.press(getByText('Cancel'));

      expect(mockAlert).toHaveBeenCalled();
    });
  });
});