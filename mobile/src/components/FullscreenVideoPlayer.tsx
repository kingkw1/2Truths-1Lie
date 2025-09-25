import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { VideoView, useVideoPlayer, VideoSource } from 'expo-video';
import { MediaCapture, VideoSegment } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FullscreenVideoPlayerProps {
  mergedVideo?: MediaCapture;
  segments?: VideoSegment[];
  individualVideos?: MediaCapture[];
  selectedSegment?: number;
  autoPlay?: boolean;
}

export const FullscreenVideoPlayer: React.FC<FullscreenVideoPlayerProps> = ({
  mergedVideo,
  segments = [],
  individualVideos = [],
  selectedSegment,
  autoPlay = false,
}) => {
  const videoRef = useRef<Video>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  const hasMergedVideo = !!mergedVideo && segments.length > 0;
  const hasIndividualVideos = individualVideos.length >= 3;

  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  useEffect(() => {
    if (isLoading) {
      fadeAnim.setValue(1);
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, fadeAnim]);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) console.error('[ERROR] Video playback error:', status.error);
      setIsLoading(false);
      return;
    }

    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);
    setCurrentPosition(status.positionMillis);
    setVideoDuration(status.durationMillis || 0);

    // Simplified status update - timing is now handled directly in playSegment
  }, []);

  const playSegment = useCallback(async (segment: VideoSegment) => {
    const callId = Math.random().toString(36).substr(2, 9);
    console.log(`🎯 CALL_DEBUG [${callId}]: playSegment called for segment ${segment.statementIndex}`);
    
    if (!videoRef.current || !mergedVideo?.streamingUrl) {
      console.log(`🎯 CALL_DEBUG [${callId}]: Cannot play segment - videoRef: ${!!videoRef.current}, mergedVideo: ${!!mergedVideo?.streamingUrl}`);
      return;
    }

    // Clear any existing timeout first
    if (timeoutIdRef.current) {
      console.log(`🎯 CALL_DEBUG [${callId}]: Clearing existing timeout`);
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    try {
      setIsLoading(true);
      
      // Ensure video is loaded
      if (currentVideoUrl !== mergedVideo.streamingUrl) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Loading video URL: ${mergedVideo.streamingUrl}`);
        await videoRef.current.loadAsync({ uri: mergedVideo.streamingUrl }, { shouldPlay: false });
        setCurrentVideoUrl(mergedVideo.streamingUrl);
        // Wait for video to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Get initial status
      const initialStatus = await videoRef.current.getStatusAsync();
      console.log(`🎯 CALL_DEBUG [${callId}]: Initial status - isLoaded: ${initialStatus.isLoaded}, position: ${initialStatus.isLoaded ? initialStatus.positionMillis : 'unknown'}ms`);
      
      if (!initialStatus.isLoaded) {
        console.error(`🎯 CALL_DEBUG [${callId}]: Video not loaded, cannot seek`);
        setIsLoading(false);
        return;
      }
      
      // Use playFromPositionAsync for atomic seek + play operation
      // This should be more reliable than separate setPositionAsync + playAsync calls
      
      // Ensure we have timing data in milliseconds
      const startTimeMillis = segment.startTime; // Already in milliseconds from our data
      const endTimeMillis = segment.endTime;     // Already in milliseconds from our data
      const durationToPlay = endTimeMillis - startTimeMillis;
      
      console.log(`🎯 CALL_DEBUG [${callId}]: Using playFromPositionAsync`);
      console.log(`🎯 CALL_DEBUG [${callId}]: Start: ${startTimeMillis}ms, End: ${endTimeMillis}ms, Duration: ${durationToPlay}ms`);
      
      // Set up the precise stop timer BEFORE starting playback
      console.log(`🎯 CALL_DEBUG [${callId}]: Setting precise stop timer for ${durationToPlay}ms`);
      timeoutIdRef.current = setTimeout(() => {
        console.log(`🎯 CALL_DEBUG [${callId}]: Precise stop timer fired - pausing video`);
        videoRef.current?.pauseAsync();
      }, durationToPlay);
      
      // Since both setPositionAsync and playFromPositionAsync fail with merged videos,
      // use a fast-forward approach to reach the target position
      if (autoPlay) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Attempting fast-forward approach to ${startTimeMillis}ms`);
        
        try {
          if (startTimeMillis === 0) {
            // For first segment, just play from beginning
            console.log(`🎯 CALL_DEBUG [${callId}]: Playing from beginning (segment 0)`);
            await videoRef.current.setPositionAsync(0);
            await videoRef.current.playAsync();
          } else {
            // For other segments, use fast-forward approach
            console.log(`🎯 CALL_DEBUG [${callId}]: Fast-forwarding to segment start`);
            
            // Start from beginning at high speed
            await videoRef.current.setPositionAsync(0);
            await videoRef.current.setRateAsync(8.0, true); // 8x speed, preserve pitch
            await videoRef.current.playAsync();
            
            // Calculate fast-forward duration (time to reach target position at 8x speed)
            const fastForwardDuration = startTimeMillis / 8;
            
            console.log(`🎯 CALL_DEBUG [${callId}]: Fast-forwarding for ${fastForwardDuration}ms to reach ${startTimeMillis}ms`);
            
            // Wait for fast-forward to complete
            setTimeout(async () => {
              try {
                // Set back to normal speed
                if (videoRef.current) {
                  await videoRef.current.setRateAsync(1.0, true);
                  console.log(`🎯 CALL_DEBUG [${callId}]: Reached target position, playing at normal speed`);
                }
              } catch (rateError) {
                console.error(`🎯 CALL_DEBUG [${callId}]: Failed to set normal playback rate:`, rateError);
              }
            }, fastForwardDuration);
          }
          
          console.log(`🎯 CALL_DEBUG [${callId}]: Fast-forward approach initiated successfully`);
        } catch (error) {
          console.error(`🎯 CALL_DEBUG [${callId}]: Fast-forward approach failed:`, error);
          // Ultimate fallback: just play from current position
          try {
            await videoRef.current.playAsync();
          } catch (fallbackError) {
            console.error(`🎯 CALL_DEBUG [${callId}]: Even basic playAsync failed:`, fallbackError);
          }
        }
      } else {
        // If not auto-playing, try basic seek (even though it likely won't work)
        const startTimeSeconds = startTimeMillis / 1000;
        console.log(`🎯 CALL_DEBUG [${callId}]: Auto-play disabled, attempting basic seek to ${startTimeSeconds}s`);
        try {
          await videoRef.current.setPositionAsync(startTimeSeconds);
        } catch (error) {
          console.error(`🎯 CALL_DEBUG [${callId}]: Basic seek failed:`, error);
        }
      }
      
      setIsLoading(false);
      console.log(`🎯 CALL_DEBUG [${callId}]: playSegment completed successfully`);
    } catch (error) {
      console.error(`🎯 CALL_DEBUG [${callId}]: Error during segment playback:`, error);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      setIsLoading(false);
    }
  }, [mergedVideo, currentVideoUrl, autoPlay]);

  const loadIndividualVideo = useCallback(async (videoIndex: number) => {
    if (!hasIndividualVideos || !videoRef.current || videoIndex >= individualVideos.length) return;

    const video = individualVideos[videoIndex];
    const videoUrl = video.streamingUrl || video.url || '';

    if (!videoUrl) {
      console.error('No video URL available for video index:', videoIndex);
      return;
    }

    try {
      setIsLoading(true);
      if (currentVideoUrl !== videoUrl) {
        await videoRef.current.loadAsync(
          { uri: videoUrl },
          { shouldPlay: autoPlay, positionMillis: 0 },
          false
        );
        setCurrentVideoUrl(videoUrl);
      } else {
        await videoRef.current.setPositionAsync(0);
        if (autoPlay) await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error loading individual video:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasIndividualVideos, individualVideos, currentVideoUrl, autoPlay]);

  useEffect(() => {
    if (selectedSegment === undefined || selectedSegment === null) return;

    if (hasMergedVideo && segments[selectedSegment]) {
      playSegment(segments[selectedSegment]);
    } else if (hasIndividualVideos) {
      loadIndividualVideo(selectedSegment);
    }
  }, [selectedSegment, hasMergedVideo, hasIndividualVideos, segments, playSegment, loadIndividualVideo]);

  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [isPlaying]);

  const handleScreenTouch = useCallback(() => setShowControls(true), []);

  if (!hasMergedVideo && !hasIndividualVideos) {
    return (
      <View style={styles.container}>
        <Text style={styles.noVideoText}>No video available</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1}
      onPress={handleScreenTouch}
    >
      <Video
        ref={videoRef}
        style={styles.video}
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
      {isLoading && (
        <Animated.View style={[styles.loadingOverlay, { opacity: fadeAnim }]}>
          <ActivityIndicator size="large" color="#ffffff" />
        </Animated.View>
      )}
      {showControls && !isLoading && (
        <TouchableOpacity
          style={styles.playPauseButton}
          onPress={togglePlayPause}
          activeOpacity={0.8}
        >
          <Text style={styles.playPauseIcon}>
            {isPlaying ? '⏸️' : '▶️'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: screenHeight,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseIcon: {
    fontSize: 32,
  },
  noVideoText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default FullscreenVideoPlayer;