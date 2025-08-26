/**
 * Unit tests for StatementWithMedia component
 * Tests video-only statement recording interface
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { StatementWithMedia } from '../StatementWithMedia';
import { Statement, MediaCapture } from '../../types/challenge';
import { renderWithStore, createMockChallengeCreationState, createTestStore } from '../../utils/testUtils';

// Mock MediaRecorder component for video-only recording
jest.mock('../MediaRecorder', () => {
  return function MockMediaRecorder({ onRecordingComplete, onRecordingError }: any) {
    return (
      <div data-testid="media-recorder">
        <button 
          onClick={() => {
            const mockVideoData = {
              type: 'video',
              url: 'blob:mock-video-url',
              duration: 15000,
              fileSize: 2048,
              mimeType: 'video/webm',
            };
            // Set the global recorded media state
            (global as any).mockRecordedMedia = mockVideoData;
            
            onRecordingComplete(mockVideoData);
            // Also trigger the hook's callback
            if ((global as any).mockOnRecordingComplete) {
              (global as any).mockOnRecordingComplete(mockVideoData);
            }
          }}
        >
          Complete Video Recording
        </button>
        <button 
          onClick={() => onRecordingError('Test recording error')}
        >
          Trigger Error
        </button>
      </div>
    );
  };
});

// Mock MediaPreview component
jest.mock('../MediaPreview', () => {
  return function MockMediaPreview({ mediaData, onReRecord, onConfirm }: any) {
    return (
      <div data-testid="media-preview">
        <div>Video: {mediaData.url}</div>
        <div>Duration: {mediaData.duration}ms</div>
        <div>Size: {mediaData.fileSize} bytes</div>
        <button onClick={onReRecord}>Re-record</button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    );
  };
});

// Mock quality feedback components
jest.mock('../QualityFeedback', () => ({
  StatementQualityFeedback: ({ quality, isVisible }: any) => (
    isVisible && quality ? (
      <div data-testid="quality-feedback">
        <span>Score: {quality.score}/100</span>
        <span>{quality.feedback}</span>
      </div>
    ) : null
  ),
  RealTimeQualityIndicator: ({ quality }: any) => (
    quality ? <div data-testid="quality-indicator">Quality: {quality.score}</div> : null
  ),
  AnimatedFeedback: ({ message, type, isVisible, onDismiss }: any) => (
    isVisible ? (
      <div data-testid="animated-feedback" className={type}>
        <span>{message}</span>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    ) : null
  ),
}));

// Mock Redux media recording hook
jest.mock('../../hooks/useReduxMediaRecording', () => ({
  useReduxMediaRecording: ({ onRecordingComplete }: any) => {
    // Store the callback for later use
    (global as any).mockOnRecordingComplete = onRecordingComplete;
    
    return {
      recordedMedia: (global as any).mockRecordedMedia || null,
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: null,
      uploadState: {
        isUploading: false,
        uploadProgress: 0,
        uploadError: null,
      },
      resetRecording: jest.fn(() => {
        (global as any).mockRecordedMedia = null;
      }),
    };
  },
}));

const defaultProps = {
  statementIndex: 0,
  statement: {
    id: 'stmt_1',
    text: '',
    isLie: false,
    confidence: 0,
  } as Statement,
  onStatementChange: jest.fn(),
  onMediaChange: jest.fn(),
};

describe('StatementWithMedia Component - Video-Only Interface', () => {
  let store: any;

  beforeEach(() => {
    store = createTestStore(createMockChallengeCreationState());
    jest.clearAllMocks();
    // Mock console.warn for error handling tests
    console.warn = jest.fn();
    // Clear global mock state
    (global as any).mockRecordedMedia = null;
    (global as any).mockOnRecordingComplete = null;
  });

  it('renders video recording button initially', () => {
    renderWithStore(<StatementWithMedia {...defaultProps} />, store);
    
    expect(screen.getByText('🎥 Record Your Statement')).toBeInTheDocument();
    expect(screen.getByText('Statement 1')).toBeInTheDocument();
  });

  it('shows recording interface when video button is clicked', () => {
    renderWithStore(<StatementWithMedia {...defaultProps} />, store);
    
    fireEvent.click(screen.getByText('🎥 Record Your Statement'));
    
    expect(screen.getByTestId('media-recorder')).toBeInTheDocument();
    expect(screen.getByText('Complete Video Recording')).toBeInTheDocument();
  });

  it('handles video recording completion', async () => {
    const mockOnMediaChange = jest.fn();
    renderWithStore(<StatementWithMedia {...defaultProps} onMediaChange={mockOnMediaChange} />, store);
    
    // Start recording
    fireEvent.click(screen.getByText('🎥 Record Your Statement'));
    
    // Complete recording
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(mockOnMediaChange).toHaveBeenCalledWith(0, {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 15000,
        fileSize: 2048,
        mimeType: 'video/webm',
      });
    });
  });

  it('shows media preview after recording', async () => {
    renderWithStore(<StatementWithMedia {...defaultProps} />, store);
    
    // Start and complete recording
    fireEvent.click(screen.getByText('🎥 Record Your Statement'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByTestId('media-preview')).toBeInTheDocument();
      expect(screen.getByText('Video: blob:mock-video-url')).toBeInTheDocument();
      expect(screen.getByText('Duration: 15000ms')).toBeInTheDocument();
    });
  });

  it('handles recording errors', async () => {
    renderWithStore(<StatementWithMedia {...defaultProps} />, store);
    
    // Start recording
    fireEvent.click(screen.getByText('🎥 Record Your Statement'));
    
    // Trigger error
    fireEvent.click(screen.getByText('Trigger Error'));
    
    // Error should be logged (mocked console.warn)
    expect(console.warn).toHaveBeenCalledWith('Media recording error:', 'Test recording error');
  });

  it('allows re-recording after completion', async () => {
    renderWithStore(<StatementWithMedia {...defaultProps} />, store);
    
    // Complete initial recording
    fireEvent.click(screen.getByText('🎥 Record Your Statement'));
    fireEvent.click(screen.getByText('Complete Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByTestId('media-preview')).toBeInTheDocument();
    });
    
    // Click re-record
    fireEvent.click(screen.getByText('Re-record'));
    
    await waitFor(() => {
      expect(screen.getByTestId('media-recorder')).toBeInTheDocument();
    });
  });

  it('shows statement number correctly', () => {
    renderWithStore(<StatementWithMedia {...defaultProps} statementIndex={1} />, store);
    
    expect(screen.getByText('Statement 2')).toBeInTheDocument();
  });

  it('applies lie styling when isLie is true', () => {
    renderWithStore(<StatementWithMedia {...defaultProps} isLie={true} />, store);
    
    expect(screen.getByText('🎭 This is the lie')).toBeInTheDocument();
  });

  it('disables interactions when disabled prop is true', () => {
    renderWithStore(<StatementWithMedia {...defaultProps} disabled={true} />, store);
    
    const recordButton = screen.getByText('🎥 Record Your Statement');
    expect(recordButton).toBeDisabled();
  });

  it('shows quality feedback for recorded video statements', async () => {
    // Mock statement with text for quality assessment
    const statementWithText = {
      ...defaultProps.statement,
      text: 'This is a well-formed statement for quality testing',
    };
    
    renderWithStore(<StatementWithMedia {...defaultProps} statement={statementWithText} />, store);
    
    // Quality feedback should be visible for existing text
    await waitFor(() => {
      expect(screen.getByTestId('quality-feedback')).toBeInTheDocument();
    });
  });
});
