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
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
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

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    if (status.didJustFinish && status.positionMillis !== undefined) {
      console.log('🎯 Video finished naturally at position:', status.positionMillis);
      setIsPlaying(false);
    }
    
    if (status.positionMillis !== undefined) {
      setCurrentPosition(status.positionMillis);
    }
    
    if (status.durationMillis !== undefined) {
      setVideoDuration(status.durationMillis);
    }
  }, []);

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

  

  const playSegment = useCallback(async (segmentIndex: number, seekMethod: 'setPosition' | 'playFromPosition' | 'fastForward' = 'setPosition') => {
    const callId = Math.random().toString(36).substring(7);
    console.log(`🎯 CALL_DEBUG [${callId}]: playSegment called with segmentIndex: ${segmentIndex}, seekMethod: ${seekMethod}`);
    
    if (!videoRef.current || !mergedVideo?.streamingUrl) {
      console.log(`🎯 CALL_DEBUG [${callId}]: Cannot play segment - videoRef: ${!!videoRef.current}, mergedVideo: ${!!mergedVideo?.streamingUrl}`);
      return;
    }

    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      console.log(`🎯 CALL_DEBUG [${callId}]: Invalid segment index: ${segmentIndex}, segments length: ${segments.length}`);
      return;
    }

    const segment = segments[segmentIndex];
    const startTimeMs = segment.startTime;
    const endTimeMs = segment.endTime;
    const durationMs = endTimeMs - startTimeMs;

    console.log(`🎯 CALL_DEBUG [${callId}]: Playing segment ${segmentIndex} from ${startTimeMs}ms to ${endTimeMs}ms (duration: ${durationMs}ms)`);

    try {
      // Load video if not loaded
      if (currentVideoUrl !== mergedVideo.streamingUrl) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Loading new video: ${mergedVideo.streamingUrl}`);
        setCurrentVideoUrl(mergedVideo.streamingUrl);
        setIsLoading(true);
        await videoRef.current.loadAsync({ uri: mergedVideo.streamingUrl }, { shouldPlay: false });
        setIsLoading(false);
        console.log(`🎯 CALL_DEBUG [${callId}]: Video loaded successfully`);
      }

      // Get current status to check if video is ready
      const initialStatus = await videoRef.current.getStatusAsync();
      if (!initialStatus.isLoaded) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Video not loaded, cannot seek`);
        return;
      }

      console.log(`🎯 CALL_DEBUG [${callId}]: Initial position: ${initialStatus.positionMillis}ms, seeking to: ${startTimeMs}ms`);
      
      // Check video duration vs expected segment times
      if (initialStatus.durationMillis) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Actual video duration: ${initialStatus.durationMillis}ms`);
        console.log(`🎯 CALL_DEBUG [${callId}]: Expected segment end: ${endTimeMs}ms`);
        
        if (endTimeMs > initialStatus.durationMillis) {
          console.log(`🎯 CALL_DEBUG [${callId}]: ⚠️  WARNING: Segment end (${endTimeMs}ms) exceeds actual video duration (${initialStatus.durationMillis}ms)`);
          console.log(`🎯 CALL_DEBUG [${callId}]: This suggests the segment data doesn't match the actual merged video`);
        }
      }

      // Clear any existing timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      // Use precise setPositionAsync 
      console.log(`🎯 CALL_DEBUG [${callId}]: Using setPositionAsync method`);
      await videoRef.current.setPositionAsync(startTimeMs);
      await videoRef.current.playAsync();
      setIsPlaying(true);

      // Set timeout to stop at end time, but adjust if segment exceeds video duration
      let timeoutDuration = durationMs;
      if (initialStatus.durationMillis && endTimeMs > initialStatus.durationMillis) {
        // Adjust timeout to actual remaining video duration
        const remainingDuration = initialStatus.durationMillis - startTimeMs;
        timeoutDuration = Math.max(remainingDuration, 100); // At least 100ms
        console.log(`🎯 CALL_DEBUG [${callId}]: Adjusted timeout from ${durationMs}ms to ${timeoutDuration}ms due to video duration limit`);
      }
      
      console.log(`🎯 CALL_DEBUG [${callId}]: Setting timeout for ${timeoutDuration}ms to stop segment`);
      timeoutIdRef.current = setTimeout(async () => {
        console.log(`🎯 CALL_DEBUG [${callId}]: Timeout reached, stopping segment playback`);
        
        try {
          if (videoRef.current) {
            const currentStatus = await videoRef.current.getStatusAsync();
            if (currentStatus.isLoaded) {
              console.log(`🎯 CALL_DEBUG [${callId}]: Final position when stopping: ${currentStatus.positionMillis}ms (target was ${endTimeMs}ms)`);
            }
            await videoRef.current.pauseAsync();
            setIsPlaying(false);
          }
        } catch (error) {
          console.log(`🎯 CALL_DEBUG [${callId}]: Error stopping playback:`, error);
        }
      }, timeoutDuration);

    } catch (error) {
      console.log(`🎯 CALL_DEBUG [${callId}]: Error in playSegment:`, error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [segments, mergedVideo, currentVideoUrl]);

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
      playSegment(selectedSegment);
    } else if (hasIndividualVideos) {
      loadIndividualVideo(selectedSegment);
    }
  }, [selectedSegment, hasMergedVideo, hasIndividualVideos, segments, playSegment, loadIndividualVideo]);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);



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