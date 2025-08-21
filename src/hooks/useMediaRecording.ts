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

    // Check if MediaRecorder is supported
    if (typeof MediaRecorder === 'undefined') {
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
        
        console.log(`Video recording setup: ${videoTracks.length} video tracks, ${audioTracks.length} audio tracks`);
      }
      
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
    // Check basic browser support first
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      // Fallback to text if basic APIs not supported
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
      
      // Verify stream has both video and audio tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log(`Creating MediaRecorder with ${videoTracks.length} video tracks and ${audioTracks.length} audio tracks`);
      
      // Log track details for debugging
      videoTracks.forEach((track, index) => {
        console.log(`Video track ${index}:`, track.label, track.getSettings());
      });
      audioTracks.forEach((track, index) => {
        console.log(`Audio track ${index}:`, track.label, track.getSettings());
      });
      
      // Ensure we have audio tracks
      if (audioTracks.length === 0) {
        console.warn('⚠️ No audio tracks found in stream - audio will not be recorded');
      } else {
        // Test if audio tracks are actually working and ensure they're enabled
        audioTracks.forEach((track, index) => {
          console.log(`🎤 Audio track ${index} - enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
          
          // Ensure audio track is enabled and not muted
          if (!track.enabled) {
            console.log(`🔧 Enabling audio track ${index}`);
            track.enabled = true;
          }
          
          if (track.readyState !== 'live') {
            console.warn(`⚠️ Audio track ${index} is not live (readyState: ${track.readyState})`);
          }
          
          // Log additional track properties
          const settings = track.getSettings();
          console.log(`🎤 Audio track ${index} settings:`, settings);
        });
        
        // Test audio level detection to verify audio is actually working
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          source.connect(analyser);
          
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let audioDetected = false;
          
          const checkAudio = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            if (average > 0 && !audioDetected) {
              console.log('🔊 Audio signal detected! Average level:', average);
              audioDetected = true;
              audioContext.close();
            } else if (!audioDetected) {
              setTimeout(checkAudio, 100);
            }
          };
          
          setTimeout(() => {
            if (!audioDetected) {
              console.warn('⚠️ No audio signal detected after 2 seconds - microphone might be muted or not working');
              audioContext.close();
            }
          }, 2000);
          
          checkAudio();
        } catch (error) {
          console.warn('⚠️ Could not test audio levels:', error);
        }
      }
      
      // Create MediaRecorder with explicit options for better audio capture
      let options: MediaRecorderOptions = {};
      
      // Try with MIME type first
      // Try a more aggressive approach to ensure audio is recorded
      console.log('🎯 Configuring MediaRecorder for reliable audio recording...');
      
      // Force audio inclusion by using specific options
      if (MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`✅ Using MIME type: ${mimeType}`);
        
        // Try with minimal audio bitrate to ensure compatibility
        const audioOptimizedOptions = {
          mimeType,
          audioBitsPerSecond: 32000, // Very low bitrate for maximum compatibility
        };
        
        try {
          // Test if audio bitrate is supported
          const testRecorder = new MediaRecorder(stream, audioOptimizedOptions);
          testRecorder.stop();
          options = audioOptimizedOptions;
          console.log('✅ Using audio-optimized options with 32kbps audio');
        } catch (error) {
          console.warn('Audio bitrate not supported, trying MIME type only');
          options = { mimeType };
        }
      } else {
        console.warn(`⚠️ MIME type ${mimeType} not supported, using browser default`);
        options = {}; // Let browser choose
      }
      
      console.log('🎬 Final MediaRecorder options:', options);
      
      // Final validation: ensure stream has audio tracks
      const streamAudioTracks = stream.getAudioTracks();
      const streamVideoTracks = stream.getVideoTracks();
      
      if (streamAudioTracks.length === 0) {
        console.error('❌ No audio tracks in stream - this will cause silent recordings!');
        throw new Error('No audio tracks available for recording');
      }
      
      if (streamVideoTracks.length === 0) {
        console.error('❌ No video tracks in stream - this will cause video-less recordings!');
        throw new Error('No video tracks available for recording');
      }
      
      console.log(`✅ Stream validation passed: ${streamVideoTracks.length} video, ${streamAudioTracks.length} audio tracks`);
      
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        console.log('✅ MediaRecorder created successfully');
      } catch (error) {
        console.error('❌ Failed to create MediaRecorder with options, trying without options:', error);
        // Fallback: create without any options
        mediaRecorderRef.current = new MediaRecorder(stream);
        console.log('✅ MediaRecorder created with browser defaults');
      }
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`Data chunk received: ${event.data.size} bytes, type: ${event.data.type}`);
          
          // Validate that chunks contain expected audio codec
          if (event.data.type && !event.data.type.includes('opus') && !event.data.type.includes('aac')) {
            console.warn('⚠️ Chunk may not contain audio codec:', event.data.type);
          }
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        console.log(`Recording stopped. Chunks: ${chunksRef.current.length}, Total size: ${chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)} bytes`);
        
        // Wait a bit more to ensure all data is processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Log chunk details
        chunksRef.current.forEach((chunk, index) => {
          console.log(`Chunk ${index}: ${chunk.size} bytes, type: ${chunk.type}`);
        });
        
        // Ensure we have chunks before creating blob
        if (chunksRef.current.length === 0) {
          const errorMessage = 'Recording failed: No data chunks received';
          setState(prev => ({ ...prev, error: errorMessage }));
          if (onRecordingError) {
            onRecordingError(errorMessage);
          }
          return;
        }
        
        // Create blob with explicit MIME type to ensure proper format
        // Use the MIME type from the first chunk if available, otherwise use recording MIME type
        let blobMimeType = mimeType || 'video/webm;codecs=vp8,opus';
        
        if (chunksRef.current.length > 0 && chunksRef.current[0].type) {
          blobMimeType = chunksRef.current[0].type;
          console.log(`🎬 Using chunk MIME type: ${blobMimeType}`);
        } else {
          console.log(`🎬 Using fallback MIME type: ${blobMimeType}`);
        }
        
        let blob = new Blob(chunksRef.current, { 
          type: blobMimeType
        });
        
        // Apply compatibility fixes based on container type
        if (blobMimeType.includes('webm')) {
          console.log('🔧 Applying WebM compatibility fixes...');
          
          // For WebM, try different codec specifications
          const webmVariants = [
            blobMimeType, // Use original first
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus', 
            'video/webm',
          ];
          
          for (const variant of webmVariants) {
            try {
              const testBlob = new Blob(chunksRef.current, { type: variant });
              if (testBlob.size > 1000) {
                console.log(`✅ Using WebM variant: ${variant}`);
                blob = testBlob;
                break;
              }
            } catch (error) {
              console.warn(`WebM variant ${variant} failed:`, error);
            }
          }
        } else if (blobMimeType.includes('mp4')) {
          console.log('🔧 Applying MP4 compatibility fixes...');
          
          // For MP4, ensure proper codec specification
          const mp4Variants = [
            blobMimeType, // Use original first
            'video/mp4;codecs=h264,aac', // Most compatible
            'video/mp4', // Generic fallback
          ];
          
          for (const variant of mp4Variants) {
            try {
              const testBlob = new Blob(chunksRef.current, { type: variant });
              if (testBlob.size > 1000) {
                console.log(`✅ Using MP4 variant: ${variant}`);
                blob = testBlob;
                break;
              }
            } catch (error) {
              console.warn(`MP4 variant ${variant} failed:`, error);
            }
          }
        }
        
        // Verify the blob has content
        if (blob.size === 0) {
          const errorMessage = 'Recording failed: No data captured';
          setState(prev => ({ ...prev, error: errorMessage }));
          if (onRecordingError) {
            onRecordingError(errorMessage);
          }
          return;
        }
        
        console.log(`✅ Created blob: ${blob.size} bytes, type: ${blob.type}`);
        
        // Create a test video element to verify the blob contains audio
        const testVideo = document.createElement('video');
        const blobUrl = URL.createObjectURL(blob);
        testVideo.src = blobUrl;
        testVideo.preload = 'metadata';
        
        const cleanupTestVideo = () => {
          URL.revokeObjectURL(blobUrl);
        };
        
        testVideo.addEventListener('loadedmetadata', () => {
          const duration = testVideo.duration;
          const isValidDuration = duration && isFinite(duration) && duration > 0;
          
          console.log(`📹 Video metadata - Duration: ${duration}s (${isValidDuration ? 'VALID' : 'INVALID'}), Dimensions: ${testVideo.videoWidth}x${testVideo.videoHeight}`);
          
          if (!isValidDuration) {
            console.error('❌ Invalid video duration detected - WebM file may be corrupted');
          }
          
          // Check for audio tracks using multiple methods
          const hasAudioTracks = 'audioTracks' in testVideo && (testVideo as any).audioTracks?.length > 0;
          const hasMozAudio = (testVideo as any).mozHasAudio;
          const hasWebkitAudio = (testVideo as any).webkitAudioDecodedByteCount > 0;
          
          // Additional audio detection methods
          const hasAudioContext = testVideo.volume !== undefined; // Basic audio capability
          const hasAudioCodec = blobMimeType.includes('opus') || blobMimeType.includes('aac');
          const hasAudioChunks = chunksRef.current.some(chunk => 
            chunk.type.includes('opus') || chunk.type.includes('aac')
          );
          
          console.log(`🔊 Audio detection:`);
          console.log(`  - audioTracks: ${hasAudioTracks ? (testVideo as any).audioTracks.length : 'not supported'}`);
          console.log(`  - mozHasAudio: ${hasMozAudio}`);
          console.log(`  - webkitAudioDecodedByteCount: ${(testVideo as any).webkitAudioDecodedByteCount || 'not supported'}`);
          console.log(`  - hasAudioCodec: ${hasAudioCodec}`);
          console.log(`  - hasAudioChunks: ${hasAudioChunks}`);
          console.log(`  - blobSize: ${blob.size} bytes`);
          
          if (hasAudioTracks || hasMozAudio || hasWebkitAudio || (hasAudioCodec && hasAudioChunks)) {
            console.log('✅ Audio tracks detected in video!');
          } else {
            console.warn('⚠️ No audio tracks detected - but this may be a browser API limitation');
            console.log('🎵 Audio should still work if codec and chunks are present');
          }
          
          cleanupTestVideo();
        });
        testVideo.addEventListener('error', (e) => {
          console.error('❌ Error loading test video:', e);
          console.error('This indicates the WebM file is corrupted or invalid');
          cleanupTestVideo();
        });
        
        // Force load metadata
        testVideo.load();
        
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
          
          // Now stop the tracks after blob is created and processed
          setTimeout(() => {
            if (streamRef.current) {
              try {
                const tracks = streamRef.current.getTracks();
                console.log(`🔇 Stopping ${tracks.length} media tracks after blob creation...`);
                tracks.forEach(track => {
                  console.log(`  Stopping ${track.kind} track: ${track.label}`);
                  track.stop();
                });
                streamRef.current = null;
              } catch (error) {
                console.warn('Error stopping tracks:', error);
              }
            }
          }, 100);
        }
      };

      // Add error handler for MediaRecorder
      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        const errorMessage = 'Recording error occurred';
        setState(prev => ({ ...prev, error: errorMessage }));
        if (onRecordingError) {
          onRecordingError(errorMessage);
        }
      };

      // Start recording with smaller time slice to ensure audio capture
      mediaRecorderRef.current.start(250); // 250ms chunks for better audio capture
      console.log('MediaRecorder started');
      
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
  const stopRecording = useCallback(async () => {
    console.log('🛑 Stopping recording...');
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!mediaRecorderRef.current) {
      console.warn('No MediaRecorder to stop');
      return;
    }

    const currentState = mediaRecorderRef.current.state;
    console.log(`MediaRecorder state: ${currentState}`);
    
    if (currentState === 'recording' || currentState === 'paused') {
      try {
        // Request final data chunk before stopping to ensure complete file
        if (currentState === 'recording') {
          console.log('📦 Requesting final data chunk...');
          mediaRecorderRef.current.requestData();
          
          // Wait a bit for the final chunk to be processed
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Stop the recorder
        console.log('🔴 Calling MediaRecorder.stop()...');
        mediaRecorderRef.current.stop();
        
        // Wait for the onstop event to fire and process the blob
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
    }
    
    // Don't stop tracks immediately - let the onstop handler complete first
    // We'll stop tracks after the blob is created
    console.log('⏳ Waiting for MediaRecorder to finalize...');
    
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
    if (streamRef.current && streamRef.current.getTracks) {
      try {
        const tracks = streamRef.current.getTracks();
        if (tracks && Array.isArray(tracks)) {
          tracks.forEach(track => track.stop());
        }
      } catch (error) {
        console.warn('Error stopping tracks:', error);
      }
    }
    if (state.recordedMedia?.url && state.recordedMedia.url.startsWith('blob:')) {
      blobUrlManager.revokeUrl(state.recordedMedia.url);
    }
    if (compressorRef.current) {
      compressorRef.current.dispose();
      compressorRef.current = null;
    }
  }, [state.recordedMedia]);

  // Get current stream
  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

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
    getStream,
    
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
    'video/webm;codecs=vp8,opus', // VP8+Opus is most widely supported for audio
    'video/webm;codecs=vp9,opus', // VP9+Opus backup
    'video/mp4;codecs=h264,aac', // H.264+AAC if supported
    'video/webm', // Generic WebM
    'video/mp4', // Generic MP4 (may choose incompatible codecs)
  ];
  
  console.log('Testing MIME type support:');
  for (const type of types) {
    const isSupported = MediaRecorder.isTypeSupported(type);
    console.log(`  ${type}: ${isSupported ? 'SUPPORTED' : 'not supported'}`);
    if (isSupported) {
      console.log(`✅ Selected MIME type: ${type}`);
      return type;
    }
  }
  
  console.warn('⚠️ No preferred MIME type supported, using fallback');
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