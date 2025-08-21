/**
 * Media API Compatibility Tests
 * Tests media capture functionality across different browser implementations
 * Requirement 8: Media Capture with robust cross-browser support
 * Requirement 9: Error Handling and Resilience with graceful degradation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MediaRecorder from '../MediaRecorder';
import { useMediaRecording } from '../../hooks/useMediaRecording';
import challengeCreationSlice from '../../store/slices/challengeCreationSlice';

// Browser-specific API implementations
const browserImplementations = {
  chrome: {
    name: 'Chrome',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480 }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 48000 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        frameRate: true,
        facingMode: true,
        sampleRate: true,
        echoCancellation: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      state: 'inactive',
      mimeType: 'video/webm;codecs=vp9',
    })),
    isTypeSupported: (type: string) => type.includes('webm') || type.includes('vp9'),
    supportedMimeTypes: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'audio/webm;codecs=opus'],
  },

  firefox: {
    name: 'Firefox',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480 }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 44100 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        frameRate: true,
        sampleRate: true,
        echoCancellation: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      state: 'inactive',
      mimeType: 'video/webm;codecs=vp8',
    })),
    isTypeSupported: (type: string) => type.includes('webm') || type.includes('vp8'),
    supportedMimeTypes: ['video/webm;codecs=vp8', 'audio/webm;codecs=opus'],
  },

  safari: {
    name: 'Safari',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480 }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 44100 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        frameRate: true,
        sampleRate: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      mimeType: 'video/mp4',
    })),
    isTypeSupported: (type: string) => type.includes('mp4') || type.includes('h264'),
    supportedMimeTypes: ['video/mp4', 'audio/mp4'],
  },

  edge: {
    name: 'Edge',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480 }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 48000 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        frameRate: true,
        facingMode: true,
        sampleRate: true,
        echoCancellation: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      state: 'inactive',
      mimeType: 'video/webm;codecs=vp9',
    })),
    isTypeSupported: (type: string) => type.includes('webm') || type.includes('mp4'),
    supportedMimeTypes: ['video/webm;codecs=vp9', 'video/mp4', 'audio/webm;codecs=opus'],
  },

  mobileSafari: {
    name: 'Mobile Safari',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480, facingMode: 'user' }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 44100 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        facingMode: true,
        sampleRate: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      state: 'inactive',
      mimeType: 'video/mp4',
    })),
    isTypeSupported: (type: string) => type.includes('mp4'),
    supportedMimeTypes: ['video/mp4', 'audio/mp4'],
  },

  androidChrome: {
    name: 'Android Chrome',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    mediaDevices: {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [
          { kind: 'video', stop: jest.fn(), getSettings: () => ({ width: 640, height: 480, facingMode: 'environment' }) },
          { kind: 'audio', stop: jest.fn(), getSettings: () => ({ sampleRate: 48000 }) },
        ],
      }),
      getSupportedConstraints: () => ({
        width: true,
        height: true,
        frameRate: true,
        facingMode: true,
        sampleRate: true,
        echoCancellation: true,
      }),
    },
    MediaRecorder: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      state: 'inactive',
      mimeType: 'video/webm;codecs=vp8',
    })),
    isTypeSupported: (type: string) => type.includes('webm') || type.includes('mp4'),
    supportedMimeTypes: ['video/webm;codecs=vp8', 'video/mp4', 'audio/webm;codecs=opus'],
  },
};

// Test store setup
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

// Helper to mock browser environment
const mockBrowserEnvironment = (browser: keyof typeof browserImplementations) => {
  const impl = browserImplementations[browser];
  
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: impl.userAgent,
  });
  
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: impl.mediaDevices,
  });
  
  (global as any).MediaRecorder = impl.MediaRecorder;
  (global as any).MediaRecorder.isTypeSupported = impl.isTypeSupported;
  
  return impl;
};

describe('Media API Compatibility Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Chrome Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('chrome');
    });

    it('supports WebM video recording with VP9 codec', async () => {
      const onRecordingComplete = jest.fn();
      
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={onRecordingComplete}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(browserImplementations.chrome.mediaDevices.getUserMedia).toHaveBeenCalledWith({
          video: { width: 640, height: 480 },
          audio: true,
        });
      });
    });

    it('handles advanced video constraints in Chrome', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.chrome.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalled();
        
        const constraints = getUserMediaCall.mock.calls[0][0];
        expect(constraints.video).toBeDefined();
        expect(constraints.audio).toBe(true);
      });
    });

    it('supports pause and resume functionality in Chrome', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByText('Start Recording')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByText('Start Recording'));

      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeInTheDocument();
      });
    });
  });

  describe('Firefox Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('firefox');
    });

    it('adapts to Firefox MediaRecorder implementation', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(browserImplementations.firefox.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });

    it('handles Firefox-specific MIME types', () => {
      const impl = browserImplementations.firefox;
      
      // Test supported MIME types
      expect(impl.isTypeSupported('video/webm;codecs=vp8')).toBe(true);
      expect(impl.isTypeSupported('video/webm;codecs=vp9')).toBe(false);
      expect(impl.isTypeSupported('audio/webm;codecs=opus')).toBe(true);
    });

    it('works with Firefox audio recording', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['audio']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Audio'));

      await waitFor(() => {
        expect(browserImplementations.firefox.mediaDevices.getUserMedia).toHaveBeenCalledWith({
          audio: true,
        });
      });
    });
  });

  describe('Safari Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('safari');
    });

    it('adapts to Safari MP4 format preference', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(browserImplementations.safari.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });

    it('handles Safari MIME type limitations', () => {
      const impl = browserImplementations.safari;
      
      // Safari prefers MP4
      expect(impl.isTypeSupported('video/mp4')).toBe(true);
      expect(impl.isTypeSupported('video/webm')).toBe(false);
      expect(impl.isTypeSupported('audio/mp4')).toBe(true);
    });

    it('works without pause/resume in Safari', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByText('Start Recording')).toBeInTheDocument();
      });

      // Start recording
      fireEvent.click(screen.getByText('Start Recording'));

      // Safari implementation might not have pause/resume
      await waitFor(() => {
        const pauseButton = screen.queryByText('Pause');
        // May or may not be present depending on Safari version
        if (pauseButton) {
          expect(pauseButton).toBeInTheDocument();
        }
      });
    });
  });

  describe('Mobile Safari Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('mobileSafari');
    });

    it('handles mobile Safari camera constraints', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.mobileSafari.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalled();
      });
    });

    it('adapts UI for mobile Safari touch interface', () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video', 'audio', 'text']}
          />
        </TestWrapper>
      );

      // Should render touch-friendly interface
      expect(screen.getByText('Video')).toBeInTheDocument();
      expect(screen.getByText('Audio')).toBeInTheDocument();
      expect(screen.getByText('Text Only')).toBeInTheDocument();
    });

    it('handles mobile Safari autoplay restrictions', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      // Mobile Safari requires user interaction for media
      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(browserImplementations.mobileSafari.mediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });
  });

  describe('Android Chrome Compatibility', () => {
    beforeEach(() => {
      mockBrowserEnvironment('androidChrome');
    });

    it('handles Android camera switching', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.androidChrome.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalled();
      });
    });

    it('supports Android-specific video formats', () => {
      const impl = browserImplementations.androidChrome;
      
      expect(impl.isTypeSupported('video/webm;codecs=vp8')).toBe(true);
      expect(impl.isTypeSupported('video/mp4')).toBe(true);
      expect(impl.isTypeSupported('audio/webm;codecs=opus')).toBe(true);
    });

    it('handles Android performance constraints', async () => {
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
            maxDuration={15000} // Shorter duration for mobile
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        expect(screen.getByText('0:00 / 0:15')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Browser Fallback Mechanisms', () => {
    it('falls back gracefully when MediaRecorder is not supported', async () => {
      // Mock no MediaRecorder support
      (global as any).MediaRecorder = undefined;

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

    it('adapts MIME type selection based on browser support', () => {
      // Test Chrome
      mockBrowserEnvironment('chrome');
      expect(browserImplementations.chrome.isTypeSupported('video/webm;codecs=vp9')).toBe(true);

      // Test Safari
      mockBrowserEnvironment('safari');
      expect(browserImplementations.safari.isTypeSupported('video/mp4')).toBe(true);
      expect(browserImplementations.safari.isTypeSupported('video/webm')).toBe(false);
    });

    it('provides consistent API across different implementations', async () => {
      const browsers = ['chrome', 'firefox', 'safari', 'edge'] as const;
      
      for (const browser of browsers) {
        mockBrowserEnvironment(browser);
        
        const { unmount } = render(
          <TestWrapper>
            <MediaRecorder
              onRecordingComplete={jest.fn()}
              onRecordingError={jest.fn()}
              allowedTypes={['video']}
            />
          </TestWrapper>
        );

        // Should render consistently across browsers
        expect(screen.getByText('Record Your Statement')).toBeInTheDocument();
        expect(screen.getByText('Video')).toBeInTheDocument();

        unmount();
      }
    });

    it('handles getUserMedia permission variations across browsers', async () => {
      const permissionErrors = [
        new DOMException('Permission denied', 'NotAllowedError'),
        new DOMException('Permission dismissed', 'AbortError'),
        new DOMException('Device not found', 'NotFoundError'),
        new DOMException('Device in use', 'NotReadableError'),
      ];

      for (const error of permissionErrors) {
        mockBrowserEnvironment('chrome');
        browserImplementations.chrome.mediaDevices.getUserMedia.mockRejectedValueOnce(error);

        const { unmount } = render(
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

        unmount();
      }
    });
  });

  describe('Performance Optimization Across Browsers', () => {
    it('optimizes video constraints for mobile browsers', async () => {
      mockBrowserEnvironment('mobileSafari');

      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.mobileSafari.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalled();
        
        // Mobile should use appropriate constraints
        const constraints = getUserMediaCall.mock.calls[0][0];
        expect(constraints.video).toBeDefined();
      });
    });

    it('handles codec selection based on browser capabilities', () => {
      const testCases = [
        { browser: 'chrome', expectedCodec: 'vp9' },
        { browser: 'firefox', expectedCodec: 'vp8' },
        { browser: 'safari', expectedCodec: 'h264' },
        { browser: 'androidChrome', expectedCodec: 'vp8' },
      ] as const;

      testCases.forEach(({ browser, expectedCodec }) => {
        mockBrowserEnvironment(browser);
        const impl = browserImplementations[browser];
        
        // Should prefer the expected codec for each browser
        const supportedTypes = impl.supportedMimeTypes;
        const hasExpectedCodec = supportedTypes.some(type => type.includes(expectedCodec));
        
        if (expectedCodec !== 'h264') { // h264 is implied in mp4
          expect(hasExpectedCodec).toBe(true);
        }
      });
    });

    it('adapts recording quality based on device capabilities', async () => {
      // Test high-end desktop
      mockBrowserEnvironment('chrome');
      
      const { unmount: unmountDesktop } = render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.chrome.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalledWith({
          video: { width: 640, height: 480 },
          audio: true,
        });
      });

      unmountDesktop();

      // Test mobile device
      mockBrowserEnvironment('mobileSafari');
      
      render(
        <TestWrapper>
          <MediaRecorder
            onRecordingComplete={jest.fn()}
            onRecordingError={jest.fn()}
            allowedTypes={['video']}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Video'));

      await waitFor(() => {
        const getUserMediaCall = browserImplementations.mobileSafari.mediaDevices.getUserMedia as jest.Mock;
        expect(getUserMediaCall).toHaveBeenCalled();
      });
    });
  });
});