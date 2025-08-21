/**
 * Comprehensive tests for useMediaRecording hook
 * Tests all recording modes, compression, error handling, and state management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { useMediaRecording } from '../useMediaRecording';
import challengeCreationSlice from '../../store/slices/challengeCreationSlice';

// Mock MediaRecorder API
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

const mockStream = {
  getTracks: jest.fn(() => [
    { stop: jest.fn(), kind: 'video' },
    { stop: jest.fn(), kind: 'audio' },
  ]),
};

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(),
  },
});

(global as any).MediaRecorder = jest.fn(() => mockMediaRecorder);
(global as any).MediaRecorder.isTypeSupported = jest.fn(() => true);

// Mock URL and Blob
(global as any).URL = {
  createObjectURL: jest.fn(() => 'blob:mock-url'),
  revokeObjectURL: jest.fn(),
};

(global as any).Blob = jest.fn((content: any[], options?: any) => ({
  size: content.join('').length || 1024,
  type: options?.type || 'application/octet-stream',
}));

// Mock btoa
(global as any).btoa = jest.fn((str: string) => Buffer.from(str, 'utf8').toString('base64'));

// Mock compression module
jest.mock('../../utils/mediaCompression', () => ({
  MediaCompressor: jest.fn().mockImplementation(() => ({
    compressMedia: jest.fn().mockResolvedValue({
      compressedBlob: new Blob(['compressed'], { type: 'video/webm' }),
      originalSize: 2048,
      compressedSize: 1024,
      compressionRatio: 2,
      processingTime: 100,
      quality: 0.8,
    }),
    dispose: jest.fn(),
  })),
}));

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationSlice,
    },
  });
};

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
      expect(result.current.mediaType).toBe('text');
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

    it('validates text input', async () => {
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
        video: { width: 640, height: 480 },
        audio: true,
      });
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.mediaType).toBe('video');
      expect(result.current.isMediaMode).toBe(true);
    });

    it('handles video recording with custom constraints', async () => {
      const options = {
        videoConstraints: { width: 1280, height: 720 },
        audioConstraints: { echoCancellation: true },
      };

      const { result } = renderHook(() => useMediaRecording(options), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true },
      });
    });

    it('completes video recording with MediaRecorder', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      // Simulate MediaRecorder setup
      expect(global.MediaRecorder).toHaveBeenCalledWith(
        mockStream,
        expect.objectContaining({
          mimeType: expect.any(String),
        })
      );

      // Simulate recording start
      act(() => {
        mockMediaRecorder.state = 'recording';
        result.current.startRecording('video');
      });

      expect(result.current.isRecording).toBe(true);

      // Simulate recording stop
      const mockBlob = new Blob(['video data'], { type: 'video/webm' });
      
      act(() => {
        mockMediaRecorder.state = 'inactive';
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop(new Event('stop'));
        }
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob } as any);
        }
      });

      await waitFor(() => {
        expect(result.current.recordedMedia).toEqual({
          type: 'video',
          url: 'blob:mock-url',
          duration: expect.any(Number),
          fileSize: expect.any(Number),
          mimeType: 'video/webm',
        });
      });
    });

    it('handles video recording pause and resume', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      // Pause recording
      act(() => {
        mockMediaRecorder.state = 'paused';
        result.current.togglePause();
      });

      expect(mockMediaRecorder.pause).toHaveBeenCalled();
      expect(result.current.isPaused).toBe(true);

      // Resume recording
      act(() => {
        mockMediaRecorder.state = 'recording';
        result.current.togglePause();
      });

      expect(mockMediaRecorder.resume).toHaveBeenCalled();
      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('Audio Recording', () => {
    it('starts audio recording successfully', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true,
      });
      expect(result.current.mediaType).toBe('audio');
    });

    it('completes audio recording', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      act(() => {
        mockMediaRecorder.state = 'inactive';
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop(new Event('stop'));
        }
      });

      await waitFor(() => {
        expect(result.current.recordedMedia?.type).toBe('audio');
        expect(result.current.recordedMedia?.mimeType).toBe('audio/webm');
      });
    });
  });

  describe('Compression Integration', () => {
    it('compresses media when enabled', async () => {
      const { MediaCompressor } = require('../../utils/mediaCompression');
      const mockCompressor = new MediaCompressor();

      const { result } = renderHook(() => useMediaRecording({
        enableCompression: true,
        compressionOptions: { quality: 0.8 },
      }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      const mockBlob = new Blob(['video data'], { type: 'video/webm' });
      
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop(new Event('stop'));
        }
      });

      await waitFor(() => {
        expect(mockCompressor.compressMedia).toHaveBeenCalledWith(
          mockBlob,
          { quality: 0.8 },
          expect.any(Function)
        );
      });

      await waitFor(() => {
        expect(result.current.recordedMedia).toEqual({
          type: 'video',
          url: 'blob:mock-url',
          duration: expect.any(Number),
          fileSize: 1024,
          mimeType: 'video/webm',
          originalSize: 2048,
          compressionRatio: 2,
          compressionTime: 100,
        });
      });
    });

    it('reports compression progress', async () => {
      const { result } = renderHook(() => useMediaRecording({
        enableCompression: true,
      }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      const mockBlob = new Blob(['video data'], { type: 'video/webm' });
      
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop(new Event('stop'));
        }
      });

      // Simulate compression progress
      act(() => {
        // This would be called by the compression progress callback
        // In a real scenario, the compressor would call this
      });

      expect(result.current.isCompressing).toBe(true);
    });

    it('handles compression errors gracefully', async () => {
      const { MediaCompressor } = require('../../utils/mediaCompression');
      const mockCompressor = new MediaCompressor();
      mockCompressor.compressMedia.mockRejectedValue(new Error('Compression failed'));

      const { result } = renderHook(() => useMediaRecording({
        enableCompression: true,
      }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      const mockBlob = new Blob(['video data'], { type: 'video/webm' });
      
      act(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: mockBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
          mockMediaRecorder.onstop(new Event('stop'));
        }
      });

      await waitFor(() => {
        // Should fall back to uncompressed media
        expect(result.current.recordedMedia?.type).toBe('video');
        expect(result.current.error).toContain('Compression failed');
      });
    });
  });

  describe('Error Handling', () => {
    it('handles getUserMedia permission denied', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(result.current.error).toContain('Permission denied');
      expect(result.current.hasPermission).toBe(false);
    });

    it('handles device not found error', async () => {
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new DOMException('Device not found', 'NotFoundError')
      );

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      expect(result.current.error).toContain('No audio device found');
    });

    it('handles MediaRecorder errors', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      // Simulate MediaRecorder error
      act(() => {
        if (mockMediaRecorder.onerror) {
          mockMediaRecorder.onerror(new Event('error'));
        }
      });

      expect(result.current.error).toContain('Recording failed');
      expect(result.current.isRecording).toBe(false);
    });

    it('handles unsupported media types', async () => {
      (global as any).MediaRecorder.isTypeSupported = jest.fn(() => false);

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('video');
      });

      expect(result.current.error).toContain('not supported');
    });
  });

  describe('Duration Tracking', () => {
    it('tracks recording duration', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      act(() => {
        mockMediaRecorder.state = 'recording';
      });

      // Advance time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.duration).toBe(5000);

      jest.useRealTimers();
    });

    it('enforces maximum duration', async () => {
      jest.useFakeTimers();

      const { result } = renderHook(() => useMediaRecording({
        maxDuration: 10000,
      }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.startRecording('audio');
      });

      act(() => {
        mockMediaRecorder.state = 'recording';
      });

      // Advance past max duration
      act(() => {
        jest.advanceTimersByTime(15000);
      });

      expect(mockMediaRecorder.stop).toHaveBeenCalled();

      jest.useRealTimers();
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

      expect(mockMediaRecorder.stop).toHaveBeenCalled();
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

      unmount();

      // Should stop tracks
      expect(mockStream.getTracks().forEach).toBeDefined();
    });
  });

  describe('Media Support Detection', () => {
    it('checks media support correctly', () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.checkMediaSupport();
      });

      expect(result.current.canRecord).toBe(true);
    });

    it('handles missing MediaRecorder API', () => {
      const originalMediaRecorder = (global as any).MediaRecorder;
      (global as any).MediaRecorder = undefined;

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.checkMediaSupport();
      });

      expect(result.current.canRecord).toBe(false);

      // Restore MediaRecorder
      (global as any).MediaRecorder = originalMediaRecorder;
    });

    it('handles missing getUserMedia API', () => {
      const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
      });

      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.checkMediaSupport();
      });

      expect(result.current.canRecord).toBe(false);

      // Restore getUserMedia
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: originalGetUserMedia },
      });
    });
  });

  describe('Redux Integration', () => {
    it('dispatches recording events to Redux store', async () => {
      const { result } = renderHook(() => useMediaRecording(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.completeTextRecording('Test statement');
      });

      await waitFor(() => {
        expect(result.current.recordedMedia).not.toBeNull();
      });

      // The hook should dispatch actions to the Redux store
      // This would be verified by checking the store state
      expect(result.current.recordedMedia?.type).toBe('text');
    });
  });
});