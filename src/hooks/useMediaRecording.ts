/**
 * Custom hook for managing media recording state and integration
 * Provides centralized media recording logic with Redux integration
 */

import { useState, useCallback, useRef } from 'react';
import { MediaCapture, MediaType } from '../types/challenge';
import { 
  MediaCompressor, 
  CompressionOptions, 
  CompressionProgress,
  CompressionResult 
} from '../utils/mediaCompression';
import { blobUrlManager } from '../utils/blobUrlManager';

interface UseMediaRecordingOptions {
  maxDuration?: number;
  allowedTypes?: MediaType[];
  onRecordingComplete?: (mediaData: MediaCapture) => void;
  onRecordingError?: (error: string) => void;
  enableCompression?: boolean;
  compressionOptions?: CompressionOptions;
  onCompressionProgress?: (progress: CompressionProgress) => void;
}

interface MediaRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  mediaType: MediaType | null;
  hasPermission: boolean;
  error: string | null;
  recordedMedia: MediaCapture | null;
  isCompressing: boolean;
  compressionProgress: CompressionProgress | null;
}

export const useMediaRecording = (options: UseMediaRecordingOptions = {}) => {
  const {
    maxDuration = 30000,
    allowedTypes = ['video', 'text'], // Deprecated: now defaults to video-first with text fallback
    onRecordingComplete,
    onRecordingError,
    enableCompression = true,
    compressionOptions = {},
    onCompressionProgress,
  } = options;

  // Redux dispatch removed - this hook is now standalone
  
  const [state, setState] = useState<MediaRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    mediaType: null,
    hasPermission: false,
    error: null,
    recordedMedia: null,
    isCompressing: false,
    compressionProgress: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const compressorRef = useRef<MediaCompressor | null>(null);

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
            audio: true 
          }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      setState(prev => ({ 
        ...prev, 
        hasPermission: true, 
        error: null,
        mediaType: type 
      }));
      
      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Permission denied';
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        error: errorMessage 
      }));
      
      if (onRecordingError) {
        onRecordingError(`Failed to access ${type}: ${errorMessage}`);
      }
      
      return null;
    }
  }, [onRecordingError]);

  // Start recording - prioritizes video with audio, falls back to text
  const startRecording = useCallback(async (type: MediaType) => {
    // Force video-first approach - ignore allowedTypes parameter
    const actualType = type === 'audio' ? 'video' : type; // Convert audio requests to video
    
    // Handle text recording
    if (actualType === 'text') {
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true,
        error: null 
      }));
      return true;
    }

    // For any media recording, try video with audio first
    const isVideoSupported = await checkMediaSupport('video');
    if (!isVideoSupported) {
      // Fallback to text if video not supported
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true,
        error: 'Video recording not supported, using text mode instead' 
      }));
      return true; // Fallback to text is successful
    }

    // Request permissions and start video recording with audio
    const stream = await requestPermissions('video'); // Always request video with audio
    if (!stream) {
      // Fallback to text
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true,
        error: 'Camera/microphone access denied, using text mode instead'
      }));
      return true;
    }

    try {
      const mimeType = getSupportedVideoMimeType(); // Always use video MIME type
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        // Check if compression is needed and enabled (only for video now)
        if (enableCompression && actualType === 'video') {
          try {
            setState(prev => ({ 
              ...prev, 
              isCompressing: true,
              compressionProgress: { stage: 'analyzing', progress: 0 }
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
                setState(prev => ({ 
                  ...prev, 
                  compressionProgress: progress 
                }));
                if (onCompressionProgress) {
                  onCompressionProgress(progress);
                }
              }
            );

            // Clean up any existing blob URL first
            if (state.recordedMedia?.url && state.recordedMedia.url.startsWith('blob:')) {
              blobUrlManager.revokeUrl(state.recordedMedia.url);
            }
            
            const url = blobUrlManager.createUrl(compressionResult.compressedBlob);
            
            const mediaData: MediaCapture = {
              type: 'video', // Always video with audio
              url,
              duration: state.duration,
              fileSize: compressionResult.compressedSize,
              mimeType,
              originalSize: compressionResult.originalSize,
              compressionRatio: compressionResult.compressionRatio,
              compressionTime: compressionResult.processingTime,
            };

            setState(prev => ({ 
              ...prev, 
              recordedMedia: mediaData,
              isCompressing: false,
              compressionProgress: null
            }));
            
            if (onRecordingComplete) {
              onRecordingComplete(mediaData);
            }
          } catch (error) {
            // Fallback to uncompressed if compression fails
            console.warn('Compression failed, using original:', error);
            
            // Clean up any existing blob URL first
            if (state.recordedMedia?.url && state.recordedMedia.url.startsWith('blob:')) {
              blobUrlManager.revokeUrl(state.recordedMedia.url);
            }
            
            const url = blobUrlManager.createUrl(blob);
            const mediaData: MediaCapture = {
              type: 'video', // Always video with audio
              url,
              duration: state.duration,
              fileSize: blob.size,
              mimeType,
            };

            setState(prev => ({ 
              ...prev, 
              recordedMedia: mediaData,
              isCompressing: false,
              compressionProgress: null,
              error: 'Compression failed, using original quality'
            }));
            
            if (onRecordingComplete) {
              onRecordingComplete(mediaData);
            }
          }
        } else {
          // No compression needed or disabled
          // Clean up any existing blob URL first
          if (state.recordedMedia?.url && state.recordedMedia.url.startsWith('blob:')) {
            blobUrlManager.revokeUrl(state.recordedMedia.url);
          }
          
          const url = blobUrlManager.createUrl(blob);
          
          const mediaData: MediaCapture = {
            type: 'video', // Always video with audio
            url,
            duration: state.duration,
            fileSize: blob.size,
            mimeType,
          };

          setState(prev => ({ ...prev, recordedMedia: mediaData }));
          
          if (onRecordingComplete) {
            onRecordingComplete(mediaData);
          }
        }
      };

      mediaRecorderRef.current.start(100);
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        error: null,
        mediaType: 'video' // Always set to video
      }));

      // Start timer
      timerRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 100;
          
          if (newDuration >= maxDuration) {
            stopRecording();
            return { ...prev, duration: maxDuration };
          }
          
          return { ...prev, duration: newDuration };
        });
      }, 100);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Recording failed';
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        mediaType: 'text' // Fallback to text
      }));
      
      if (onRecordingError) {
        onRecordingError(`Recording failed: ${errorMessage}`);
      }
      
      return false;
    }
  }, [allowedTypes, maxDuration, onRecordingComplete, onRecordingError, checkMediaSupport, requestPermissions, state.duration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      isPaused: false 
    }));
  }, [state.isRecording]);

  // Cancel recording (stops without saving)
  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && state.isRecording) {
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

    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      isPaused: false,
      duration: 0,
      error: null,
      recordedMedia: null
    }));
  }, [state.isRecording]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (state.isPaused) {
      mediaRecorderRef.current.resume();
      // Resume timer
      timerRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.duration + 100;
          if (newDuration >= maxDuration) {
            stopRecording();
            return { ...prev, duration: maxDuration };
          }
          return { ...prev, duration: newDuration };
        });
      }, 100);
    } else {
      mediaRecorderRef.current.pause();
      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, [state.isPaused, maxDuration, stopRecording]);

  // Complete text recording
  const completeTextRecording = useCallback((text: string) => {
    const mediaData: MediaCapture = {
      type: 'text',
      url: `data:text/plain;base64,${btoa(text)}`,
      duration: 0,
      fileSize: new Blob([text]).size,
      mimeType: 'text/plain',
    };

    setState(prev => ({ ...prev, recordedMedia: mediaData }));
    
    if (onRecordingComplete) {
      onRecordingComplete(mediaData);
    }
  }, [onRecordingComplete]);

  // Reset recording state
  const resetRecording = useCallback(() => {
    stopRecording();
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      mediaType: null,
      hasPermission: false,
      error: null,
      recordedMedia: null,
      isCompressing: false,
      compressionProgress: null,
    });
  }, [stopRecording]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (state.recordedMedia?.url && state.recordedMedia.url.startsWith('blob:')) {
      blobUrlManager.revokeUrl(state.recordedMedia.url);
    }
    if (compressorRef.current) {
      compressorRef.current.dispose();
      compressorRef.current = null;
    }
  }, [state.recordedMedia]);

  return {
    // State
    ...state,
    
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
    allowedTypes: ['video', 'text'], // Force video-first approach
    canRecord: true, // Always can record (video or text fallback)
    isTextMode: state.mediaType === 'text',
    isMediaMode: state.mediaType === 'video', // Only video mode now
  };
};

// Helper functions for MIME type detection
function getSupportedVideoMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
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

export default useMediaRecording;