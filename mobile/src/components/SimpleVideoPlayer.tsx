/**
 * Simple Video Player Component - Minimal implementation for testing
 * Uses expo-av with basic functionality to test video loading
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
  const [detectedVideoLength, setDetectedVideoLength] = useState<number | null>(null); // Track actual video duration
  const [forcedIndividualMode, setForcedIndividualMode] = useState(false); // Force individual mode when duration mismatch detected

  // Extract segments from merged video
  const segments: VideoSegment[] = mergedVideo.segments || [];
  
  // Determine if we should use individual videos (when available and segments match)
  // Check if individual videos are actually different by looking at mediaId or core URL
  const hasUniqueIndividualVideos = individualVideos.length === segments.length && 
    individualVideos.length > 1 && 
    (() => {
      // Extract media IDs or core URLs (without AWS signature parameters)
      const mediaIdentifiers = individualVideos.map(v => {
        const url = v.streamingUrl || v.url || '';
        // Extract media ID from AWS URL or use the full URL for local files
        const mediaIdMatch = url.match(/\/([a-f0-9-]{36})\?/);
        return mediaIdMatch ? mediaIdMatch[1] : (v.mediaId || url);
      });
      const uniqueCount = new Set(mediaIdentifiers).size;
      
      // Only log if we find unique videos (the success case)
      if (uniqueCount > 1) {
        console.log(`🎬 STRATEGY: Found ${uniqueCount} unique individual videos`);
      }
      return uniqueCount > 1;
    })();
  
  // Force individual video strategy if merged video appears to be incomplete
  // (This happens when fallback merge only copied the first video)
  const expectedTotalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);
  const mergedVideoDuration = mergedVideo.duration || 0;
  const durationMismatch = Math.abs(expectedTotalDuration - mergedVideoDuration) > 500; // 500ms tolerance
  
  // Also check if detected video length differs from expected (runtime detection)
  const runtimeDurationMismatch = detectedVideoLength !== null && 
    Math.abs(expectedTotalDuration - detectedVideoLength) > 500;
  
  const shouldUseIndividualVideos = hasUniqueIndividualVideos || 
    (individualVideos.length === segments.length && durationMismatch) ||
    forcedIndividualMode ||
    runtimeDurationMismatch;
  
  const useIndividualVideos = shouldUseIndividualVideos;
  
  // Minimal logging for debugging
  if (runtimeDurationMismatch) {
    console.log(`⚠️ DURATION MISMATCH: Expected ${expectedTotalDuration}ms, detected ${detectedVideoLength}ms - using individual mode`);
  }

  // Video status update handler
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoStatus('loaded');
      setIsPlaying(status.isPlaying);
      setErrorMessage('');
      
      // Track the detected video duration
      if (status.durationMillis && detectedVideoLength !== status.durationMillis) {
        setDetectedVideoLength(status.durationMillis);
        
        // Check if video duration doesn't match expected duration and we're not already in individual mode
        if (!useIndividualVideos && Math.abs(status.durationMillis - expectedTotalDuration) > 500) {
          console.warn(`⚠️ RUNTIME MISMATCH: Video ${status.durationMillis}ms vs Expected ${expectedTotalDuration}ms`);
          setForcedIndividualMode(true);
        }
      }
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
    console.log(`� SEGMENT_PLAY: Starting playback for segment ${segmentIndex}`);
    
    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      console.error('🎯 SEGMENT_PLAY: Invalid segment index:', segmentIndex);
      return;
    }

    const segment = segments[segmentIndex];
    setIsLoading(true);
    setSelectedSegment(segmentIndex);

    try {
      console.log(`� SEGMENT_PLAY: Segment ${segmentIndex} config:`, {
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration: segment.duration,
        useIndividualVideos,
      });

      if (useIndividualVideos && individualVideos[segmentIndex]) {
        // Use individual video for this segment
        const individualVideo = individualVideos[segmentIndex];
        const individualVideoUrl = individualVideo.streamingUrl || individualVideo.url;
        
        console.log(`� SEGMENT_PLAY: Using individual video ${segmentIndex}: ${individualVideoUrl}`);
        
        if (currentVideoUrl !== individualVideoUrl) {
          // Need to switch video source
          console.log(`� SEGMENT_PLAY: Switching video source`);
          setCurrentVideoUrl(individualVideoUrl || '');
          
          // Wait a bit for the video to load the new source
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (videoRef.current) {
          // Check if all individual videos point to the same merged file
          const isSameMergedFile = (() => {
            const mergedUrl = mergedVideo.streamingUrl || mergedVideo.url || '';
            const individualUrl = individualVideoUrl || '';
            // Extract file IDs from URLs to compare
            const mergedFileId = mergedUrl.match(/\/([a-f0-9-]{36})\?/)?.[1];
            const individualFileId = individualUrl.match(/\/([a-f0-9-]{36})\?/)?.[1];
            return mergedFileId && mergedFileId === individualFileId;
          })();
          
          if (isSameMergedFile) {
            // All individual videos point to the same merged file - seek to segment position
            console.log(`� SEGMENT_PLAY: Individual videos point to merged file - seeking to ${segment.startTime}ms`);
            
            // Check if we can actually seek to this position
            const currentStatus = await videoRef.current.getStatusAsync();
            const actualDuration = currentStatus.isLoaded ? currentStatus.durationMillis || 0 : 0;
            
            // console.log(`🎯 SEGMENT_PLAY: Video status - duration: ${actualDuration}ms, seeking to: ${segment.startTime}ms`);
            
            if (actualDuration > 0 && segment.startTime >= actualDuration) {
              console.error(`� SEGMENT_PLAY: ❌ CANNOT SEEK - position ${segment.startTime}ms exceeds video duration ${actualDuration}ms`);
              setErrorMessage(`Segment ${segmentIndex + 1} is not available - seek position beyond video duration`);
              Alert.alert(
                'Segment Unavailable', 
                `Cannot play segment ${segmentIndex + 1}. The video file seems incomplete.`
              );
              return;
            }
            
            await videoRef.current.setPositionAsync(segment.startTime);
            // console.log(`🎯 SEGMENT_PLAY: ✅ Seeked to ${segment.startTime}ms for segment ${segmentIndex}`);
            await videoRef.current.playAsync();
          } else {
            // True individual videos - play from start
            console.log(`� SEGMENT_PLAY: Playing individual video from start`);
            await videoRef.current.setPositionAsync(0);
            await videoRef.current.playAsync();
          }
        }
        
      } else {
        // Fall back to merged video with seeking
        console.log(`� SEGMENT_PLAY: Using merged video strategy`);
        
        if (videoRef.current) {
          // Get current status
          const status = await videoRef.current.getStatusAsync();
          console.log(`� SEGMENT_PLAY: Video status:`, {
            isLoaded: status.isLoaded,
            currentPosition: status.isLoaded ? status.positionMillis : 'N/A',
            totalDuration: status.isLoaded ? status.durationMillis : 'N/A',
            seekingTo: segment.startTime,
          });
          
          // Ensure video is loaded before seeking
          if (!status.isLoaded) {
            console.log(`� SEGMENT_PLAY: Video not loaded, waiting for load...`);
            // Wait for video to load
            await new Promise(resolve => setTimeout(resolve, 1000));
            const newStatus = await videoRef.current!.getStatusAsync();
            if (!newStatus.isLoaded) {
              console.error(`🎬 SIMPLE PLAYER: Video still not loaded after waiting`);
              return;
            }
          }
          
          // Pause before seeking to ensure clean state
          await videoRef.current.pauseAsync();
          
          // Seek to segment start time
          console.log(`🎬 SIMPLE PLAYER: Seeking to position ${segment.startTime}ms (${segment.startTime/1000}s)`);
          await videoRef.current.setPositionAsync(segment.startTime);
          
          // Wait a moment for seek to complete
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify seek position
          const seekStatus = await videoRef.current.getStatusAsync();
          console.log(`🎬 SIMPLE PLAYER: Position after seek: ${seekStatus.isLoaded ? seekStatus.positionMillis : 'N/A'}ms`);
          
          // Play the video
          console.log(`🎬 SIMPLE PLAYER: Starting playback`);
          await videoRef.current.playAsync();
          
          // Get status after play
          const playStatus = await videoRef.current.getStatusAsync();
          console.log(`🎬 SIMPLE PLAYER: Video status after play:`, {
            isPlaying: playStatus.isLoaded ? playStatus.isPlaying : 'N/A',
            position: playStatus.isLoaded ? playStatus.positionMillis : 'N/A',
          });
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

  // For merged video strategy, always use merged video URL
  // For individual video strategy, use currentVideoUrl or fallback to first individual video
  const videoUrl = useIndividualVideos 
    ? (currentVideoUrl || individualVideos[0]?.streamingUrl || individualVideos[0]?.url)
    : (mergedVideo.streamingUrl || mergedVideo.url);

  // Create a stable key for video component to force reload when strategy changes
  const videoKey = useIndividualVideos 
    ? `individual-${selectedSegment}-${currentVideoUrl}`
    : `merged-${mergedVideo.streamingUrl || mergedVideo.url}-${expectedTotalDuration}`;

  // Add timestamp to force reload if duration issues persist
  const [reloadKey, setReloadKey] = useState(0);
  const finalVideoKey = `${videoKey}-${reloadKey}`;

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
        <Text style={styles.debugText}>Expected Duration: {expectedTotalDuration}ms</Text>
        <Text style={styles.debugText}>Video Key: {finalVideoKey?.substring(0, 30)}...</Text>
        {errorMessage ? (
          <Text style={styles.errorText}>Error: {errorMessage}</Text>
        ) : null}
        
        {/* Force reload button for debugging */}
        <TouchableOpacity
          style={{ backgroundColor: '#ff6b6b', padding: 8, borderRadius: 4, marginTop: 8 }}
          onPress={() => {
            console.log('🔄 SIMPLE PLAYER: Force reloading video component...');
            setReloadKey(prev => prev + 1);
          }}
        >
          <Text style={{ color: 'white', fontSize: 12 }}>Force Reload Video</Text>
        </TouchableOpacity>
      </View>

      {/* Video Player - Visible for debugging */}
      <Video
        key={finalVideoKey} // Use stable key based on strategy and video
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
              console.log(`� BUTTON_PRESS: Statement ${index + 1} button pressed`);
              console.log(`🎯 BUTTON_PRESS: Segment config:`, {
                segmentIndex: index,
                startTime: segments[index].startTime,
                endTime: segments[index].endTime,
                duration: segments[index].duration
              });
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
