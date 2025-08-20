/**
 * Media Recording Component
 * Implements video, audio, and text-only recording with fallback mechanisms
 * Enhanced with real-time quality feedback and recording indicators
 * Requirements 1 & 3: Intuitive Core Game Loop and Game Difficulty/Engagement
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MediaCapture, MediaType } from "../types/challenge";
import {
  MediaQualityFeedback,
  RealTimeQualityIndicator,
  AnimatedFeedback,
} from "./QualityFeedback";
import { analyzeMediaQuality, MediaQuality } from "../utils/qualityAssessment";

interface MediaRecorderProps {
  onRecordingComplete: (mediaData: MediaCapture) => void;
  onRecordingError: (error: string) => void;
  maxDuration?: number; // in milliseconds, default 30 seconds
  allowedTypes?: MediaType[];
  disabled?: boolean;
}

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  mediaType: MediaType;
  hasPermission: boolean;
  error: string | null;
  recordingQuality: MediaQuality | null;
  showQualityFeedback: boolean;
}

export const MediaRecorder: React.FC<MediaRecorderProps> = ({
  onRecordingComplete,
  onRecordingError,
  maxDuration = 30000, // 30 seconds default
  allowedTypes = ["video", "audio", "text"],
  disabled = false,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    mediaType: "text",
    hasPermission: false,
    error: null,
    recordingQuality: null,
    showQualityFeedback: false,
  });

  const [feedbackMessage, setFeedbackMessage] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "info";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });

  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for media device support
  const checkMediaSupport = useCallback(
    async (type: MediaType): Promise<boolean> => {
      if (type === "text") return true;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
      }

      try {
        const constraints =
          type === "video" ? { video: true, audio: true } : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((track) => track.stop());
        return true;
      } catch (error) {
        console.warn(`Media type ${type} not supported:`, error);
        return false;
      }
    },
    [],
  );

  // Request media permissions
  const requestPermissions = useCallback(
    async (type: MediaType) => {
      if (type === "text") {
        setRecordingState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
        }));
        return true;
      }

      try {
        const constraints =
          type === "video"
            ? { video: { width: 640, height: 480 }, audio: true }
            : { audio: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (type === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setRecordingState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
          mediaType: type,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Permission denied";
        setRecordingState((prev) => ({
          ...prev,
          hasPermission: false,
          error: errorMessage,
        }));
        onRecordingError(`Failed to access ${type}: ${errorMessage}`);
        return false;
      }
    },
    [onRecordingError],
  );

  // Start recording
  const startRecording = useCallback(
    async (type: MediaType) => {
      if (disabled) return;

      // Check if type is allowed
      if (!allowedTypes.includes(type)) {
        onRecordingError(`Recording type ${type} is not allowed`);
        return;
      }

      // For text-only, just switch to text mode
      if (type === "text") {
        setRecordingState((prev) => ({
          ...prev,
          mediaType: "text",
          hasPermission: true,
          error: null,
        }));
        return;
      }

      // Check support and request permissions
      const isSupported = await checkMediaSupport(type);
      if (!isSupported) {
        // Fallback to text
        setRecordingState((prev) => ({
          ...prev,
          mediaType: "text",
          hasPermission: true,
          error: `${type} recording not supported, using text mode`,
        }));
        return;
      }

      const hasPermission = await requestPermissions(type);
      if (!hasPermission) {
        // Fallback to text
        setRecordingState((prev) => ({
          ...prev,
          mediaType: "text",
          hasPermission: true,
        }));
        return;
      }

      // Start actual recording
      if (streamRef.current) {
        try {
          const mimeType =
            type === "video"
              ? "video/webm;codecs=vp9"
              : "audio/webm;codecs=opus";

          mediaRecorderRef.current = new window.MediaRecorder(
            streamRef.current,
            { mimeType },
          );
          chunksRef.current = [];

          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.ondataavailable = (event: any) => {
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
                duration: recordingState.duration,
                fileSize: blob.size,
                mimeType,
              };

              // Analyze media quality
              const quality = analyzeMediaQuality(mediaData);
              setRecordingState((prev) => ({
                ...prev,
                recordingQuality: quality,
                showQualityFeedback: true,
              }));

              // Show feedback message based on quality
              if (quality.score >= 80) {
                setFeedbackMessage({
                  message: "Excellent recording! Great quality.",
                  type: "success",
                  visible: true,
                });
              } else if (quality.score < 50) {
                setFeedbackMessage({
                  message:
                    "Recording quality could be improved. Try again in a quieter environment.",
                  type: "warning",
                  visible: true,
                });
              }

              onRecordingComplete(mediaData);
            };

            mediaRecorderRef.current.start(100); // Collect data every 100ms
          }

          setRecordingState((prev) => ({
            ...prev,
            isRecording: true,
            duration: 0,
          }));

          // Start timer
          timerRef.current = setInterval(() => {
            setRecordingState((prev) => {
              const newDuration = prev.duration + 100;

              // Auto-stop at max duration
              if (newDuration >= maxDuration) {
                stopRecording();
                return { ...prev, duration: maxDuration };
              }

              return { ...prev, duration: newDuration };
            });
          }, 100);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Recording failed";
          setRecordingState((prev) => ({
            ...prev,
            error: errorMessage,
            mediaType: "text", // Fallback to text
          }));
          onRecordingError(`Recording failed: ${errorMessage}`);
        }
      }
    },
    [
      disabled,
      allowedTypes,
      maxDuration,
      onRecordingComplete,
      onRecordingError,
      checkMediaSupport,
      requestPermissions,
      recordingState.duration,
    ],
  );

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setRecordingState((prev) => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      hasPermission: false,
    }));
  }, [recordingState.isRecording]);

  // Pause/Resume recording
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (recordingState.isPaused) {
      mediaRecorderRef.current.resume();
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingState((prev) => {
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

    setRecordingState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  }, [recordingState.isPaused, maxDuration, stopRecording]);

  // Handle text-only completion
  const handleTextComplete = useCallback(
    (text: string) => {
      const mediaData: MediaCapture = {
        type: "text",
        url: `data:text/plain;base64,${btoa(text)}`,
        duration: 0,
        fileSize: new Blob([text]).size,
        mimeType: "text/plain",
      };

      // Analyze text media quality
      const quality = analyzeMediaQuality(mediaData);
      setRecordingState((prev) => ({
        ...prev,
        recordingQuality: quality,
        showQualityFeedback: true,
      }));

      setFeedbackMessage({
        message: "Text recorded successfully!",
        type: "success",
        visible: true,
      });

      onRecordingComplete(mediaData);
    },
    [onRecordingComplete],
  );

  // Dismiss feedback message
  const dismissFeedback = useCallback(() => {
    setFeedbackMessage((prev) => ({ ...prev, visible: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const maxDurationFormatted = formatDuration(maxDuration);
  const currentDurationFormatted = formatDuration(recordingState.duration);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Record Your Statement</h3>
        <p style={styles.subtitle}>
          Choose how you'd like to record your statement. Video and audio add
          personality to your challenge!
        </p>
      </div>

      {/* Media Type Selection */}
      {!recordingState.isRecording && (
        <div style={styles.typeSelection}>
          {allowedTypes.includes("video") && (
            <button
              onClick={() => startRecording("video")}
              style={{
                ...styles.typeButton,
                ...(recordingState.mediaType === "video"
                  ? styles.typeButtonActive
                  : {}),
              }}
              disabled={disabled}
            >
              <span style={styles.typeIcon}>🎥</span>
              <span>Video</span>
            </button>
          )}

          {allowedTypes.includes("audio") && (
            <button
              onClick={() => startRecording("audio")}
              style={{
                ...styles.typeButton,
                ...(recordingState.mediaType === "audio"
                  ? styles.typeButtonActive
                  : {}),
              }}
              disabled={disabled}
            >
              <span style={styles.typeIcon}>🎤</span>
              <span>Audio</span>
            </button>
          )}

          {allowedTypes.includes("text") && (
            <button
              onClick={() => startRecording("text")}
              style={{
                ...styles.typeButton,
                ...(recordingState.mediaType === "text"
                  ? styles.typeButtonActive
                  : {}),
              }}
              disabled={disabled}
            >
              <span style={styles.typeIcon}>📝</span>
              <span>Text Only</span>
            </button>
          )}
        </div>
      )}

      {/* Error Display */}
      {recordingState.error && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{recordingState.error}</span>
        </div>
      )}

      {/* Video Preview */}
      {recordingState.mediaType === "video" && recordingState.hasPermission && (
        <div style={styles.videoContainer}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
        </div>
      )}

      {/* Audio Visualizer with Recording Indicator */}
      {recordingState.mediaType === "audio" && recordingState.hasPermission && (
        <div style={styles.audioContainer}>
          <div style={styles.audioVisualizer}>
            <span style={styles.audioIcon}>🎤</span>
            <div style={styles.audioWave}>
              {recordingState.isRecording && (
                <div style={styles.audioWaveAnimation}>♪ ♫ ♪ ♫</div>
              )}
            </div>
            {recordingState.isRecording && (
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot}>●</span>
                <span>Recording...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Input */}
      {recordingState.mediaType === "text" && (
        <TextRecorder onComplete={handleTextComplete} disabled={disabled} />
      )}

      {/* Recording Controls with Quality Indicator */}
      {(recordingState.mediaType === "video" ||
        recordingState.mediaType === "audio") &&
        recordingState.hasPermission && (
          <div style={styles.controls}>
            <div style={styles.controlsHeader}>
              <div style={styles.duration}>
                {currentDurationFormatted} / {maxDurationFormatted}
              </div>
              {recordingState.isRecording && (
                <RealTimeQualityIndicator
                  score={75} // Placeholder - would be real-time analysis
                  isAnalyzing={false}
                  showLabel={true}
                />
              )}
            </div>

            <div style={styles.controlButtons}>
              {!recordingState.isRecording ? (
                <button
                  onClick={() => startRecording(recordingState.mediaType)}
                  style={styles.recordButton}
                  disabled={disabled}
                >
                  <span style={styles.recordIcon}>⏺️</span>
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={togglePause}
                    style={styles.pauseButton}
                    disabled={disabled}
                  >
                    <span style={styles.pauseIcon}>
                      {recordingState.isPaused ? "▶️" : "⏸️"}
                    </span>
                    {recordingState.isPaused ? "Resume" : "Pause"}
                  </button>

                  <button
                    onClick={stopRecording}
                    style={styles.stopButton}
                    disabled={disabled}
                  >
                    <span style={styles.stopIcon}>⏹️</span>
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* Media Quality Feedback */}
      {recordingState.showQualityFeedback &&
        recordingState.recordingQuality && (
          <MediaQualityFeedback
            quality={recordingState.recordingQuality}
            isVisible={recordingState.showQualityFeedback}
            compact={true}
          />
        )}

      {/* Animated Feedback Messages */}
      <AnimatedFeedback
        message={feedbackMessage.message}
        type={feedbackMessage.type}
        isVisible={feedbackMessage.visible}
        onDismiss={dismissFeedback}
        autoHide={true}
        duration={3000}
      />
    </div>
  );
};

// Text-only recorder component
interface TextRecorderProps {
  onComplete: (text: string) => void;
  disabled?: boolean;
}

const TextRecorder: React.FC<TextRecorderProps> = ({
  onComplete,
  disabled,
}) => {
  const [text, setText] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = () => {
    if (text.trim()) {
      onComplete(text.trim());
      setIsCompleted(true);
    }
  };

  const handleTextChange = (value: string) => {
    // Enforce character limit
    const limitedText = value.length > 500 ? value.substring(0, 500) : value;
    setText(limitedText);
  };

  const handleReset = () => {
    setText("");
    setIsCompleted(false);
  };

  if (isCompleted) {
    return (
      <div style={styles.textCompleted}>
        <div style={styles.textPreview}>
          <h4>Text Recorded:</h4>
          <p>"{text}"</p>
        </div>
        <button onClick={handleReset} style={styles.resetButton}>
          Record Again
        </button>
      </div>
    );
  }

  return (
    <div style={styles.textContainer}>
      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Type your statement here... (This will be your recorded content)"
        style={styles.textInput}
        disabled={disabled}
        maxLength={500}
      />
      <div style={styles.textFooter}>
        <span style={styles.characterCount}>{text.length}/500 characters</span>
        <button
          onClick={handleSubmit}
          style={{
            ...styles.textSubmitButton,
            ...(text.trim().length === 0 ? styles.buttonDisabled : {}),
          }}
          disabled={disabled || text.trim().length === 0}
        >
          Complete Text Recording
        </button>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    border: "2px solid #E5E7EB",
  } as React.CSSProperties,

  header: {
    marginBottom: "24px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  title: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: "8px",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "14px",
    color: "#6B7280",
    lineHeight: "1.5",
  } as React.CSSProperties,

  typeSelection: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    marginBottom: "24px",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  typeButton: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
    padding: "16px 20px",
    border: "2px solid #D1D5DB",
    borderRadius: "8px",
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
    transition: "all 0.2s",
    minWidth: "100px",
  } as React.CSSProperties,

  typeButtonActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#EBF8FF",
    color: "#1E40AF",
  } as React.CSSProperties,

  typeIcon: {
    fontSize: "24px",
  } as React.CSSProperties,

  errorContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: "6px",
    color: "#DC2626",
    fontSize: "14px",
    marginBottom: "16px",
  } as React.CSSProperties,

  errorIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  videoContainer: {
    marginBottom: "20px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  video: {
    width: "100%",
    maxWidth: "400px",
    height: "300px",
    backgroundColor: "#000000",
    borderRadius: "8px",
  } as React.CSSProperties,

  audioContainer: {
    marginBottom: "20px",
  } as React.CSSProperties,

  audioVisualizer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "16px",
    padding: "40px",
    backgroundColor: "#F3F4F6",
    borderRadius: "8px",
  } as React.CSSProperties,

  audioIcon: {
    fontSize: "48px",
  } as React.CSSProperties,

  audioWave: {
    height: "40px",
    display: "flex",
    alignItems: "center",
  } as React.CSSProperties,

  audioWaveAnimation: {
    fontSize: "24px",
    color: "#3B82F6",
    animation: "pulse 1s infinite",
  } as React.CSSProperties,

  textContainer: {
    marginBottom: "20px",
  } as React.CSSProperties,

  textInput: {
    width: "100%",
    minHeight: "120px",
    padding: "16px",
    border: "2px solid #D1D5DB",
    borderRadius: "8px",
    fontSize: "16px",
    fontFamily: "inherit",
    resize: "vertical" as const,
    marginBottom: "12px",
  } as React.CSSProperties,

  textFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  characterCount: {
    fontSize: "12px",
    color: "#9CA3AF",
  } as React.CSSProperties,

  textSubmitButton: {
    padding: "8px 16px",
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  } as React.CSSProperties,

  textCompleted: {
    textAlign: "center" as const,
    padding: "20px",
    backgroundColor: "#F0FDF4",
    border: "2px solid #BBF7D0",
    borderRadius: "8px",
  } as React.CSSProperties,

  textPreview: {
    marginBottom: "16px",
  } as React.CSSProperties,

  resetButton: {
    padding: "8px 16px",
    backgroundColor: "#6B7280",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  } as React.CSSProperties,

  controls: {
    textAlign: "center" as const,
  } as React.CSSProperties,

  controlsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  } as React.CSSProperties,

  duration: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#374151",
  } as React.CSSProperties,

  recordingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    color: "#EF4444",
    marginTop: "8px",
  } as React.CSSProperties,

  recordingDot: {
    fontSize: "12px",
    animation: "pulse 1s infinite",
  } as React.CSSProperties,

  controlButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  recordButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#EF4444",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  } as React.CSSProperties,

  pauseButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#F59E0B",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
  } as React.CSSProperties,

  stopButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#6B7280",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
  } as React.CSSProperties,

  recordIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  pauseIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  stopIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,
};

export default MediaRecorder;
