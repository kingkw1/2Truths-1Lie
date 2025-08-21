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
import { useMediaRecording } from "../hooks/useMediaRecording";
import { CompressionOptions, CompressionProgress } from "../utils/mediaCompression";

interface MediaRecorderProps {
  onRecordingComplete: (mediaData: MediaCapture) => void;
  onRecordingError: (error: string) => void;
  maxDuration?: number; // in milliseconds, default 30 seconds
  allowedTypes?: MediaType[];
  disabled?: boolean;
  enableCompression?: boolean;
  compressionOptions?: CompressionOptions;
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
  enableCompression = true,
  compressionOptions = {},
}) => {
  const [feedbackMessage, setFeedbackMessage] = useState<{
    message: string;
    type: "success" | "warning" | "error" | "info";
    visible: boolean;
  }>({ message: "", type: "info", visible: false });

  const [recordingQuality, setRecordingQuality] = useState<MediaQuality | null>(null);
  const [showQualityFeedback, setShowQualityFeedback] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Use the enhanced media recording hook
  const {
    isRecording,
    isPaused,
    duration,
    mediaType,
    hasPermission,
    error,
    recordedMedia,
    isCompressing,
    compressionProgress,
    startRecording,
    stopRecording,
    cancelRecording,
    togglePause,
    completeTextRecording,
    resetRecording,
    cleanup,
    checkMediaSupport,
    canRecord,
    isTextMode,
    isMediaMode,
  } = useMediaRecording({
    maxDuration,
    allowedTypes,
    onRecordingComplete: (mediaData) => {
      // Analyze media quality
      const quality = analyzeMediaQuality(mediaData);
      setRecordingQuality(quality);
      setShowQualityFeedback(true);

      // Show feedback message based on quality and compression
      if (mediaData.compressionRatio && mediaData.compressionRatio > 1) {
        const savings = Math.round((1 - 1/mediaData.compressionRatio) * 100);
        setFeedbackMessage({
          message: `Recording compressed successfully! ${savings}% size reduction.`,
          type: "success",
          visible: true,
        });
      } else if (quality.score >= 80) {
        setFeedbackMessage({
          message: "Excellent recording! Great quality.",
          type: "success",
          visible: true,
        });
      } else if (quality.score < 50) {
        setFeedbackMessage({
          message: "Recording quality could be improved. Try again in a quieter environment.",
          type: "warning",
          visible: true,
        });
      }

      onRecordingComplete(mediaData);
    },
    onRecordingError,
    enableCompression,
    compressionOptions,
    onCompressionProgress: (progress) => {
      // Could add additional UI feedback here
    },
  });

  // Handle text-only completion
  const handleTextComplete = useCallback(
    (text: string) => {
      completeTextRecording(text);
    },
    [completeTextRecording],
  );

  // Dismiss feedback message
  const dismissFeedback = useCallback(() => {
    setFeedbackMessage((prev) => ({ ...prev, visible: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const maxDurationFormatted = formatDuration(maxDuration);
  const currentDurationFormatted = formatDuration(duration);

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
      {!isRecording && !isCompressing && (
        <div style={styles.typeSelection}>
          {allowedTypes.includes("video") && (
            <button
              onClick={() => startRecording("video")}
              style={{
                ...styles.typeButton,
                ...(mediaType === "video"
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
                ...(mediaType === "audio"
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
                ...(mediaType === "text"
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
      {error && (
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Compression Progress */}
      {isCompressing && compressionProgress && (
        <div style={styles.compressionContainer}>
          <div style={styles.compressionHeader}>
            <span style={styles.compressionIcon}>⚙️</span>
            <span>Compressing media...</span>
          </div>
          <div style={styles.progressBar}>
            <div 
              style={{
                ...styles.progressFill,
                width: `${compressionProgress.progress}%`
              }}
            />
          </div>
          <div style={styles.compressionDetails}>
            <span>{compressionProgress.stage}</span>
            <span>{Math.round(compressionProgress.progress)}%</span>
          </div>
        </div>
      )}

      {/* Video Preview */}
      {mediaType === "video" && hasPermission && (
        <div style={styles.videoContainer}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
        </div>
      )}

      {/* Audio Visualizer with Recording Indicator */}
      {mediaType === "audio" && hasPermission && (
        <div style={styles.audioContainer}>
          <div style={styles.audioVisualizer}>
            <span style={styles.audioIcon}>🎤</span>
            <div style={styles.audioWave}>
              {isRecording && (
                <div style={styles.audioWaveAnimation}>♪ ♫ ♪ ♫</div>
              )}
            </div>
            {isRecording && (
              <div style={styles.recordingIndicator}>
                <span style={styles.recordingDot}>●</span>
                <span>Recording...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Input */}
      {mediaType === "text" && (
        <TextRecorder onComplete={handleTextComplete} disabled={disabled || isCompressing} />
      )}

      {/* Recording Controls with Quality Indicator */}
      {(mediaType === "video" || mediaType === "audio") &&
        hasPermission && (
          <div style={styles.controls}>
            <div style={styles.controlsHeader}>
              <div style={styles.duration}>
                {currentDurationFormatted} / {maxDurationFormatted}
              </div>
              {isRecording && (
                <RealTimeQualityIndicator
                  score={75} // Placeholder - would be real-time analysis
                  isAnalyzing={false}
                  showLabel={true}
                />
              )}
            </div>

            <div style={styles.controlButtons}>
              {!isRecording ? (
                <button
                  onClick={() => startRecording(mediaType)}
                  style={styles.recordButton}
                  disabled={disabled || isCompressing}
                  title="Start recording"
                >
                  <span style={styles.recordIcon}>⏺️</span>
                  Start Recording
                </button>
              ) : (
                <>
                  <button
                    onClick={togglePause}
                    style={isPaused ? styles.resumeButton : styles.pauseButton}
                    disabled={disabled}
                    title={isPaused ? "Resume recording" : "Pause recording"}
                  >
                    <span style={styles.pauseIcon}>
                      {isPaused ? "▶️" : "⏸️"}
                    </span>
                    {isPaused ? "Resume" : "Pause"}
                  </button>

                  <button
                    onClick={stopRecording}
                    style={styles.stopButton}
                    disabled={disabled}
                    title="Stop and save recording"
                  >
                    <span style={styles.stopIcon}>⏹️</span>
                    Stop & Save
                  </button>

                  <button
                    onClick={cancelRecording}
                    style={styles.cancelButton}
                    disabled={disabled}
                    title="Cancel recording without saving"
                  >
                    <span style={styles.cancelIcon}>❌</span>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* Media Quality Feedback */}
      {showQualityFeedback && recordingQuality && (
        <MediaQualityFeedback
          quality={recordingQuality}
          isVisible={showQualityFeedback}
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
    transition: "all 0.2s",
  } as React.CSSProperties,

  resumeButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 0.2s",
  } as React.CSSProperties,

  cancelButton: {
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
    transition: "all 0.2s",
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

  cancelIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  compressionContainer: {
    padding: "16px",
    backgroundColor: "#F3F4F6",
    border: "2px solid #D1D5DB",
    borderRadius: "8px",
    marginBottom: "16px",
  } as React.CSSProperties,

  compressionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
  } as React.CSSProperties,

  compressionIcon: {
    fontSize: "16px",
    animation: "spin 2s linear infinite",
  } as React.CSSProperties,

  progressBar: {
    width: "100%",
    height: "8px",
    backgroundColor: "#E5E7EB",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "8px",
  } as React.CSSProperties,

  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    transition: "width 0.3s ease",
  } as React.CSSProperties,

  compressionDetails: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#6B7280",
  } as React.CSSProperties,
};

export default MediaRecorder;
