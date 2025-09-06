/**
 * Complete Video Processing Integration Example
 * Demonstrates the full workflow of video merging, upload, and playback
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useDispatch } from 'react-redux';
import { videoMergingService, MergeProgress, MergeResult } from '../services/videoMergingService';
import { enhancedUploadService, UploadProgress, UploadResult } from '../services/enhancedUploadService';
import { videoUploadService, UploadProgress as VideoUploadProgress } from '../services/uploadService';
import { setIndividualRecording } from '../store/slices/challengeCreationSlice';
import EnhancedSegmentedVideoPlayer from './EnhancedSegmentedVideoPlayer';
import { MediaCapture, VideoSegment } from '../types';

interface CompleteWorkflowProps {
  recordedVideos: [string, string, string]; // URIs of recorded videos
  statements: [string, string, string]; // Statement texts
  lieIndex: number; // Index of the lie
  userId: string;
  onComplete?: (challengeId: string) => void;
}

interface WorkflowState {
  stage: 'ready' | 'merging' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
  mergeResult?: MergeResult;
  uploadResult?: UploadResult;
  mergedMedia?: MediaCapture;
  error?: string;
}

export const CompleteVideoProcessingWorkflow: React.FC<CompleteWorkflowProps> = ({
  recordedVideos,
  statements,
  lieIndex,
  userId,
  onComplete,
}) => {
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    stage: 'ready',
    progress: 0,
    message: 'Ready to process videos',
  });

  const processingRef = useRef(false);
  const dispatch = useDispatch();

  /**
   * MAIN FUNCTION: createConcatenatedVideo()
   * This is the core function that properly merges three videos
   */
  const createConcatenatedVideo = async (): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      console.log('🎬 Starting createConcatenatedVideo() - TRUE video merging');
      
      setWorkflowState({
        stage: 'merging',
        progress: 0,
        message: 'Initializing video merge...',
      });

      // Step 1: Configure merging options for optimal quality
      const mergeOptions = {
        compressionQuality: 0.8, // High quality
        outputFormat: 'mp4' as const, // Standard format
        maxOutputSize: 50 * 1024 * 1024, // 50MB limit
        mergeStrategy: 'auto' as const, // Auto-select best method
        targetResolution: '1280x720', // HD quality
        targetBitrate: '2M', // 2 Mbps for good quality
        includeTransitions: false, // No transitions for seamless playback
      };

      // Step 2: Perform the actual video concatenation
      const mergeResult = await videoMergingService.mergeStatementVideos(
        recordedVideos,
        mergeOptions,
        (progress: MergeProgress) => {
          const progressPercent = Math.round(progress.progress);
          let stageMessage = 'Processing videos...';

          switch (progress.stage) {
            case 'preparing':
              stageMessage = 'Analyzing video files...';
              break;
            case 'merging':
              if (progress.currentSegment !== undefined) {
                stageMessage = `Merging segment ${progress.currentSegment + 1} of 3...`;
              } else {
                stageMessage = 'Concatenating video streams...';
              }
              break;
            case 'compressing':
              stageMessage = 'Compressing merged video...';
              break;
            case 'finalizing':
              stageMessage = 'Creating segment metadata...';
              break;
          }

          setWorkflowState(prev => ({
            ...prev,
            progress: progressPercent,
            message: stageMessage,
          }));

          console.log(`🔄 Merge progress: ${progressPercent}% - ${stageMessage}`);
        }
      );

      if (!mergeResult.success) {
        throw new Error(mergeResult.error || 'Video merge failed');
      }

      console.log('✅ createConcatenatedVideo() completed successfully');
      console.log('📊 Merge strategy used:', mergeResult.mergeStrategy);
      console.log('📊 Total duration:', mergeResult.totalDuration, 'ms');
      console.log('📊 File size:', (mergeResult.fileSize || 0) / (1024 * 1024), 'MB');
      console.log('📊 Segments:', mergeResult.segments);

      // Step 3: Handle result based on merge strategy
      if (mergeResult.mergeStrategy === 'individual-videos' && mergeResult.individualVideoUris) {
        // For individual video strategy, populate individual recordings instead of merged video
        await handleIndividualVideos(mergeResult);
      } else {
        // For actual merged videos, create merged media capture
        const mergedMedia = createMergedMediaCapture(mergeResult);
        // Step 4: Upload the merged challenge
        await uploadMergedChallenge(mergedMedia, mergeResult);
      }

    } catch (error: any) {
      console.error('❌ createConcatenatedVideo() failed:', error);
      setWorkflowState({
        stage: 'error',
        progress: 0,
        message: 'Video processing failed',
        error: error.message,
      });
    } finally {
      processingRef.current = false;
    }
  };

  /**
   * Handle individual video strategy - upload each video separately and set individual recordings
   */
  const handleIndividualVideos = async (mergeResult: MergeResult): Promise<void> => {
    console.log('🎯 INDIVIDUAL_VIDEOS: Processing individual video strategy');
    
    if (!mergeResult.individualVideoUris || mergeResult.individualVideoUris.length !== 3) {
      throw new Error('Individual video strategy requires exactly 3 video URIs');
    }

    if (!mergeResult.segments || mergeResult.segments.length !== 3) {
      throw new Error('Individual video strategy requires exactly 3 segments');
    }

    setWorkflowState(prev => ({
      ...prev,
      stage: 'uploading',
      progress: 0,
      message: 'Uploading individual videos...',
    }));

    const uploadPromises = mergeResult.individualVideoUris.map(async (videoUri, index) => {
      console.log(`🎯 INDIVIDUAL_VIDEOS: Uploading video ${index + 1} of 3`);
      
      const segment = mergeResult.segments![index];
      const timestamp = Date.now();
      const filename = `individual_statement_${index + 1}_${timestamp}.mp4`;

      // Get video file info
      const videoInfo = await FileSystem.getInfoAsync(videoUri);
      const fileSize = videoInfo.exists && 'size' in videoInfo ? videoInfo.size : 0;

      // Upload individual video
      const uploadResult = await videoUploadService.uploadVideo(
        videoUri,
        filename,
        segment.duration,
        {
          compress: fileSize > 50000000, // Compress if > 50MB
          compressionQuality: 0.8,
          maxFileSize: 100000000, // 100MB max
          retryAttempts: 3,
          timeout: 120000,
        },
        (progress: VideoUploadProgress) => {
          const overallProgress = ((index * 100) + progress.progress) / 3;
          setWorkflowState(prev => ({
            ...prev,
            progress: overallProgress,
            message: `Uploading video ${index + 1} of 3... ${Math.round(progress.progress)}%`,
          }));
        }
      );

      // Create MediaCapture for this individual video
      const individualMedia: MediaCapture = {
        type: 'video',
        url: videoUri,
        streamingUrl: uploadResult.streamingUrl || uploadResult.cloudStorageKey,
        duration: segment.duration,
        fileSize: fileSize,
        mimeType: 'video/mp4',
        mediaId: uploadResult.mediaId,
        isMergedVideo: false,
        storageType: 'cloud',
        isUploaded: true,
        compressionRatio: uploadResult.compressionRatio || 1,
      };

      return { index, media: individualMedia };
    });

    try {
      const uploadResults = await Promise.all(uploadPromises);
      
      // Update individual recordings in Redux
      uploadResults.forEach(({ index, media }) => {
        console.log(`✅ INDIVIDUAL_VIDEOS: Video ${index + 1} uploaded successfully:`, media.mediaId);
        dispatch(setIndividualRecording({
          statementIndex: index,
          recording: media,
        }));
      });

      setWorkflowState(prev => ({
        ...prev,
        stage: 'complete',
        progress: 100,
        message: 'Individual videos uploaded successfully!',
      }));

      console.log('✅ INDIVIDUAL_VIDEOS: All individual videos uploaded successfully');
      
    } catch (error: any) {
      console.error('❌ INDIVIDUAL_VIDEOS: Failed to upload individual videos:', error);
      throw new Error(`Failed to upload individual videos: ${error.message}`);
    }
  };

  /**
   * Create MediaCapture object from merge result
   */
  const createMergedMediaCapture = (mergeResult: MergeResult): MediaCapture => {
    const mergedMedia: MediaCapture = {
      type: 'video',
      url: mergeResult.mergedVideoUri,
      streamingUrl: mergeResult.mergedVideoUri, // For playback
      duration: mergeResult.totalDuration,
      fileSize: mergeResult.fileSize,
      mimeType: 'video/mp4',
      isMergedVideo: true,
      segments: mergeResult.segments,
      compressionRatio: mergeResult.compressionRatio,
      storageType: 'local',
      isUploaded: false,
      // Additional metadata for tracking
      originalSize: mergeResult.fileSize, // Would be sum of original files
      compressionTime: 0, // Would be tracked during merge
      compressionQuality: 0.8,
    };

    setWorkflowState(prev => ({
      ...prev,
      mergeResult,
      mergedMedia,
    }));

    return mergedMedia;
  };

  /**
   * Upload the merged challenge with proper metadata
   */
  const uploadMergedChallenge = async (
    mergedMedia: MediaCapture,
    mergeResult: MergeResult
  ): Promise<void> => {
    console.log('📤 Starting upload of merged challenge...');

    setWorkflowState(prev => ({
      ...prev,
      stage: 'uploading',
      progress: 0,
      message: 'Preparing upload...',
    }));

    const uploadOptions = {
      compressionBeforeUpload: true, // Apply additional compression
      uploadTimeout: 5 * 60 * 1000, // 5 minutes
      retryAttempts: 3,
      onProgress: (progress: UploadProgress) => {
        const progressPercent = Math.round(progress.progress);
        let uploadMessage = 'Uploading...';

        switch (progress.stage) {
          case 'preparing':
            uploadMessage = 'Preparing upload...';
            break;
          case 'processing':
            uploadMessage = 'Optimizing for upload...';
            break;
          case 'uploading':
            if (progress.uploadSpeed && progress.estimatedTimeRemaining) {
              const timeRemaining = Math.round(progress.estimatedTimeRemaining / 1000);
              uploadMessage = `Uploading at ${progress.uploadSpeed} (${timeRemaining}s remaining)`;
            } else {
              uploadMessage = 'Uploading to server...';
            }
            break;
          case 'completed':
            uploadMessage = 'Upload complete!';
            break;
        }

        setWorkflowState(prev => ({
          ...prev,
          progress: progressPercent,
          message: uploadMessage,
        }));
      },
    };

    try {
      const uploadResult = await enhancedUploadService.uploadMergedChallenge(
        mergedMedia,
        uploadOptions
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      console.log('✅ Challenge upload completed successfully');
      console.log('📊 Challenge ID:', uploadResult.challengeId);
      console.log('📊 Video URL:', uploadResult.videoUrl);

      setWorkflowState(prev => ({
        ...prev,
        stage: 'complete',
        progress: 100,
        message: 'Challenge created successfully!',
        uploadResult,
      }));

      onComplete?.(uploadResult.challengeId!);

    } catch (error: any) {
      console.error('❌ Challenge upload failed:', error);
      throw error;
    }
  };

  /**
   * Render the video processing progress
   */
  const renderProgress = () => {
    if (workflowState.stage === 'ready') return null;

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>
          {workflowState.stage === 'merging' ? 'Creating Merged Video' : 
           workflowState.stage === 'uploading' ? 'Uploading Challenge' :
           workflowState.stage === 'complete' ? 'Complete!' : 'Processing'}
        </Text>
        
        <Text style={styles.progressMessage}>{workflowState.message}</Text>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill,
                { width: `${workflowState.progress}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>{workflowState.progress}%</Text>
        </View>

        {(workflowState.stage === 'merging' || workflowState.stage === 'uploading') && (
          <ActivityIndicator size="large" color="#4a90e2" style={styles.spinner} />
        )}
      </View>
    );
  };

  /**
   * Render the complete challenge summary
   */
  const renderSummary = () => {
    if (workflowState.stage !== 'complete' || !workflowState.mergeResult) {
      return null;
    }

    const { mergeResult, uploadResult } = workflowState;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>🎉 Challenge Created!</Text>
        
        <View style={styles.summaryStats}>
          <Text style={styles.statItem}>
            📹 Duration: {Math.round((mergeResult.totalDuration || 0) / 1000)}s
          </Text>
          <Text style={styles.statItem}>
            📦 Size: {((mergeResult.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB
          </Text>
          <Text style={styles.statItem}>
            🗜️ Compression: {((mergeResult.compressionRatio || 1) * 100).toFixed(0)}%
          </Text>
          <Text style={styles.statItem}>
            🎯 Strategy: {mergeResult.mergeStrategy || 'auto'}
          </Text>
        </View>

        {uploadResult?.challengeId && (
          <Text style={styles.challengeId}>
            Challenge ID: {uploadResult.challengeId}
          </Text>
        )}
      </View>
    );
  };

  /**
   * Render the video player for preview
   */
  const renderVideoPlayer = () => {
    if (!workflowState.mergedMedia || workflowState.stage !== 'complete') {
      return null;
    }

    return (
      <View style={styles.playerContainer}>
        <Text style={styles.playerTitle}>Preview Your Challenge</Text>
        <EnhancedSegmentedVideoPlayer
          mergedVideo={workflowState.mergedMedia}
          statementTexts={Array.from(statements)}
          showStatementTexts={true}
          enableSegmentSwitching={true}
          onSegmentSelect={(index) => {
            console.log(`Playing segment ${index}: ${statements[index]}`);
          }}
        />
      </View>
    );
  };

  /**
   * Render error state
   */
  const renderError = () => {
    if (workflowState.stage !== 'error') return null;

    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>❌ Processing Failed</Text>
        <Text style={styles.errorMessage}>{workflowState.error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={createConcatenatedVideo}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const canProcess = recordedVideos.every(uri => uri && uri.length > 0) &&
    statements.every(statement => statement && statement.trim().length > 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Video Processing Workflow</Text>
      
      {/* Statement preview */}
      <View style={styles.statementsContainer}>
        <Text style={styles.sectionTitle}>Your Statements:</Text>
        {statements.map((statement, index) => (
          <View key={index} style={[
            styles.statementItem,
            index === lieIndex && styles.lieStatement
          ]}>
            <Text style={styles.statementNumber}>Statement {index + 1}</Text>
            <Text style={styles.statementText}>{statement}</Text>
            {index === lieIndex && (
              <Text style={styles.lieIndicator}>🤥 This is the lie</Text>
            )}
          </View>
        ))}
      </View>

      {/* Progress display */}
      {renderProgress()}

      {/* Summary */}
      {renderSummary()}

      {/* Video player */}
      {renderVideoPlayer()}

      {/* Error handling */}
      {renderError()}

      {/* Action button */}
      {workflowState.stage === 'ready' && (
        <TouchableOpacity
          style={[
            styles.processButton,
            !canProcess && styles.processButtonDisabled
          ]}
          onPress={createConcatenatedVideo}
          disabled={!canProcess}
        >
          <Text style={[
            styles.processButtonText,
            !canProcess && styles.processButtonTextDisabled
          ]}>
            🎬 Create Concatenated Video
          </Text>
        </TouchableOpacity>
      )}

      {/* Technical details */}
      <View style={styles.technicalDetails}>
        <Text style={styles.technicalTitle}>Technical Implementation:</Text>
        <Text style={styles.technicalItem}>
          ✅ True video concatenation (not just copying first video)
        </Text>
        <Text style={styles.technicalItem}>
          ✅ Accurate segment metadata with proper timing
        </Text>
        <Text style={styles.technicalItem}>
          ✅ Multiple merge strategies (FFmpeg, native, fallback)
        </Text>
        <Text style={styles.technicalItem}>
          ✅ Asynchronous compression with progress tracking
        </Text>
        <Text style={styles.technicalItem}>
          ✅ Enhanced upload flow with retry logic
        </Text>
        <Text style={styles.technicalItem}>
          ✅ Segmented playback with individual video switching
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 20,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    margin: 16,
    color: '#333',
  },
  statementsContainer: {
    margin: 16,
  },
  statementItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  lieStatement: {
    borderColor: '#ff6b6b',
    backgroundColor: '#fff5f5',
  },
  statementNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  statementText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  lieIndicator: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '600',
    marginTop: 8,
  },
  progressContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4a90e2',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a90e2',
  },
  spinner: {
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: '#e8f4fd',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4a90e2',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c5aa0',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryStats: {
    marginBottom: 12,
  },
  statItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  challengeId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 8,
  },
  playerContainer: {
    margin: 16,
  },
  playerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  processButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    borderRadius: 12,
    margin: 16,
  },
  processButtonDisabled: {
    backgroundColor: '#ccc',
  },
  processButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  processButtonTextDisabled: {
    color: '#999',
  },
  technicalDetails: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  technicalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0c4a6e',
    marginBottom: 12,
  },
  technicalItem: {
    fontSize: 12,
    color: '#0e7490',
    marginBottom: 6,
    lineHeight: 18,
  },
});

export default CompleteVideoProcessingWorkflow;
