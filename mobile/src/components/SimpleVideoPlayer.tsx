/**
 * Simple Video Player Component - Updated for individual videos only
 * Plays individual videos for each statement without merged video functionality
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { MediaCapture } from '../types';

interface SimpleVideoPlayerProps {
  individualVideos: MediaCapture[]; // Array of individual videos for each statement
  onSegmentSelect?: (segmentIndex: number) => void;
  statementTexts?: string[];
}

export const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({
  individualVideos = [],
  onSegmentSelect,
  statementTexts = [],
}) => {
  const videoRef = useRef<Video>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>('not-loaded');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>(''); // Track which video is currently loaded

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setVideoStatus('loaded');
    } else {
      setVideoStatus('error');
      if ('error' in status && status.error) {
        console.error('Video playback error:', status.error);
        setErrorMessage(status.error);
      }
    }
  };

  const selectSegment = async (segmentIndex: number) => {
    console.log(`🎬 SIMPLE_PLAYER: Selecting segment ${segmentIndex}`);
    
    if (segmentIndex < 0 || segmentIndex >= individualVideos.length) {
      console.error('Invalid segment index:', segmentIndex);
      return;
    }

    const video = individualVideos[segmentIndex];
    if (!video) {
      console.error('No video found for segment:', segmentIndex);
      return;
    }

    try {
      setIsLoading(true);
      setSelectedSegment(segmentIndex);
      setErrorMessage('');

      const videoUrl = video.streamingUrl || video.url || '';
      
      if (videoUrl !== currentVideoUrl) {
        console.log(`🎬 SIMPLE_PLAYER: Loading individual video ${segmentIndex}: ${videoUrl}`);
        
        // Load the individual video
        if (videoRef.current) {
          await videoRef.current.loadAsync(
            { uri: videoUrl },
            { shouldPlay: true, positionMillis: 0 },
            false
          );
          setCurrentVideoUrl(videoUrl);
        }
      } else {
        // Same video, just restart
        if (videoRef.current) {
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
        }
      }

      // Notify parent component
      onSegmentSelect?.(segmentIndex);
    } catch (error) {
      console.error('Error selecting segment:', error);
      setErrorMessage(`Failed to play video ${segmentIndex + 1}`);
      Alert.alert('Playback Error', `Failed to play video for statement ${segmentIndex + 1}`);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    try {
      if (videoRef.current) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Alert.alert('Playback Error', 'Failed to control video playback');
    }
  };

  // Early return if no videos
  if (!individualVideos || individualVideos.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No videos available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Play/Pause Button */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
            disabled={!currentVideoUrl || videoStatus !== 'loaded'}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Statement Selection */}
      <View style={styles.segmentContainer}>
        {individualVideos.map((video, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.segmentButton,
              selectedSegment === index && styles.selectedSegmentButton,
            ]}
            onPress={() => selectSegment(index)}
          >
            <Text
              style={[
                styles.segmentButtonText,
                selectedSegment === index && styles.selectedSegmentButtonText,
              ]}
            >
              Statement {index + 1}
            </Text>
            {statementTexts[index] && (
              <Text style={styles.statementText}>
                {statementTexts[index]}
              </Text>
            )}
            <Text style={styles.videoDuration}>
              {video.duration ? `${Math.round(video.duration / 1000)}s` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  videoContainer: {
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff3333',
    textAlign: 'center',
    fontSize: 16,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  playButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 30,
    minWidth: 60,
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 24,
  },
  segmentContainer: {
    marginBottom: 20,
  },
  segmentButton: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedSegmentButton: {
    borderColor: '#007AFF',
    backgroundColor: '#e6f3ff',
  },
  segmentButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  selectedSegmentButtonText: {
    color: '#007AFF',
  },
  statementText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  videoDuration: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    elevation: 1,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default SimpleVideoPlayer;
