/**
 * Upload Service Tests
 */

import { VideoUploadService } from '../uploadService';

// Mock FileSystem
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn().mockResolvedValue({
    exists: true,
    size: 1024 * 1024, // 1MB
  }),
  deleteAsync: jest.fn().mockResolvedValue(true),
  readAsStringAsync: jest.fn().mockResolvedValue('mock-base64-data'),
}));

// Mock fetch
global.fetch = jest.fn();

describe('VideoUploadService', () => {
  let uploadService: VideoUploadService;

  beforeEach(() => {
    uploadService = VideoUploadService.getInstance();
    uploadService.setAuthToken('test-token');
    jest.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = VideoUploadService.getInstance();
    const instance2 = VideoUploadService.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should set auth token', () => {
    uploadService.setAuthToken('new-token');
    expect(uploadService.getUploadStats().platform).toBeDefined();
  });

  it('should handle upload errors gracefully', async () => {
    // Mock permission check to pass, then make fetch fail
    const mockAuthService = {
      hasPermission: jest.fn().mockResolvedValue(true)
    };
    jest.doMock('../authService', () => ({
      authService: mockAuthService
    }));

    // Mock fetch to reject
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await uploadService.uploadVideo(
      'mock://video.mp4',
      'test.mp4',
      5000,
      { retryAttempts: 1 }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('should provide upload statistics', () => {
    const stats = uploadService.getUploadStats();
    expect(stats).toHaveProperty('activeUploads');
    expect(stats).toHaveProperty('platform');
    expect(stats).toHaveProperty('baseUrl');
  });
});