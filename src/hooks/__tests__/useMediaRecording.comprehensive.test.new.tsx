/**
 * Comprehensive tests for useMediaRecording hook
 * Tests all recording modes, compression, error handling, and state management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useMediaRecording } from '../useMediaRecording';

// Export to make this a module
export {};

// Mock MediaCompressor
jest.mock('../../utils/mediaCompression', () => ({
  MediaCompressor: jest.fn().mockImplementation(() => ({
    compressMedia: jest.fn().mockResolvedValue({
      blob: new Blob(['compressed'], { type: 'video/webm' }),
      originalSize: 1000,
      compressedSize: 500,
      compressionRatio: 0.5,
      compressionTime: 100,
      quality: 0.8,
    }),
    dispose: jest.fn(),
  })),
}));

// Mock blobUrlManager
jest.mock('../../utils/blobUrlManager', () => ({
  blobUrlManager: {
    createUrl: jest.fn().mockReturnValue('blob:mock-url'),
    revokeUrl: jest.fn(),
    getAllUrls: jest.fn().mockReturnValue([]),
    revokeAllUrls: jest.fn(),
  },
}));

// Create mock tracks
const mockVideoTrack = {
  kind: 'video',
  label: 'Mock Video Track',
  enabled: true,
  muted: false,
  readyState: 'live',
  stop: jest.fn(),
  getSettings: jest.fn(() => ({ width: 640, height: 480 })),
};

const mockAudioTrack = {
  kind: 'audio',
  label: 'Mock Audio Track',
  enabled: true,
  muted: false,
  readyState: 'live',
  stop: jest.fn(),
  getSettings: jest.fn(() => ({ sampleRate: 44100 })),
};

// Create mock stream
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
  state: 'inactive',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  ondataavailable: null,
  onstop: null,
  onerror: null,
  onstart: null,
  onpause: null,
  onresume: null,
  mimeType: 'video/webm',
  stream: mockStream,
  audioBitsPerSecond: 128000,
  videoBitsPerSecond: 2500000,
};

// Mock global MediaRecorder constructor
global.MediaRecorder = jest.fn(() => mockMediaRecorder) as any;
(global.MediaRecorder as any).isTypeSupported = jest.fn().mockReturnValue(true);

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue(mockStream),
    enumerateDevices: jest.fn().mockResolvedValue([]),
  },
});

// Mock AudioContext for audio level detection
(global as any).AudioContext = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn().mockReturnValue({
    connect: jest.fn(),
  }),
  createAnalyser: jest.fn().mockReturnValue({
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
  }),
  close: jest.fn(),
}));

// Mock btoa for text encoding
(global as any).btoa = jest.fn((str: string) => Buffer.from(str, 'utf8').toString('base64'));

// Store setup for testing
const createTestStore = () => configureStore({
  reducer: {
    test: (state = {}) => state,
  },
});

// Test wrapper
const createWrapper = () => {
  const store = createTestStore();
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
};

describe('useMediaRecording Hook - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
    mockMediaRecorder.state = 'inactive';
  });

  describe('Hook Initialization', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.mediaType).toBe(null);
      expect(result.current.hasPermission).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.recordedMedia).toBeNull();
      expect(result.current.isCompressing).toBe(false);
      expect(result.current.compressionProgress).toBeNull();
    });

    it('initializes with custom options', () => {
      const options = {
        maxDuration: 60000,
        enableCompression: true,
        compressionOptions: { quality: 0.9 },
      };

      const { result } = renderHook(() => useMediaRecording(options), {
        wrapper: createWrapper(),
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.canRecord).toBe(true);
    });
  });

  describe('Text Recording', () => {
    it('completes text recording successfully', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.completeTextRecording('This is my test statement');
      });

      await waitFor(() => {
        expect(result.current.recordedMedia).toEqual({
          type: 'text',
          url: expect.stringContaining('data:text/plain;base64,'),
          duration: 0,
          fileSize: expect.any(Number),
          mimeType: 'text/plain',
        });
      });

      expect(result.current.mediaType).toBe('text');
      expect(result.current.isTextMode).toBe(true);
      expect(result.current.isMediaMode).toBe(false);
    });

    it('validates text input', () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      // Empty text should not create recording
      act(() => {
        result.current.completeTextRecording('');
      });

      expect(result.current.recordedMedia).toBeNull();

      // Whitespace only should not create recording
      act(() => {
        result.current.completeTextRecording('   ');
      });

      expect(result.current.recordedMedia).toBeNull();
    });

    it('handles text encoding correctly', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      const testText = 'Test with unicode: 🎥📹🎬';

      act(() => {
        result.current.completeTextRecording(testText);
      });

      await waitFor(() => {
        expect(result.current.recordedMedia?.url).toContain('data:text/plain;base64,');
        expect(global.btoa).toHaveBeenCalledWith(testText);
      });
    });
  });

  describe('Video Recording', () => {
    it('starts video recording successfully', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

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
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.mediaType).toBe('video');
      expect(result.current.isMediaMode).toBe(true);
    });

    it('handles video recording with custom options', async () => {
      const options = {
        maxDuration: 15000,
        enableCompression: true,
      };

      const { result } = renderHook(() => useMediaRecording(options), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.mediaType).toBe('video');
    });

    it('handles video recording pause and resume', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      // Simulate recording state
      act(() => {
        mockMediaRecorder.state = 'recording';
      });

      // Pause recording
      act(() => {
        result.current.togglePause();
      });

      expect(mockMediaRecorder.pause).toHaveBeenCalled();

      // Resume recording
      act(() => {
        mockMediaRecorder.state = 'paused';
        result.current.togglePause();
      });

      expect(mockMediaRecorder.resume).toHaveBeenCalled();
    });
  });

  describe('Audio Recording (converted to video)', () => {
    it('converts audio request to video recording', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      // Audio requests should be converted to video
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
      expect(result.current.mediaType).toBe('video');
    });
  });

  describe('Error Handling', () => {
    it('handles getUserMedia permission denied with fallback to text', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(result.current.error).toContain('Camera/microphone access denied, using text mode instead');
      expect(result.current.mediaType).toBe('text');
      expect(result.current.hasPermission).toBe(true); // Text fallback is successful
    });

    it('handles device not found error with fallback to text', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new DOMException('Device not found', 'NotFoundError')
      );

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(result.current.error).toContain('Camera/microphone access denied, using text mode instead');
      expect(result.current.mediaType).toBe('text');
    });

    it('handles missing MediaRecorder API with fallback to text', async () => {
      const originalMediaRecorder = global.MediaRecorder;
      delete (global as any).MediaRecorder;

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(result.current.error).toContain('Video recording not supported, using text mode instead');
      expect(result.current.mediaType).toBe('text');

      // Restore MediaRecorder
      global.MediaRecorder = originalMediaRecorder;
    });
  });

  describe('State Management', () => {
    it('resets recording state correctly', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      // Complete a text recording
      act(() => {
        result.current.completeTextRecording('Test text');
      });

      await waitFor(() => {
        expect(result.current.recordedMedia).not.toBeNull();
      });

      // Reset recording
      act(() => {
        result.current.resetRecording();
      });

      expect(result.current.recordedMedia).toBeNull();
      expect(result.current.duration).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('cancels recording in progress', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      act(() => {
        mockMediaRecorder.state = 'recording';
      });

      // Cancel recording
      act(() => {
        result.current.cancelRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.recordedMedia).toBeNull();
    });

    it('cleans up resources on unmount', async () => {
      const { result, unmount } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      // Unmount component
      unmount();

      // Should clean up resources (tracks should be stopped)
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockAudioTrack.stop).toHaveBeenCalled();
    });
  });

  describe('Media Support Detection', () => {
    it('checks media support correctly', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const isSupported = await result.current.checkMediaSupport('video');
        expect(isSupported).toBe(true);
      });

      expect(result.current.canRecord).toBe(true);
    });

    it('handles missing MediaRecorder API', async () => {
      const originalMediaRecorder = global.MediaRecorder;
      delete (global as any).MediaRecorder;

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const isSupported = await result.current.checkMediaSupport('video');
        expect(isSupported).toBe(false);
      });

      // Restore MediaRecorder
      global.MediaRecorder = originalMediaRecorder;
    });

    it('handles missing getUserMedia API', async () => {
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
      });

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const isSupported = await result.current.checkMediaSupport('video');
        expect(isSupported).toBe(false);
      });

      // Restore getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: originalGetUserMedia },
      });
    });
  });

  describe('Utility Functions', () => {
    it('provides stream access', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      const stream = result.current.getStream();
      expect(stream).toBeDefined();
    });
  });
});
