/**
 * Integration Tests for Mobile Media Migration
 * Tests the complete migration workflow from discovery to completion
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import MigrationStatusIndicator from '../components/MigrationStatusIndicator';
import { useMigration, useMigrationStatus } from '../hooks/useMigration';
import { mediaMigrationService } from '../services/mediaMigrationService';
import { videoUploadService } from '../services/uploadService';
import { crossDeviceMediaService } from '../services/crossDeviceMediaService';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-file-system');
jest.mock('../services/uploadService');
jest.mock('../services/crossDeviceMediaService');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockUploadService = videoUploadService as jest.Mocked<typeof videoUploadService>;
const mockCrossDeviceService = crossDeviceMediaService as jest.Mocked<typeof crossDeviceMediaService>;

// Mock store
const mockStore = configureStore({
  reducer: {
    auth: (state = { user: { id: 'test-user' } }) => state,
  },
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={mockStore}>{children}</Provider>
);

// Test component that uses the migration hook
const TestMigrationComponent: React.FC = () => {
  const migration = useMigration();
  
  return (
    <div>
      <div testID="legacy-count">{migration.legacyItems.length}</div>
      <div testID="is-migrating">{migration.isMigrating.toString()}</div>
      <div testID="error">{migration.error || 'none'}</div>
      <button
        testID="discover-button"
        onPress={() => migration.discoverLegacyMedia()}
      >
        Discover
      </button>
      <button
        testID="migrate-button"
        onPress={() => migration.runMigration({ dryRun: false })}
      >
        Migrate
      </button>
      <button
        testID="verify-button"
        onPress={() => migration.verifyMigration()}
      >
        Verify
      </button>
    </div>
  );
};

describe('Migration Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    Object.defineProperty(mockFileSystem, 'documentDirectory', {
      value: 'file:///documents/',
      writable: true,
      configurable: true
    });
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
    mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
    mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
  });

  describe('Complete Migration Workflow', () => {
    it('should complete full migration workflow successfully', async () => {
      // Setup legacy data
      const legacyChallengeData = {
        challengeId: 'test-challenge',
        mediaData: [
          {
            type: 'video',
            url: 'file:///documents/video1.mp4',
            duration: 5000,
            fileSize: 1024000,
          },
          {
            type: 'video',
            url: 'blob:http://localhost:3000/video2',
            duration: 3000,
          },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'challenge_test') {
          return Promise.resolve(JSON.stringify(legacyChallengeData));
        }
        return Promise.resolve(null);
      });

      // Mock file exists for local file
      mockFileSystem.getInfoAsync.mockImplementation((path) => {
        if (path.includes('video1.mp4')) {
          return Promise.resolve({ exists: true } as any);
        }
        return Promise.resolve({ exists: false } as any);
      });

      // Mock successful upload
      mockUploadService.uploadVideo.mockResolvedValue({
        success: true,
        streamingUrl: 'https://server.com/api/media/stream/migrated-video1',
        mediaId: 'migrated-video1',
        fileSize: 1024000,
      });

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      // Step 1: Discover legacy media
      fireEvent.press(getByTestId('discover-button'));

      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('2');
      });

      // Step 2: Run migration
      fireEvent.press(getByTestId('migrate-button'));

      await waitFor(() => {
        expect(getByTestId('is-migrating')).toHaveTextContent('true');
      });

      await waitFor(() => {
        expect(getByTestId('is-migrating')).toHaveTextContent('false');
      }, { timeout: 5000 });

      // Verify upload was called for the local file
      expect(mockUploadService.uploadVideo).toHaveBeenCalledWith(
        'file:///documents/video1.mp4',
        expect.stringContaining('migrated_'),
        5, // duration in seconds
        expect.objectContaining({
          
          compressionQuality: 0.8,
        })
      );

      // Verify AsyncStorage was updated
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'challenge_test',
        expect.stringContaining('https://server.com/api/media/stream/migrated-video1')
      );

      // Step 3: Verify migration
      fireEvent.press(getByTestId('verify-button'));

      await waitFor(() => {
        expect(getByTestId('error')).toHaveTextContent('none');
      });
    });

    it('should handle migration errors gracefully', async () => {
      // Setup legacy data
      const legacyChallengeData = {
        mediaData: [
          {
            type: 'video',
            url: 'file:///documents/corrupted.mp4',
            duration: 5000,
          },
        ],
      };

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(legacyChallengeData));
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);

      // Mock upload failure
      mockUploadService.uploadVideo.mockResolvedValue({
        success: false,
        error: 'File corrupted',
      });

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      // Discover and migrate
      fireEvent.press(getByTestId('discover-button'));
      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('1');
      });

      fireEvent.press(getByTestId('migrate-button'));
      await waitFor(() => {
        expect(getByTestId('is-migrating')).toHaveTextContent('false');
      });

      // Should not show error in hook (errors are handled per-item)
      expect(getByTestId('error')).toHaveTextContent('none');
    });
  });

  describe('MigrationStatusIndicator Component', () => {
    it('should show migration needed status', async () => {
      // Setup legacy data
      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        mediaData: [{ type: 'video', url: 'blob:http://localhost/video' }],
      }));

      const { getByText, queryByText } = render(
        <TestWrapper>
          <MigrationStatusIndicator showDetails={true} autoHide={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText(/1 items need migration/)).toBeTruthy();
        expect(getByText(/Tap to migrate legacy media files/)).toBeTruthy();
      });
    });

    it('should hide when no migration needed and autoHide enabled', async () => {
      // No legacy data
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);

      const { queryByText } = render(
        <TestWrapper>
          <MigrationStatusIndicator autoHide={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(queryByText(/migration/)).toBeNull();
      });
    });

    it('should show migration modal when pressed', async () => {
      // Setup legacy data
      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        mediaData: [{ type: 'video', url: 'blob:http://localhost/video' }],
      }));

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <MigrationStatusIndicator showDetails={true} autoHide={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(getByText(/1 items need migration/)).toBeTruthy();
      });

      // Press the indicator to open modal
      fireEvent.press(getByText(/1 items need migration/));

      await waitFor(() => {
        expect(getByText(/Media Migration/)).toBeTruthy();
        expect(getByText(/Found 1 legacy media files/)).toBeTruthy();
      });
    });
  });

  describe('Migration Status Hook', () => {
    it('should provide correct migration status', async () => {
      let hookResult: any;

      const TestStatusComponent: React.FC = () => {
        const status = useMigrationStatus();
        hookResult = status;
        return null;
      };

      // Setup legacy data
      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'challenge_test') {
          return Promise.resolve(JSON.stringify({
            mediaData: [
              { type: 'video', url: 'blob:http://localhost/video1' },
              { type: 'video', url: 'file:///documents/video2.mp4' },
            ],
          }));
        }
        if (key === 'migration_status') {
          return Promise.resolve(JSON.stringify({
            lastMigration: '2023-01-01T00:00:00.000Z',
            totalItems: 3,
            migrated: 1,
            failed: 0,
            skipped: 2,
          }));
        }
        return Promise.resolve(null);
      });

      render(
        <TestWrapper>
          <TestStatusComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(hookResult.loading).toBe(false);
        expect(hookResult.hasLegacyItems).toBe(true);
        expect(hookResult.legacyCount).toBe(2);
        expect(hookResult.migrationNeeded).toBe(true);
        expect(hookResult.lastMigration).toBe('2023-01-01T00:00:00.000Z');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle AsyncStorage errors', async () => {
      mockAsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('discover-button'));

      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('0');
        expect(getByTestId('error')).toHaveTextContent('none');
      });
    });

    it('should handle FileSystem errors', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValue([]);
      mockFileSystem.readDirectoryAsync.mockRejectedValue(new Error('File system error'));

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('discover-button'));

      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('0');
      });
    });

    it('should handle upload service errors', async () => {
      // Setup legacy data
      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        mediaData: [{ type: 'video', url: 'file:///documents/video.mp4', duration: 5000 }],
      }));
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);

      // Mock upload service throwing error
      mockUploadService.uploadVideo.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('discover-button'));
      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('1');
      });

      fireEvent.press(getByTestId('migrate-button'));
      await waitFor(() => {
        expect(getByTestId('is-migrating')).toHaveTextContent('false');
      });

      // Migration should complete but with failures
      expect(getByTestId('error')).toHaveTextContent('none');
    });
  });

  describe('Performance and Batching', () => {
    it('should process large numbers of items in batches', async () => {
      // Create many legacy items
      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        type: 'video',
        url: `file:///documents/video${i}.mp4`,
        duration: 5000,
      }));

      mockAsyncStorage.getAllKeys.mockResolvedValue(['challenge_test']);
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
        mediaData: manyItems,
      }));
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockUploadService.uploadVideo.mockResolvedValue({
        success: true,
        streamingUrl: 'https://server.com/migrated',
        mediaId: 'migrated',
      });

      const { getByTestId } = render(
        <TestWrapper>
          <TestMigrationComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('discover-button'));
      await waitFor(() => {
        expect(getByTestId('legacy-count')).toHaveTextContent('20');
      });

      const startTime = Date.now();
      fireEvent.press(getByTestId('migrate-button'));

      await waitFor(() => {
        expect(getByTestId('is-migrating')).toHaveTextContent('false');
      }, { timeout: 10000 });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (batching should help)
      expect(duration).toBeLessThan(8000); // 8 seconds max
      expect(mockUploadService.uploadVideo).toHaveBeenCalledTimes(20);
    });
  });
});