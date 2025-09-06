/**
 * Enhanced Segmented Video Player Component
 * Supports multiple playback modes: true merged videos and individual segment switching
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
import * as FileSystem from 'expo-file-system';
import { MediaCapture, VideoSegment } from '../types';

interface EnhancedVideoPlayerProps {
  mergedVideo: MediaCapture;
  onSegmentSelect?: (segmentIndex: number) => void;
  onPlaybackComplete?: () => void;
  showStatementTexts?: boolean;
  statementTexts?: string[];
  autoPlay?: boolean;
  enableSegmentSwitching?: boolean; // New: enable switching between individual videos
}

interface SegmentMetadata {
  version: string;
  mergedVideoUri: string;
  totalDuration: number;
  segmentCount: number;
  mergeStrategy?: string;
  playbackMode?: 'segment_switching' | 'merged_video';
  segments: Array<{
    statementIndex: number;
    startTime: number;
    endTime: number;
    duration: number;
    originalDuration?: number;
    individualVideoUri?: string; // For segment switching mode
    playbackStartTime?: number;
    playbackDuration?: number;
  }>;
  originalVideos: Array<{
    index: number;
    uri: string;
    statementIndex: number;
  }>;
  playbackInstructions?: {
    description: string;
    fallbackVideoUri: string;
    segmentSwitchingEnabled: boolean;
  };
}

export const EnhancedSegmentedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({
  mergedVideo,
  onSegmentSelect,
  onPlaybackComplete,
  showStatementTexts = true,
  statementTexts = [],
  autoPlay = false,
  enableSegmentSwitching = true,
}) => {
  const videoRef = useRef<Video>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus | null>(null);
  const [segmentMetadata, setSegmentMetadata] = useState<SegmentMetadata | null>(null);
  const [playbackMode, setPlaybackMode] = useState<'merged_video' | 'segment_switching'>('merged_video');
  const [currentVideoSource, setCurrentVideoSource] = useState<string | null>(null);

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];

  // Load enhanced metadata when component mounts
  useEffect(() => {
    loadSegmentMetadata();
  }, [mergedVideo]);

  // Validate segments
  useEffect(() => {
    if (segments.length !== 3) {
      console.warn('EnhancedVideoPlayer: Expected 3 segments, got', segments.length);
    }
  }, [segments]);

  /**
   * Load enhanced segment metadata from file
   */
  const loadSegmentMetadata = async () => {
    try {
      const videoUri = mergedVideo.streamingUrl || mergedVideo.url;
      if (!videoUri) return;

      const metadataUri = videoUri.replace(/\.[^/.]+$/, '.segments.json');
      const fileInfo = await FileSystem.getInfoAsync(metadataUri);

      if (fileInfo.exists) {
        const metadataContent = await FileSystem.readAsStringAsync(metadataUri);
        const metadata: SegmentMetadata = JSON.parse(metadataContent);
        
        setSegmentMetadata(metadata);
        
        // Determine playback mode
        if (enableSegmentSwitching && 
            metadata.playbackMode === 'segment_switching' &&
            metadata.playbackInstructions?.segmentSwitchingEnabled) {
          setPlaybackMode('segment_switching');
          console.log('🎯 Using segment switching playback mode');
        } else {
          setPlaybackMode('merged_video');
          console.log('🎯 Using merged video playback mode');
        }
      } else {
        console.log('📄 No enhanced metadata found, using basic merged video mode');
        setPlaybackMode('merged_video');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load segment metadata:', error);
      setPlaybackMode('merged_video');
    }
  };

  // Handle playback status updates
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setPlaybackStatus(status);

    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setVideoDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      // Handle segment boundaries based on playback mode
      if (selectedSegment !== null && segments[selectedSegment]) {
        if (playbackMode === 'merged_video') {
          handleMergedVideoPlayback(status);
        } else {
          handleSegmentSwitchingPlayback(status);
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

  /**
   * Handle playback for merged video mode
   */
  const handleMergedVideoPlayback = (status: AVPlaybackStatus) => {
    if (!status.isLoaded || selectedSegment === null) return;

    const segment = segments[selectedSegment];
    const currentTimeMs = status.positionMillis || 0;
    
    // If we've passed the end of the current segment, pause the video
    if (currentTimeMs >= segment.endTime) {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  };

  /**
   * Handle playback for segment switching mode
   */
  const handleSegmentSwitchingPlayback = (status: AVPlaybackStatus) => {
    if (!status.isLoaded || selectedSegment === null || !segmentMetadata) return;

    const segmentMeta = segmentMetadata.segments[selectedSegment];
    const currentTimeMs = status.positionMillis || 0;
    
    // Check if we've reached the end of the individual video segment
    if (segmentMeta.playbackDuration && currentTimeMs >= segmentMeta.playbackDuration) {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  };

  /**
   * Play a specific segment
   */
  const playSegment = async (segmentIndex: number) => {
    if (!videoRef.current || segmentIndex < 0 || segmentIndex >= segments.length) {
      return;
    }

    setSelectedSegment(segmentIndex);
    setIsLoading(true);

    try {
      if (playbackMode === 'segment_switching' && segmentMetadata) {
        await playSegmentWithSwitching(segmentIndex);
      } else {
        await playSegmentMerged(segmentIndex);
      }

      setIsPlaying(true);
      onSegmentSelect?.(segmentIndex);
    } catch (error) {
      console.error('Error playing segment:', error);
      Alert.alert('Playback Error', 'Failed to play segment');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Play segment using individual video switching
   */
  const playSegmentWithSwitching = async (segmentIndex: number) => {
    if (!segmentMetadata) return;

    const segmentMeta = segmentMetadata.segments[segmentIndex];
    
    // Check if we have an individual video for this segment
    if (segmentMeta.individualVideoUri) {
      const newVideoSource = segmentMeta.individualVideoUri;
      
      // Only switch video source if it's different
      if (currentVideoSource !== newVideoSource) {
        console.log('🔄 Switching to individual video:', newVideoSource);
        
        // Load the individual video for this segment
        await videoRef.current?.loadAsync(
          { uri: newVideoSource },
          { shouldPlay: false }
        );
        
        setCurrentVideoSource(newVideoSource);
      }

      // Seek to the start time within the individual video
      const startTime = segmentMeta.playbackStartTime || 0;
      await videoRef.current?.setPositionAsync(startTime);
    } else {
      // Fallback to merged video mode
      await playSegmentMerged(segmentIndex);
    }
  };

  /**
   * Play segment using merged video
   */
  const playSegmentMerged = async (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    const videoSource = mergedVideo.streamingUrl || mergedVideo.url!;
    
    // Switch to merged video if needed
    if (currentVideoSource !== videoSource) {
      console.log('🔄 Switching to merged video:', videoSource);
      
      await videoRef.current?.loadAsync(
        { uri: videoSource },
        { shouldPlay: false }
      );
      
      setCurrentVideoSource(videoSource);
    }

    // Seek to the start of the segment in merged video
    await videoRef.current?.setPositionAsync(segment.startTime);
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
        setCurrentVideoSource(null);
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

    if (playbackMode === 'segment_switching' && segmentMetadata) {
      const segmentMeta = segmentMetadata.segments[segmentIndex];
      const segmentDuration = segmentMeta.playbackDuration || segmentMeta.duration;
      const playedDuration = Math.max(0, currentPosition);
      return Math.min(100, (playedDuration / segmentDuration) * 100);
    } else {
      const segment = segments[segmentIndex];
      const segmentDuration = segment.endTime - segment.startTime;
      const playedDuration = Math.max(0, currentPosition - segment.startTime);
      return Math.min(100, (playedDuration / segmentDuration) * 100);
    }
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

  // Render playback mode indicator
  const renderPlaybackModeIndicator = () => {
    return (
      <View style={styles.playbackModeIndicator}>
        <Text style={styles.playbackModeText}>
          Mode: {playbackMode === 'segment_switching' ? 'Individual Videos' : 'Merged Video'}
        </Text>
        {segmentMetadata && (
          <Text style={styles.playbackModeDetails}>
            Strategy: {segmentMetadata.mergeStrategy || 'unknown'}
          </Text>
        )}
      </View>
    );
  };

  // Render video controls
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

      {/* Playback Mode Indicator */}
      {renderPlaybackModeIndicator()}

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
            Mode: {playbackMode}
          </Text>
          {currentVideoSource && (
            <Text style={styles.videoSourceInfo}>
              Source: {currentVideoSource.split('/').pop()}
            </Text>
          )}
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
  playbackModeIndicator: {
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  playbackModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c5aa0',
    marginBottom: 4,
  },
  playbackModeDetails: {
    fontSize: 12,
    color: '#5a7ba7',
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
    marginBottom: 4,
  },
  videoSourceInfo: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
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

export default EnhancedSegmentedVideoPlayer;
