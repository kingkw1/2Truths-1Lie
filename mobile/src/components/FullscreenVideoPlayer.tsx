/**
 * Fullscreen Video Player for Modern Fullscreen Interface
 * 
 * Features:
 * - True fullscreen video display with no borders/padding
 * - Minimal controls hidden by default
 * - Optimized for immersive viewing experience
 * - Supports both merged videos with segments and individual videos
 * - Touch-friendly interaction for mobile use
 */

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

// Latency compensation: pause slightly early to account for command delay.
const PAUSE_BUFFER_MS = 100;

// Helper to convert seconds (potentially float) to integer milliseconds
const toMillis = (seconds: number) => {
  // Heuristic to handle potentially mixed data types (some in seconds, some in ms).
  // If a value is small (e.g., < 1000), it's likely seconds. Otherwise, it's already ms.
  if (seconds > 1000) {
    return Math.round(seconds); // Assume it's already in milliseconds
  }
  return Math.round(seconds * 1000); // Assume it's in seconds
};

// New interface for consistent timing data
interface NormalizedSegment {
  startTimeMillis: number;
  endTimeMillis: number;
  original: VideoSegment;
}

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
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null); // For precise pausing
  const pendingSegmentRef = useRef<NormalizedSegment | null>(null); // Holds the segment intended for playback
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // State for UI and playback control
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0); // For progress bar, etc.
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  // Normalized segments with guaranteed integer millisecond timings
  const [normalizedSegments, setNormalizedSegments] = useState<NormalizedSegment[]>([]);

  // Determine video source and type
  const hasMergedVideo = !!mergedVideo && segments.length > 0;
  const hasIndividualVideos = individualVideos.length >= 3;

  // Step 1: Normalize segment timings when props change
  useEffect(() => {
    console.log('[DEBUG] Raw segments received:', JSON.stringify(segments, null, 2));
    const normalized = segments.map(seg => ({
      startTimeMillis: toMillis(seg.startTime),
      endTimeMillis: toMillis(seg.endTime),
      original: seg,
    }));
    setNormalizedSegments(normalized);
    console.log('[DEBUG] Normalized segments set:', JSON.stringify(normalized, null, 2));
  }, [segments]);

  // Hide controls after 3 seconds of inactivity
  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  // Auto-hide loading indicator with fade animation
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

  // Step 3: Implement Synchronized Timer in onPlaybackStatusUpdate
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoading(false);
      if (status.error) {
        console.error('[ERROR] Video playback error:', status.error);
      }
      return;
    }

    // Update UI state
    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);
    setCurrentPosition(status.positionMillis);
    setVideoDuration(status.durationMillis || 0);

    const pendingSegment = pendingSegmentRef.current;

    // Synchronize and schedule the timer ONLY when playback has actually started
    if (pendingSegment && status.isPlaying) {
      // Calculate remaining time from the CURRENT position and apply the buffer.
      const remainingDuration = pendingSegment.endTimeMillis - status.positionMillis;
      const timerDuration = remainingDuration - PAUSE_BUFFER_MS;

      console.log(`[DEBUG] Sync: Playback started. Pos: ${status.positionMillis}. Remaining: ${remainingDuration}ms. Scheduling pause in ${timerDuration}ms (w/ ${PAUSE_BUFFER_MS}ms buffer).`);

      if (timerDuration > 0) {
        timeoutIdRef.current = setTimeout(() => {
          const video = videoRef.current;
          if (video) {
            console.log(`[DEBUG] setTimeout fired: Pausing and seeking to end: ${pendingSegment.endTimeMillis}ms.`);
            video.pauseAsync();
            video.setPositionAsync(pendingSegment.endTimeMillis); // Corrective seek
          }
        }, timerDuration);
      } else {
        // If we're already past the buffer time, pause and seek immediately.
        const video = videoRef.current;
        if (video) {
          video.pauseAsync();
          video.setPositionAsync(pendingSegment.endTimeMillis);
        }
      }

      // Clear the pending segment ref to ensure this logic only runs once per play intent.
      pendingSegmentRef.current = null;
    }

    // Continuous logging for debugging
    // console.log(`[STATUS] pos=${status.positionMillis}ms, playing=${status.isPlaying}, buffering=${status.isBuffering}`);
  }, []); // No dependencies needed, relies on refs and status

  // Step 2: Modify playSegment to Signal Intent
  const playSegment = useCallback(async (segment: NormalizedSegment) => {
    if (!videoRef.current || !mergedVideo?.streamingUrl) {
      console.log('[DEBUG] playSegment aborted: Video ref or URL not ready.');
      return;
    }
    console.log(`[DEBUG] playSegment INTENT for:`, segment);

    // Clear any pending timer and set the new segment as the playback goal
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    pendingSegmentRef.current = segment;

    try {
      setIsLoading(true);

      // Load the video if it's not the current one
      if (currentVideoUrl !== mergedVideo.streamingUrl) {
        console.log(`[DEBUG] Loading new video source: ${mergedVideo.streamingUrl}`);
        await videoRef.current.loadAsync({ uri: mergedVideo.streamingUrl }, { shouldPlay: false });
        setCurrentVideoUrl(mergedVideo.streamingUrl);
      }
      
      // Seek to the precise start time and request playback
      console.log(`[DEBUG] Seeking to: ${segment.startTimeMillis}ms and requesting play.`);
      await videoRef.current.setPositionAsync(segment.startTimeMillis);
      if (autoPlay) {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('[ERROR] Error during segment playback initiation:', error);
      pendingSegmentRef.current = null; // Clear intent on error
      setIsLoading(false); // Ensure loading state is reset on error
    }
    // Note: We don't set isLoading(false) in a finally block here,
    // because we want the loading indicator to persist until playback truly starts,
    // which is handled by the onPlaybackStatusUpdate callback.
  }, [mergedVideo, currentVideoUrl, autoPlay]);

  // Load and play individual video (no change needed for this part)
  const loadIndividualVideo = useCallback(async (videoIndex: number) => {
    if (!hasIndividualVideos || !videoRef.current || videoIndex >= individualVideos.length) return;

    const video = individualVideos[videoIndex];
    console.log('🎬 FULLSCREEN_PLAYER: loadIndividualVideo - Raw video object:', JSON.stringify(video, null, 2));
    
    const videoUrl = video.streamingUrl || video.url || '';
    console.log('🎬 FULLSCREEN_PLAYER: loadIndividualVideo - Final videoUrl:', videoUrl);

    if (!videoUrl) {
      console.error('No video URL available for video index:', videoIndex);
      return;
    }

    try {
      setIsLoading(true);

      // Load video if not already loaded or different URL  
      if (currentVideoUrl !== videoUrl) {
        await videoRef.current.loadAsync(
          { uri: videoUrl },
          { shouldPlay: autoPlay, positionMillis: 0 },
          false
        );
        setCurrentVideoUrl(videoUrl);
      } else {
        // Same video, just restart
        await videoRef.current.setPositionAsync(0);
        if (autoPlay) {
          await videoRef.current.playAsync();
        }
      }

    } catch (error) {
      console.error('Error loading individual video:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasIndividualVideos, individualVideos, currentVideoUrl, autoPlay]);

  // Effect to trigger playback when selectedSegment changes
  useEffect(() => {
    if (selectedSegment === undefined || selectedSegment === null) return;

    if (hasMergedVideo && normalizedSegments[selectedSegment]) {
      const segmentToPlay = normalizedSegments[selectedSegment];
      playSegment(segmentToPlay);
    } else if (hasIndividualVideos) {
      loadIndividualVideo(selectedSegment);
    }
  }, [selectedSegment, hasMergedVideo, hasIndividualVideos, normalizedSegments, playSegment, loadIndividualVideo]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [isPlaying]);

  // Handle screen touch to show/hide controls
  const handleScreenTouch = useCallback(() => {
    setShowControls(true);
  }, []);

  // Early return if no video sources available
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
      {/* Fullscreen Video */}
      <Video
        ref={videoRef}
        style={styles.video}
        useNativeControls={false}
        resizeMode={ResizeMode.COVER} // Use COVER for fullscreen experience
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      {/* Loading Indicator */}
      {isLoading && (
        <Animated.View style={[styles.loadingOverlay, { opacity: fadeAnim }]}>
          <ActivityIndicator size="large" color="#ffffff" />
        </Animated.View>
      )}

      {/* Minimal Play/Pause Control (only shown when controls are visible) */}
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
