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
  const pendingSegmentRef = useRef<VideoSegment | null>(null);
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

    const segmentToPlay = pendingSegmentRef.current;

    // A segment is pending and the video has just started playing.
    if (segmentToPlay && status.isPlaying && !status.isBuffering) {
      const remainingDuration = segmentToPlay.endTime - status.positionMillis;

      // Clear any existing timer, just in case.
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // PHASE 2: Simple timeout-based timing - trust the accurate backend segment metadata
      console.log(`🎯 SIMPLE_TIMING: Segment (${segmentToPlay.startTime}-${segmentToPlay.endTime}ms) - scheduling pause in ${remainingDuration}ms`);
      console.log(`🎯 SIMPLE_TIMING: Current position: ${status.positionMillis}ms, Segment end: ${segmentToPlay.endTime}ms`);
      
      timeoutIdRef.current = setTimeout(() => {
        console.log(`🎯 SIMPLE_TIMING: Pausing at segment boundary`);
        videoRef.current?.pauseAsync();
      }, remainingDuration > 0 ? remainingDuration : 0);

      // IMPORTANT: Clear the intent so this only runs once per playback.
      pendingSegmentRef.current = null;
    }
  }, []);

  const playSegment = useCallback(async (segment: VideoSegment) => {
    if (!videoRef.current || !mergedVideo?.streamingUrl) return;

    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

    pendingSegmentRef.current = segment;

    try {
      setIsLoading(true);
      if (currentVideoUrl !== mergedVideo.streamingUrl) {
        await videoRef.current.loadAsync({ uri: mergedVideo.streamingUrl }, { shouldPlay: false });
        setCurrentVideoUrl(mergedVideo.streamingUrl);
      }
      
      await videoRef.current.setPositionAsync(segment.startTime);
      if (autoPlay) {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('[ERROR] Error during segment playback initiation:', error);
      pendingSegmentRef.current = null;
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