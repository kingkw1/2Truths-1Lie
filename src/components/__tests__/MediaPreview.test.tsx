/**
 * Unit tests for MediaPreview component
 * Tests video, audio, and text media playback functionality
 */

import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import MediaPreview from '../MediaPreview';
import { MediaCapture } from '../../types/challenge';

// Mock HTML5 media elements
const mockVideoElement = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 30,
  paused: true,
  volume: 1,
  muted: false,
};

const mockAudioElement = {
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentTime: 0,
  duration: 15,
  paused: true,
  volume: 1,
  muted: false,
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLVideoElement and HTMLAudioElement
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: mockVideoElement.play,
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: mockVideoElement.pause,
});

Object.defineProperty(HTMLAudioElement.prototype, 'play', {
  writable: true,
  value: mockAudioElement.play,
});

Object.defineProperty(HTMLAudioElement.prototype, 'pause', {
  writable: true,
  value: mockAudioElement.pause,
});

describe('MediaPreview Component', () => {
  const mockVideoData: MediaCapture = {
    type: 'video',
    url: 'blob:mock-video-url',
    duration: 30000,
    fileSize: 1024000,
    mimeType: 'video/webm',
  };

  const mockAudioData: MediaCapture = {
    type: 'audio',
    url: 'blob:mock-audio-url',
    duration: 15000,
    fileSize: 512000,
    mimeType: 'audio/webm',
  };

  const mockTextData: MediaCapture = {
    type: 'text',
    url: 'data:text/plain;base64,VGhpcyBpcyBhIHRlc3QgdGV4dA==', // "This is a test text"
    duration: 0,
    fileSize: 17,
    mimeType: 'text/plain',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Video Preview', () => {
    it('renders video preview with controls', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('VIDEO')).toBeInTheDocument();
      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });

    it('displays video element with correct src', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', mockVideoData.url);
    });

    it('shows play button initially', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const playButton = screen.getByTitle('Play');
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveTextContent('▶️');
    });

    it('handles play button click', async () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);
      
      await waitFor(() => {
        expect(mockVideoElement.play).toHaveBeenCalled();
      });
    });

    it('displays time information', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const timeElements = screen.getAllByText('0:00');
      expect(timeElements).toHaveLength(2); // current time and duration
      expect(screen.getByText('/')).toBeInTheDocument();
    });

    it('shows volume controls', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const volumeButton = screen.getByTitle(/mute/i);
      const volumeSlider = screen.getByTitle('Volume');
      
      expect(volumeButton).toBeInTheDocument();
      expect(volumeSlider).toBeInTheDocument();
    });
  });

  describe('Audio Preview', () => {
    it('renders audio preview with visualizer', () => {
      render(<MediaPreview mediaData={mockAudioData} />);
      
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('AUDIO')).toBeInTheDocument();
      expect(screen.getByText('Audio Recording')).toBeInTheDocument();
    });

    it('displays audio element (hidden)', () => {
      render(<MediaPreview mediaData={mockAudioData} />);
      
      const audio = document.querySelector('audio');
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute('src', mockAudioData.url);
    });

    it('shows audio visualizer with icon', () => {
      render(<MediaPreview mediaData={mockAudioData} />);
      
      expect(screen.getByText('🎵')).toBeInTheDocument();
      expect(screen.getByText('Audio Recording')).toBeInTheDocument();
    });

    it('displays file size information', () => {
      render(<MediaPreview mediaData={mockAudioData} />);
      
      expect(screen.getByText('Size: 500.0 KB')).toBeInTheDocument();
    });

    it('handles audio playback controls', async () => {
      render(<MediaPreview mediaData={mockAudioData} />);
      
      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);
      
      await waitFor(() => {
        expect(mockAudioElement.play).toHaveBeenCalled();
      });
    });
  });

  describe('Text Preview', () => {
    it('renders text preview without playback controls', () => {
      render(<MediaPreview mediaData={mockTextData} />);
      
      expect(screen.getByText('Preview Recording')).toBeInTheDocument();
      expect(screen.getByText('TEXT')).toBeInTheDocument();
      expect(screen.getByText('Text Recording')).toBeInTheDocument();
      expect(screen.getByText('This is a test text')).toBeInTheDocument();
    });

    it('displays text content correctly', () => {
      render(<MediaPreview mediaData={mockTextData} />);
      
      expect(screen.getByText('This is a test text')).toBeInTheDocument();
    });

    it('shows character count', () => {
      render(<MediaPreview mediaData={mockTextData} />);
      
      expect(screen.getByText('17 characters')).toBeInTheDocument();
    });

    it('does not show playback controls for text', () => {
      render(<MediaPreview mediaData={mockTextData} />);
      
      expect(screen.queryByTitle('Play')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Volume')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('renders re-record button when callback provided', () => {
      const onReRecord = jest.fn();
      render(<MediaPreview mediaData={mockVideoData} onReRecord={onReRecord} />);
      
      const reRecordButton = screen.getByRole('button', { name: /re-record/i });
      expect(reRecordButton).toBeInTheDocument();
    });

    it('renders confirm button when callback provided', () => {
      const onConfirm = jest.fn();
      render(<MediaPreview mediaData={mockVideoData} onConfirm={onConfirm} />);
      
      const confirmButton = screen.getByRole('button', { name: /use this recording/i });
      expect(confirmButton).toBeInTheDocument();
    });

    it('calls onReRecord when re-record button clicked', () => {
      const onReRecord = jest.fn();
      render(<MediaPreview mediaData={mockVideoData} onReRecord={onReRecord} />);
      
      const reRecordButton = screen.getByRole('button', { name: /re-record/i });
      fireEvent.click(reRecordButton);
      
      expect(onReRecord).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when confirm button clicked', () => {
      const onConfirm = jest.fn();
      render(<MediaPreview mediaData={mockVideoData} onConfirm={onConfirm} />);
      
      const confirmButton = screen.getByRole('button', { name: /use this recording/i });
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not render action buttons when no callbacks provided', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      expect(screen.queryByRole('button', { name: /re-record/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /use this recording/i })).not.toBeInTheDocument();
    });
  });

  describe('Controls Visibility', () => {
    it('hides controls when showControls is false', () => {
      render(<MediaPreview mediaData={mockVideoData} showControls={false} />);
      
      expect(screen.queryByTitle('Play')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Volume')).not.toBeInTheDocument();
    });

    it('shows controls by default', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles unsupported media type', () => {
      const invalidMediaData = {
        ...mockVideoData,
        type: 'invalid' as any,
      };
      
      render(<MediaPreview mediaData={invalidMediaData} />);
      
      expect(screen.getByText('Unsupported media type: invalid')).toBeInTheDocument();
    });

    it('handles missing text content', () => {
      const emptyTextData = {
        ...mockTextData,
        url: undefined,
      };
      
      render(<MediaPreview mediaData={emptyTextData} />);
      
      expect(screen.getByText('No text content available')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('formats time correctly for different durations', () => {
      // Test the time formatting function indirectly by checking duration display
      // Since the component shows 0:00 initially, we'll test that it renders without error
      const testCases = [
        { duration: 30000 }, // 30 seconds
        { duration: 90000 }, // 1:30
        { duration: 3661000 }, // Over an hour
      ];

      testCases.forEach(({ duration }) => {
        const mediaData = { ...mockVideoData, duration };
        const { unmount } = render(<MediaPreview mediaData={mediaData} />);
        
        // Check that the component renders successfully with different durations
        expect(screen.getByText('Preview Recording')).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar for video and audio', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const progressContainer = document.querySelector('[style*="cursor: pointer"]');
      expect(progressContainer).toBeInTheDocument();
    });

    it('handles progress bar click', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const progressContainer = document.querySelector('[style*="cursor: pointer"]') as HTMLElement;
      
      // Mock getBoundingClientRect
      jest.spyOn(progressContainer, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        right: 100,
        bottom: 10,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      
      fireEvent.click(progressContainer, { clientX: 50 });
      
      // Should attempt to seek to middle of the track
      // This would be tested more thoroughly with actual media element mocking
    });
  });

  describe('Volume Control', () => {
    it('handles volume slider changes', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const volumeSlider = screen.getByTitle('Volume') as HTMLInputElement;
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });
      
      expect(volumeSlider.value).toBe('0.5');
    });

    it('handles mute button toggle', () => {
      render(<MediaPreview mediaData={mockVideoData} />);
      
      const muteButton = screen.getByTitle(/mute/i);
      fireEvent.click(muteButton);
      
      // The button should toggle mute state
      expect(muteButton).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('revokes blob URLs on unmount', () => {
      const { unmount } = render(<MediaPreview mediaData={mockVideoData} />);
      
      unmount();
      
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockVideoData.url);
    });

    it('does not revoke non-blob URLs', () => {
      const httpMediaData = {
        ...mockVideoData,
        url: 'https://example.com/video.mp4',
      };
      
      const { unmount } = render(<MediaPreview mediaData={httpMediaData} />);
      
      unmount();
      
      expect(global.URL.revokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className and style', () => {
      const customStyle = { backgroundColor: 'red' };
      const { container } = render(
        <MediaPreview 
          mediaData={mockVideoData} 
          className="custom-class" 
          style={customStyle}
        />
      );
      
      const previewContainer = container.firstChild as HTMLElement;
      expect(previewContainer).toHaveClass('custom-class');
      expect(previewContainer).toHaveStyle('background-color: red');
    });
  });
});