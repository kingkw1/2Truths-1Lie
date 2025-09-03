/**
 * Comprehensive Upload Integration Tests
 * Tests complete upload flow from mobile client to backend
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';

import { VideoUploadService } from '../services/uploadService';
import { useUploadManager } from '../hooks/useUploadManager';
import { EnhancedUploadUI } from '../components/EnhancedUploadUI';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  documentDirectory: 'mock://documents/',
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

// Mock fetch with various response scenarios
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock network info
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Upload Integration - Comprehensive Tests', () => {
  let store: any;
  let uploadService: VideoUploadService;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
      },
      preloadedState: {
        challengeCreation: {
          currentChallenge: {
            id: 'test-challenge',
            statements: ['Statement 1', 'Statement 2', 'Statement 3'],
            mediaData: {},
          },
          uploadState: {},
          mediaRecordingState: {},
          previewMode: false,
        },
      },
    });

    uploadService = VideoUploadService.getInstance();
    uploadService.setAuthToken('test-token');
    jest.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<Provider store={store}>{component}</Provider>);
  };

  describe('End-to-End Upload Flow', () => {
    it('should complete full upload flow successfully', async () => {
      // Mock successful file info
      const mockFileInfo = {
        exists: true,
        size: 5 * 1024 * 1024, // 5MB
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'upload-session-123',
            upload_url: '/api/upload/upload-session-123',
            chunk_size: 1024 * 1024,
            total_chunks: 5,
          }),
          headers: new Map([['X-Upload-Session-ID', 'upload-session-123']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 20,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 40,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 60,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 80,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 100,
            media_url: '/api/media/stream/final-video-id',
            media_id: 'final-video-id',
          }),
        });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000, // 30 seconds
        { compress: true }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/final-video-id');
      expect(result.mediaId).toBe('final-video-id');
      expect(mockFetch).toHaveBeenCalledTimes(6); // 1 initiate + 5 chunks
    });

    it('should handle network interruption and resume upload', async () => {
      const mockFileInfo = {
        exists: true,
        size: 3 * 1024 * 1024, // 3MB
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock initiate success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'resume-session-123',
          upload_url: '/api/upload/resume-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: 3,
        }),
        headers: new Map([['X-Upload-Session-ID', 'resume-session-123']]),
      });

      // Mock first chunk success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 33,
        }),
      });

      // Mock network error on second chunk
      mockFetch.mockRejectedValueOnce(new Error('Network request failed'));

      // Mock resume request (get status)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'resume-session-123',
          uploaded_chunks: [0],
          remaining_chunks: [1, 2],
          progress: 33,
        }),
      });

      // Mock successful resume of remaining chunks
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 67,
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/resumed-video-id',
          media_id: 'resumed-video-id',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: true, enableResume: true }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/resumed-video-id');
      // Should have made resume calls
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/resume-session-123/status'),
        expect.any(Object)
      );
    });

    it('should handle upload cancellation gracefully', async () => {
      const mockFileInfo = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock initiate success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'cancel-session-123',
          upload_url: '/api/upload/cancel-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: 2,
        }),
        headers: new Map([['X-Upload-Session-ID', 'cancel-session-123']]),
      });

      // Start upload
      const uploadPromise = uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        20000,
        { compress: false }
      );

      // Cancel after a short delay
      setTimeout(() => {
        uploadService.cancelUpload('cancel-session-123');
      }, 100);

      // Mock cancel response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          cancelled: true,
        }),
      });

      const result = await uploadPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle server validation errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 100 * 1024 * 1024, // 100MB - too large
        uri: 'mock://large-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock server validation error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          detail: 'File size exceeds maximum allowed size of 50MB',
          error_code: 'FILE_TOO_LARGE',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://large-video.mp4',
        'large-video.mp4',
        120000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds maximum');
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
    });

    it('should handle authentication errors', async () => {
      const mockFileInfo = {
        exists: true,
        size: 5 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);

      // Mock authentication error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: 'Invalid or expired authentication token',
          error_code: 'AUTHENTICATION_FAILED',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        30000,
        { compress: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication');
      expect(result.errorCode).toBe('AUTHENTICATION_FAILED');
    });

    it('should handle server errors with retry logic', async () => {
      const mockFileInfo = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock initiate success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'retry-session-123',
          upload_url: '/api/upload/retry-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: 2,
        }),
        headers: new Map([['X-Upload-Session-ID', 'retry-session-123']]),
      });

      // Mock server error on first chunk (should retry)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          detail: 'Internal server error',
        }),
      });

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 50,
        }),
      });

      // Mock second chunk success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/retry-video-id',
          media_id: 'retry-video-id',
        }),
      });

      const result = await uploadService.uploadVideo(
        'mock://video.mp4',
        'test-video.mp4',
        25000,
        { compress: false, maxRetries: 3 }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/retry-video-id');
    });
  });

  describe('UI Integration Tests', () => {
    it('should integrate upload progress with UI components', async () => {
      const TestUploadComponent = () => {
        const uploadManager = useUploadManager(0);
        
        return (
          <EnhancedUploadUI
            statementIndex={0}
            onUploadComplete={() => {}}
            onUploadError={() => {}}
          />
        );
      };

      const { getByTestId, queryByText } = renderWithProvider(<TestUploadComponent />);

      // Should show initial state
      expect(queryByText('Upload Video')).toBeTruthy();

      // Mock file selection and upload
      const mockFileInfo = {
        exists: true,
        size: 3 * 1024 * 1024,
        uri: 'mock://selected-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload flow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'ui-session-123',
            upload_url: '/api/upload/ui-session-123',
            chunk_size: 1024 * 1024,
            total_chunks: 3,
          }),
          headers: new Map([['X-Upload-Session-ID', 'ui-session-123']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 33,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 67,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 100,
            media_url: '/api/media/stream/ui-video-id',
            media_id: 'ui-video-id',
          }),
        });

      // Simulate file selection and upload
      act(() => {
        store.dispatch({
          type: 'challengeCreation/startUpload',
          payload: { statementIndex: 0, sessionId: 'ui-session-123' },
        });
      });

      // Should show uploading state
      await waitFor(() => {
        expect(queryByText('Uploading...')).toBeTruthy();
      });

      // Simulate progress updates
      act(() => {
        store.dispatch({
          type: 'challengeCreation/updateUploadProgress',
          payload: { statementIndex: 0, progress: 33 },
        });
      });

      act(() => {
        store.dispatch({
          type: 'challengeCreation/updateUploadProgress',
          payload: { statementIndex: 0, progress: 67 },
        });
      });

      act(() => {
        store.dispatch({
          type: 'challengeCreation/completeUpload',
          payload: { 
            statementIndex: 0, 
            mediaUrl: '/api/media/stream/ui-video-id',
            mediaId: 'ui-video-id'
          },
        });
      });

      // Should show completion state
      await waitFor(() => {
        expect(queryByText('Upload Complete')).toBeTruthy();
      });
    });

    it('should handle upload errors in UI', async () => {
      const TestErrorComponent = () => {
        const uploadManager = useUploadManager(0);
        
        return (
          <EnhancedUploadUI
            statementIndex={0}
            onUploadComplete={() => {}}
            onUploadError={() => {}}
          />
        );
      };

      const { queryByText } = renderWithProvider(<TestErrorComponent />);

      // Simulate upload error
      act(() => {
        store.dispatch({
          type: 'challengeCreation/setUploadError',
          payload: { 
            statementIndex: 0, 
            error: 'Network connection failed',
            errorCode: 'NETWORK_ERROR'
          },
        });
      });

      // Should show error state
      await waitFor(() => {
        expect(queryByText('Upload Failed')).toBeTruthy();
        expect(queryByText('Retry Upload')).toBeTruthy();
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle iOS-specific upload behavior', async () => {
      // Mock iOS platform
      jest.doMock('react-native', () => ({
        ...jest.requireActual('react-native'),
        Platform: { OS: 'ios' },
      }));

      const mockFileInfo = {
        exists: true,
        size: 4 * 1024 * 1024,
        uri: 'file:///var/mobile/Containers/Data/Application/video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'ios-session-123',
          upload_url: '/api/upload/ios-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: 4,
        }),
        headers: new Map([['X-Upload-Session-ID', 'ios-session-123']]),
      });

      // Mock chunk uploads
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 4) * 100,
          }),
        });
      }

      // Mock final completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/ios-video-id',
          media_id: 'ios-video-id',
        }),
      });

      const result = await uploadService.uploadVideo(
        mockFileInfo.uri,
        'ios-video.mp4',
        35000,
        { compress: true }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/ios-video-id');
    });

    it('should handle Android-specific upload behavior', async () => {
      // Mock Android platform
      jest.doMock('react-native', () => ({
        ...jest.requireActual('react-native'),
        Platform: { OS: 'android' },
      }));

      const mockFileInfo = {
        exists: true,
        size: 6 * 1024 * 1024,
        uri: 'content://media/external/video/media/12345',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload with Android-specific handling
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'android-session-123',
          upload_url: '/api/upload/android-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: 6,
        }),
        headers: new Map([['X-Upload-Session-ID', 'android-session-123']]),
      });

      // Mock chunk uploads
      for (let i = 0; i < 6; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / 6) * 100,
          }),
        });
      }

      // Mock final completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/android-video-id',
          media_id: 'android-video-id',
        }),
      });

      const result = await uploadService.uploadVideo(
        mockFileInfo.uri,
        'android-video.mp4',
        40000,
        { compress: true }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/android-video-id');
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should handle large file uploads without memory issues', async () => {
      const mockFileInfo = {
        exists: true,
        size: 45 * 1024 * 1024, // 45MB - near limit
        uri: 'mock://large-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload with many chunks
      const totalChunks = 45; // 1MB chunks
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          session_id: 'large-session-123',
          upload_url: '/api/upload/large-session-123',
          chunk_size: 1024 * 1024,
          total_chunks: totalChunks,
        }),
        headers: new Map([['X-Upload-Session-ID', 'large-session-123']]),
      });

      // Mock all chunk uploads
      for (let i = 0; i < totalChunks; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: ((i + 1) / totalChunks) * 100,
          }),
        });
      }

      // Mock final completion
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chunk_uploaded: true,
          progress: 100,
          media_url: '/api/media/stream/large-video-id',
          media_id: 'large-video-id',
        }),
      });

      const result = await uploadService.uploadVideo(
        mockFileInfo.uri,
        'large-video.mp4',
        300000, // 5 minutes
        { compress: false }
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('/api/media/stream/large-video-id');
      expect(mockFetch).toHaveBeenCalledTimes(totalChunks + 2); // initiate + chunks + complete
    });

    it('should clean up resources after upload completion', async () => {
      const mockFileInfo = {
        exists: true,
        size: 2 * 1024 * 1024,
        uri: 'mock://cleanup-video.mp4',
      };

      require('expo-file-system').getInfoAsync.mockResolvedValue(mockFileInfo);
      require('expo-file-system').readAsStringAsync.mockResolvedValue('mock-base64-data');

      // Mock successful upload
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            session_id: 'cleanup-session-123',
            upload_url: '/api/upload/cleanup-session-123',
            chunk_size: 1024 * 1024,
            total_chunks: 2,
          }),
          headers: new Map([['X-Upload-Session-ID', 'cleanup-session-123']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 50,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            chunk_uploaded: true,
            progress: 100,
            media_url: '/api/media/stream/cleanup-video-id',
            media_id: 'cleanup-video-id',
          }),
        });

      const result = await uploadService.uploadVideo(
        mockFileInfo.uri,
        'cleanup-video.mp4',
        25000,
        { compress: false }
      );

      expect(result.success).toBe(true);

      // Verify cleanup was called
      const stats = uploadService.getUploadStats();
      expect(stats.activeUploads).toBe(0);
    });
  });
});