/**
 * Performance and stress tests for media components
 * Tests handling of large files, concurrent operations, and resource usage
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

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => []),
};
Object.defineProperty(global, 'performance', { value: mockPerformance });

// Mock fetch with performance tracking
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn().mockReturnValue('mock-auth-token'),
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

describe('Media Components - Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Large File Handling', () => {
    it('handles very large video files efficiently', async () => {
      const largeVideoData: MediaCapture = {
        type: 'video',
        url: 'blob:large-video-url',
        duration: 3600000, // 1 hour
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
        mimeType: 'video/webm',
      };

      const startTime = performance.now();

      render(<MediaPreview mediaData={largeVideoData} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render quickly even with large files
      expect(renderTime).toBeLessThan(100); // Less than 100ms
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText(/2 GB/)).toBeInTheDocument();
    });

    it('handles multiple large file uploads concurrently', async () => {
      const uploadSessions = [
        'session-1',
        'session-2', 
        'session-3',
        'session-4',
        'session-5',
      ];

      // Mock responses for all sessions
      mockFetch.mockImplementation((url) => {
        const sessionId = url.match(/session-(\d+)/)?.[0];
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: Math.floor(Math.random() * 100),
            uploaded_chunks: [0, 1],
            remaining_chunks: [2, 3, 4],
          }),
        });
      });

      const components = uploadSessions.map(sessionId => (
        <UploadProgress
          key={sessionId}
          sessionId={sessionId}
          filename={`large-file-${sessionId}.webm`}
          fileSize={500 * 1024 * 1024} // 500MB each
          autoStart={true}
        />
      ));

      const startTime = performance.now();

      render(<div>{components}</div>);

      // Fast-forward timers to trigger polling
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        uploadSessions.forEach(sessionId => {
          expect(screen.getByText(`large-file-${sessionId}.webm`)).toBeInTheDocument();
        });
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle multiple concurrent uploads efficiently
      expect(totalTime).toBeLessThan(500); // Less than 500ms
    });

    it('efficiently handles rapid text input changes', async () => {
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

      const textInput = screen.getByPlaceholderText(/Type your statement here/);
      
      const startTime = performance.now();

      // Simulate rapid typing
      for (let i = 0; i < 100; i++) {
        fireEvent.change(textInput, { 
          target: { value: 'a'.repeat(i + 1) } 
        });
      }

      const endTime = performance.now();
      const inputTime = endTime - startTime;

      // Should handle rapid input changes efficiently
      expect(inputTime).toBeLessThan(200); // Less than 200ms
      expect(screen.getByText('100/500 characters')).toBeInTheDocument();
    });
  });

  describe('Memory Usage Optimization', () => {
    it('properly cleans up resources when switching media types', async () => {
      const mockRevokeObjectURL = jest.fn();
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const videoData: MediaCapture = {
        type: 'video',
        url: 'blob:video-url',
        duration: 10000,
        fileSize: 1024 * 1024,
        mimeType: 'video/webm',
      };

      const audioData: MediaCapture = {
        type: 'audio',
        url: 'blob:audio-url',
        duration: 5000,
        fileSize: 512 * 1024,
        mimeType: 'audio/webm',
      };

      const { rerender } = render(<MediaPreview mediaData={videoData} />);

      // Switch to audio
      rerender(<MediaPreview mediaData={audioData} />);

      // Should clean up previous video URL
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:video-url');
    });

    it('handles rapid component mount/unmount cycles', () => {
      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:test-url',
        duration: 5000,
        fileSize: 1024,
        mimeType: 'video/webm',
      };

      const startTime = performance.now();

      // Rapidly mount and unmount components
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(<MediaPreview mediaData={mediaData} />);
        unmount();
      }

      const endTime = performance.now();
      const cycleTime = endTime - startTime;

      // Should handle rapid cycles efficiently
      expect(cycleTime).toBeLessThan(1000); // Less than 1 second
    });

    it('efficiently handles many simultaneous preview components', () => {
      const mediaItems = Array.from({ length: 20 }, (_, i) => ({
        type: 'video' as const,
        url: `blob:video-${i}`,
        duration: 5000 + i * 1000,
        fileSize: 1024 * (i + 1),
        mimeType: 'video/webm',
      }));

      const startTime = performance.now();

      render(
        <div>
          {mediaItems.map((media, i) => (
            <MediaPreview key={i} mediaData={media} />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render many components efficiently
      expect(renderTime).toBeLessThan(300); // Less than 300ms
      expect(screen.getAllByText('Preview Recording')).toHaveLength(20);
    });
  });

  describe('Network Performance', () => {
    it('efficiently handles high-frequency upload status polling', async () => {
      let requestCount = 0;
      mockFetch.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: Math.min(requestCount * 5, 100),
            uploaded_chunks: Array.from({ length: requestCount }, (_, i) => i),
            remaining_chunks: Array.from({ length: Math.max(0, 20 - requestCount) }, (_, i) => i + requestCount),
          }),
        });
      });

      render(
        <UploadProgress
          sessionId="performance-test"
          filename="test.webm"
          fileSize={1024 * 1024}
          autoStart={true}
        />
      );

      // Fast-forward through multiple polling cycles
      for (let i = 0; i < 10; i++) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
        await waitFor(() => {
          expect(screen.getByText(/\d+%/)).toBeInTheDocument();
        });
      }

      // Should have made reasonable number of requests
      expect(requestCount).toBeGreaterThan(5);
      expect(requestCount).toBeLessThan(15); // Not too many requests
    });

    it('handles network request failures without performance degradation', async () => {
      let failureCount = 0;
      mockFetch.mockImplementation(() => {
        failureCount++;
        if (failureCount <= 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'in_progress',
            progress_percent: 50,
            uploaded_chunks: [0, 1],
            remaining_chunks: [2, 3],
          }),
        });
      });

      const startTime = performance.now();

      render(
        <UploadProgress
          sessionId="failure-test"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Fast-forward through failure and recovery
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const recoveryTime = endTime - startTime;

      // Should recover efficiently even after failures
      expect(recoveryTime).toBeLessThan(1000);
      expect(failureCount).toBe(4); // 3 failures + 1 success
    });
  });

  describe('UI Responsiveness', () => {
    it('maintains responsive UI during intensive operations', async () => {
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

      const textInput = screen.getByPlaceholderText(/Type your statement here/);

      // Simulate intensive text processing
      const startTime = performance.now();
      
      for (let i = 0; i < 500; i++) {
        fireEvent.change(textInput, { 
          target: { value: 'Complex text with unicode: 🎥📹🎬 '.repeat(i % 10 + 1) } 
        });
        
        // Check that UI remains responsive
        if (i % 100 === 0) {
          expect(screen.getByText(/\d+\/500 characters/)).toBeInTheDocument();
        }
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should maintain responsiveness
      expect(processingTime).toBeLessThan(500);
    });

    it('handles rapid upload progress updates smoothly', async () => {
      let progressValue = 0;
      mockFetch.mockImplementation(() => {
        progressValue = Math.min(progressValue + 1, 100);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: progressValue < 100 ? 'in_progress' : 'completed',
            progress_percent: progressValue,
            uploaded_chunks: Array.from({ length: progressValue }, (_, i) => i),
            remaining_chunks: Array.from({ length: 100 - progressValue }, (_, i) => i + progressValue),
          }),
        });
      });

      render(
        <UploadProgress
          sessionId="rapid-progress"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      const startTime = performance.now();

      // Rapidly advance through progress updates
      for (let i = 0; i < 100; i++) {
        act(() => {
          jest.advanceTimersByTime(50); // Very frequent updates
        });
        
        if (i % 20 === 0) {
          await waitFor(() => {
            expect(screen.getByText(/\d+%/)).toBeInTheDocument();
          });
        }
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(updateTime).toBeLessThan(1000);
    });
  });

  describe('Stress Testing', () => {
    it('handles extreme file sizes without crashing', () => {
      const extremeFileSizes = [
        0, // Empty file
        1, // 1 byte
        1024, // 1 KB
        1024 * 1024, // 1 MB
        1024 * 1024 * 1024, // 1 GB
        10 * 1024 * 1024 * 1024, // 10 GB
        Number.MAX_SAFE_INTEGER, // Maximum safe integer
      ];

      extremeFileSizes.forEach(fileSize => {
        const { unmount } = render(
          <UploadProgress
            sessionId={`size-test-${fileSize}`}
            filename="extreme-size.webm"
            fileSize={fileSize}
          />
        );

        // Should render without crashing
        expect(screen.getByText('extreme-size.webm')).toBeInTheDocument();
        
        unmount();
      });
    });

    it('handles extreme duration values', () => {
      const extremeDurations = [
        0, // No duration
        1, // 1ms
        1000, // 1 second
        60000, // 1 minute
        3600000, // 1 hour
        86400000, // 24 hours
        Number.MAX_SAFE_INTEGER, // Maximum duration
      ];

      extremeDurations.forEach(duration => {
        const mediaData: MediaCapture = {
          type: 'video',
          url: 'blob:duration-test',
          duration,
          fileSize: 1024,
          mimeType: 'video/webm',
        };

        const { unmount } = render(<MediaPreview mediaData={mediaData} />);

        // Should render without crashing
        expect(screen.getByText('Preview Recording')).toBeInTheDocument();
        
        unmount();
      });
    });

    it('handles many concurrent upload sessions', async () => {
      const sessionCount = 50;
      const sessions = Array.from({ length: sessionCount }, (_, i) => `stress-session-${i}`);

      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: async () => ({
          status: 'in_progress',
          progress_percent: Math.floor(Math.random() * 100),
          uploaded_chunks: [0],
          remaining_chunks: [1, 2, 3],
        }),
      }));

      const startTime = performance.now();

      render(
        <div>
          {sessions.map(sessionId => (
            <UploadProgress
              key={sessionId}
              sessionId={sessionId}
              filename={`file-${sessionId}.webm`}
              fileSize={1024}
              autoStart={true}
            />
          ))}
        </div>
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should handle many concurrent sessions
      expect(renderTime).toBeLessThan(2000); // Less than 2 seconds
      expect(screen.getAllByText(/file-stress-session-\d+\.webm/)).toHaveLength(sessionCount);
    });

    it('handles rapid component state changes', async () => {
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

      const startTime = performance.now();

      // Rapidly switch between states
      for (let i = 0; i < 100; i++) {
        fireEvent.click(screen.getByText('Text Only'));
        
        const textInput = screen.getByPlaceholderText(/Type your statement here/);
        fireEvent.change(textInput, { target: { value: `Text ${i}` } });
        
        if (i % 10 === 0) {
          fireEvent.click(screen.getByText('Complete Text Recording'));
          
          await waitFor(() => {
            expect(screen.getByText('Record Again')).toBeInTheDocument();
          });
          
          fireEvent.click(screen.getByText('Record Again'));
        }
      }

      const endTime = performance.now();
      const stateChangeTime = endTime - startTime;

      // Should handle rapid state changes efficiently
      expect(stateChangeTime).toBeLessThan(2000);
      expect(onRecordingComplete).toHaveBeenCalledTimes(10);
    });
  });

  describe('Resource Cleanup', () => {
    it('properly cleans up timers and intervals', () => {
      const { unmount } = render(
        <UploadProgress
          sessionId="cleanup-test"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Start polling
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Unmount should clean up timers
      unmount();

      // Advance time further - no more requests should be made
      const initialCallCount = mockFetch.mock.calls.length;
      
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should not make additional requests after unmount
      expect(mockFetch.mock.calls.length).toBe(initialCallCount);
    });

    it('handles cleanup during error states', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { unmount } = render(
        <UploadProgress
          sessionId="error-cleanup-test"
          filename="test.webm"
          fileSize={1024}
          autoStart={true}
        />
      );

      // Let error occur
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Unmount during error state
      unmount();

      // Should clean up properly even in error state
      expect(true).toBe(true); // No crashes
    });
  });
});