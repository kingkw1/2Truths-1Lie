/**
 * Fullscreen Video Player for Snapchat-Style Interface
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
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');
  const [hasReachedSegmentEnd, setHasReachedSegmentEnd] = useState(false);

  // Determine video source and type
  const hasMergedVideo = !!mergedVideo && segments.length > 0;
  const hasIndividualVideos = individualVideos.length >= 3;

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

  // Handle video playback status updates
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setCurrentPosition(status.positionMillis || 0);
      setVideoDuration(status.durationMillis || 0);

      // For merged video: pause when we reach the end of the current segment
      if (hasMergedVideo && segments.length > 0 && selectedSegment !== undefined && selectedSegment !== null) {
        const currentSegment = segments[selectedSegment];
        if (currentSegment && status.positionMillis && status.positionMillis >= currentSegment.endTime) {
          // Only pause and log once per segment
          if (!hasReachedSegmentEnd) {
            setHasReachedSegmentEnd(true);
            videoRef.current?.pauseAsync();
            console.log(`🎬 FULLSCREEN_PLAYER: Reached end of segment ${selectedSegment}, pausing`);
          }
        }
      }
    } else {
      setIsLoading(false);
      if ('error' in status && status.error) {
        console.error('Video playback error:', status.error);
      }
    }
  }, [hasMergedVideo, segments, selectedSegment, hasReachedSegmentEnd]);

  // Load and play merged video segment
  const loadMergedVideoSegment = useCallback(async (segmentIndex: number) => {
    if (!hasMergedVideo || !videoRef.current || segmentIndex >= segments.length) return;

    const segment = segments[segmentIndex];
    const videoUrl = mergedVideo!.streamingUrl;

    if (!videoUrl) {
      console.error('No video URL available for merged video');
      return;
    }

    try {
      setIsLoading(true);

      // Load video if not already loaded or different URL
      if (currentVideoUrl !== videoUrl) {
        await videoRef.current.loadAsync(
          { uri: videoUrl },
          { shouldPlay: false, positionMillis: segment.startTime },
          false
        );
        setCurrentVideoUrl(videoUrl);
      }

      // Seek to segment start and play
      await videoRef.current.setPositionAsync(segment.startTime);
      if (autoPlay) {
        await videoRef.current.playAsync();
      }

      console.log(`🎬 FULLSCREEN_PLAYER: Loaded segment ${segmentIndex} (${segment.startTime}ms - ${segment.endTime}ms)`);

    } catch (error) {
      console.error('Error loading merged video segment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasMergedVideo, mergedVideo, segments, currentVideoUrl, autoPlay]);

  // Load and play individual video
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

  // Effect to load video when selectedSegment changes
  const lastSelectedSegment = useRef<number | null>(null);
  
  useEffect(() => {
    if (selectedSegment !== undefined && selectedSegment !== null) {
      // Prevent rapid consecutive calls for the same segment
      if (lastSelectedSegment.current === selectedSegment) {
        console.log(`🎬 FULLSCREEN_PLAYER: Segment ${selectedSegment} already selected, skipping`);
        return;
      }
      
      lastSelectedSegment.current = selectedSegment;
      // Reset the segment end flag when loading a new segment
      setHasReachedSegmentEnd(false);
      console.log(`🎬 FULLSCREEN_PLAYER: Loading segment ${selectedSegment}`);
      
      if (hasMergedVideo) {
        loadMergedVideoSegment(selectedSegment);
      } else if (hasIndividualVideos) {
        loadIndividualVideo(selectedSegment);
      }
    }
  }, [selectedSegment, hasMergedVideo, hasIndividualVideos, loadMergedVideoSegment, loadIndividualVideo]);

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
        resizeMode={ResizeMode.COVER}
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

      {/* Current Statement Indicator (bottom of screen) */}
      {selectedSegment !== undefined && selectedSegment !== null && (
        <View style={styles.statementIndicator}>
          <Text style={styles.statementIndicatorText}>
            Statement {selectedSegment + 1}
          </Text>
        </View>
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
  statementIndicator: {
    position: 'absolute',
    bottom: 120, // Above the statement selector buttons
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statementIndicatorText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  noVideoText: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
  },
});

export default FullscreenVideoPlayer;
