/**
 * Integration tests for MediaRecorder with compression
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaRecorder } from '../MediaRecorder';
import { MediaCapture } from '../../types/challenge';

// Mock the compression module
jest.mock('../../utils/mediaCompression', () => ({
  MediaCompressor: jest.fn().mockImplementation(() => ({
    compressMedia: jest.fn().mockResolvedValue({
      compressedBlob: new Blob(['compressed'], { type: 'video/webm' }),
      originalSize: 1000,
      compressedSize: 500,
      compressionRatio: 2,
      processingTime: 100,
      quality: 0.8,
    }),
    dispose: jest.fn(),
  })),
  createMediaCompressor: jest.fn(),
  compressMediaBlob: jest.fn(),
}));

// Mock useMediaRecording hook
jest.mock('../../hooks/useMediaRecording', () => ({
  useMediaRecording: jest.fn(() => ({
    isRecording: false,
    isPaused: false,
    duration: 0,
    mediaType: 'text',
    hasPermission: false,
    error: null,
    recordedMedia: null,
    isCompressing: false,
    compressionProgress: null,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    cancelRecording: jest.fn(),
    togglePause: jest.fn(),
    completeTextRecording: jest.fn(),
    resetRecording: jest.fn(),
    cleanup: jest.fn(),
    checkMediaSupport: jest.fn(),
    canRecord: true,
    isTextMode: true,
    isMediaMode: false,
  })),
}));

describe('MediaRecorder with Compression', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with compression enabled by default', () => {
    render(
      <MediaRecorder
        onRecordingComplete={mockOnRecordingComplete}
        onRecordingError={mockOnRecordingError}
        enableCompression={true}
      />
    );

    expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
  });

  it('should show compression options in props', () => {
    const compressionOptions = {
      quality: 0.8,
      maxWidth: 640,
      maxHeight: 480,
    };

    render(
      <MediaRecorder
        onRecordingComplete={mockOnRecordingComplete}
        onRecordingError={mockOnRecordingError}
        enableCompression={true}
        compressionOptions={compressionOptions}
      />
    );

    // Component should render without errors with compression options
    expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
  });

  it('should handle compression progress display', () => {
    const { useMediaRecording } = require('../../hooks/useMediaRecording');
    
    // Mock compression in progress
    useMediaRecording.mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: 'video',
      hasPermission: true,
      error: null,
      recordedMedia: null,
      isCompressing: true,
      compressionProgress: {
        stage: 'compressing',
        progress: 50,
      },
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      cancelRecording: jest.fn(),
      togglePause: jest.fn(),
      completeTextRecording: jest.fn(),
      resetRecording: jest.fn(),
      cleanup: jest.fn(),
      checkMediaSupport: jest.fn(),
      canRecord: true,
      isTextMode: false,
      isMediaMode: true,
    });

    render(
      <MediaRecorder
        onRecordingComplete={mockOnRecordingComplete}
        onRecordingError={mockOnRecordingError}
        enableCompression={true}
      />
    );

    expect(screen.getByText('Compressing media...')).toBeInTheDocument();
    expect(screen.getByText('compressing')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should handle completed recording with compression metadata', () => {
    const mockMediaData: MediaCapture = {
      type: 'video',
      url: 'blob:mock-url',
      duration: 5000,
      fileSize: 500,
      mimeType: 'video/webm',
      originalSize: 1000,
      compressionRatio: 2,
      compressionTime: 100,
    };

    const { useMediaRecording } = require('../../hooks/useMediaRecording');
    
    useMediaRecording.mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: 'video',
      hasPermission: true,
      error: null,
      recordedMedia: mockMediaData,
      isCompressing: false,
      compressionProgress: null,
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      cancelRecording: jest.fn(),
      togglePause: jest.fn(),
      completeTextRecording: jest.fn((text) => {
        mockOnRecordingComplete({
          type: 'text',
          url: `data:text/plain;base64,${btoa(text)}`,
          duration: 0,
          fileSize: new Blob([text]).size,
          mimeType: 'text/plain',
        });
      }),
      resetRecording: jest.fn(),
      cleanup: jest.fn(),
      checkMediaSupport: jest.fn(),
      canRecord: true,
      isTextMode: false,
      isMediaMode: true,
    });

    render(
      <MediaRecorder
        onRecordingComplete={mockOnRecordingComplete}
        onRecordingError={mockOnRecordingError}
        enableCompression={true}
      />
    );

    // Should not show compression progress when not compressing
    expect(screen.queryByText('Compressing media...')).not.toBeInTheDocument();
  });

  it('should disable controls during compression', () => {
    const { useMediaRecording } = require('../../hooks/useMediaRecording');
    
    useMediaRecording.mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: 'text',
      hasPermission: true,
      error: null,
      recordedMedia: null,
      isCompressing: true,
      compressionProgress: {
        stage: 'compressing',
        progress: 30,
      },
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      cancelRecording: jest.fn(),
      togglePause: jest.fn(),
      completeTextRecording: jest.fn(),
      resetRecording: jest.fn(),
      cleanup: jest.fn(),
      checkMediaSupport: jest.fn(),
      canRecord: true,
      isTextMode: true,
      isMediaMode: false,
    });

    render(
      <MediaRecorder
        onRecordingComplete={mockOnRecordingComplete}
        onRecordingError={mockOnRecordingError}
        enableCompression={true}
      />
    );

    // Text input should be disabled during compression
    const textArea = screen.getByPlaceholderText(/Type your statement here/);
    expect(textArea).toBeDisabled();
  });
});

describe('MediaRecorder Compression Integration', () => {
  it('should pass compression options to useMediaRecording hook', () => {
    const { useMediaRecording } = require('../../hooks/useMediaRecording');
    const mockUseMediaRecording = jest.fn().mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: 'text',
      hasPermission: false,
      error: null,
      recordedMedia: null,
      isCompressing: false,
      compressionProgress: null,
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      cancelRecording: jest.fn(),
      togglePause: jest.fn(),
      completeTextRecording: jest.fn(),
      resetRecording: jest.fn(),
      cleanup: jest.fn(),
      checkMediaSupport: jest.fn(),
      canRecord: true,
      isTextMode: true,
      isMediaMode: false,
    });

    useMediaRecording.mockImplementation(mockUseMediaRecording);

    const compressionOptions = {
      quality: 0.9,
      maxWidth: 1280,
      maxHeight: 720,
    };

    render(
      <MediaRecorder
        onRecordingComplete={jest.fn()}
        onRecordingError={jest.fn()}
        enableCompression={true}
        compressionOptions={compressionOptions}
      />
    );

    expect(mockUseMediaRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        enableCompression: true,
        compressionOptions,
      })
    );
  });
});