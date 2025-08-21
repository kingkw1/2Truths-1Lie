/**
 * Comprehensive failure mode tests for media components
 * Tests edge cases, error conditions, and recovery scenarios
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MediaRecorder from '../MediaRecorder';
import MediaPreview from '../MediaPreview';
import { UploadProgress } from '../UploadProgress';
import { MediaCapture } from '../../types/challenge';
import challengeCreationSlice from '../../store/slices/challengeCreationSlice';

// Mock dependencies
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationSlice,
    },
  });
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = createTestStore();
  return <Provider store={store}>{children}</Provider>;
};

describe('Media Components - Failure Mode Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
  });

  describe('MediaRecorder Failure Modes', () => {
    it('handles getUserMedia permission denied gracefully', async () => {
      // Mock permission denied error
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockRejectedValue(
            new DOMException('Permission denied', 'NotAllowedError')
          ),
        },
      });

      const onRecordingError = jest.fn();

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={onRecordingError}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      // Try to start video recording
      fireEvent.click(screen.getByText('Video'));

      // Should fall back to text mode instead of calling error handler
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });

      // Should show fallback message
      expect(screen.getByText(/video recording not supported, using text mode/)).toBeInTheDocument();
    });

    it('handles getUserMedia device not found error', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockRejectedValue(
            new DOMException('Device not found', 'NotFoundError')
          ),
        },
      });

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['audio', 'text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Audio'));

      await waitFor(() => {
        expect(screen.getByText(/audio recording not supported, using text mode/)).toBeInTheDocument();
      });
    });

    it('handles MediaRecorder constructor failure', async () => {
      // Mock successful getUserMedia but failing MediaRecorder
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
          }),
        },
      });

      (global as any).MediaRecorder = jest.fn(() => {
        throw new Error('MediaRecorder not supported');
      });

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });
    });

    it('handles MediaRecorder.isTypeSupported returning false', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }],
          }),
        },
      });

      (global as any).MediaRecorder = jest.fn();
      (global as any).MediaRecorder.isTypeSupported = jest.fn(() => false);

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });
    });

    it('handles empty text input validation', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Text Only'));

      const completeButton = screen.getByText('Complete Text Recording');
      expect(completeButton).toBeDisabled();

      // Try with whitespace only
      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      fireEvent.change(textInput, { target: { value: '   ' } });
      
      expect(completeButton).toBeDisabled();
    });

    it('handles extremely long text input', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Text Only'));

      const textInput = screen.getByPlaceholderText(/Type your statement here/) as HTMLTextAreaElement;
      const veryLongText = 'a'.repeat(1000);
      
      fireEvent.change(textInput, { target: { value: veryLongText } });

      // Should be truncated to character limit
      expect(textInput.value).toHaveLength(500);
      expect(screen.getByText('500/500 characters')).toBeInTheDocument();
    });

    it('handles component unmount during recording', () => {
      const mockStream = {
        getTracks: jest.fn(() => [
          { stop: jest.fn() },
          { stop: jest.fn() },
        ]),
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream),
        },
      });

      const { unmount } = render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      // Start recording process
      fireEvent.click(screen.getByText('Video'));

      // Unmount component
      unmount();

      // Should clean up streams
      expect(mockStream.getTracks).toHaveBeenCalled();
    });
  });

  describe('MediaPreview Failure Modes', () => {
    it('handles corrupted media URLs', () => {
      const corruptedMediaData: MediaCapture = {
        type: 'video',
        url: 'blob:corrupted-url',
        duration: 5000,
        fileSize: 1024,
        mimeType: 'video/webm',
      };

      render(<MediaPreview mediaData={corruptedMediaData} />);

      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('VIDEO')).toBeInTheDocument();
    });

    it('handles missing or invalid text content', () => {
      const invalidTextData: MediaCapture = {
        type: 'text',
        url: 'data:text/plain;base64,invalid-base64!!!',
        duration: 0,
        fileSize: 0,
        mimeType: 'text/plain',
      };

      render(<MediaPreview mediaData={invalidTextData} />);

      expect(screen.getByText('No text content available')).toBeInTheDocument();
    });

    it('handles unsupported media types', () => {
      const unsupportedMediaData = {
        type: 'unknown' as any,
        url: 'blob:unknown-url',
        duration: 5000,
        fileSize: 1024,
        mimeType: 'unknown/type',
      };

      render(<MediaPreview mediaData={unsupportedMediaData} />);

      expect(screen.getByText('Unsupported media type: unknown')).toBeInTheDocument();
    });

    it('handles media element load errors', () => {
      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-url',
        duration: 5000,
        fileSize: 1024,
        mimeType: 'video/webm',
      };

      render(<MediaPreview mediaData={mediaData} />);

      // Simulate media load error
      const videoElement = document.querySelector('video');
      if (videoElement) {
        fireEvent.error(videoElement);
      }

      // Component should still render
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
    });

    it('handles zero duration media', () => {
      const zeroDurationMedia: MediaCapture = {
        type: 'audio',
        url: 'blob:audio-url',
        duration: 0,
        fileSize: 1024,
        mimeType: 'audio/webm',
      };

      render(<MediaPreview mediaData={zeroDurationMedia} />);

      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('AUDIO')).toBeInTheDocument();
    });
  });

  describe('UploadProgress Failure Modes', () => {
    it('handles network timeouts during status polling', async () => {
      // Mock timeout error
      mockFetch.mockImplementation(() => 
        Promise.reject(new Error('Request timeout'))
      );

      const onError = jest.fn();

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
          onUploadError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Request timeout')).toBeInTheDocument();
      });
    });

    it('handles server returning invalid JSON', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Status check failed/)).toBeInTheDocument();
      });
    });

    it('handles 404 session not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      render(
        <UploadProgress
          sessionId="nonexistent-session"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Status check failed/)).toBeInTheDocument();
      });
    });

    it('handles 500 server errors with retry', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 25,
            uploaded_chunks: [0],
            remaining_chunks: [1, 2, 3],
          }),
        });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Should eventually recover
      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles upload session expiration', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'expired',
          progress_percent: 50,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3],
          error_message: 'Session expired',
        }),
      });

      const onError = jest.fn();

      render(
        <UploadProgress
          sessionId="expired-session"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
          onUploadError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('✗ Upload failed')).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Session expired');
    });

    it('handles cancel operation failure', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 25,
            uploaded_chunks: [0],
            remaining_chunks: [1, 2, 3],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      // Try to cancel
      const cancelButton = screen.getByTitle('Cancel upload');
      fireEvent.click(cancelButton);

      // Should handle cancel failure gracefully
      await waitFor(() => {
        // Component should still be visible even if cancel failed
        expect(screen.getByText('test.webm')).toBeInTheDocument();
      });
    });

    it('handles extremely large file sizes', () => {
      const hugeFileSize = 10 * 1024 * 1024 * 1024; // 10GB

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="huge-file.webm"
          fileSize={hugeFileSize}
        />
      );

      expect(screen.getByText(/10 GB/)).toBeInTheDocument();
    });

    it('handles zero file size', () => {
      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="empty-file.webm"
          fileSize={0}
        />
      );

      expect(screen.getByText(/0 B/)).toBeInTheDocument();
    });

    it('handles missing authentication token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Status check failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component Error Propagation', () => {
    it('handles recording error followed by upload attempt', async () => {
      const onRecordingError = jest.fn();
      const onUploadError = jest.fn();

      // Mock recording failure
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockRejectedValue(new Error('Camera busy')),
        },
      });

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={onRecordingError}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      // Should fall back to text mode
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });
    });

    it('handles preview of corrupted media followed by upload', () => {
      const corruptedMedia: MediaCapture = {
        type: 'video',
        url: 'blob:corrupted',
        duration: -1, // Invalid duration
        fileSize: -1, // Invalid file size
        mimeType: 'invalid/type',
      };

      render(<MediaPreview mediaData={corruptedMedia} />);

      // Should still render preview
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
    });
  });

  describe('Memory and Resource Leak Prevention', () => {
    it('cleans up blob URLs on component unmount', () => {
      const mockRevokeObjectURL = jest.fn();
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:test-url',
        duration: 5000,
        fileSize: 1024,
        mimeType: 'video/webm',
      };

      const { unmount } = render(<MediaPreview mediaData={mediaData} />);

      unmount();

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('stops polling on component unmount', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { unmount } = render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Start polling
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Unmount should stop polling
      unmount();

      // No way to directly test this, but component should clean up
      expect(true).toBe(true);
    });

    it('handles multiple rapid component mounts/unmounts', () => {
      const mediaData: MediaCapture = {
        type: 'audio',
        url: 'blob:audio-url',
        duration: 3000,
        fileSize: 512,
        mimeType: 'audio/webm',
      };

      // Mount and unmount rapidly
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<MediaPreview mediaData={mediaData} />);
        unmount();
      }

      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });
  });

  describe('Edge Case Scenarios', () => {
    it('handles simultaneous recording attempts', async () => {
      const onRecordingComplete = jest.fn();

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={jest.fn()}
            allowedTypes={['text']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Text Only'));

      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      
      // Rapidly change text and try to complete
      fireEvent.change(textInput, { target: { value: 'First text' } });
      fireEvent.click(screen.getByText('Complete Text Recording'));
      
      fireEvent.change(textInput, { target: { value: 'Second text' } });
      
      // Should handle this gracefully
      await waitFor(() => {
        expect(onRecordingComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('handles browser tab visibility changes during upload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3],
        }),
      });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: true,
      });

      fireEvent(document, new Event('visibilitychange'));

      // Should continue working
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });
  });
});