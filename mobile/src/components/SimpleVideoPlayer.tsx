/**
 * Simple Video Player Component - Minimal implementation for testing
 * Uses expo-av with basic functionality to test video loading
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

interface SimpleVideoPlayerProps {
  mergedVideo: MediaCapture;
  onSegmentSelect?: (segmentIndex: number) => void;
  statementTexts?: string[];
}

export const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({
  mergedVideo,
  onSegmentSelect,
  statementTexts = [],
}) => {
  const videoRef = useRef<Video>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>('not-loaded');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];

  // Video status update handler
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoStatus('loaded');
      setIsPlaying(status.isPlaying);
      setErrorMessage('');
    } else if (status.error) {
      setVideoStatus('error');
      setErrorMessage(status.error);
      console.error('Video playback error:', status.error);
    } else {
      setVideoStatus('loading');
    }
  };

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
      console.log(`🎬 SIMPLE PLAYER: Playing segment ${segmentIndex}:`, {
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        url: mergedVideo.streamingUrl
      });

      if (videoRef.current) {
        // Seek to segment start time (convert milliseconds to milliseconds)
        await videoRef.current.setPositionAsync(segment.startTime);
        
        // Play the video
        await videoRef.current.playAsync();
      }
      
      onSegmentSelect?.(segmentIndex);
    } catch (error) {
      console.error('Error playing segment:', error);
      setErrorMessage(`Playback error: ${error}`);
      Alert.alert('Playback Error', 'Failed to play segment. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Pause playback
  const pausePlayback = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.pauseAsync();
      } catch (error) {
        console.error('Error pausing video:', error);
      }
    }
  };

  // Resume playback
  const resumePlayback = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.playAsync();
      } catch (error) {
        console.error('Error resuming video:', error);
      }
    }
  };

  // Error handling for missing segments
  if (!segments || segments.length === 0) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>No video segments available</Text>
      </View>
    );
  }

  const videoUrl = mergedVideo.streamingUrl || mergedVideo.url;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Video Player Test</Text>
      
      {/* Debug Info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>Video URL: {videoUrl?.substring(0, 80)}...</Text>
        <Text style={styles.debugText}>Segments: {segments.length}</Text>
        <Text style={styles.debugText}>Status: {videoStatus}</Text>
        {errorMessage ? (
          <Text style={styles.errorText}>Error: {errorMessage}</Text>
        ) : null}
      </View>

      {/* Video Player - Visible for debugging */}
      <Video
        ref={videoRef}
        source={{ uri: videoUrl! }}
        style={styles.visibleVideo}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        shouldPlay={false}
        isLooping={false}
        useNativeControls={true}
        resizeMode={ResizeMode.CONTAIN}
      />

      {/* Simple Segment Buttons */}
      <View style={styles.segmentsContainer}>
        {segments.map((segment, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.segmentButton,
              selectedSegment === index && styles.selectedSegmentButton,
            ]}
            onPress={() => playSegment(index)}
            disabled={isLoading || videoStatus !== 'loaded'}
          >
            <Text style={styles.segmentButtonText}>
              Statement {index + 1}
            </Text>
            <Text style={styles.segmentDetails}>
              {Math.round(segment.startTime / 1000)}s - {Math.round(segment.endTime / 1000)}s
            </Text>
            {isLoading && selectedSegment === index && (
              <ActivityIndicator size="small" color="#4a90e2" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Simple Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={isPlaying ? pausePlayback : resumePlayback}
          disabled={videoStatus !== 'loaded'}
        >
          <Text style={styles.controlButtonText}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  debugContainer: {
    backgroundColor: '#e8f4f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  debugText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginBottom: 4,
  },
  visibleVideo: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    marginBottom: 16,
  },
  segmentsContainer: {
    marginBottom: 16,
  },
  segmentButton: {
    backgroundColor: 'white',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedSegmentButton: {
    borderColor: '#4a90e2',
    backgroundColor: '#f0f8ff',
  },
  segmentButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  segmentDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  controls: {
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#4a90e2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SimpleVideoPlayer;
