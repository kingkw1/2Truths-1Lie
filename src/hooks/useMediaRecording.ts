/**
 * Custom hook for managing media recording state and integration
 * Provides centralized media recording logic with Redux integration
 */

import { useState, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { MediaCapture, MediaType } from '../types/challenge';

interface UseMediaRecordingOptions {
  maxDuration?: number;
  allowedTypes?: MediaType[];
  onRecordingComplete?: (mediaData: MediaCapture) => void;
  onRecordingError?: (error: string) => void;
}

interface MediaRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  mediaType: MediaType | null;
  hasPermission: boolean;
  error: string | null;
  recordedMedia: MediaCapture | null;
}

export const useMediaRecording = (options: UseMediaRecordingOptions = {}) => {
  const {
    maxDuration = 30000,
    allowedTypes = ['video', 'audio', 'text'],
    onRecordingComplete,
    onRecordingError,
  } = options;

  const dispatch = useDispatch();
  
  const [state, setState] = useState<MediaRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    mediaType: null,
    hasPermission: false,
    error: null,
    recordedMedia: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Start recording
  const startRecording = useCallback(async (type: MediaType) => {
    if (!allowedTypes.includes(type)) {
      const error = `Recording type ${type} is not allowed`;
      setState(prev => ({ ...prev, error }));
      if (onRecordingError) onRecordingError(error);
      return false;
    }

    // Handle text recording
    if (type === 'text') {
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true,
        error: null 
      }));
      return true;
    }

    // Check support
    const isSupported = await checkMediaSupport(type);
    if (!isSupported) {
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true,
        error: `${type} recording not supported, falling back to text mode` 
      }));
      return true; // Fallback to text is successful
    }

    // Request permissions and start recording
    const stream = await requestPermissions(type);
    if (!stream) {
      // Fallback to text
      setState(prev => ({ 
        ...prev, 
        mediaType: 'text',
        hasPermission: true 
      }));
      return true;
    }

    try {
      const mimeType = type === 'video' 
        ? getSupportedVideoMimeType()
        : getSupportedAudioMimeType();
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const mediaData: MediaCapture = {
          type,
          url,
          duration: state.duration,
          fileSize: blob.size,
          mimeType,
        };

        setState(prev => ({ ...prev, recordedMedia: mediaData }));
        
        if (onRecordingComplete) {
          onRecordingComplete(mediaData);
        }
      };

      mediaRecorderRef.current.start(100);
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        error: null 
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
      URL.revokeObjectURL(state.recordedMedia.url);
    }
  }, [state.recordedMedia]);

  return {
    // State
    ...state,
    
    // Actions
    startRecording,
    stopRecording,
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
    isTextMode: state.mediaType === 'text',
    isMediaMode: state.mediaType === 'video' || state.mediaType === 'audio',
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