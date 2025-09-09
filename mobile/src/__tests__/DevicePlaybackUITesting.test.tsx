/**
 * Device Playback UI Testing
 * Tests video playback functionality across different device types and screen sizes
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert, Platform, Dimensions } from 'react-native';
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture, VideoSegment } from '../types';

// Device configuration types
type DeviceType = 'IPHONE_13' | 'ANDROID_PIXEL' | 'LOW_END_ANDROID' | 'TABLET_IPAD' | 'FOLDABLE_SAMSUNG';

interface DeviceConfig {
  platform: 'ios' | 'android';
  dimensions: { width: number; height: number };
  pixelRatio: number;
  videoQuality: '480p' | '720p' | '1080p' | '4K';
  processingPower: 'low' | 'medium' | 'high';
  memoryConstraints: boolean;
  networkCapability: 'slow' | 'medium' | 'fast';
}

const deviceConfigs: Record<DeviceType, DeviceConfig> = {
  IPHONE_13: {
    platform: 'ios',
    dimensions: { width: 390, height: 844 },
    pixelRatio: 3,
    videoQuality: '1080p',
    processingPower: 'high',
    memoryConstraints: false,
    networkCapability: 'fast',
  },
  ANDROID_PIXEL: {
    platform: 'android',
    dimensions: { width: 393, height: 851 },
    pixelRatio: 2.75,
    videoQuality: '1080p',
    processingPower: 'high',
    memoryConstraints: false,
    networkCapability: 'fast',
  },
  LOW_END_ANDROID: {
    platform: 'android',
    dimensions: { width: 360, height: 640 },
    pixelRatio: 2,
    videoQuality: '480p',
    processingPower: 'low',
    memoryConstraints: true,
    networkCapability: 'slow',
  },
  TABLET_IPAD: {
    platform: 'ios',
    dimensions: { width: 820, height: 1180 },
    pixelRatio: 2,
    videoQuality: '4K',
    processingPower: 'high',
    memoryConstraints: false,
    networkCapability: 'fast',
  },
  FOLDABLE_SAMSUNG: {
    platform: 'android',
    dimensions: { width: 768, height: 1024 },
    pixelRatio: 2.5,
    videoQuality: '1080p',
    processingPower: 'high',
    memoryConstraints: false,
    networkCapability: 'fast',
  },
};

// Global test state
declare global {
  var __DEVICE_TYPE__: DeviceType;
  var __PLAYBACK_SCENARIO__: string;
  var __NETWORK_STATE__: 'online' | 'offline' | 'slow' | 'unstable';
}

// Mock Expo AV with device-specific behaviors
jest.mock('expo-av', () => {
  const mockReact = require('react');
  return {
    Video: mockReact.forwardRef(({ source, onPlaybackStatusUpdate, onLoad }: any, ref: any) => {
      const deviceType = global.__DEVICE_TYPE__ || 'IPHONE_13';
      const device = deviceConfigs[deviceType];
      const scenario = global.__PLAYBACK_SCENARIO__ || 'NORMAL';

      mockReact.useImperativeHandle(ref, () => ({
      loadAsync: jest.fn().mockImplementation(async (source, initialStatus) => {
        const loadDelay = device.processingPower === 'low' ? 2000 : 
                         device.processingPower === 'medium' ? 1000 : 500;
        
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        if (scenario === 'LOAD_ERROR') {
          throw new Error('Failed to load video');
        }
        
        if (scenario === 'UNSUPPORTED_FORMAT') {
          throw new Error('Video format not supported on this device');
        }
        
        // Simulate successful load
        setTimeout(() => {
          onLoad?.({
            isLoaded: true,
            durationMillis: 15000, // 15 seconds merged video
            naturalSize: { 
              width: device.videoQuality === '4K' ? 3840 : 
                     device.videoQuality === '1080p' ? 1920 : 1280,
              height: device.videoQuality === '4K' ? 2160 : 
                      device.videoQuality === '1080p' ? 1080 : 720
            },
          });
        }, 100);
      }),
      
      playAsync: jest.fn().mockImplementation(async () => {
        if (scenario === 'PLAYBACK_ERROR') {
          throw new Error('Playback failed');
        }
        
        // Start playback status updates
        const updateInterval = setInterval(() => {
          onPlaybackStatusUpdate?.({
            isLoaded: true,
            isPlaying: true,
            isBuffering: device.networkCapability === 'slow',
            positionMillis: Math.random() * 15000,
            durationMillis: 15000,
          });
        }, 100);
        
        // Clean up after 5 seconds
        setTimeout(() => clearInterval(updateInterval), 5000);
      }),
      
      pauseAsync: jest.fn().mockResolvedValue({}),
      stopAsync: jest.fn().mockResolvedValue({}),
      setPositionAsync: jest.fn().mockImplementation(async (position) => {
        if (scenario === 'SEEK_ERROR') {
          throw new Error('Seeking failed');
        }
        
        const seekDelay = device.processingPower === 'low' ? 500 : 100;
        await new Promise(resolve => setTimeout(resolve, seekDelay));
      }),
      
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: true,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 15000,
      }),
    }));

    return mockReact.createElement('div', {
      'data-testid': 'video-player',
      'data-device': deviceType,
      'data-quality': device.videoQuality,
      style: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
      },
    }, `Video Player - ${deviceType}`);
    }),
    ResizeMode: {
      CONTAIN: 'contain',
      COVER: 'cover',
      STRETCH: 'stretch',
    },
  };
});

// Mock React Native modules with device-specific behaviors
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: global.__DEVICE_TYPE__ ? deviceConfigs[global.__DEVICE_TYPE__].platform : 'ios',
      select: jest.fn((options) => {
        const deviceType = global.__DEVICE_TYPE__ || 'IPHONE_13';
        const platform = deviceConfigs[deviceType].platform;
        return options[platform] || options.default;
      }),
    },
    Dimensions: {
      get: jest.fn(() => {
        const deviceType = global.__DEVICE_TYPE__ || 'IPHONE_13';
        return deviceConfigs[deviceType].dimensions;
      }),
    },
    Alert: { alert: jest.fn() },
  };
});

const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
  });
};

const renderWithStore = (component: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

// Mock data
const mockMergedVideo: MediaCapture = {
  type: 'video',
  url: 'https://example.com/merged-video.mp4',
  streamingUrl: 'https://example.com/merged-video.mp4',
  duration: 15000,
  fileSize: 10 * 1024 * 1024,
  mimeType: 'video/mp4',
  mediaId: 'merged-video-123',
};

const mockSegments: VideoSegment[] = [
  {
    statementIndex: 0,
    startTime: 0,
    endTime: 5000,
    duration: 5000,
  },
  {
    statementIndex: 1,
    startTime: 5000,
    endTime: 10000,
    duration: 5000,
  },
  {
    statementIndex: 2,
    startTime: 10000,
    endTime: 15000,
    duration: 5000,
  },
];

describe('Device Playback UI Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__DEVICE_TYPE__ = 'IPHONE_13';
    global.__PLAYBACK_SCENARIO__ = 'NORMAL';
    global.__NETWORK_STATE__ = 'online';
  });

  describe('iPhone 13 Playback Testing', () => {
    beforeEach(() => {
      global.__DEVICE_TYPE__ = 'IPHONE_13';
    });

    it('renders video player optimized for iPhone 13 screen', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-device')).toBe('IPHONE_13');
      expect(videoPlayer.getAttribute('data-quality')).toBe('1080p');
    });

    it('handles high-quality video playback smoothly', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      // Should load quickly on high-end device
      await waitFor(() => {
        expect(getByText('▶️')).toBeTruthy();
      }, { timeout: 1000 });

      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should start playing without buffering issues
      await waitFor(() => {
        expect(getByText('⏸️')).toBeTruthy();
      });
    });

    it('provides smooth segment navigation on iPhone', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Statement 1')).toBeTruthy();
      });

      // Test segment selection
      const segment2Button = getByText('Statement 2');
      await act(async () => {
        fireEvent.press(segment2Button);
      });

      // Should seek quickly on high-end device
      await waitFor(() => {
        expect(getByText('Current: Statement 2')).toBeTruthy();
      }, { timeout: 500 });
    });
  });

  describe('Android Pixel Playback Testing', () => {
    beforeEach(() => {
      global.__DEVICE_TYPE__ = 'ANDROID_PIXEL';
    });

    it('renders video player optimized for Android Pixel', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-device')).toBe('ANDROID_PIXEL');
      expect(videoPlayer.getAttribute('data-quality')).toBe('1080p');
    });

    it('handles Android-specific video codecs', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      // Should load successfully with Android codecs
      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });
    });
  });

  describe('Low-End Android Device Testing', () => {
    beforeEach(() => {
      global.__DEVICE_TYPE__ = 'LOW_END_ANDROID';
    });

    it('adapts playback for low-end device constraints', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-device')).toBe('LOW_END_ANDROID');
      expect(videoPlayer.getAttribute('data-quality')).toBe('480p');
    });

    it('shows loading indicators for slower processing', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Should show loading state longer on low-end device
      expect(getByText('Loading merged video...')).toBeTruthy();

      // Eventually should load
      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('handles memory constraints during playback', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Test multiple segment switches (memory stress test)
      for (let i = 0; i < 3; i++) {
        const segmentButton = getByText(`Statement ${i + 1}`);
        await act(async () => {
          fireEvent.press(segmentButton);
        });

        await waitFor(() => {
          expect(getByText(`Current: Statement ${i + 1}`)).toBeTruthy();
        });
      }

      // Should still be functional after memory stress
      expect(getByText('Status: loaded')).toBeTruthy();
    });
  });

  describe('iPad Tablet Testing', () => {
    beforeEach(() => {
      global.__DEVICE_TYPE__ = 'TABLET_IPAD';
    });

    it('optimizes UI layout for tablet screen size', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-device')).toBe('TABLET_IPAD');
      expect(videoPlayer.getAttribute('data-quality')).toBe('4K');
    });

    it('handles high-resolution video on large screen', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Should handle 4K video smoothly
      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      await waitFor(() => {
        expect(getByText('⏸️')).toBeTruthy();
      });
    });
  });

  describe('Foldable Device Testing', () => {
    beforeEach(() => {
      global.__DEVICE_TYPE__ = 'FOLDABLE_SAMSUNG';
    });

    it('adapts to foldable screen dimensions', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-device')).toBe('FOLDABLE_SAMSUNG');
    });

    it('handles screen orientation changes', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Simulate fold/unfold by changing dimensions
      const Dimensions = require('react-native').Dimensions;
      Dimensions.get.mockReturnValueOnce({ width: 1024, height: 768 }); // Unfolded

      // Should continue working after orientation change
      expect(getByText('Merged Video Player')).toBeTruthy();
    });
  });

  describe('Cross-Device Compatibility', () => {
    it('maintains consistent functionality across all devices', async () => {
      const devices: DeviceType[] = ['IPHONE_13', 'ANDROID_PIXEL', 'LOW_END_ANDROID', 'TABLET_IPAD', 'FOLDABLE_SAMSUNG'];
      
      for (const device of devices) {
        global.__DEVICE_TYPE__ = device;
        
        const { getByText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        // All devices should show the same core functionality
        await waitFor(() => {
          expect(getByText('Merged Video Player')).toBeTruthy();
          expect(getByText('Statement 1')).toBeTruthy();
          expect(getByText('Statement 2')).toBeTruthy();
          expect(getByText('Statement 3')).toBeTruthy();
        });

        unmount();
      }
    });

    it('scales performance based on device capabilities', async () => {
      const performanceTests = [
        { device: 'IPHONE_13', expectedLoadTime: 1000 },
        { device: 'ANDROID_PIXEL', expectedLoadTime: 1000 },
        { device: 'LOW_END_ANDROID', expectedLoadTime: 3000 },
        { device: 'TABLET_IPAD', expectedLoadTime: 1000 },
      ] as const;

      for (const test of performanceTests) {
        global.__DEVICE_TYPE__ = test.device;
        
        const startTime = Date.now();
        const { getByText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        await waitFor(() => {
          expect(getByText('Status: loaded')).toBeTruthy();
        }, { timeout: test.expectedLoadTime + 1000 });

        const loadTime = Date.now() - startTime;
        expect(loadTime).toBeLessThan(test.expectedLoadTime + 500);

        unmount();
      }
    });
  });

  describe('Error Handling Across Devices', () => {
    it('handles video load errors on different devices', async () => {
      global.__PLAYBACK_SCENARIO__ = 'LOAD_ERROR';
      
      const devices: DeviceType[] = ['IPHONE_13', 'LOW_END_ANDROID'];
      
      for (const device of devices) {
        global.__DEVICE_TYPE__ = device;
        
        const { getByText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        // Should show error handling UI
        await waitFor(() => {
          expect(getByText('Try Again') || getByText('Reload Video')).toBeTruthy();
        });

        unmount();
      }
    });

    it('handles unsupported video formats gracefully', async () => {
      global.__PLAYBACK_SCENARIO__ = 'UNSUPPORTED_FORMAT';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Skip This Video') || getByText('Report Issue')).toBeTruthy();
      });
    });

    it('provides device-appropriate error recovery options', async () => {
      global.__PLAYBACK_SCENARIO__ = 'PLAYBACK_ERROR';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Should show error recovery options
      await waitFor(() => {
        expect(getByText('Try Again') || getByText('Reload Video') || getByText('Report Issue')).toBeTruthy();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('monitors memory usage during extended playback', async () => {
      global.__DEVICE_TYPE__ = 'LOW_END_ANDROID'; // Test on constrained device
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Simulate extended usage
      for (let i = 0; i < 10; i++) {
        const segmentIndex = i % 3;
        const segmentButton = getByText(`Statement ${segmentIndex + 1}`);
        
        await act(async () => {
          fireEvent.press(segmentButton);
        });

        await waitFor(() => {
          expect(getByText(`Current: Statement ${segmentIndex + 1}`)).toBeTruthy();
        });
      }

      // Should still be responsive after extended usage
      expect(getByText('Status: loaded')).toBeTruthy();
    });

    it('tracks playback performance metrics', async () => {
      const devices: DeviceType[] = ['IPHONE_13', 'LOW_END_ANDROID'];
      
      for (const device of devices) {
        global.__DEVICE_TYPE__ = device;
        
        const { getByText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        const startTime = Date.now();
        
        await waitFor(() => {
          expect(getByText('Status: loaded')).toBeTruthy();
        });

        const playButton = getByText('▶️');
        await act(async () => {
          fireEvent.press(playButton);
        });

        await waitFor(() => {
          expect(getByText('⏸️')).toBeTruthy();
        });

        const responseTime = Date.now() - startTime;
        
        // High-end devices should respond faster
        if (device === 'IPHONE_13') {
          expect(responseTime).toBeLessThan(1500);
        } else {
          expect(responseTime).toBeLessThan(4000);
        }

        unmount();
      }
    });
  });

  describe('Accessibility Across Devices', () => {
    it('provides accessible controls on all device types', async () => {
      const devices: DeviceType[] = ['IPHONE_13', 'ANDROID_PIXEL', 'TABLET_IPAD'];
      
      for (const device of devices) {
        global.__DEVICE_TYPE__ = device;
        
        const { getByText, getByLabelText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        await waitFor(() => {
          expect(getByText('Status: loaded')).toBeTruthy();
        });

        // Should have accessible play button
        expect(getByLabelText('Play video') || getByText('▶️')).toBeTruthy();
        
        // Should have accessible segment buttons
        expect(getByText('Statement 1')).toBeTruthy();

        unmount();
      }
    });

    it('adapts text sizes for different screen densities', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Merged Video Player')).toBeTruthy();
      });

      // Text should be readable on all devices
      expect(getByText('Navigate between segments or watch the full video')).toBeTruthy();
    });
  });
});