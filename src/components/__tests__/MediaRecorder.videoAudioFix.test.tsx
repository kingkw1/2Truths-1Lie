/**
 * Enhanced Video+Audio Recording Tests
 * Tests the fixed MediaRecorder implementation for proper video+audio capture
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecorder from '../MediaRecorder';
import { MediaCapture } from '../../types/challenge';

// Mock video and audio tracks
const mockVideoTrack = {
  kind: 'video',
  stop: jest.fn(),
  enabled: true,
  muted: false,
  readyState: 'live',
  label: 'Camera',
  getSettings: () => ({ width: 640, height: 480, frameRate: 30 }),
};

const mockAudioTrack = {
  kind: 'audio',
  stop: jest.fn(),
  enabled: true,
  muted: false,
  readyState: 'live',
  label: 'Microphone',
  getSettings: () => ({ sampleRate: 48000, channelCount: 2 }),
};

const mockStream = {
  getTracks: jest.fn(() => [mockVideoTrack, mockAudioTrack]),
  getVideoTracks: jest.fn(() => [mockVideoTrack]),
  getAudioTracks: jest.fn(() => [mockAudioTrack]),
};

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  requestData: jest.fn(),
  state: 'inactive',
  mimeType: 'video/webm;codecs=vp8,opus',
  ondataavailable: null,
  onstop: null,
  onerror: null,
};

describe('Enhanced Video+Audio Recording Tests', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaRecorder.start.mockClear();
    mockMediaRecorder.stop.mockClear();
    mockVideoTrack.stop.mockClear();
    mockAudioTrack.stop.mockClear();

    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
    });

    // Mock MediaRecorder
    (global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);
    (global as any).MediaRecorder.isTypeSupported = jest.fn((type: string) => {
      return type.includes('video/webm') || type.includes('video/mp4');
    });

    // Mock URL.createObjectURL
    (global as any).URL = {
      createObjectURL: jest.fn(() => 'blob:mock-video-url'),
      revokeObjectURL: jest.fn(),
    };

    // Mock AudioContext for audio level detection
    (global as any).AudioContext = jest.fn(() => ({
      createMediaStreamSource: jest.fn(() => ({
        connect: jest.fn(),
      })),
      createAnalyser: jest.fn(() => ({
        getByteFrequencyData: jest.fn(),
        frequencyBinCount: 256,
      })),
      close: jest.fn(),
    }));
    (global as any).webkitAudioContext = (global as any).AudioContext;
  });

  const defaultProps = {
    onRecordingComplete: mockOnRecordingComplete,
    onRecordingError: mockOnRecordingError,
    maxDuration: 30000,
    disabled: false,
  };

  it('successfully requests video+audio permissions with correct constraints', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });
  });

  it('creates MediaRecorder with optimal video+audio configuration', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          mimeType: expect.stringMatching(/video\/(webm|mp4)/),
          audioBitsPerSecond: 128000,
          videoBitsPerSecond: 2500000,
        })
      );
    });
  });

  it('validates both video and audio tracks are present', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(mockStream.getVideoTracks).toHaveBeenCalled();
      expect(mockStream.getAudioTracks).toHaveBeenCalled();
    });
  });

  it('handles missing audio tracks gracefully without failing recording', async () => {
    // Mock stream with video but no audio
    const videoOnlyStream = {
      getTracks: jest.fn(() => [mockVideoTrack]),
      getVideoTracks: jest.fn(() => [mockVideoTrack]),
      getAudioTracks: jest.fn(() => []),
    };
    
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(videoOnlyStream);
    
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Should still create MediaRecorder even without audio tracks
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        videoOnlyStream,
        expect.any(Object)
      );
    });
  });

  it('uses proven MIME types for maximum compatibility', async () => {
    // Test that the component tries the most compatible formats first
    const mimeTypeOrder = [
      'video/webm;codecs=vp8,opus',
      'video/mp4;codecs=h264,aac',
      'video/webm',
      'video/mp4'
    ];
    
    let callIndex = 0;
    (global as any).MediaRecorder.isTypeSupported = jest.fn((type: string) => {
      // Return true for the first supported type
      return mimeTypeOrder.indexOf(type) === 0;
    });
    
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          mimeType: 'video/webm;codecs=vp8,opus'
        })
      );
    });
  });

  it('properly connects video stream to preview element', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      const videoElement = screen.getByRole('video') as HTMLVideoElement;
      expect(videoElement).toBeInTheDocument();
      expect(videoElement.autoplay).toBe(true);
      expect(videoElement.muted).toBe(true); // Muted to prevent feedback
      expect(videoElement.playsInline).toBe(true);
    });
  });

  it('handles MediaRecorder creation failures gracefully', async () => {
    // Mock MediaRecorder constructor to fail initially
    let creationAttempts = 0;
    (global as any).MediaRecorder = jest.fn(() => {
      creationAttempts++;
      if (creationAttempts === 1) {
        throw new Error('MediaRecorder creation failed');
      }
      return mockMediaRecorder;
    });
    
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Should attempt fallback creation
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledTimes(2);
    });
  });

  it('records complete video+audio data chunks', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });
    
    // Simulate recording progress with data chunks
    fireEvent.click(screen.getByText('Stop Recording'));
    
    // Simulate ondataavailable with video+audio data
    const mockBlob = new Blob(['video+audio data'], { type: 'video/webm;codecs=vp8,opus' });
    const dataEvent = { data: mockBlob };
    
    if (mockMediaRecorder.ondataavailable && typeof mockMediaRecorder.ondataavailable === 'function') {
      (mockMediaRecorder.ondataavailable as any)(dataEvent);
    }
    
    // Simulate onstop
    if (mockMediaRecorder.onstop && typeof mockMediaRecorder.onstop === 'function') {
      (mockMediaRecorder.onstop as any)();
    }
    
    await waitFor(() => {
      expect(mockOnRecordingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video',
          url: expect.stringMatching(/^blob:/),
          mimeType: expect.stringMatching(/video\/(webm|mp4)/),
        })
      );
    });
  });

  it('provides clear debugging information in console', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stream validation passed')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('video tracks')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('audio tracks')
      );
    });
    
    consoleSpy.mockRestore();
  });
});
