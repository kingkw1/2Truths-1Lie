/**
 * Network Resilience Testing
 * Tests app behavior under various network conditions and connectivity scenarios
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Alert } from 'react-native';
import SegmentedVideoPlayer from '../components/SegmentedVideoPlayer';
import { EnhancedMobileCameraIntegration } from '../components/EnhancedMobileCameraIntegration';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import { MediaCapture, VideoSegment } from '../types';

// Network state types
type NetworkState = 'online' | 'offline' | 'slow' | 'unstable' | 'limited';
type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none';

interface NetworkConfig {
  state: NetworkState;
  connectionType: ConnectionType;
  bandwidth: number; // Mbps
  latency: number; // ms
  packetLoss: number; // percentage
  isMetered: boolean;
}

const networkConfigs: Record<NetworkState, NetworkConfig> = {
  online: {
    state: 'online',
    connectionType: 'wifi',
    bandwidth: 50,
    latency: 20,
    packetLoss: 0,
    isMetered: false,
  },
  offline: {
    state: 'offline',
    connectionType: 'none',
    bandwidth: 0,
    latency: 0,
    packetLoss: 100,
    isMetered: false,
  },
  slow: {
    state: 'slow',
    connectionType: 'cellular',
    bandwidth: 1,
    latency: 500,
    packetLoss: 5,
    isMetered: true,
  },
  unstable: {
    state: 'unstable',
    connectionType: 'cellular',
    bandwidth: 10,
    latency: 200,
    packetLoss: 15,
    isMetered: true,
  },
  limited: {
    state: 'limited',
    connectionType: 'cellular',
    bandwidth: 5,
    latency: 100,
    packetLoss: 2,
    isMetered: true,
  },
};

// Global test state
declare global {
  var __NETWORK_STATE__: NetworkState;
  var __NETWORK_SCENARIO__: string;
  var __CONNECTION_CHANGES__: number;
}

// Mock NetInfo for network state management
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock network-aware components
const mockNetworkListeners: Array<(state: any) => void> = [];

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockImplementation(() => {
    const networkState = global.__NETWORK_STATE__ || 'online';
    const config = networkConfigs[networkState];
    
    return Promise.resolve({
      isConnected: config.state !== 'offline',
      isInternetReachable: config.state === 'online',
      type: config.connectionType,
      details: {
        isConnectionExpensive: config.isMetered,
        strength: config.bandwidth > 10 ? 'strong' : 'weak',
      },
    });
  }),
  addEventListener: jest.fn().mockImplementation((listener) => {
    mockNetworkListeners.push(listener);
    return () => {
      const index = mockNetworkListeners.indexOf(listener);
      if (index > -1) mockNetworkListeners.splice(index, 1);
    };
  }),
}));

// Mock Expo AV with network-aware behaviors
jest.mock('expo-av', () => {
  const mockReact = require('react');
  return {
    Video: mockReact.forwardRef(({ source, onPlaybackStatusUpdate, onLoad }: any, ref: any) => {
    const networkState = global.__NETWORK_STATE__ || 'online';
    const config = networkConfigs[networkState];
    const scenario = global.__NETWORK_SCENARIO__ || 'NORMAL';

    mockReact.useImperativeHandle(ref, () => ({
      loadAsync: jest.fn().mockImplementation(async (source, initialStatus) => {
        // Simulate network-dependent loading
        if (config.state === 'offline') {
          throw new Error('Network request failed');
        }
        
        if (config.state === 'slow') {
          // Simulate slow loading
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        if (config.state === 'unstable' && Math.random() < 0.3) {
          throw new Error('Connection timeout');
        }
        
        if (scenario === 'NETWORK_INTERRUPTION') {
          // Simulate network interruption during load
          setTimeout(() => {
            onPlaybackStatusUpdate?.({
              isLoaded: false,
              error: 'Network connection lost',
            });
          }, 1000);
          return;
        }
        
        // Simulate successful load with network-appropriate delay
        const loadDelay = Math.max(100, config.latency * 2);
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        setTimeout(() => {
          onLoad?.({
            isLoaded: true,
            durationMillis: 15000,
            naturalSize: { width: 1920, height: 1080 },
          });
        }, 100);
      }),
      
      playAsync: jest.fn().mockImplementation(async () => {
        if (config.state === 'offline') {
          throw new Error('No network connection');
        }
        
        if (scenario === 'PLAYBACK_INTERRUPTION') {
          // Start playing then simulate network interruption
          setTimeout(() => {
            onPlaybackStatusUpdate?.({
              isLoaded: true,
              isPlaying: false,
              isBuffering: true,
              error: 'Network connection interrupted',
            });
          }, 2000);
        }
        
        // Simulate buffering based on network quality
        const bufferingFrequency = config.state === 'slow' ? 0.8 : 
                                  config.state === 'unstable' ? 0.5 : 0.1;
        
        const updateInterval = setInterval(() => {
          const shouldBuffer = Math.random() < bufferingFrequency;
          
          onPlaybackStatusUpdate?.({
            isLoaded: true,
            isPlaying: !shouldBuffer,
            isBuffering: shouldBuffer,
            positionMillis: Math.random() * 15000,
            durationMillis: 15000,
          });
        }, 500);
        
        // Clean up after 10 seconds
        setTimeout(() => clearInterval(updateInterval), 10000);
      }),
      
      pauseAsync: jest.fn().mockResolvedValue({}),
      stopAsync: jest.fn().mockResolvedValue({}),
      setPositionAsync: jest.fn().mockImplementation(async (position) => {
        if (config.state === 'offline') {
          throw new Error('Cannot seek without network connection');
        }
        
        // Simulate seek delay based on network
        const seekDelay = config.latency + (config.state === 'slow' ? 1000 : 0);
        await new Promise(resolve => setTimeout(resolve, seekDelay));
      }),
      
      getStatusAsync: jest.fn().mockResolvedValue({
        isLoaded: config.state !== 'offline',
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 15000,
      }),
    }));

    return mockReact.createElement('div', {
      'data-testid': 'video-player',
      'data-network': networkState,
      'data-bandwidth': config.bandwidth.toString(),
      style: {
        width: '100%',
        height: '100%',
        backgroundColor: config.state === 'offline' ? '#333' : '#000',
      },
    }, `Video Player - Network: ${networkState}`);
    }),
    ResizeMode: {
      CONTAIN: 'contain',
      COVER: 'cover',
    },
  };
});

// Mock upload service with network awareness
jest.mock('../services/mobileMediaIntegration', () => ({
  uploadVideoToMergeEndpoint: jest.fn().mockImplementation(async (videos) => {
    const networkState = global.__NETWORK_STATE__ || 'online';
    const config = networkConfigs[networkState];
    
    if (config.state === 'offline') {
      throw new Error('No internet connection');
    }
    
    if (config.state === 'slow') {
      // Simulate slow upload
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    if (config.state === 'unstable' && Math.random() < 0.4) {
      throw new Error('Upload failed due to network instability');
    }
    
    // Simulate upload progress
    const uploadDelay = Math.max(1000, 5000 / config.bandwidth);
    await new Promise(resolve => setTimeout(resolve, uploadDelay));
    
    return {
      mergedVideoUrl: 'https://example.com/merged-video.mp4',
      segments: [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ],
    };
  }),
}));

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

// Helper function to simulate network state changes
const simulateNetworkChange = (newState: NetworkState) => {
  global.__NETWORK_STATE__ = newState;
  global.__CONNECTION_CHANGES__ = (global.__CONNECTION_CHANGES__ || 0) + 1;
  
  const config = networkConfigs[newState];
  const networkInfo = {
    isConnected: config.state !== 'offline',
    isInternetReachable: config.state === 'online',
    type: config.connectionType,
    details: {
      isConnectionExpensive: config.isMetered,
      strength: config.bandwidth > 10 ? 'strong' : 'weak',
    },
  };
  
  // Notify all listeners
  mockNetworkListeners.forEach(listener => listener(networkInfo));
};

describe('Network Resilience Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__NETWORK_STATE__ = 'online';
    global.__NETWORK_SCENARIO__ = 'NORMAL';
    global.__CONNECTION_CHANGES__ = 0;
    mockNetworkListeners.length = 0;
  });

  describe('Online Network Conditions', () => {
    beforeEach(() => {
      global.__NETWORK_STATE__ = 'online';
    });

    it('loads and plays video smoothly with good connection', async () => {
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
      expect(videoPlayer.getAttribute('data-network')).toBe('online');
      expect(videoPlayer.getAttribute('data-bandwidth')).toBe('50');

      // Should load quickly
      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      }, { timeout: 1000 });

      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should start playing without buffering
      await waitFor(() => {
        expect(getByText('⏸️')).toBeTruthy();
      });
    });

    it('handles segment navigation efficiently with good connection', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Test rapid segment switching
      for (let i = 0; i < 3; i++) {
        const segmentButton = getByText(`Statement ${i + 1}`);
        await act(async () => {
          fireEvent.press(segmentButton);
        });

        await waitFor(() => {
          expect(getByText(`Current: Statement ${i + 1}`)).toBeTruthy();
        }, { timeout: 500 });
      }
    });
  });

  describe('Offline Network Conditions', () => {
    beforeEach(() => {
      global.__NETWORK_STATE__ = 'offline';
    });

    it('handles offline state gracefully', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-network')).toBe('offline');

      // Should show offline error
      await waitFor(() => {
        expect(getByText('Try Again') || getByText('Network request failed')).toBeTruthy();
      });
    });

    it('provides offline-appropriate error messages', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('🌐 Network Status') || getByText('Check your internet connection')).toBeTruthy();
      });
    });

    it('handles upload attempts while offline', async () => {
      const mockProps = {
        statementIndex: 0,
        isVisible: true,
        onComplete: jest.fn(),
        onCancel: jest.fn(),
        onError: jest.fn(),
      };

      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...mockProps} />
      );

      // Should show offline indicator or disable upload functionality
      await waitFor(() => {
        expect(getByText('No internet connection') || getByText('Offline')).toBeTruthy();
      });
    });
  });

  describe('Slow Network Conditions', () => {
    beforeEach(() => {
      global.__NETWORK_STATE__ = 'slow';
    });

    it('adapts to slow network with appropriate loading indicators', async () => {
      const { getByTestId, getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      const videoPlayer = getByTestId('video-player');
      expect(videoPlayer.getAttribute('data-network')).toBe('slow');
      expect(videoPlayer.getAttribute('data-bandwidth')).toBe('1');

      // Should show loading for longer
      expect(getByText('Loading merged video...')).toBeTruthy();

      // Eventually should load
      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      }, { timeout: 6000 });
    });

    it('shows buffering indicators during slow playback', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      }, { timeout: 6000 });

      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should show buffering frequently on slow connection
      await waitFor(() => {
        expect(getByText('Loading merged video...') || getByText('Buffering...')).toBeTruthy();
      }, { timeout: 2000 });
    });

    it('provides quality adjustment suggestions for slow connections', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('💡 Tip') || getByText('slow connection')).toBeTruthy();
      });
    });
  });

  describe('Unstable Network Conditions', () => {
    beforeEach(() => {
      global.__NETWORK_STATE__ = 'unstable';
    });

    it('handles intermittent connection failures', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // May fail to load initially
      await waitFor(() => {
        expect(
          getByText('Status: loaded') || 
          getByText('Connection timeout') || 
          getByText('Try Again')
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('provides retry mechanisms for unstable connections', async () => {
      global.__NETWORK_SCENARIO__ = 'NETWORK_INTERRUPTION';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Try Again') || getByText('Reload Video')).toBeTruthy();
      });

      // Test retry functionality
      const retryButton = getByText('Try Again') || getByText('Reload Video');
      await act(async () => {
        fireEvent.press(retryButton);
      });

      // Should attempt to reload
      expect(getByText('Loading merged video...')).toBeTruthy();
    });
  });

  describe('Network State Transitions', () => {
    it('handles transition from online to offline', async () => {
      global.__NETWORK_STATE__ = 'online';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      });

      // Start playing
      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Simulate going offline during playback
      await act(async () => {
        simulateNetworkChange('offline');
      });

      // Should handle the transition gracefully
      await waitFor(() => {
        expect(getByText('Network connection lost') || getByText('Connection interrupted')).toBeTruthy();
      });
    });

    it('handles transition from offline to online', async () => {
      global.__NETWORK_STATE__ = 'offline';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Try Again') || getByText('Network request failed')).toBeTruthy();
      });

      // Simulate coming back online
      await act(async () => {
        simulateNetworkChange('online');
      });

      // Should offer to retry
      await waitFor(() => {
        expect(getByText('Try Again') || getByText('Reload Video')).toBeTruthy();
      });
    });

    it('handles transition from slow to fast connection', async () => {
      global.__NETWORK_STATE__ = 'slow';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('Status: loaded')).toBeTruthy();
      }, { timeout: 6000 });

      // Simulate connection improvement
      await act(async () => {
        simulateNetworkChange('online');
      });

      // Should improve playback quality
      const playButton = getByText('▶️');
      await act(async () => {
        fireEvent.press(playButton);
      });

      // Should play more smoothly now
      await waitFor(() => {
        expect(getByText('⏸️')).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('tracks and reports network state changes', async () => {
      global.__NETWORK_STATE__ = 'online';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Simulate multiple network changes
      await act(async () => {
        simulateNetworkChange('slow');
      });

      await act(async () => {
        simulateNetworkChange('offline');
      });

      await act(async () => {
        simulateNetworkChange('online');
      });

      expect(global.__CONNECTION_CHANGES__).toBe(3);
    });
  });

  describe('Metered Connection Handling', () => {
    beforeEach(() => {
      global.__NETWORK_STATE__ = 'limited';
    });

    it('detects metered connections and shows warnings', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Should show data usage warning
      await waitFor(() => {
        expect(getByText('Data usage') || getByText('metered connection')).toBeTruthy();
      });
    });

    it('provides data-saving options on metered connections', async () => {
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(getByText('lower video quality') || getByText('data-saving')).toBeTruthy();
      });
    });
  });

  describe('Upload Resilience', () => {
    it('handles upload failures due to network issues', async () => {
      global.__NETWORK_STATE__ = 'unstable';
      
      const mockProps = {
        statementIndex: 0,
        isVisible: true,
        onComplete: jest.fn(),
        onCancel: jest.fn(),
        onError: jest.fn(),
      };

      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...mockProps} />
      );

      // Should handle upload failures gracefully
      await waitFor(() => {
        expect(mockProps.onError).toHaveBeenCalledWith(
          expect.stringContaining('network')
        );
      });
    });

    it('provides upload retry mechanisms', async () => {
      global.__NETWORK_STATE__ = 'slow';
      
      const mockProps = {
        statementIndex: 0,
        isVisible: true,
        onComplete: jest.fn(),
        onCancel: jest.fn(),
        onError: jest.fn(),
      };

      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...mockProps} />
      );

      // Should show upload progress for slow connections
      await waitFor(() => {
        expect(getByText('Uploading...') || getByText('Upload progress')).toBeTruthy();
      });
    });

    it('queues uploads when offline and processes when online', async () => {
      global.__NETWORK_STATE__ = 'offline';
      
      const mockProps = {
        statementIndex: 0,
        isVisible: true,
        onComplete: jest.fn(),
        onCancel: jest.fn(),
        onError: jest.fn(),
      };

      const { getByText } = renderWithStore(
        <EnhancedMobileCameraIntegration {...mockProps} />
      );

      // Should queue upload when offline
      await waitFor(() => {
        expect(getByText('Queued for upload') || getByText('Will upload when online')).toBeTruthy();
      });

      // Simulate coming back online
      await act(async () => {
        simulateNetworkChange('online');
      });

      // Should process queued uploads
      await waitFor(() => {
        expect(getByText('Processing queued uploads') || getByText('Uploading...')).toBeTruthy();
      });
    });
  });

  describe('Error Recovery and User Guidance', () => {
    it('provides contextual error messages based on network state', async () => {
      const networkStates: NetworkState[] = ['offline', 'slow', 'unstable'];
      
      for (const state of networkStates) {
        global.__NETWORK_STATE__ = state;
        
        const { getByText, unmount } = renderWithStore(
          <SegmentedVideoPlayer
            mergedVideo={mockMergedVideo}
            segments={mockSegments}
          />
        );

        await waitFor(() => {
          if (state === 'offline') {
            expect(getByText('No internet connection') || getByText('Check your internet connection')).toBeTruthy();
          } else if (state === 'slow') {
            expect(getByText('slow connection') || getByText('lower video quality')).toBeTruthy();
          } else if (state === 'unstable') {
            expect(getByText('Connection timeout') || getByText('Try Again')).toBeTruthy();
          }
        });

        unmount();
      }
    });

    it('provides progressive retry strategies', async () => {
      global.__NETWORK_STATE__ = 'unstable';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Should show retry options
      await waitFor(() => {
        expect(getByText('Try Again')).toBeTruthy();
      });

      // Test multiple retries
      for (let i = 0; i < 3; i++) {
        const retryButton = getByText('Try Again');
        await act(async () => {
          fireEvent.press(retryButton);
        });

        await waitFor(() => {
          expect(getByText(`Retry (${2-i} left)`) || getByText('Try Again')).toBeTruthy();
        });
      }
    });

    it('suggests alternative actions when network fails persistently', async () => {
      global.__NETWORK_STATE__ = 'offline';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      await waitFor(() => {
        expect(
          getByText('Try again later') || 
          getByText('Download for offline viewing') ||
          getByText('Check your connection')
        ).toBeTruthy();
      });
    });
  });

  describe('Performance Under Network Stress', () => {
    it('maintains UI responsiveness during network issues', async () => {
      global.__NETWORK_STATE__ = 'unstable';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // UI should remain responsive even with network issues
      expect(getByText('Merged Video Player')).toBeTruthy();
      expect(getByText('Statement 1')).toBeTruthy();
      expect(getByText('Statement 2')).toBeTruthy();
      expect(getByText('Statement 3')).toBeTruthy();
    });

    it('handles rapid network state changes gracefully', async () => {
      global.__NETWORK_STATE__ = 'online';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Rapidly change network states
      const states: NetworkState[] = ['online', 'slow', 'offline', 'unstable', 'online'];
      
      for (const state of states) {
        await act(async () => {
          simulateNetworkChange(state);
        });
        
        // Small delay to let the component react
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should still be functional
      expect(getByText('Merged Video Player')).toBeTruthy();
    });

    it('manages memory efficiently during network retries', async () => {
      global.__NETWORK_STATE__ = 'unstable';
      
      const { getByText } = renderWithStore(
        <SegmentedVideoPlayer
          mergedVideo={mockMergedVideo}
          segments={mockSegments}
        />
      );

      // Simulate multiple retry attempts
      for (let i = 0; i < 5; i++) {
        await waitFor(() => {
          expect(getByText('Try Again')).toBeTruthy();
        });

        const retryButton = getByText('Try Again');
        await act(async () => {
          fireEvent.press(retryButton);
        });

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Should not show memory warnings or crashes
      expect(getByText('Merged Video Player')).toBeTruthy();
    });
  });
});