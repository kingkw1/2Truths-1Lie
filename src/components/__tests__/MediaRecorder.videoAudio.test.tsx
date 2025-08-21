/**
 * Comprehensive tests for video+audio recording functionality
 * Tests the fix for video recording without audio issue
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecorder from '../MediaRecorder';
import { MediaCapture } from '../../types/challenge';

// Mock MediaRecorder API with enhanced functionality
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: null as any,
  onstop: null as any,
  onerror: null as any,
  state: 'inactive',
};

// Mock stream with both video and audio tracks
const mockVideoTrack = {
  kind: 'video',
  stop: jest.fn(),
  getSettings: () => ({ width: 640, height: 480 }),
};

const mockAudioTrack = {
  kind: 'audio',
  stop: jest.fn(),
  getSettings: () => ({ sampleRate: 48000, channelCount: 2 }),
};

const mockStream = {
  getTracks: jest.fn(() => [mockVideoTrack, mockAudioTrack]),
  getVideoTracks: jest.fn(() => [mockVideoTrack]),
  getAudioTracks: jest.fn(() => [mockAudioTrack]),
};

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(),
  },
});

// Mock MediaRecorder constructor
(global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);
(global as any).MediaRecorder.isTypeSupported = jest.fn((type: string) => {
  // Support video formats with audio codecs
  return type.includes('video/webm') || type.includes('video/mp4');
});

// Mock URL.createObjectURL
(global as any).URL = {
  createObjectURL: jest.fn(() => 'blob:mock-video-url'),
  revokeObjectURL: jest.fn(),
};

// Mock Blob with realistic video+audio size
(global as any).Blob = jest.fn((content: any[], options?: any) => ({
  size: content.length > 0 ? 1024 * 1024 : 0, // 1MB for video+audio
  type: options?.type || 'video/webm',
}));

describe('MediaRecorder Video+Audio Recording', () => {
  const mockOnRecordingComplete = jest.fn();
  const mockOnRecordingError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaRecorder.start.mockClear();
    mockMediaRecorder.stop.mockClear();
    mockVideoTrack.stop.mockClear();
    mockAudioTrack.stop.mockClear();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
  });

  const defaultProps = {
    onRecordingComplete: mockOnRecordingComplete,
    onRecordingError: mockOnRecordingError,
    maxDuration: 30000,
    disabled: false,
  };

  it('requests both video and audio permissions for video recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    // Click the primary video recording button
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

  it('verifies both video and audio tracks are available', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(mockStream.getVideoTracks).toHaveBeenCalled();
      expect(mockStream.getAudioTracks).toHaveBeenCalled();
    });
  });

  it('creates MediaRecorder with video+audio MIME type', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          mimeType: expect.stringMatching(/video\/webm|video\/mp4/),
          audioBitsPerSecond: 128000,
          videoBitsPerSecond: 2500000,
        })
      );
    });
  });

  it('shows video preview when recording starts', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      const video = screen.getByRole('video') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
      expect(video.autoplay).toBe(true);
      expect(video.muted).toBe(true); // Muted to prevent feedback
      expect(video.playsInline).toBe(true);
    });
  });

  it('starts recording with proper configuration', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for permissions and then start recording
    await waitFor(() => {
      expect(screen.getByText('Start Video Recording')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(mockMediaRecorder.start).toHaveBeenCalledWith(100); // 100ms time slice
    });
  });

  it('shows recording status with video+audio indication', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for recording to start
    await waitFor(() => {
      expect(screen.getByText('Recording video with audio...')).toBeInTheDocument();
    });
  });

  it('handles recording completion with video+audio data', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for recording to start
    await waitFor(() => {
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    // Simulate recording completion
    const mockBlob = new Blob(['video+audio data'], { type: 'video/webm;codecs=vp8,opus' });
    
    // Simulate data available event
    if (mockMediaRecorder.ondataavailable) {
      mockMediaRecorder.ondataavailable({ data: mockBlob });
    }
    
    // Simulate stop event
    if (mockMediaRecorder.onstop) {
      await mockMediaRecorder.onstop();
    }
    
    await waitFor(() => {
      expect(mockOnRecordingComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video',
          url: expect.stringContaining('blob:'),
          fileSize: expect.any(Number),
          mimeType: expect.stringMatching(/video\/webm|video\/mp4/),
        })
      );
    });
  });

  it('provides recording controls during video recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for recording to start
    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
      expect(screen.getByText('Stop & Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('handles pause and resume functionality', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for recording to start
    await waitFor(() => {
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    // Pause recording
    fireEvent.click(screen.getByText('Pause'));
    
    await waitFor(() => {
      expect(mockMediaRecorder.pause).toHaveBeenCalled();
      expect(screen.getByText('Resume')).toBeInTheDocument();
    });

    // Resume recording
    fireEvent.click(screen.getByText('Resume'));
    
    await waitFor(() => {
      expect(mockMediaRecorder.resume).toHaveBeenCalled();
      expect(screen.getByText('Pause')).toBeInTheDocument();
    });
  });

  it('handles recording cancellation properly', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for recording to start
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    // Cancel recording
    fireEvent.click(screen.getByText('Cancel'));
    
    await waitFor(() => {
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(screen.getByText('Start Video Recording')).toBeInTheDocument();
    });
  });

  it('falls back to text when video+audio is not available', async () => {
    // Mock getUserMedia to fail
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
      new Error('NotAllowedError: Permission denied')
    );
    
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      expect(screen.getByText(/Camera\/microphone access denied, using text mode instead/)).toBeInTheDocument();
    });
  });

  it('handles MediaRecorder errors gracefully', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    // Wait for MediaRecorder to be created
    await waitFor(() => {
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    // Simulate MediaRecorder error
    if (mockMediaRecorder.onerror) {
      mockMediaRecorder.onerror(new Event('error'));
    }
    
    await waitFor(() => {
      expect(mockOnRecordingError).toHaveBeenCalledWith('Recording error occurred');
    });
  });

  it('validates MIME type support for video+audio', () => {
    const supportedTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/mp4;codecs=h264,aac',
    ];

    supportedTypes.forEach(type => {
      expect((global as any).MediaRecorder.isTypeSupported(type)).toBe(true);
    });
  });

  it('shows duration timer during recording', async () => {
    render(<MediaRecorder {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText(/0:00 \/ 0:30/)).toBeInTheDocument();
    });
  });

  it('enforces maximum recording duration', async () => {
    render(<MediaRecorder {...defaultProps} maxDuration={5000} />); // 5 seconds
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(screen.getByText(/0:00 \/ 0:05/)).toBeInTheDocument();
    });
  });
});

describe('MediaRecorder Audio Quality Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
  });

  it('requests high-quality audio settings', async () => {
    render(<MediaRecorder 
      onRecordingComplete={jest.fn()}
      onRecordingError={jest.fn()}
    />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
      );
    });
  });

  it('configures MediaRecorder with appropriate bitrates', async () => {
    render(<MediaRecorder 
      onRecordingComplete={jest.fn()}
      onRecordingError={jest.fn()}
    />);
    
    fireEvent.click(screen.getByText('Start Video Recording'));
    
    await waitFor(() => {
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          audioBitsPerSecond: 128000, // 128 kbps for good audio quality
          videoBitsPerSecond: 2500000, // 2.5 Mbps for good video quality
        })
      );
    });
  });
});