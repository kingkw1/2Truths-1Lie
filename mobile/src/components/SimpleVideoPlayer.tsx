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
  individualVideos?: MediaCapture[]; // Add individual videos for proper segment playback
  onSegmentSelect?: (segmentIndex: number) => void;
  statementTexts?: string[];
}

export const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({
  mergedVideo,
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

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];
  
  // Determine if we should use individual videos (when available and segments match)
  const useIndividualVideos = individualVideos.length === segments.length;
  
  // Initialize video URL (start with merged video or first individual video)
  const initialVideoUrl = useIndividualVideos && individualVideos[0] 
    ? (individualVideos[0].streamingUrl || individualVideos[0].url)
    : (mergedVideo.streamingUrl || mergedVideo.url);
    
  // Initialize currentVideoUrl if not set
  if (!currentVideoUrl && initialVideoUrl) {
    setCurrentVideoUrl(initialVideoUrl);
  }

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
    console.log(`🎬 SIMPLE PLAYER: playSegment called with index ${segmentIndex}`);
    
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
        useIndividualVideos,
        individualVideosCount: individualVideos.length,
      });

      if (useIndividualVideos && individualVideos[segmentIndex]) {
        // Use individual video for this segment
        const individualVideo = individualVideos[segmentIndex];
        const individualVideoUrl = individualVideo.streamingUrl || individualVideo.url;
        
        console.log(`🎬 SIMPLE PLAYER: Switching to individual video ${segmentIndex}:`, individualVideoUrl);
        
        if (currentVideoUrl !== individualVideoUrl) {
          // Need to switch video source
          console.log(`🎬 SIMPLE PLAYER: Loading new video source`);
          setCurrentVideoUrl(individualVideoUrl || '');
          
          // Wait a bit for the video to load the new source
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (videoRef.current) {
          // For individual videos, start from beginning
          console.log(`🎬 SIMPLE PLAYER: Playing individual video from start`);
          await videoRef.current.setPositionAsync(0);
          await videoRef.current.playAsync();
        }
        
      } else {
        // Fall back to merged video with seeking
        console.log(`🎬 SIMPLE PLAYER: Using merged video with seeking`);
        
        const mergedVideoUrl = mergedVideo.streamingUrl || mergedVideo.url;
        if (currentVideoUrl !== mergedVideoUrl) {
          console.log(`🎬 SIMPLE PLAYER: Loading merged video source`);
          setCurrentVideoUrl(mergedVideoUrl || '');
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (videoRef.current) {
          // Get current status
          const status = await videoRef.current.getStatusAsync();
          console.log(`🎬 SIMPLE PLAYER: Current video status before seek:`, status);
          
          // Seek to segment start time
          console.log(`🎬 SIMPLE PLAYER: Seeking to position ${segment.startTime}ms`);
          await videoRef.current.setPositionAsync(segment.startTime);
          
          // Play the video
          console.log(`🎬 SIMPLE PLAYER: Starting playback`);
          await videoRef.current.playAsync();
          
          // Get status after play
          const newStatus = await videoRef.current.getStatusAsync();
          console.log(`🎬 SIMPLE PLAYER: Video status after play:`, newStatus);
        } else {
          console.error('🎬 SIMPLE PLAYER: Video ref is null');
        }
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

  const videoUrl = currentVideoUrl || mergedVideo.streamingUrl || mergedVideo.url;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Video Player Test</Text>
      
      {/* Debug Info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>Video URL: {videoUrl?.substring(0, 80)}...</Text>
        <Text style={styles.debugText}>Segments: {segments.length}</Text>
        <Text style={styles.debugText}>Individual Videos: {individualVideos.length}</Text>
        <Text style={styles.debugText}>Use Individual: {useIndividualVideos ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Status: {videoStatus}</Text>
        {errorMessage ? (
          <Text style={styles.errorText}>Error: {errorMessage}</Text>
        ) : null}
      </View>

      {/* Video Player - Visible for debugging */}
      <Video
        key={currentVideoUrl} // Add unique key based on current video URL
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
            onPress={() => {
              console.log(`🎬 SIMPLE PLAYER: Button ${index} pressed for segment`, segments[index]);
              playSegment(index);
            }}
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
