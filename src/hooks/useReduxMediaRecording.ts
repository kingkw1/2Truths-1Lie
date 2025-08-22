/**
 * Redux-integrated media recording hook
 * Conne    maxDuration = 30000,
    allowedTypes = ['video', 'text'],
    onRecordingComplete,
    onRecordingError,
    enableCompression = false, // Disabled by default to preserve audio in video recordings
    compressionOptions = {},
    onCompressionProgress,ia recording state to Redux store for unified state management
 */

import { useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { MediaCapture, MediaType } from '../types/challenge';
import { 
  MediaCompressor, 
  CompressionOptions, 
  CompressionProgress,
  CompressionResult 
} from '../utils/mediaCompression';
import {
  startMediaRecording,
  stopMediaRecording,
  pauseMediaRecording,
  resumeMediaRecording,
  updateRecordingDuration,
  setMediaRecordingError,
  setMediaCompression,
  setStatementMedia,
  startUpload,
  updateUploadProgress,
  completeUpload,
  setUploadError,
  cancelUpload,
  resetMediaState,
} from '../store/slices/challengeCreationSlice';
import { useFileUpload } from './useFileUpload';
import {
  selectMediaRecordingState,
  selectUploadState,
  selectCurrentMedia,
} from '../store/selectors/mediaSelectors';
import { blobUrlManager } from '../utils/blobUrlManager';

interface UseReduxMediaRecordingOptions {
  statementIndex: number;
  maxDuration?: number;
  allowedTypes?: MediaType[];
  onRecordingComplete?: (mediaData: MediaCapture) => void;
  onRecordingError?: (error: string) => void;
  enableCompression?: boolean;
  compressionOptions?: CompressionOptions;
  onCompressionProgress?: (progress: CompressionProgress) => void;
}

export const useReduxMediaRecording = (options: UseReduxMediaRecordingOptions) => {
  const {
    statementIndex,
    maxDuration = 30000,
    allowedTypes = ['video', 'audio', 'text'],
    onRecordingComplete,
    onRecordingError,
    enableCompression = true,
    compressionOptions = {},
    onCompressionProgress,
  } = options;

  const dispatch = useDispatch();
  
  // Get state from Redux using memoized selectors
  const mediaRecordingState = useSelector((state: RootState) => 
    selectMediaRecordingState(state, statementIndex)
  );

  const uploadState = useSelector((state: RootState) => 
    selectUploadState(state, statementIndex)
  );

  const currentMedia = useSelector((state: RootState) => 
    selectCurrentMedia(state, statementIndex)
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const compressorRef = useRef<MediaCompressor | null>(null);

  // File upload hook for handling media uploads
  const fileUpload = useFileUpload({
    onUploadComplete: (result) => {
      dispatch(completeUpload({
        statementIndex,
        fileUrl: result.fileUrl,
      }));
    },
    onUploadError: (error) => {
      dispatch(setUploadError({
        statementIndex,
        error: error.message,
      }));
    },
    onUploadCancel: () => {
      dispatch(cancelUpload({ statementIndex }));
    },
  });

  // Check media device support
  const checkMediaSupport = useCallback(async (type: MediaType): Promise<boolean> => {
    if (type === 'text') return true;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    try {
      const constraints = type === 'video' 
        ? { video: true, audio: true }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }, []);

  // Request media permissions
  const requestPermissions = useCallback(async (type: MediaType): Promise<MediaStream | null> => {
    if (type === 'text') return null;

    try {
      const constraints = type === 'video' 
        ? { 
            video: { 
              width: { ideal: 640 }, 
              height: { ideal: 480 },
              facingMode: 'user'
            }, 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          }
        : { 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Verify we have both video and audio tracks for video recording
      if (type === 'video') {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        if (videoTracks.length === 0) {
          throw new Error('No video track available');
        }
        if (audioTracks.length === 0) {
          console.warn('No audio track available for video recording');
        }
        
        console.log(`✅ Video recording setup: ${videoTracks.length} video tracks, ${audioTracks.length} audio tracks`);
        
        // Log track details for debugging
        videoTracks.forEach((track, index) => {
          console.log(`Video track ${index}: ${track.label} - ${track.kind}`);
        });
        audioTracks.forEach((track, index) => {
          console.log(`Audio track ${index}: ${track.label} - ${track.kind}`);
        });
      }
      
      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Permission denied';
      dispatch(setMediaRecordingError({
        statementIndex,
        error: `Failed to access ${type}: ${errorMessage}`,
      }));
      
      if (onRecordingError) {
        onRecordingError(`Failed to access ${type}: ${errorMessage}`);
      }
      
      return null;
    }
  }, [dispatch, statementIndex, onRecordingError]);

  // Start recording
  const startRecording = useCallback(async (type: MediaType) => {
    if (!allowedTypes.includes(type)) {
      const error = `Recording type ${type} is not allowed`;
      dispatch(setMediaRecordingError({ statementIndex, error }));
      if (onRecordingError) onRecordingError(error);
      return false;
    }

    // Handle text recording
    if (type === 'text') {
      dispatch(startMediaRecording({ statementIndex, mediaType: 'text' }));
      return true;
    }

    // Check support
    const isSupported = await checkMediaSupport(type);
    if (!isSupported) {
      dispatch(setMediaRecordingError({
        statementIndex,
        error: `${type} recording not supported, falling back to text mode`,
      }));
      dispatch(startMediaRecording({ statementIndex, mediaType: 'text' }));
      return true; // Fallback to text is successful
    }

    // Request permissions and start recording
    const stream = await requestPermissions(type);
    if (!stream) {
      // Fallback to text
      dispatch(startMediaRecording({ statementIndex, mediaType: 'text' }));
      return true;
    }

    try {
      const mimeType = type === 'video' 
        ? getSupportedVideoMimeType()
        : getSupportedAudioMimeType();
      
      // Create MediaRecorder with optimized settings for video+audio
      const options: MediaRecorderOptions = {
        mimeType,
      };
      
      // Add bitrate settings for better quality when supported
      if (type === 'video' && mimeType.includes('codecs=')) {
        options.audioBitsPerSecond = 128000;   // 128 kbps for good audio quality
        options.videoBitsPerSecond = 2500000;  // 2.5 Mbps for good video quality
      }
      
      console.log(`🎬 Creating MediaRecorder for ${type} with options:`, options);
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Check if compression is needed and enabled
        if (enableCompression && (type === 'video' || type === 'audio')) {
          try {
            dispatch(setMediaCompression({
              statementIndex,
              isCompressing: true,
              progress: 0,
            }));

            // Initialize compressor
            if (!compressorRef.current) {
              compressorRef.current = new MediaCompressor();
            }

            // Compress the media
            const compressionResult = await compressorRef.current.compressMedia(
              blob,
              compressionOptions,
              (progress) => {
                dispatch(setMediaCompression({
                  statementIndex,
                  isCompressing: true,
                  progress: progress.progress,
                }));
                if (onCompressionProgress) {
                  onCompressionProgress(progress);
                }
              }
            );

            // Clean up any existing blob URL first
            if (currentMedia?.url && currentMedia.url.startsWith('blob:')) {
              blobUrlManager.revokeUrl(currentMedia.url);
            }
            
            const url = blobUrlManager.createUrl(compressionResult.compressedBlob);
            
            const mediaData: MediaCapture = {
              type,
              url,
              duration: mediaRecordingState.duration,
              fileSize: compressionResult.compressedSize,
              mimeType,
              originalSize: compressionResult.originalSize,
              compressionRatio: compressionResult.compressionRatio,
              compressionTime: compressionResult.processingTime,
            };

            dispatch(setMediaCompression({
              statementIndex,
              isCompressing: false,
            }));

            dispatch(setStatementMedia({ index: statementIndex, media: mediaData }));
            
            if (onRecordingComplete) {
              onRecordingComplete(mediaData);
            }

            // Start upload if the media has a blob URL
            if (mediaData.url && mediaData.url.startsWith('blob:')) {
              const file = new File([compressionResult.compressedBlob], `statement_${statementIndex}.${type}`, {
                type: mimeType,
              });
              
              dispatch(startUpload({
                statementIndex,
                sessionId: `upload_${Date.now()}_${statementIndex}`,
              }));

              fileUpload.startUpload(file);
            }
          } catch (error) {
            // Fallback to uncompressed if compression fails
            console.warn('Compression failed, using original:', error);
            
            // Clean up any existing blob URL first
            if (currentMedia?.url && currentMedia.url.startsWith('blob:')) {
              blobUrlManager.revokeUrl(currentMedia.url);
            }
            
            const url = blobUrlManager.createUrl(blob);
            const mediaData: MediaCapture = {
              type,
              url,
              duration: mediaRecordingState.duration,
              fileSize: blob.size,
              mimeType,
            };

            dispatch(setMediaCompression({
              statementIndex,
              isCompressing: false,
            }));

            dispatch(setMediaRecordingError({
              statementIndex,
              error: 'Compression failed, using original quality',
            }));

            dispatch(setStatementMedia({ index: statementIndex, media: mediaData }));
            
            if (onRecordingComplete) {
              onRecordingComplete(mediaData);
            }
          }
        } else {
          // No compression needed or disabled
          // Clean up any existing blob URL first
          if (currentMedia?.url && currentMedia.url.startsWith('blob:')) {
            blobUrlManager.revokeUrl(currentMedia.url);
          }
          
          const url = blobUrlManager.createUrl(blob);
          
          const mediaData: MediaCapture = {
            type,
            url,
            duration: mediaRecordingState.duration,
            fileSize: blob.size,
            mimeType,
          };

          dispatch(setStatementMedia({ index: statementIndex, media: mediaData }));
          
          if (onRecordingComplete) {
            onRecordingComplete(mediaData);
          }

          // Start upload if needed
          if (mediaData.url && mediaData.url.startsWith('blob:')) {
            const file = new File([blob], `statement_${statementIndex}.${type}`, {
              type: mimeType,
            });
            
            dispatch(startUpload({
              statementIndex,
              sessionId: `upload_${Date.now()}_${statementIndex}`,
            }));

            fileUpload.startUpload(file);
          }
        }
      };

      mediaRecorderRef.current.start(100);
      
      dispatch(startMediaRecording({ statementIndex, mediaType: type }));

      // Start timer
      timerRef.current = setInterval(() => {
        dispatch(updateRecordingDuration({
          statementIndex,
          duration: mediaRecordingState.duration + 100,
        }));
        
        if (mediaRecordingState.duration + 100 >= maxDuration) {
          stopRecording();
        }
      }, 100);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recording failed';
      dispatch(setMediaRecordingError({
        statementIndex,
        error: errorMessage,
      }));
      
      if (onRecordingError) {
        onRecordingError(`Recording failed: ${errorMessage}`);
      }
      
      return false;
    }
  }, [
    allowedTypes, 
    maxDuration, 
    onRecordingComplete, 
    onRecordingError, 
    checkMediaSupport, 
    requestPermissions, 
    mediaRecordingState.duration,
    dispatch,
    statementIndex,
    enableCompression,
    compressionOptions,
    onCompressionProgress,
    fileUpload
  ]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    dispatch(stopMediaRecording({ statementIndex }));
  }, [dispatch, statementIndex, mediaRecordingState.isRecording]);

  // Cancel recording (stops without saving)
  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecordingState.isRecording) {
      // Stop the recorder but don't trigger onstop callback
      const originalOnStop = mediaRecorderRef.current.onstop;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = originalOnStop;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear chunks to prevent accidental saving
    chunksRef.current = [];

    dispatch(resetMediaState({ statementIndex }));
  }, [dispatch, statementIndex, mediaRecordingState.isRecording]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecordingState.isPaused) {
      mediaRecorderRef.current.resume();
      dispatch(resumeMediaRecording({ statementIndex }));
      
      // Resume timer
      timerRef.current = setInterval(() => {
        dispatch(updateRecordingDuration({
          statementIndex,
          duration: mediaRecordingState.duration + 100,
        }));
        
        if (mediaRecordingState.duration + 100 >= maxDuration) {
          stopRecording();
        }
      }, 100);
    } else {
      mediaRecorderRef.current.pause();
      dispatch(pauseMediaRecording({ statementIndex }));
      
      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [dispatch, statementIndex, mediaRecordingState.isPaused, mediaRecordingState.duration, maxDuration, stopRecording]);

  // Complete text recording
  const completeTextRecording = useCallback((text: string) => {
    const mediaData: MediaCapture = {
      type: 'text',
      url: `data:text/plain;base64,${btoa(text)}`,
      duration: 0,
      fileSize: new Blob([text]).size,
      mimeType: 'text/plain',
    };

    dispatch(setStatementMedia({ index: statementIndex, media: mediaData }));
    
    if (onRecordingComplete) {
      onRecordingComplete(mediaData);
    }
  }, [dispatch, statementIndex, onRecordingComplete]);

  // Reset recording state
  const resetRecording = useCallback(() => {
    stopRecording();
    dispatch(resetMediaState({ statementIndex }));
  }, [dispatch, statementIndex, stopRecording]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (currentMedia?.url && currentMedia.url.startsWith('blob:')) {
      blobUrlManager.revokeUrl(currentMedia.url);
    }
    if (compressorRef.current) {
      compressorRef.current.dispose();
      compressorRef.current = null;
    }
  }, [currentMedia]);

  // Update file upload progress in Redux
  useEffect(() => {
    if (fileUpload.isUploading && fileUpload.progress) {
      dispatch(updateUploadProgress({
        statementIndex,
        progress: fileUpload.progressPercent,
      }));
    }
  }, [fileUpload.isUploading, fileUpload.progressPercent, dispatch, statementIndex]);

  return {
    // State from Redux
    ...mediaRecordingState,
    uploadState,
    recordedMedia: currentMedia,
    
    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    togglePause,
    completeTextRecording,
    resetRecording,
    cleanup,
    
    // Utilities
    checkMediaSupport,
    
    // Computed values
    maxDuration,
    allowedTypes,
    canRecord: allowedTypes.length > 0,
    isTextMode: mediaRecordingState.mediaType === 'text',
    isMediaMode: mediaRecordingState.mediaType === 'video' || mediaRecordingState.mediaType === 'audio',
  };
};

// Helper functions for MIME type detection
function getSupportedVideoMimeType(): string {
  const types = [
    'video/webm;codecs=vp8,opus',  // Most widely supported with audio
    'video/mp4;codecs=h264,aac',   // Good browser support with audio
    'video/webm;codecs=vp9,opus',  // VP9 with audio
    'video/webm;codecs=vp8',       // VP8 without audio spec
    'video/webm',                  // Generic WebM fallback
    'video/mp4',                   // Generic MP4 fallback
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`✅ Using video MIME type: ${type}`);
      return type;
    }
  }
  
  console.warn('⚠️ No preferred video MIME types supported, using fallback');
  return 'video/webm'; // Fallback
}

function getSupportedAudioMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return 'audio/webm'; // Fallback
}

export default useReduxMediaRecording;