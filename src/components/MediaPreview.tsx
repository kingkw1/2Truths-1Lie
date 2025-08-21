/**
 * Media Preview Component
 * Supports playback of recorded video, audio, and text media
 * Requirements 8: Media Capture with preview and playback functionality
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MediaCapture, MediaType } from "../types/challenge";

interface MediaPreviewProps {
  mediaData: MediaCapture;
  onReRecord?: () => void;
  onConfirm?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  mediaData,
  onReRecord,
  onConfirm,
  showControls = true,
  autoPlay = false,
  className = "",
  style = {},
}) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isLoading: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Get the appropriate media element based on type
  const getMediaElement = useCallback(() => {
    return mediaData.type === "video" ? videoRef.current : audioRef.current;
  }, [mediaData.type]);

  // Update playback state from media element
  const updatePlaybackState = useCallback(() => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    setPlaybackState(prev => ({
      ...prev,
      currentTime: mediaElement.currentTime,
      duration: mediaElement.duration || 0,
      isPlaying: !mediaElement.paused,
      volume: mediaElement.volume,
      isMuted: mediaElement.muted,
    }));
  }, [getMediaElement]);

  // Play/pause toggle
  const togglePlayback = useCallback(async () => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    try {
      if (playbackState.isPlaying) {
        mediaElement.pause();
      } else {
        await mediaElement.play();
      }
    } catch (error) {
      console.error("Playback error:", error);
      setPlaybackState(prev => ({
        ...prev,
        error: "Failed to play media",
      }));
    }
  }, [getMediaElement, playbackState.isPlaying]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    mediaElement.currentTime = Math.max(0, Math.min(time, playbackState.duration));
  }, [getMediaElement, playbackState.duration]);

  // Handle progress bar click
  const handleProgressClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * playbackState.duration;
    
    seekTo(newTime);
  }, [playbackState.duration, seekTo]);

  // Volume control
  const setVolume = useCallback((volume: number) => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    mediaElement.volume = clampedVolume;
    setPlaybackState(prev => ({ ...prev, volume: clampedVolume }));
  }, [getMediaElement]);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    mediaElement.muted = !mediaElement.muted;
    setPlaybackState(prev => ({ ...prev, isMuted: mediaElement.muted }));
  }, [getMediaElement]);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds)) return "0:00";
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Setup media element event listeners
  useEffect(() => {
    const mediaElement = getMediaElement();
    if (!mediaElement) return;

    const handleLoadStart = () => setPlaybackState(prev => ({ ...prev, isLoading: true }));
    const handleLoadedData = () => {
      setPlaybackState(prev => ({ ...prev, isLoading: false }));
      updatePlaybackState();
    };
    const handleTimeUpdate = updatePlaybackState;
    const handlePlay = () => setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    const handleEnded = () => setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    const handleError = () => setPlaybackState(prev => ({ ...prev, error: "Media playback error", isLoading: false }));

    mediaElement.addEventListener("loadstart", handleLoadStart);
    mediaElement.addEventListener("loadeddata", handleLoadedData);
    mediaElement.addEventListener("timeupdate", handleTimeUpdate);
    mediaElement.addEventListener("play", handlePlay);
    mediaElement.addEventListener("pause", handlePause);
    mediaElement.addEventListener("ended", handleEnded);
    mediaElement.addEventListener("error", handleError);

    // Auto-play if requested
    if (autoPlay) {
      mediaElement.play().catch(console.error);
    }

    return () => {
      mediaElement.removeEventListener("loadstart", handleLoadStart);
      mediaElement.removeEventListener("loadeddata", handleLoadedData);
      mediaElement.removeEventListener("timeupdate", handleTimeUpdate);
      mediaElement.removeEventListener("play", handlePlay);
      mediaElement.removeEventListener("pause", handlePause);
      mediaElement.removeEventListener("ended", handleEnded);
      mediaElement.removeEventListener("error", handleError);
    };
  }, [getMediaElement, autoPlay, updatePlaybackState]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (mediaData.url && mediaData.url.startsWith("blob:")) {
        URL.revokeObjectURL(mediaData.url);
      }
    };
  }, [mediaData.url]);

  // Render different preview types
  const renderMediaContent = () => {
    switch (mediaData.type) {
      case "video":
        return (
          <div style={styles.videoContainer}>
            <video
              ref={videoRef}
              src={mediaData.url}
              style={styles.video}
              preload="metadata"
              playsInline
              muted={playbackState.isMuted}
            />
            {playbackState.isLoading && (
              <div style={styles.loadingOverlay}>
                <div style={styles.spinner}>⟳</div>
                <span>Loading video...</span>
              </div>
            )}
          </div>
        );

      case "audio":
        return (
          <div style={styles.audioContainer}>
            <audio
              ref={audioRef}
              src={mediaData.url}
              preload="metadata"
            />
            <div style={styles.audioVisualizer}>
              <div style={styles.audioIcon}>
                {playbackState.isPlaying ? "🔊" : "🎵"}
              </div>
              <div style={styles.audioInfo}>
                <h4>Audio Recording</h4>
                <p>Duration: {formatTime(playbackState.duration)}</p>
                {mediaData.fileSize && (
                  <p>Size: {(mediaData.fileSize / 1024).toFixed(1)} KB</p>
                )}
              </div>
              {playbackState.isLoading && (
                <div style={styles.audioLoading}>
                  <div style={styles.spinner}>⟳</div>
                </div>
              )}
            </div>
          </div>
        );

      case "text":
        return (
          <div style={styles.textContainer}>
            <div style={styles.textHeader}>
              <span style={styles.textIcon}>📝</span>
              <h4>Text Recording</h4>
            </div>
            <div style={styles.textContent}>
              {mediaData.url ? (
                <p>{atob(mediaData.url.split(",")[1] || "")}</p>
              ) : (
                <p style={styles.textError}>No text content available</p>
              )}
            </div>
            <div style={styles.textMeta}>
              {mediaData.fileSize && (
                <span>{mediaData.fileSize} characters</span>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div style={styles.errorContainer}>
            <span style={styles.errorIcon}>⚠️</span>
            <p>Unsupported media type: {mediaData.type}</p>
          </div>
        );
    }
  };

  // Render playback controls for video/audio
  const renderPlaybackControls = () => {
    if (mediaData.type === "text" || !showControls) return null;

    return (
      <div style={styles.controls}>
        {/* Main playback controls */}
        <div style={styles.mainControls}>
          <button
            onClick={togglePlayback}
            style={styles.playButton}
            disabled={playbackState.isLoading}
            title={playbackState.isPlaying ? "Pause" : "Play"}
          >
            <span style={styles.playIcon}>
              {playbackState.isLoading ? "⟳" : playbackState.isPlaying ? "⏸️" : "▶️"}
            </span>
          </button>

          <div style={styles.timeDisplay}>
            <span>{formatTime(playbackState.currentTime)}</span>
            <span style={styles.timeSeparator}>/</span>
            <span>{formatTime(playbackState.duration)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          ref={progressRef}
          style={styles.progressContainer}
          onClick={handleProgressClick}
        >
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${playbackState.duration > 0 ? (playbackState.currentTime / playbackState.duration) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Volume controls */}
        <div style={styles.volumeControls}>
          <button
            onClick={toggleMute}
            style={styles.volumeButton}
            title={playbackState.isMuted ? "Unmute" : "Mute"}
          >
            <span style={styles.volumeIcon}>
              {playbackState.isMuted ? "🔇" : playbackState.volume > 0.5 ? "🔊" : "🔉"}
            </span>
          </button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={playbackState.isMuted ? 0 : playbackState.volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={styles.volumeSlider}
            title="Volume"
          />
        </div>
      </div>
    );
  };

  // Render action buttons
  const renderActionButtons = () => {
    if (!onReRecord && !onConfirm) return null;

    return (
      <div style={styles.actionButtons}>
        {onReRecord && (
          <button onClick={onReRecord} style={styles.reRecordButton}>
            <span style={styles.buttonIcon}>🔄</span>
            Re-record
          </button>
        )}
        {onConfirm && (
          <button onClick={onConfirm} style={styles.confirmButton}>
            <span style={styles.buttonIcon}>✓</span>
            Use This Recording
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={className} style={{ ...styles.container, ...style }}>
      <div style={styles.header}>
        <h3 style={styles.title}>Preview Recording</h3>
        <div style={styles.mediaInfo}>
          <span style={styles.mediaType}>{mediaData.type.toUpperCase()}</span>
          {mediaData.mimeType && (
            <span style={styles.mimeType}>({mediaData.mimeType})</span>
          )}
        </div>
      </div>

      {playbackState.error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠️</span>
          <span>{playbackState.error}</span>
        </div>
      )}

      <div style={styles.previewArea}>
        {renderMediaContent()}
        {renderPlaybackControls()}
      </div>

      {renderActionButtons()}
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
    maxWidth: "600px",
    margin: "0 auto",
  } as React.CSSProperties,

  header: {
    marginBottom: "20px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  title: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: "8px",
  } as React.CSSProperties,

  mediaInfo: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#6B7280",
  } as React.CSSProperties,

  mediaType: {
    backgroundColor: "#EBF8FF",
    color: "#1E40AF",
    padding: "2px 8px",
    borderRadius: "4px",
    fontWeight: "bold",
  } as React.CSSProperties,

  mimeType: {
    fontStyle: "italic",
  } as React.CSSProperties,

  errorBanner: {
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

  previewArea: {
    marginBottom: "20px",
  } as React.CSSProperties,

  // Video styles
  videoContainer: {
    position: "relative" as const,
    backgroundColor: "#000000",
    borderRadius: "8px",
    overflow: "hidden",
    marginBottom: "16px",
  } as React.CSSProperties,

  video: {
    width: "100%",
    height: "auto",
    maxHeight: "400px",
    display: "block",
  } as React.CSSProperties,

  loadingOverlay: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
    color: "#FFFFFF",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: "16px",
    borderRadius: "8px",
  } as React.CSSProperties,

  // Audio styles
  audioContainer: {
    marginBottom: "16px",
  } as React.CSSProperties,

  audioVisualizer: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "24px",
    backgroundColor: "#F3F4F6",
    borderRadius: "8px",
    position: "relative" as const,
  } as React.CSSProperties,

  audioIcon: {
    fontSize: "48px",
  } as React.CSSProperties,

  audioInfo: {
    flex: 1,
  } as React.CSSProperties,

  audioLoading: {
    position: "absolute" as const,
    top: "50%",
    right: "20px",
    transform: "translateY(-50%)",
  } as React.CSSProperties,

  // Text styles
  textContainer: {
    marginBottom: "16px",
  } as React.CSSProperties,

  textHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  } as React.CSSProperties,

  textIcon: {
    fontSize: "20px",
  } as React.CSSProperties,

  textContent: {
    padding: "16px",
    backgroundColor: "#F9FAFB",
    border: "1px solid #E5E7EB",
    borderRadius: "8px",
    marginBottom: "8px",
    minHeight: "80px",
    fontSize: "16px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  textMeta: {
    fontSize: "12px",
    color: "#6B7280",
    textAlign: "right" as const,
  } as React.CSSProperties,

  textError: {
    color: "#DC2626",
    fontStyle: "italic",
  } as React.CSSProperties,

  // Control styles
  controls: {
    padding: "16px",
    backgroundColor: "#F9FAFB",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
  } as React.CSSProperties,

  mainControls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginBottom: "12px",
  } as React.CSSProperties,

  playButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    backgroundColor: "#3B82F6",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "20px",
    transition: "all 0.2s",
  } as React.CSSProperties,

  playIcon: {
    display: "block",
  } as React.CSSProperties,

  timeDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#374151",
    fontFamily: "monospace",
  } as React.CSSProperties,

  timeSeparator: {
    color: "#9CA3AF",
  } as React.CSSProperties,

  progressContainer: {
    marginBottom: "12px",
    cursor: "pointer",
  } as React.CSSProperties,

  progressTrack: {
    width: "100%",
    height: "6px",
    backgroundColor: "#E5E7EB",
    borderRadius: "3px",
    overflow: "hidden",
  } as React.CSSProperties,

  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    transition: "width 0.1s",
  } as React.CSSProperties,

  volumeControls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  } as React.CSSProperties,

  volumeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px",
  } as React.CSSProperties,

  volumeIcon: {
    display: "block",
  } as React.CSSProperties,

  volumeSlider: {
    width: "80px",
  } as React.CSSProperties,

  // Action button styles
  actionButtons: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  } as React.CSSProperties,

  reRecordButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#6B7280",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
  } as React.CSSProperties,

  confirmButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#10B981",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
  } as React.CSSProperties,

  buttonIcon: {
    fontSize: "16px",
  } as React.CSSProperties,

  errorContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "20px",
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: "8px",
    color: "#DC2626",
  } as React.CSSProperties,

  spinner: {
    fontSize: "24px",
    animation: "spin 1s linear infinite",
  } as React.CSSProperties,
};

export default MediaPreview;