/**
 * SegmentedVideoPlayer Component Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SegmentedVideoPlayer from '../SegmentedVideoPlayer';
import { MediaCapture, VideoSegment } from '../../types';

// Mock expo-av
jest.mock('expo-av', () => ({
  Video: jest.fn(({ children, ...props }) => {
    const MockVideo = require('react-native').View;
    return <MockVideo testID="mock-video" {...props}>{children}</MockVideo>;
  }),
  ResizeMode: {
    CONTAIN: 'contain',
  },
}));

describe('SegmentedVideoPlayer', () => {
  const mockMergedVideo: MediaCapture = {
    type: 'video',
    streamingUrl: 'https://example.com/test-video.mp4',
    duration: 30000,
    fileSize: 5000000,
    mimeType: 'video/mp4',
    mediaId: 'test-video-1',
    isUploaded: true,
    isMergedVideo: true,
    segments: [
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
    ],
  };

  const mockStatementTexts = [
    'I have climbed Mount Everest',
    'I can speak 4 languages fluently',
    'I once met a famous movie star',
  ];

  it('renders correctly with segments', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('Select a Statement to Play')).toBeTruthy();
    expect(getByText('Statement 1')).toBeTruthy();
    expect(getByText('Statement 2')).toBeTruthy();
    expect(getByText('Statement 3')).toBeTruthy();
  });

  it('displays statement texts when provided', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
        showStatementTexts={true}
      />
    );

    expect(getByText('I have climbed Mount Everest')).toBeTruthy();
    expect(getByText('I can speak 4 languages fluently')).toBeTruthy();
    expect(getByText('I once met a famous movie star')).toBeTruthy();
  });

  it('hides statement texts when showStatementTexts is false', () => {
    const { queryByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
        showStatementTexts={false}
      />
    );

    expect(queryByText('I have climbed Mount Everest')).toBeNull();
    expect(queryByText('I can speak 4 languages fluently')).toBeNull();
    expect(queryByText('I once met a famous movie star')).toBeNull();
  });

  it('calls onSegmentSelect when a segment is selected', async () => {
    const mockOnSegmentSelect = jest.fn();
    
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
        onSegmentSelect={mockOnSegmentSelect}
      />
    );

    const segment1Button = getByText('Statement 1').parent;
    fireEvent.press(segment1Button!);

    await waitFor(() => {
      expect(mockOnSegmentSelect).toHaveBeenCalledWith(0);
    });
  });

  it('displays segment durations correctly', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
      />
    );

    // Each segment is 10 seconds (10000ms)
    expect(getByText('0:10')).toBeTruthy();
  });

  it('shows error when no video URL is available', () => {
    const videoWithoutUrl: MediaCapture = {
      ...mockMergedVideo,
      streamingUrl: undefined,
      url: undefined,
    };

    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={videoWithoutUrl}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('No video URL available')).toBeTruthy();
  });

  it('shows error when no segments are available', () => {
    const videoWithoutSegments: MediaCapture = {
      ...mockMergedVideo,
      segments: [],
    };

    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={videoWithoutSegments}
        statementTexts={mockStatementTexts}
      />
    );

    expect(getByText('No video segments available')).toBeTruthy();
  });

  it('handles missing statement texts gracefully', () => {
    const { getByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        showStatementTexts={true}
      />
    );

    // Should show default text when no statement texts provided
    expect(getByText('Statement 1')).toBeTruthy();
    expect(getByText('Statement 2')).toBeTruthy();
    expect(getByText('Statement 3')).toBeTruthy();
  });

  it('renders video controls when a segment is selected', async () => {
    const { getByText, queryByText } = render(
      <SegmentedVideoPlayer
        mergedVideo={mockMergedVideo}
        statementTexts={mockStatementTexts}
      />
    );

    // Initially no controls should be visible
    expect(queryByText('▶️ Play')).toBeNull();
    expect(queryByText('⏹️ Stop')).toBeNull();

    // Select a segment
    const segment1Button = getByText('Statement 1').parent;
    fireEvent.press(segment1Button!);

    // Controls should appear after segment selection
    await waitFor(() => {
      expect(getByText('▶️ Play')).toBeTruthy();
      expect(getByText('⏹️ Stop')).toBeTruthy();
    });
  });
});