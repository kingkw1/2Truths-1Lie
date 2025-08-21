/**
 * Tests for UploadProgress Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UploadProgress } from '../UploadProgress';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('UploadProgress Component', () => {
  const defaultProps = {
    sessionId: 'test-session-123',
    filename: 'test-video.webm',
    fileSize: 1024 * 1024, // 1MB
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Initial Rendering', () => {
    it('renders with basic props', () => {
      render(<UploadProgress {...defaultProps} />);
      
      expect(screen.getByText('test-video.webm')).toBeInTheDocument();
      expect(screen.getByText(/\(.*1 MB.*\)/)).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('shows preparing upload initially', () => {
      render(<UploadProgress {...defaultProps} autoStart={false} />);
      
      expect(screen.getByText('Preparing upload...')).toBeInTheDocument();
    });

    it('renders in compact mode', () => {
      render(<UploadProgress {...defaultProps} compact={true} />);
      
      expect(screen.getByText('test-video.webm')).toBeInTheDocument();
      // Compact mode should still show essential elements
    });
  });

  describe('Upload Progress Tracking', () => {
    it('polls upload status when autoStart is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 25,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3, 4, 5],
        }),
      });

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/upload/test-session-123/status',
          expect.objectContaining({
            headers: {
              'Authorization': 'Bearer mock-auth-token',
            },
          })
        );
      });
    });

    it('updates progress display', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0, 1, 2],
          remaining_chunks: [3, 4, 5],
        }),
      });

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
    });

    it('shows completion status', async () => {
      const onComplete = jest.fn();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          progress_percent: 100,
          uploaded_chunks: [0, 1, 2, 3, 4, 5],
          remaining_chunks: [],
        }),
      });

      render(
        <UploadProgress 
          {...defaultProps} 
          autoStart={true}
          onUploadComplete={onComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('✓ Upload completed')).toBeInTheDocument();
      });

      expect(onComplete).toHaveBeenCalledWith('/api/v1/files/test-session-123_test-video.webm');
    });

    it('handles upload failure', async () => {
      const onError = jest.fn();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'failed',
          progress_percent: 30,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3, 4, 5],
          error_message: 'Network error',
        }),
      });

      render(
        <UploadProgress 
          {...defaultProps} 
          autoStart={true}
          onUploadError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('✗ Upload failed')).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Network error');
    });
  });

  describe('Upload Control Actions', () => {
    it('cancels upload when cancel button is clicked', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 25,
            uploaded_chunks: [0, 1],
            remaining_chunks: [2, 3, 4, 5],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Upload cancelled' }),
        });

      const onCancel = jest.fn();

      render(
        <UploadProgress 
          {...defaultProps} 
          autoStart={true}
          onUploadCancel={onCancel}
        />
      );

      // Wait for initial status to load
      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      // Click cancel button
      const cancelButton = screen.getByTitle('Cancel upload');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/v1/upload/test-session-123',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      expect(onCancel).toHaveBeenCalled();
    });

    it('retries upload when retry button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'failed',
          progress_percent: 30,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3, 4, 5],
          error_message: 'Network error',
        }),
      });

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(screen.getByText('✗ Upload failed')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry Upload');
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 30,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3, 4, 5],
        }),
      });

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });
    });

    it('dismisses component when dismiss button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          progress_percent: 100,
          uploaded_chunks: [0, 1, 2, 3, 4, 5],
          remaining_chunks: [],
        }),
      });

      const { container } = render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(screen.getByText('✓ Upload completed')).toBeInTheDocument();
      });

      const dismissButton = screen.getByTitle('Dismiss');
      fireEvent.click(dismissButton);

      // Component should be removed from DOM
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Speed and ETA Calculations', () => {
    it('calculates and displays upload speed', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0, 1, 2],
          remaining_chunks: [3, 4, 5],
        }),
      });

      render(<UploadProgress {...defaultProps} autoStart={true} showDetails={true} />);

      // Fast-forward time to simulate upload progress
      act(() => {
        jest.advanceTimersByTime(2000); // 2 seconds
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      // Should show speed information
      await waitFor(() => {
        const speedText = screen.getByText(/\/s/);
        expect(speedText).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('shows estimated time remaining', async () => {
      jest.useFakeTimers();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 25,
          uploaded_chunks: [0, 1],
          remaining_chunks: [2, 3, 4, 5, 6, 7],
        }),
      });

      render(<UploadProgress {...defaultProps} autoStart={true} showDetails={true} />);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('25%')).toBeInTheDocument();
      });

      // Should show ETA
      await waitFor(() => {
        const etaText = screen.getByText(/remaining/);
        expect(etaText).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Status check failed/)).toBeInTheDocument();
      });
    });

    it('continues polling after recoverable errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 50,
            uploaded_chunks: [0, 1, 2],
            remaining_chunks: [3, 4, 5],
          }),
        });

      render(<UploadProgress {...defaultProps} autoStart={true} />);

      // Should recover and show progress
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('File Size Formatting', () => {
    it('formats bytes correctly', () => {
      render(<UploadProgress {...defaultProps} fileSize={1024} />);
      expect(screen.getAllByText(/1 KB/)[0]).toBeInTheDocument();
    });

    it('formats megabytes correctly', () => {
      render(<UploadProgress {...defaultProps} fileSize={1024 * 1024 * 5.5} />);
      expect(screen.getAllByText(/5\.5 MB/)[0]).toBeInTheDocument();
    });

    it('formats gigabytes correctly', () => {
      render(<UploadProgress {...defaultProps} fileSize={1024 * 1024 * 1024 * 2.3} />);
      expect(screen.getAllByText(/2\.3 GB/)[0]).toBeInTheDocument();
    });
  });

  describe('Detailed Progress Information', () => {
    it('shows chunk information when showDetails is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0, 1, 2],
          remaining_chunks: [3, 4, 5],
        }),
      });

      render(
        <UploadProgress 
          {...defaultProps} 
          autoStart={true} 
          showDetails={true}
          compact={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Chunks: 3 / 6')).toBeInTheDocument();
      });
    });

    it('hides detailed information in compact mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: 50,
          uploaded_chunks: [0, 1, 2],
          remaining_chunks: [3, 4, 5],
        }),
      });

      render(
        <UploadProgress 
          {...defaultProps} 
          autoStart={true} 
          showDetails={true}
          compact={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      // Should not show chunk details in compact mode
      expect(screen.queryByText('Chunks:')).not.toBeInTheDocument();
    });
  });
});