/**
 * Segmented Video Player Component (V2 - Updated for expo-video)
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { MediaCapture, VideoSegment } from '../types';

interface SegmentedVideoPlayerProps {
  mergedVideo: MediaCapture;
  onSegmentSelect?: (segmentIndex: number) => void;
  onPlaybackComplete?: () => void;
  showStatementTexts?: boolean;
  statementTexts?: string[];
  autoPlay?: boolean;
}

export const SegmentedVideoPlayerV2: React.FC<SegmentedVideoPlayerProps> = ({
  mergedVideo,
  onSegmentSelect,
  onPlaybackComplete,
  showStatementTexts = true,
  statementTexts = [],
  autoPlay = false,
}) => {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];

  // Initialize video player
  const player = useVideoPlayer(mergedVideo.streamingUrl || mergedVideo.url!, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Validate segments
  useEffect(() => {
    if (segments.length !== 3) {
      console.warn('SegmentedVideoPlayerV2: Expected 3 segments, got', segments.length);
    }

    // Setup player status listener
    const subscription = player.addListener('timeUpdate', (status) => {
      setCurrentPosition(status.currentTime * 1000); // Convert to milliseconds
    });

    return () => {
      subscription?.remove();
    };
  }, [segments.length, player]);

  // Play a specific segment
  const playSegment = async (segmentIndex: number) => {
    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      console.error('Invalid segment index:', segmentIndex);
      return;
    }

    const segment = segments[segmentIndex];
    setIsLoading(true);
    setSelectedSegment(segmentIndex);

    try {
      console.log(`🎬 Playing segment ${segmentIndex}:`, {
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        url: mergedVideo.streamingUrl
      });

      // Seek to segment start time (convert to seconds)
      player.currentTime = segment.startTime / 1000;
      
      // Play the video
      player.play();
      
      onSegmentSelect?.(segmentIndex);
    } catch (error) {
      console.error('Error playing segment:', error);
      Alert.alert('Playback Error', 'Failed to play segment');
    } finally {
      setIsLoading(false);
    }
  };

  // Pause current playback
  const pausePlayback = () => {
    player.pause();
  };

  // Resume current playback
  const resumePlayback = () => {
    player.play();
  };

  // Stop playback and reset
  const stopPlayback = () => {
    player.pause();
    setSelectedSegment(null);
  };

  // Format time for display
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress for selected segment
  const getSegmentProgress = (segmentIndex: number): number => {
    if (selectedSegment !== segmentIndex) return 0;
    
    const segment = segments[segmentIndex];
    const segmentPosition = Math.max(0, currentPosition - segment.startTime);
    const progress = Math.min(100, (segmentPosition / segment.duration) * 100);
    
    return Math.max(0, progress);
  };

  // Render individual segment button
  const renderSegmentButton = (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    const isSelected = selectedSegment === segmentIndex;
    const progress = getSegmentProgress(segmentIndex);
    const statementText = showStatementTexts && statementTexts[segmentIndex] 
      ? statementTexts[segmentIndex] 
      : `Statement ${segmentIndex + 1}`;

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

        {showStatementTexts && (
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
          ) : isSelected && player.playing ? (
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
          onPress={player.playing ? pausePlayback : resumePlayback}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>
            {player.playing ? '⏸️ Pause' : '▶️ Play'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.stopButton]}
          onPress={stopPlayback}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>⏹️ Stop</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Error handling for missing segments
  if (!segments || segments.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>No video segments available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Statement to Play</Text>

      {/* Video Player (hidden but functional) */}
      <VideoView
        style={styles.hiddenVideo}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit="contain"
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
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
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
    fontWeight: 'bold',
    color: '#333',
  },
  selectedSegmentTitle: {
    color: '#4a90e2',
  },
  segmentDuration: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
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
    marginTop: 8,
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
    fontSize: 10,
    color: '#666',
    minWidth: 30,
    textAlign: 'right',
  },
  playIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  playIcon: {
    fontSize: 16,
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  controlButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  stopButton: {
    backgroundColor: '#ff6b6b',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  currentSegmentInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  currentSegmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  currentSegmentDetails: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
  },
});

export default SegmentedVideoPlayerV2;
