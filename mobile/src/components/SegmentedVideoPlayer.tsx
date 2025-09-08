/**
 * Segmented Video Player Component
 * Handles merged videos with segment metadata for precise navigation
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
// Note: Using basic progress bar instead of slider for now
import { Video, AVPlaybackStatus, ResizeMode } from 'expo-av';
import { MediaCapture, VideoSegment } from '../types';
import { useErrorHandling } from '../hooks/useErrorHandling';
import { errorHandlingService } from '../services/errorHandlingService';
import PlaybackErrorHandler from './PlaybackErrorHandler';

interface SegmentedVideoPlayerProps {
  mergedVideo: MediaCapture; // Merged video with segment metadata
  segments: VideoSegment[]; // Segment metadata from server
  onSegmentSelect?: (segmentIndex: number) => void;
  statementTexts?: string[];
  autoPlay?: boolean;
}

export const SegmentedVideoPlayer: React.FC<SegmentedVideoPlayerProps> = ({
  mergedVideo,
  segments = [],
  onSegmentSelect,
  statementTexts = [],
  autoPlay = false,
}) => {
  const videoRef = useRef<Video>(null);
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>('not-loaded');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);

  // Enhanced error handling
  const {
    error: playbackError,
    isRetrying,
    retryCount,
    handleError,
    clearError,
    retry,
    canRetry,
  } = useErrorHandling(
    () => loadMergedVideo(),
    {
      showAlert: false, // We'll handle alerts in our custom component
      autoRetry: false, // Manual retry control
      maxRetries: 3,
      onError: (error) => {
        console.error('🎥 PLAYBACK_ERROR:', error);
        setVideoStatus('error');
      },
      onMaxRetriesReached: (error) => {
        console.error('🎥 PLAYBACK_MAX_RETRIES:', error);
        setErrorMessage('Maximum retry attempts reached. Please try reloading the video.');
      },
    }
  );

  // Load the merged video on component mount
  useEffect(() => {
    loadMergedVideo();
  }, [mergedVideo.streamingUrl]);

  const loadMergedVideo = async () => {
    if (!mergedVideo.streamingUrl) {
      const error = new Error('No video URL available');
      handleError(error, 'loadMergedVideo');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');
      clearError(); // Clear any previous errors
      console.log('🎬 SEGMENTED_PLAYER: Loading merged video:', mergedVideo.streamingUrl);

      if (videoRef.current) {
        await videoRef.current.loadAsync(
          { uri: mergedVideo.streamingUrl },
          { shouldPlay: autoPlay, positionMillis: 0 },
          false
        );
        setIsVideoLoaded(true);
        setVideoStatus('loaded');
      }
    } catch (error: any) {
      console.error('Error loading merged video:', error);
      handleError(error, 'loadMergedVideo');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setVideoStatus('loaded');
      setCurrentPosition(status.positionMillis || 0);
      setVideoDuration(status.durationMillis || 0);

      // Auto-detect which segment is currently playing
      if (status.positionMillis && segments.length > 0) {
        const currentSegmentIndex = segments.findIndex(segment => 
          status.positionMillis! >= segment.startTime && 
          status.positionMillis! <= segment.endTime
        );
        
        if (currentSegmentIndex !== -1 && currentSegmentIndex !== selectedSegment) {
          setSelectedSegment(currentSegmentIndex);
        }
      }
    } else {
      setVideoStatus('error');
      if ('error' in status && status.error) {
        console.error('Video playback error:', status.error);
        setErrorMessage(status.error);
      }
    }
  };

  const selectSegment = async (segmentIndex: number) => {
    console.log(`🎬 SEGMENTED_PLAYER: Selecting segment ${segmentIndex}`);
    
    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      console.error('Invalid segment index:', segmentIndex);
      return;
    }

    const segment = segments[segmentIndex];
    if (!segment) {
      console.error('No segment found for index:', segmentIndex);
      return;
    }

    try {
      setSelectedSegment(segmentIndex);
      
      if (videoRef.current && isVideoLoaded) {
        // Seek to the start of the selected segment
        await videoRef.current.setPositionAsync(segment.startTime);
        await videoRef.current.playAsync();
        
        console.log(`🎬 SEGMENTED_PLAYER: Seeking to segment ${segmentIndex} at ${segment.startTime}ms`);
      }

      // Notify parent component
      onSegmentSelect?.(segmentIndex);
    } catch (error: any) {
      console.error('Error selecting segment:', error);
      handleError(error, 'selectSegment');
    }
  };

  const togglePlayPause = async () => {
    try {
      if (videoRef.current && isVideoLoaded) {
        if (isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
      }
    } catch (error: any) {
      console.error('Error toggling playback:', error);
      handleError(error, 'togglePlayPause');
    }
  };

  const seekToPosition = async (positionMillis: number) => {
    try {
      if (videoRef.current && isVideoLoaded) {
        await videoRef.current.setPositionAsync(positionMillis);
      }
    } catch (error: any) {
      console.error('Error seeking:', error);
      handleError(error, 'seekToPosition');
    }
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentSegmentInfo = () => {
    if (selectedSegment !== null && segments[selectedSegment]) {
      return segments[selectedSegment];
    }
    return null;
  };

  // Early return if no merged video or segments
  if (!mergedVideo.streamingUrl || segments.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {!mergedVideo.streamingUrl ? 'No merged video available' : 'No segment data available'}
        </Text>
      </View>
    );
  }

  // Show playback error handler if there's an error
  if (playbackError) {
    return (
      <PlaybackErrorHandler
        error={playbackError}
        isRetrying={isRetrying}
        retryCount={retryCount}
        maxRetries={3}
        videoUrl={mergedVideo.streamingUrl}
        videoId={mergedVideo.mediaId}
        currentTime={currentPosition}
        duration={videoDuration}
        onRetry={canRetry ? retry : undefined}
        onReload={() => {
          clearError();
          loadMergedVideo();
        }}
        onSkip={() => {
          clearError();
          // Could implement skip functionality here
        }}
        onReportIssue={() => {
          console.log('Report issue for video:', mergedVideo.mediaId);
          // Could implement issue reporting here
        }}
      />
    );
  }

  const currentSegmentInfo = getCurrentSegmentInfo();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Merged Video Player</Text>
      <Text style={styles.description}>
        Navigate between segments or watch the full video
      </Text>

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
            <Text style={styles.loadingText}>Loading merged video...</Text>
          </View>
        )}

        {errorMessage && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Custom Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayPause}
            disabled={!isVideoLoaded || videoStatus !== 'loaded'}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(currentPosition)} / {formatTime(videoDuration)}
            </Text>
            {currentSegmentInfo && (
              <Text style={styles.segmentTimeText}>
                Segment: {formatTime(currentSegmentInfo.startTime)} - {formatTime(currentSegmentInfo.endTime)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      {videoDuration > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${(currentPosition / videoDuration) * 100}%` }
              ]} 
            />
            
            {/* Segment Markers */}
            {segments.map((segment, index) => {
              const leftPosition = (segment.startTime / videoDuration) * 100;
              const width = ((segment.endTime - segment.startTime) / videoDuration) * 100;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.segmentMarker,
                    {
                      left: `${leftPosition}%`,
                      width: `${width}%`,
                    },
                    selectedSegment === index && styles.selectedSegmentMarker,
                  ]}
                  onPress={() => selectSegment(index)}
                />
              );
            })}
          </View>
          
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>{formatTime(currentPosition)}</Text>
            <Text style={styles.progressText}>{formatTime(videoDuration)}</Text>
          </View>
        </View>
      )}

      {/* Segment Selection */}
      <View style={styles.segmentContainer}>
        <Text style={styles.segmentTitle}>Select Statement:</Text>
        {segments.map((segment, index) => (
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
              Statement {segment.statementIndex + 1}
            </Text>
            {statementTexts[segment.statementIndex] && (
              <Text style={styles.statementText}>
                {statementTexts[segment.statementIndex]}
              </Text>
            )}
            <Text style={styles.segmentDuration}>
              {formatTime(segment.startTime)} - {formatTime(segment.endTime)} 
              ({formatTime(segment.duration)})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Info */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {videoStatus} | Playing: {isPlaying ? 'Yes' : 'No'}
        </Text>
        {selectedSegment !== null && (
          <Text style={styles.statusText}>
            Current: Statement {segments[selectedSegment]?.statementIndex + 1}
          </Text>
        )}
        <Text style={styles.statusText}>
          Segments: {segments.length} | Duration: {formatTime(videoDuration)}
        </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  timeContainer: {
    flex: 1,
    marginLeft: 15,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  segmentTimeText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  progressBar: {
    height: 20,
    backgroundColor: '#E0E0E0',
    borderRadius: 10,
    position: 'relative',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  segmentMarker: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.5)',
  },
  selectedSegmentMarker: {
    backgroundColor: 'rgba(0, 122, 255, 0.7)',
    borderColor: '#007AFF',
  },
  segmentContainer: {
    marginBottom: 20,
  },
  segmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
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
  segmentDuration: {
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
    marginBottom: 2,
  },
});

export default SegmentedVideoPlayer;