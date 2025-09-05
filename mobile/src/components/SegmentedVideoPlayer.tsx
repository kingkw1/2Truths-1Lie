/**
 * Segmented Video Player Component
 * Displays three selectable statement segments and allows seeking/playing specific segments
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { MediaCapture, VideoSegment } from '../types';

interface SegmentedVideoPlayerProps {
  mergedVideo: MediaCapture;
  onSegmentSelect?: (segmentIndex: number) => void;
  onPlaybackComplete?: () => void;
  showStatementTexts?: boolean;
  statementTexts?: string[];
  autoPlay?: boolean;
}

export const SegmentedVideoPlayer: React.FC<SegmentedVideoPlayerProps> = ({
  mergedVideo,
  onSegmentSelect,
  onPlaybackComplete,
  showStatementTexts = true,
  statementTexts = [],
  autoPlay = false,
}) => {
  const videoRef = useRef<Video>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus | null>(null);

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];

  // Validate segments
  useEffect(() => {
    if (segments.length !== 3) {
      console.warn('SegmentedVideoPlayer: Expected 3 segments, got', segments.length);
    }
  }, [segments]);

  // Handle playback status updates
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setPlaybackStatus(status);

    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setVideoDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      // Check if we've reached the end of the current segment
      if (selectedSegment !== null && segments[selectedSegment]) {
        const segment = segments[selectedSegment];
        const currentTimeMs = status.positionMillis || 0;
        
        // If we've passed the end of the current segment, pause the video
        if (currentTimeMs >= segment.endTime) {
          videoRef.current?.pauseAsync();
          setIsPlaying(false);
        }
      }

      // Check if video has finished playing completely
      if (status.didJustFinish) {
        setIsPlaying(false);
        onPlaybackComplete?.();
      }
    } else if (!status.isLoaded) {
      console.error('Video playback error: Video failed to load');
      Alert.alert('Playback Error', 'Failed to load video');
    }
  };

  // Play a specific segment
  const playSegment = async (segmentIndex: number) => {
    if (!videoRef.current || segmentIndex < 0 || segmentIndex >= segments.length) {
      return;
    }

    const segment = segments[segmentIndex];
    setSelectedSegment(segmentIndex);
    setIsLoading(true);

    try {
      // Seek to the start of the segment
      await videoRef.current.setPositionAsync(segment.startTime);
      
      // Start playing
      await videoRef.current.playAsync();
      
      setIsPlaying(true);
      onSegmentSelect?.(segmentIndex);
    } catch (error) {
      console.error('Error playing segment:', error);
      Alert.alert('Playback Error', 'Failed to play segment');
    } finally {
      setIsLoading(false);
    }
  };

  // Pause current playback
  const pausePlayback = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
      } catch (error) {
        console.error('Error pausing video:', error);
      }
    }
  };

  // Resume current playback
  const resumePlayback = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.playAsync();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error resuming video:', error);
      }
    }
  };

  // Stop playback and reset
  const stopPlayback = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
        setIsPlaying(false);
        setSelectedSegment(null);
      } catch (error) {
        console.error('Error stopping video:', error);
      }
    }
  };

  // Format time for display
  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get segment progress
  const getSegmentProgress = (segmentIndex: number): number => {
    if (selectedSegment !== segmentIndex || !segments[segmentIndex]) {
      return 0;
    }

    const segment = segments[segmentIndex];
    const segmentDuration = segment.endTime - segment.startTime;
    const playedDuration = Math.max(0, currentPosition - segment.startTime);
    
    return Math.min(100, (playedDuration / segmentDuration) * 100);
  };

  // Render segment button
  const renderSegmentButton = (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    const isSelected = selectedSegment === segmentIndex;
    const progress = getSegmentProgress(segmentIndex);
    const statementText = statementTexts[segmentIndex] || `Statement ${segmentIndex + 1}`;

    return (
      <TouchableOpacity
        key={segmentIndex}
        style={[
          styles.segmentButton,
          isSelected && styles.selectedSegmentButton,
        ]}
        onPress={() => playSegment(segmentIndex)}
        disabled={isLoading}
      >
        <View style={styles.segmentHeader}>
          <Text style={[
            styles.segmentTitle,
            isSelected && styles.selectedSegmentTitle,
          ]}>
            Statement {segmentIndex + 1}
          </Text>
          <Text style={styles.segmentDuration}>
            {formatTime(segment.duration)}
          </Text>
        </View>

        {showStatementTexts && statementText && (
          <Text style={[
            styles.segmentText,
            isSelected && styles.selectedSegmentText,
          ]} numberOfLines={2}>
            {statementText}
          </Text>
        )}

        {/* Progress bar for selected segment */}
        {isSelected && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { width: `${progress}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress)}%
            </Text>
          </View>
        )}

        {/* Play/Pause indicator */}
        <View style={styles.playIndicator}>
          {isLoading && isSelected ? (
            <ActivityIndicator size="small" color="#4a90e2" />
          ) : isSelected && isPlaying ? (
            <Text style={styles.playIcon}>⏸️</Text>
          ) : (
            <Text style={styles.playIcon}>▶️</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render video player controls
  const renderVideoControls = () => {
    if (selectedSegment === null) {
      return null;
    }

    return (
      <View style={styles.videoControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={isPlaying ? pausePlayback : resumePlayback}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={stopPlayback}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>⏹️ Stop</Text>
        </TouchableOpacity>

        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>
            {formatTime(currentPosition)} / {formatTime(videoDuration)}
          </Text>
        </View>
      </View>
    );
  };

  if (!mergedVideo.streamingUrl && !mergedVideo.url) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No video URL available</Text>
      </View>
    );
  }

  if (segments.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No video segments available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Statement to Play</Text>

      {/* Video Player (hidden but functional) */}
      <Video
        ref={videoRef}
        source={{ uri: mergedVideo.streamingUrl || mergedVideo.url! }}
        style={styles.hiddenVideo}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        shouldPlay={false}
        isLooping={false}
        useNativeControls={false}
        resizeMode={ResizeMode.CONTAIN}
      />

      {/* Segment Selection Buttons */}
      <View style={styles.segmentsContainer}>
        {segments.map((_, index) => renderSegmentButton(index))}
      </View>

      {/* Video Controls */}
      {renderVideoControls()}

      {/* Current Segment Info */}
      {selectedSegment !== null && (
        <View style={styles.currentSegmentInfo}>
          <Text style={styles.currentSegmentTitle}>
            Now Playing: Statement {selectedSegment + 1}
          </Text>
          <Text style={styles.currentSegmentDetails}>
            Duration: {formatTime(segments[selectedSegment].duration)} • 
            Position: {formatTime(currentPosition - segments[selectedSegment].startTime)} / {formatTime(segments[selectedSegment].duration)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  hiddenVideo: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  segmentsContainer: {
    marginBottom: 20,
  },
  segmentButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedSegmentButton: {
    borderColor: '#4a90e2',
    backgroundColor: '#f0f8ff',
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedSegmentTitle: {
    color: '#4a90e2',
  },
  segmentDuration: {
    fontSize: 14,
    color: '#666',
  },
  segmentText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  selectedSegmentText: {
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 35,
  },
  playIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  playIcon: {
    fontSize: 20,
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  controlButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timeDisplay: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  currentSegmentInfo: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentSegmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a90e2',
    marginBottom: 4,
  },
  currentSegmentDetails: {
    fontSize: 12,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
});

export default SegmentedVideoPlayer;