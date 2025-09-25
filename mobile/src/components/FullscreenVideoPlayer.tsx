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
      
      // Convert startTime from milliseconds to seconds for setPositionAsync
      const startTimeSeconds = segment.startTime / 1000;
      console.log(`🎯 CALL_DEBUG [${callId}]: Seeking to ${startTimeSeconds}s (${segment.startTime}ms)`);
      
      // Try different approach: pause first, then seek
      await videoRef.current.pauseAsync();
      console.log(`🎯 CALL_DEBUG [${callId}]: Video paused`);
      
      // Try seeking multiple times with different approaches
      let seekAttempts = 0;
      let seekSuccessful = false;
      
      while (seekAttempts < 3 && !seekSuccessful) {
        seekAttempts++;
        console.log(`🎯 CALL_DEBUG [${callId}]: Seek attempt ${seekAttempts}`);
        
        try {
          if (seekAttempts === 1) {
            // First attempt: basic seek
            await videoRef.current.setPositionAsync(startTimeSeconds);
          } else if (seekAttempts === 2) {
            // Second attempt: with tolerance
            await videoRef.current.setPositionAsync(startTimeSeconds, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
          } else {
            // Third attempt: unload and reload, then seek
            await videoRef.current.unloadAsync();
            await new Promise(resolve => setTimeout(resolve, 100));
            await videoRef.current.loadAsync({ uri: mergedVideo.streamingUrl }, { shouldPlay: false });
            await new Promise(resolve => setTimeout(resolve, 200));
            await videoRef.current.setPositionAsync(startTimeSeconds);
          }
          
          // Wait for seek to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verify position
          const status = await videoRef.current.getStatusAsync();
          if (status.isLoaded) {
            const actualPositionMs = status.positionMillis || 0;
            const expectedPositionMs = segment.startTime;
            const positionDiff = Math.abs(actualPositionMs - expectedPositionMs);
            
            console.log(`🎯 CALL_DEBUG [${callId}]: Attempt ${seekAttempts} - Expected ${expectedPositionMs}ms, got ${actualPositionMs}ms, diff: ${positionDiff}ms`);
            
            if (positionDiff <= 100) {
              seekSuccessful = true;
              break;
            }
          }
        } catch (seekError) {
          console.error(`🎯 CALL_DEBUG [${callId}]: Seek attempt ${seekAttempts} failed:`, seekError);
        }
      }
      
      if (!seekSuccessful) {
        console.error(`🎯 CALL_DEBUG [${callId}]: All seek attempts failed! This indicates the merged video lacks proper keyframes for seeking.`);
        console.error(`🎯 BACKEND_ISSUE [${callId}]: The merged video was likely created with 'ffmpeg -c copy' which doesn't ensure seekable keyframes.`);
        // Continue with playback - the backend FFmpeg fix should resolve this for new videos
      }
      
      // Set up the timeout for the exact segment duration
      const segmentDurationMs = segment.endTime - segment.startTime;
      console.log(`🎯 CALL_DEBUG [${callId}]: Setting timeout for ${segmentDurationMs}ms`);
      
      timeoutIdRef.current = setTimeout(() => {
        console.log(`🎯 CALL_DEBUG [${callId}]: Timeout fired - pausing video`);
        videoRef.current?.pauseAsync();
      }, segmentDurationMs);
      
      // Start playback
      if (autoPlay) {
        console.log(`🎯 CALL_DEBUG [${callId}]: Starting playback`);
        await videoRef.current.playAsync();
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