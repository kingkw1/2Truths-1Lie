/**
 * Cross-Device Media Accessibility Tests
 * Tests for ensuring uploaded videos work across iOS/Android and multi-login scenarios
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CrossDeviceMediaService } from '../services/crossDeviceMediaService';
import { VideoUploadService } from '../services/uploadService';
import { AuthService } from '../services/authService';
import CrossDeviceMediaViewer from '../components/CrossDeviceMediaViewer';
import useCrossDeviceMedia from '../hooks/useCrossDeviceMedia';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../services/uploadService');
jest.mock('../services/authService');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
// Mock the services by mocking their instances
const mockVideoUploadService = {
  verifyMediaAccess: jest.fn(),
  getStreamingUrl: jest.fn(),
} as any;
const mockAuthService = {
  getCurrentUser: jest.fn(),
} as any;

describe('Cross-Device Media Accessibility', () => {
  let crossDeviceService: CrossDeviceMediaService;
  let mockUploadService: jest.Mocked<VideoUploadService>;
  let mockAuth: jest.Mocked<AuthService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset AsyncStorage
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockAsyncStorage.removeItem.mockResolvedValue();

    // Setup mock services
    mockUploadService = {
      getUserMediaLibrary: jest.fn(),
      verifyMediaAccess: jest.fn(),
      syncMediaState: jest.fn(),
      setAuthToken: jest.fn(),
    } as any;

    mockAuth = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getCurrentUser: jest.fn().mockReturnValue({ id: 'test-user', name: 'Test User' }),
      getAuthToken: jest.fn().mockReturnValue('test-token'),
    } as any;

    // Get fresh instance
    crossDeviceService = CrossDeviceMediaService.getInstance();
  });

  describe('CrossDeviceMediaService', () => {
    it('should initialize and load cached media', async () => {
      const cachedMedia = [
        {
          mediaId: 'media-1',
          filename: 'test-video.mp4',
          streamingUrl: 'https://example.com/video1.mp4',
          fileSize: 1024000,
          duration: 30000,
          uploadedAt: '2024-01-01T00:00:00Z',
          storageType: 'cloud',
        },
      ];

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mediaLibraryCache') {
          return Promise.resolve(JSON.stringify(cachedMedia));
        }
        if (key === 'lastMediaSync') {
          return Promise.resolve('2024-01-01T00:00:00Z');
        }
        return Promise.resolve(null);
      });

      await crossDeviceService.initialize();

      const library = await crossDeviceService.getMediaLibrary();
      expect(library.media).toHaveLength(1);
      expect(library.media[0].mediaId).toBe('media-1');
    });

    it('should sync media across devices', async () => {
      const localMediaIds = ['media-1', 'media-2'];
      const syncResult = {
        syncedMedia: [
          {
            mediaId: 'media-1',
            streamingUrl: 'https://example.com/video1.mp4',
            lastModified: '2024-01-01T00:00:00Z',
            needsUpdate: false,
          },
        ],
        deletedMedia: ['media-3'],
        newMedia: [
          {
            mediaId: 'media-4',
            streamingUrl: 'https://example.com/video4.mp4',
            uploadedAt: '2024-01-02T00:00:00Z',
          },
        ],
      };

      mockUploadService.syncMediaState.mockResolvedValue(syncResult);

      // Mock local media IDs
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mediaLibraryCache') {
          return Promise.resolve(JSON.stringify([
            { mediaId: 'media-1' },
            { mediaId: 'media-2' },
            { mediaId: 'media-3' },
          ]));
        }
        return Promise.resolve(null);
      });

      const result = await crossDeviceService.syncMediaLibrary();

      expect(result.syncedCount).toBe(1);
      expect(result.newMediaCount).toBe(1);
      expect(result.deletedCount).toBe(1);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'lastMediaSync',
        expect.any(String)
      );
    });

    it('should verify media accessibility for different platforms', async () => {
      const mediaId = 'test-media';
      const verificationResult = {
        accessible: true,
        streamingUrl: 'https://example.com/video.mp4',
        deviceCompatible: true,
        requiresAuth: true,
        mimeType: 'video/mp4',
      };

      mockUploadService.verifyMediaAccess.mockResolvedValue(verificationResult);

      const result = await crossDeviceService.verifyMediaAccessibility(mediaId);

      expect(result.accessible).toBe(true);
      expect(result.deviceCompatible).toBe(true);
      expect(mockUploadService.verifyMediaAccess).toHaveBeenCalledWith(mediaId);
    });

    it('should check format compatibility for iOS', async () => {
      // Mock Platform.OS to be iOS
      Object.defineProperty(Platform, 'OS', {
        get: () => 'ios',
      });

      expect(crossDeviceService.isFormatSupported('video/mp4')).toBe(true);
      expect(crossDeviceService.isFormatSupported('video/quicktime')).toBe(true);
      expect(crossDeviceService.isFormatSupported('video/webm')).toBe(false);
    });

    it('should check format compatibility for Android', async () => {
      // Mock Platform.OS to be Android
      Object.defineProperty(Platform, 'OS', {
        get: () => 'android',
      });

      expect(crossDeviceService.isFormatSupported('video/mp4')).toBe(true);
      expect(crossDeviceService.isFormatSupported('video/webm')).toBe(true);
      expect(crossDeviceService.isFormatSupported('video/quicktime')).toBe(false);
    });

    it('should handle user login and logout', async () => {
      mockUploadService.syncMediaState.mockResolvedValue({
        syncedMedia: [],
        deletedMedia: [],
        newMedia: [],
      });

      await crossDeviceService.onUserLogin();
      expect(mockUploadService.syncMediaState).toHaveBeenCalled();

      await crossDeviceService.onUserLogout();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('mediaLibraryCache');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('lastMediaSync');
    });
  });

  describe('useCrossDeviceMedia Hook', () => {
    const TestComponent = () => {
      const {
        mediaLibrary,
        isLoading,
        error,
        syncMediaLibrary,
        verifyMediaAccess,
        isFormatSupported,
        devicePreferences,
      } = useCrossDeviceMedia();

      return (
        <>
          <div testID="media-count">{mediaLibrary.length}</div>
          <div testID="loading">{isLoading ? 'loading' : 'idle'}</div>
          <div testID="error">{error || 'no-error'}</div>
          <div testID="device-format">{devicePreferences.preferredFormat}</div>
          <button testID="sync-button" onPress={syncMediaLibrary}>
            Sync
          </button>
        </>
      );
    };

    it('should load media library on mount', async () => {
      mockUploadService.getUserMediaLibrary.mockResolvedValue({
        media: [
          {
            mediaId: 'media-1',
            filename: 'test.mp4',
            streamingUrl: 'https://example.com/test.mp4',
            fileSize: 1024,
            duration: 30,
            uploadedAt: '2024-01-01T00:00:00Z',
            storageType: 'cloud',
          },
        ],
        totalCount: 1,
        hasMore: false,
      });

      const { getByTestId } = render(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId('media-count')).toHaveTextContent('1');
        expect(getByTestId('loading')).toHaveTextContent('idle');
        expect(getByTestId('error')).toHaveTextContent('no-error');
      });
    });

    it('should handle sync operation', async () => {
      mockUploadService.syncMediaState.mockResolvedValue({
        syncedMedia: [],
        deletedMedia: [],
        newMedia: [],
      });

      const { getByTestId } = render(<TestComponent />);

      await act(async () => {
        fireEvent.press(getByTestId('sync-button'));
      });

      expect(mockUploadService.syncMediaState).toHaveBeenCalled();
    });

    it('should show device preferences', () => {
      const { getByTestId } = render(<TestComponent />);
      
      expect(getByTestId('device-format')).toHaveTextContent('video/mp4');
    });
  });

  describe('CrossDeviceMediaViewer Component', () => {
    const mockMediaLibrary = [
      {
        mediaId: 'media-1',
        filename: 'test-video.mp4',
        streamingUrl: 'https://example.com/video1.mp4',
        fileSize: 1024000,
        duration: 30000,
        uploadedAt: '2024-01-01T00:00:00Z',
        deviceInfo: 'iOS 17.0',
        storageType: 'cloud' as const,
        mimeType: 'video/mp4',
        isAccessible: true,
      },
      {
        mediaId: 'media-2',
        filename: 'incompatible-video.webm',
        streamingUrl: 'https://example.com/video2.webm',
        fileSize: 2048000,
        duration: 45000,
        uploadedAt: '2024-01-02T00:00:00Z',
        deviceInfo: 'Android 14',
        storageType: 'cloud' as const,
        mimeType: 'video/webm',
        isAccessible: true,
      },
    ];

    beforeEach(() => {
      // Mock the hook
      jest.doMock('../hooks/useCrossDeviceMedia', () => ({
        __esModule: true,
        default: () => ({
          mediaLibrary: mockMediaLibrary,
          isLoading: false,
          error: null,
          hasMore: false,
          totalCount: 2,
          syncStatus: { lastSyncTime: null, syncInProgress: false },
          lastSyncResult: null,
          loadMediaLibrary: jest.fn(),
          syncMediaLibrary: jest.fn(),
          verifyMediaAccess: jest.fn().mockResolvedValue({
            accessible: true,
            deviceCompatible: true,
          }),
          getOptimizedStreamingUrl: jest.fn().mockResolvedValue('https://example.com/optimized.mp4'),
          refreshLibrary: jest.fn(),
          isFormatSupported: jest.fn((mimeType) => mimeType === 'video/mp4'),
          devicePreferences: {
            preferredFormat: 'video/mp4',
            maxResolution: '1920x1080',
            supportsHardwareDecoding: true,
          },
        }),
      }));
    });

    it('should render media library with accessibility indicators', () => {
      const { getByText, getAllByText } = render(<CrossDeviceMediaViewer />);

      expect(getByText('Cross-Device Media Library')).toBeTruthy();
      expect(getByText('test-video.mp4')).toBeTruthy();
      expect(getByText('incompatible-video.webm')).toBeTruthy();
      
      // Check accessibility indicators
      expect(getAllByText(/✓ Accessible/)).toHaveLength(2);
    });

    it('should show device compatibility status', () => {
      const { getAllByText } = render(<CrossDeviceMediaViewer />);

      // Should show platform compatibility
      expect(getAllByText(new RegExp(`✓ ${Platform.OS}`))).toBeTruthy();
    });

    it('should display device preferences', () => {
      const { getByText } = render(<CrossDeviceMediaViewer />);

      expect(getByText('Format: video/mp4')).toBeTruthy();
      expect(getByText('Max Resolution: 1920x1080')).toBeTruthy();
      expect(getByText('Hardware Decoding: Yes')).toBeTruthy();
    });
  });

  describe('Multi-Login Scenarios', () => {
    it('should handle multiple user sessions', async () => {
      const user1MediaIds = ['media-1', 'media-2'];
      const user2MediaIds = ['media-3', 'media-4'];

      // Simulate user 1 login
      mockAuth.getCurrentUser.mockReturnValue({ id: 'user-1', name: 'User 1', createdAt: new Date().toISOString() });
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mediaLibraryCache') {
          return Promise.resolve(JSON.stringify(user1MediaIds.map(id => ({ mediaId: id }))));
        }
        return Promise.resolve(null);
      });

      await crossDeviceService.onUserLogin();
      let library = await crossDeviceService.getMediaLibrary();
      expect(library.media).toHaveLength(2);

      // Simulate user logout and user 2 login
      await crossDeviceService.onUserLogout();
      
      mockAuth.getCurrentUser.mockReturnValue({ id: 'user-2', name: 'User 2', createdAt: new Date().toISOString() });
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'mediaLibraryCache') {
          return Promise.resolve(JSON.stringify(user2MediaIds.map(id => ({ mediaId: id }))));
        }
        return Promise.resolve(null);
      });

      await crossDeviceService.onUserLogin();
      library = await crossDeviceService.getMediaLibrary();
      expect(library.media).toHaveLength(2);
      
      // Verify different media IDs
      expect(library.media.map(m => m.mediaId)).toEqual(user2MediaIds);
    });

    it('should maintain user-specific media isolation', async () => {
      const mediaId = 'user-specific-media';
      
      // User 1 should have access
      mockAuth.getCurrentUser.mockReturnValue({ id: 'user-1', name: 'User 1', createdAt: new Date().toISOString() });
      mockUploadService.verifyMediaAccess.mockResolvedValue({
        accessible: true,
        deviceCompatible: true,
        requiresAuth: true,
      });

      let result = await crossDeviceService.verifyMediaAccessibility(mediaId);
      expect(result.accessible).toBe(true);

      // User 2 should not have access to user 1's media
      mockAuth.getCurrentUser.mockReturnValue({ id: 'user-2', name: 'User 2', createdAt: new Date().toISOString() });
      mockUploadService.verifyMediaAccess.mockResolvedValue({
        accessible: false,
        deviceCompatible: true,
        requiresAuth: true,
      });

      result = await crossDeviceService.verifyMediaAccessibility(mediaId);
      expect(result.accessible).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockUploadService.getUserMediaLibrary.mockRejectedValue(new Error('Network error'));

      // Should fallback to local cache
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify([
        { mediaId: 'cached-media', filename: 'cached.mp4' },
      ]));

      const library = await crossDeviceService.getMediaLibrary();
      expect(library.media).toHaveLength(1);
      expect(library.media[0].mediaId).toBe('cached-media');
    });

    it('should handle authentication errors', async () => {
      mockAuth.isAuthenticated.mockReturnValue(false);

      await expect(crossDeviceService.syncMediaLibrary()).rejects.toThrow('User not authenticated');
    });

    it('should handle incompatible media formats', async () => {
      const mediaId = 'incompatible-media';
      mockUploadService.verifyMediaAccess.mockResolvedValue({
        accessible: true,
        deviceCompatible: false,
        requiresAuth: true,
      });

      const result = await crossDeviceService.verifyMediaAccessibility(mediaId);
      expect(result.accessible).toBe(true);
      expect(result.deviceCompatible).toBe(false);
    });
  });
});