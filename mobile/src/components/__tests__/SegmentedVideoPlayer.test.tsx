/**
 * SegmentedVideoPlayer Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SegmentedVideoPlayer from '../SegmentedVideoPlayer';
import { MediaCapture, VideoSegment } from '../../types';

// Mock expo-av
jest.mock('expo-av', () => ({
  Video: ({ children, ...props }: any) => {
    const MockVideo = require('react-native').View;
    return <MockVideo testID="video-component" {...props}>{children}</MockVideo>;
  },
  ResizeMode: {
    CONTAIN: 'contain',
  },
}));

describe('SegmentedVideoPlayer', () => {
  const mockMergedVideo: MediaCapture = {
    type: 'video',
    streamingUrl: 'https://example.com/merged-video.mp4',
    duration: 30000, // 30 seconds
    mediaId: 'merged-123',
    isMergedVideo: true,
    isUploaded: true,
  };

  const mockSegments: VideoSegment[] = [
    {
      statementIndex: 0,
      startTime: 0,
      endTime: 10000,
      duration: 10000,
    },
    {
      statementIndex: 1,
      startTime: 10000,
      endTime: 20000,
      duration: 10000,
    },
    {
      statementIndex: 2,
      startTime: 20000,
      endTime: 30000,
      duration: 10000,
    },
  ];

  const mockStatementTexts = [
    'I have traveled to 15 countries',
    'I can speak 4 languages fluently',
    'I have never broken a bone',
  ];

  it('renders correctly with merged video and segments', () => {
    const { getByText, getByTestId } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('Merged Video Player')).toBeTruthy();
    expect(getByText('Navigate between segments or watch the full video')).toBeTruthy();
    expect(getByTestId('video-component')).toBeTruthy();
    expect(getByText('Select Statement:')).toBeTruthy();
  });

  it('renders segment buttons correctly', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
      />
    );

    // Check that all segment buttons are rendered
    expect(getByText('Statement 1')).toBeTruthy();
    expect(getByText('Statement 2')).toBeTruthy();
    expect(getByText('Statement 3')).toBeTruthy();

    // Check that statement texts are displayed
    expect(getByText('I have traveled to 15 countries')).toBeTruthy();
    expect(getByText('I can speak 4 languages fluently')).toBeTruthy();
    expect(getByText('I have never broken a bone')).toBeTruthy();
  });

  it('calls onSegmentSelect when segment button is pressed', () => {
    const mockOnSegmentSelect = jest.fn();
    
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
        onSegmentSelect={mockOnSegmentSelect}
      />
    );

    fireEvent.press(getByText('Statement 2'));
    expect(mockOnSegmentSelect).toHaveBeenCalledWith(1);
  });

  it('displays error message when no video URL is provided', () => {
    const invalidVideo: MediaCapture = {
      ...mockMergedVideo,
      streamingUrl: undefined,
    };

    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={invalidVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('No merged video available')).toBeTruthy();
  });

  it('displays error message when no segments are provided', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={[]}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('No segment data available')).toBeTruthy();
  });

  it('formats time correctly', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
      />
    );

    // Check that segment durations are formatted correctly
    expect(getByText(/0:00 - 0:10 \(0:10\)/)).toBeTruthy();
    expect(getByText(/0:10 - 0:20 \(0:10\)/)).toBeTruthy();
    expect(getByText(/0:20 - 0:30 \(0:10\)/)).toBeTruthy();
  });

  it('shows status information', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        segments={mockSegments}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText(/Status: not-loaded/)).toBeTruthy();
    expect(getByText(/Playing: No/)).toBeTruthy();
    expect(getByText(/Segments: 3/)).toBeTruthy();
  });
});