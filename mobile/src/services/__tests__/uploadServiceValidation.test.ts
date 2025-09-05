/**
 * Tests for client-side validation in upload service
 */

import { VideoUploadService } from '../uploadService';

describe('VideoUploadService Validation', () => {
  let uploadService: VideoUploadService;

  beforeEach(() => {
    uploadService = VideoUploadService.getInstance();
  });

  describe('validateVideoFile', () => {
    it('should validate correct video files', () => {
      const result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 15);
      expect(result.valid).toBe(true);
    });

    it('should reject files with invalid extensions', () => {
      const invalidExtensions = ['.txt', '.jpg', '.pdf', '.doc'];
      const dangerousExtensions = ['.exe'];
      
      invalidExtensions.forEach(ext => {
        const result = uploadService.validateVideoFile(`test${ext}`, 5 * 1024 * 1024, 15);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_EXTENSION');
        expect(result.error).toContain('Invalid file extension');
      });

      dangerousExtensions.forEach(ext => {
        const result = uploadService.validateVideoFile(`test${ext}`, 5 * 1024 * 1024, 15);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_EXTENSION');
        expect(result.error).toContain('Dangerous file extension');
      });
    });

    it('should reject files that are too large', () => {
      const result = uploadService.validateVideoFile('test.mp4', 100 * 1024 * 1024, 15); // 100MB
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_LARGE');
      expect(result.error).toContain('File too large');
    });

    it('should reject files that are too small', () => {
      const result = uploadService.validateVideoFile('test.mp4', 50 * 1024, 15); // 50KB
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FILE_TOO_SMALL');
      expect(result.error).toContain('File too small');
    });

    it('should reject videos that are too short', () => {
      const result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 1); // 1 second
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('DURATION_TOO_SHORT');
      expect(result.error).toContain('Video too short');
    });

    it('should reject videos that are too long', () => {
      const result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 120); // 2 minutes
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('DURATION_TOO_LONG');
      expect(result.error).toContain('Video too long');
    });

    it('should reject empty or missing filenames', () => {
      let result = uploadService.validateVideoFile('', 5 * 1024 * 1024, 15);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_FILENAME');

      result = uploadService.validateVideoFile('   ', 5 * 1024 * 1024, 15);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_FILENAME');
    });

    it('should reject filenames that are too long', () => {
      const longFilename = 'a'.repeat(300) + '.mp4';
      const result = uploadService.validateVideoFile(longFilename, 5 * 1024 * 1024, 15);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('FILENAME_TOO_LONG');
    });

    it('should reject filenames with dangerous characters', () => {
      const dangerousFilenames = [
        'test<script>.mp4',
        'test>redirect.mp4',
        'test:colon.mp4',
        'test"quote.mp4',
        'test|pipe.mp4',
        'test?question.mp4',
        'test*asterisk.mp4'
      ];

      dangerousFilenames.forEach(filename => {
        const result = uploadService.validateVideoFile(filename, 5 * 1024 * 1024, 15);
        expect(result.valid).toBe(false);
        expect(result.errorCode).toBe('INVALID_FILENAME_CHARS');
        expect(result.error).toContain('invalid characters');
      });
    });

    it('should accept valid video extensions', () => {
      const validExtensions = ['.mp4', '.mov', '.webm'];
      
      validExtensions.forEach(ext => {
        const result = uploadService.validateVideoFile(`test${ext}`, 5 * 1024 * 1024, 15);
        expect(result.valid).toBe(true);
      });
    });

    it('should handle edge cases for file sizes', () => {
      // Test minimum valid size (100KB + 1 byte)
      let result = uploadService.validateVideoFile('test.mp4', 100 * 1024 + 1, 15);
      expect(result.valid).toBe(true);

      // Test maximum valid size (50MB - 1 byte)
      result = uploadService.validateVideoFile('test.mp4', 50 * 1024 * 1024 - 1, 15);
      expect(result.valid).toBe(true);
    });

    it('should handle edge cases for duration', () => {
      // Test minimum valid duration (3 seconds)
      let result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 3);
      expect(result.valid).toBe(true);

      // Test maximum valid duration (60 seconds)
      result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 60);
      expect(result.valid).toBe(true);

      // Test just below minimum (2.9 seconds)
      result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 2.9);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('DURATION_TOO_SHORT');

      // Test just above maximum (60.1 seconds)
      result = uploadService.validateVideoFile('test.mp4', 5 * 1024 * 1024, 60.1);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('DURATION_TOO_LONG');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types for video files', () => {
      // Access private method for testing
      const getMimeType = (uploadService as any).getMimeType.bind(uploadService);
      
      expect(getMimeType('test.mp4')).toBe('video/mp4');
      expect(getMimeType('test.mov')).toBe('video/quicktime');
      expect(getMimeType('test.webm')).toBe('video/webm');
      expect(getMimeType('test.avi')).toBe('video/x-msvideo');
    });

    it('should handle case insensitive extensions', () => {
      const getMimeType = (uploadService as any).getMimeType.bind(uploadService);
      
      expect(getMimeType('test.MP4')).toBe('video/mp4');
      expect(getMimeType('test.MOV')).toBe('video/quicktime');
      expect(getMimeType('test.WEBM')).toBe('video/webm');
    });

    it('should return platform-specific defaults for unknown extensions', () => {
      const getMimeType = (uploadService as any).getMimeType.bind(uploadService);
      
      const result = getMimeType('test.unknown');
      expect(['video/mp4', 'video/quicktime']).toContain(result);
    });
  });

  describe('Integration validation scenarios', () => {
    it('should validate a typical mobile video recording', () => {
      // Typical mobile video: 720p, 30fps, ~10MB for 30 seconds
      const result = uploadService.validateVideoFile('recording_20240101_120000.mp4', 10 * 1024 * 1024, 30);
      expect(result.valid).toBe(true);
    });

    it('should reject common attack vectors', () => {
      const attackVectors = [
        { filename: '../../../etc/passwd.mp4', size: 5 * 1024 * 1024, duration: 15 },
        { filename: 'script.exe', size: 5 * 1024 * 1024, duration: 15 },
        { filename: 'malware.bat', size: 5 * 1024 * 1024, duration: 15 },
        { filename: 'virus<script>alert(1)</script>.mp4', size: 5 * 1024 * 1024, duration: 15 }
      ];

      attackVectors.forEach(vector => {
        const result = uploadService.validateVideoFile(vector.filename, vector.size, vector.duration);
        expect(result.valid).toBe(false);
      });
    });

    it('should handle boundary conditions correctly', () => {
      // Test exact boundary values
      const boundaryTests = [
        { filename: 'test.mp4', size: 100 * 1024, duration: 3, shouldPass: true }, // Minimum valid
        { filename: 'test.mp4', size: 50 * 1024 * 1024, duration: 60, shouldPass: true }, // Maximum valid
        { filename: 'test.mp4', size: 100 * 1024 - 1, duration: 3, shouldPass: false }, // Just below minimum
        { filename: 'test.mp4', size: 50 * 1024 * 1024 + 1, duration: 60, shouldPass: false }, // Just above maximum
      ];

      boundaryTests.forEach((test, index) => {
        const result = uploadService.validateVideoFile(test.filename, test.size, test.duration);
        expect(result.valid).toBe(test.shouldPass);
      });
    });
  });
});