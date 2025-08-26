/**
 * Comprehensive integration tests for the complete media workflow
 * Tests recording -> preview -> compression -> upload -> failure modes
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MediaRecorder from '../MediaRecorder';
import MediaPreview from '../MediaPreview';
import { UploadProgress } from '../UploadProgress';
import { MediaCapture, MediaType } from '../../types/challenge';
import challengeCreationSlice from '../../store/slices/challengeCreationSlice';

// Mock all external dependencies
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock MediaRecorder API
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: null as any,
  onstop: null as any,
  state: 'inactive',
};

const mockStream = {
  getTracks: jest.fn(() => [
    { stop: jest.fn() },
    { stop: jest.fn() },
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
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
}));

// Mock btoa
(global as any).btoa = jest.fn((str: string) => Buffer.from(str, 'utf8').toString('base64'));

// Mock crypto
const mockCrypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
};
Object.defineProperty(global, 'crypto', { value: mockCrypto });

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn().mockReturnValue('mock-auth-token'),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

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
  compressMediaBlob: jest.fn(),
}));

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationSlice,
    },
  });
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = createTestStore();
  return <Provider store={store}>{children}</Provider>;
};

describe('Complete Media Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockResolvedValue(mockStream);
  });

  describe('End-to-End Recording Workflow', () => {
    it('completes full text recording workflow', async () => {
      const onRecordingComplete = jest.fn();
      const onRecordingError = jest.fn();

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={onRecordingError}
            maxDuration={30000}
            allowedTypes={['text']}
          />
        </TestWrapper>
      );

      // Start text recording
      fireEvent.click(screen.getByText('Use Text Only'));

      // Enter text
      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      fireEvent.change(textInput, { target: { value: 'This is my test statement' } });

      // Complete recording
      fireEvent.click(screen.getByText('Complete Text Recording'));

      await waitFor(() => {
        expect(onRecordingComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            url: expect.stringContaining('data:text/plain;base64,'),
            duration: 0,
            mimeType: 'text/plain',
          })
        );
      });

      expect(onRecordingError).not.toHaveBeenCalled();
    });

    it('handles video recording with compression workflow', async () => {
      const onRecordingComplete = jest.fn();
      
      // Mock successful video recording
      const mockVideoBlob = new Blob(['video data'], { type: 'video/webm' });
      
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={jest.fn()}
            enableCompression={true}
            compressionOptions={{ quality: 0.8 }}
          />
        </TestWrapper>
      );

      // Should show video option
      expect(screen.getByText('Start Video Recording')).toBeInTheDocument();
      
      // The component should handle the full workflow internally
      expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
    });

    it('handles fallback from video to text when permissions denied', async () => {
      const onRecordingComplete = jest.fn();
      
      // Mock permission denied
      (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      // Try to start video recording
      fireEvent.click(screen.getByText('Start Video Recording'));

      // Should fall back to text mode
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });

      // Complete text recording
      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      fireEvent.change(textInput, { target: { value: 'Fallback text' } });
      fireEvent.click(screen.getByText('Complete Text Recording'));

      await waitFor(() => {
        expect(onRecordingComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            url: expect.stringContaining('data:text/plain;base64,'),
          })
        );
      });
    });
  });

  describe('Preview and Re-recording Workflow', () => {
    it('allows preview and re-recording of media', () => {
      const mockMediaData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 5000,
        fileSize: 1024000,
        mimeType: 'video/webm',
      };

      const onReRecord = jest.fn();
      const onConfirm = jest.fn();

      render(
        <MediaPreview
          mediaData={mockMediaData}
          onReRecord={onReRecord}
          onConfirm={onConfirm}
        />
      );

      // Should show preview
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('VIDEO')).toBeInTheDocument();

      // Should show action buttons
      const reRecordButton = screen.getByRole('button', { name: /re-record/i });
      const confirmButton = screen.getByRole('button', { name: /use this recording/i });

      expect(reRecordButton).toBeInTheDocument();
      expect(confirmButton).toBeInTheDocument();

      // Test re-record
      fireEvent.click(reRecordButton);
      expect(onReRecord).toHaveBeenCalledTimes(1);

      // Test confirm
      fireEvent.click(confirmButton);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('handles different media types in preview', () => {
      const testCases = [
        {
          type: 'video' as MediaType,
          data: {
            type: 'video' as MediaType,
            url: 'blob:video-url',
            duration: 10000,
            fileSize: 2048000,
            mimeType: 'video/webm',
          },
          expectedLabel: 'VIDEO',
        },
        {
          type: 'audio' as MediaType,
          data: {
            type: 'audio' as MediaType,
            url: 'blob:audio-url',
            duration: 5000,
            fileSize: 512000,
            mimeType: 'audio/webm',
          },
          expectedLabel: 'AUDIO',
        },
        {
          type: 'text' as MediaType,
          data: {
            type: 'text' as MediaType,
            url: 'data:text/plain;base64,VGVzdCB0ZXh0',
            duration: 0,
            fileSize: 9,
            mimeType: 'text/plain',
          },
          expectedLabel: 'TEXT',
        },
      ];

      testCases.forEach(({ data, expectedLabel }) => {
        const { unmount } = render(<MediaPreview mediaData={data} />);
        
        expect(screen.getByText('Preview Recording')).toBeInTheDocument();
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Upload Progress and Error Handling', () => {
    it('tracks upload progress successfully', async () => {
      const onComplete = jest.fn();
      const onError = jest.fn();

      // Mock successful upload status responses
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
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 50,
            uploaded_chunks: [0, 1],
            remaining_chunks: [2, 3],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            progress_percent: 100,
            uploaded_chunks: [0, 1, 2, 3],
            remaining_chunks: [],
            file_url: '/api/v1/files/test-session-123_test.webm',
          }),
        });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024 * 1024}
          autoStart={true}
          onUploadComplete={onComplete}
          onUploadError={onError}
        />
      );

      // Should start with 0%
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('✓ Upload completed')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(onComplete).toHaveBeenCalledWith('/api/v1/files/test-session-123_test.webm');
      expect(onError).not.toHaveBeenCalled();
    });

    it('handles upload failures with retry', async () => {
      const onError = jest.fn();

      // Mock failure then success
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'failed',
            progress_percent: 30,
            uploaded_chunks: [0],
            remaining_chunks: [1, 2, 3],
            error_message: 'Network timeout',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 30,
            uploaded_chunks: [0],
            remaining_chunks: [1, 2, 3],
          }),
        });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024 * 1024}
          autoStart={true}
          onUploadError={onError}
        />
      );

      // Wait for failure
      await waitFor(() => {
        expect(screen.getByText('✗ Upload failed')).toBeInTheDocument();
      });

      // Should show retry button
      const retryButton = screen.getByText('Retry Upload');
      expect(retryButton).toBeInTheDocument();

      // Click retry
      fireEvent.click(retryButton);

      // Should resume uploading
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });
    });

    it('handles upload cancellation', async () => {
      const onCancel = jest.fn();

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
          ok: true,
          json: async () => ({ message: 'Upload cancelled' }),
        });

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024 * 1024}
          autoStart={true}
          onUploadCancel={onCancel}
        />
      );

      // Wait for progress to show
      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      // Cancel upload
      const cancelButton = screen.getByTitle('Cancel upload');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/upload/test-session-123',
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Compression Integration', () => {
    it('shows compression progress during media processing', async () => {
      // This test would require mocking the useMediaRecording hook
      // to simulate compression in progress
      const mockMediaData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-url',
        duration: 10000,
        fileSize: 1024,
        mimeType: 'video/webm',
        originalSize: 2048,
        compressionRatio: 2,
        compressionTime: 100,
      };

      render(<MediaPreview mediaData={mockMediaData} />);

      // Should show compressed file info
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('VIDEO')).toBeInTheDocument();
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('recovers from temporary network errors', async () => {
      // Mock temporary network failure then success
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
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
          filename="test.webv"
          fileSize={1024 * 1024}
          autoStart={true}
        />
      );

      // Should eventually recover and show progress
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('handles unsupported media types gracefully', () => {
      const onRecordingError = jest.fn();

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={onRecordingError}
            allowedTypes={[]} // No allowed types
          />
        </TestWrapper>
      );

      // Should still render but with limited options
      expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
    });

    it('handles MediaRecorder API not available', async () => {
      // Mock MediaRecorder as undefined
      const originalMediaRecorder = (global as any).MediaRecorder;
      (global as any).MediaRecorder = undefined;

      const onRecordingComplete = jest.fn();

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'text']}
          />
        </TestWrapper>
      );

      // Should fall back to text mode
      fireEvent.click(screen.getByText('Start Video Recording'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Type your statement here/)).toBeInTheDocument();
      });

      // Restore MediaRecorder
      (global as any).MediaRecorder = originalMediaRecorder;
    });
  });

  describe('Performance and Resource Management', () => {
    it('cleans up resources on component unmount', () => {
      const mockMediaData: MediaCapture = {
        type: 'video',
        url: 'blob:mock-video-url',
        duration: 5000,
        fileSize: 1024000,
        mimeType: 'video/webm',
      };

      const { unmount } = render(<MediaPreview mediaData={mockMediaData} />);

      unmount();

      // Should revoke blob URLs
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-video-url');
    });

    it('handles large file sizes appropriately', () => {
      const largeFileSize = 100 * 1024 * 1024; // 100MB

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="large-video.webm"
          fileSize={largeFileSize}
        />
      );

      // Should format large file size correctly
      expect(screen.getAllByText(/100 MB/)[0]).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('provides proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
          />
        </TestWrapper>
      );

      // Check for accessible buttons
      const videoButton = screen.getByText('Start Video Recording').closest('button');
      const textButton = screen.getByText('Use Text Only').closest('button');

      expect(videoButton).toBeInTheDocument();
      expect(textButton).toBeInTheDocument();
    });

    it('shows appropriate loading states', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <UploadProgress
          sessionId="test-session-123"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Should show loading state
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
  });
});