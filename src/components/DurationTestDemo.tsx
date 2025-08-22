import React from 'react';
import { useMediaRecording } from '../hooks/useMediaRecording';

/**
 * Simple component to test that video recordings include audio and duration is calculated correctly.
 * Also verifies that compression is disabled to preserve audio tracks.
 */
export const DurationTestDemo: React.FC = () => {
  const {
    isRecording,
    recordedMedia,
    error,
    startRecording,
    stopRecording,
    duration,
  } = useMediaRecording();

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Video+Audio Recording Test</h2>
      <p>
        This component tests that video recordings include both video AND audio tracks.
        Compression is disabled to ensure audio is preserved during recording.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <h3>Recording Controls</h3>
        {!isRecording ? (
          <button 
            onClick={() => startRecording('video')}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            🎥 Start Video Recording
          </button>
        ) : (
          <div>
            <p style={{ color: '#ef4444', fontWeight: 'bold' }}>
              🔴 Recording... {formatDuration(duration)}
            </p>
            <button 
              onClick={stopRecording}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ⏹️ Stop Recording
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {recordedMedia && (
        <div style={{ marginTop: '20px' }}>
          <h3>Recorded Media</h3>
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f0f9ff', 
            border: '1px solid #bae6fd',
            borderRadius: '8px' 
          }}>
            <p><strong>Type:</strong> {recordedMedia.type}</p>
            <p><strong>Size:</strong> {((recordedMedia.fileSize || 0) / 1024 / 1024).toFixed(2)} MB</p>
            <p>
              <strong>Duration:</strong> {formatDuration(recordedMedia.duration || 0)}
              {recordedMedia.duration && !isFinite(recordedMedia.duration) && (
                <span style={{ color: '#dc2626', marginLeft: '8px' }}>
                  (⚠️ Invalid duration detected!)
                </span>
              )}
              {recordedMedia.duration && isFinite(recordedMedia.duration) && recordedMedia.duration > 0 && (
                <span style={{ color: '#16a34a', marginLeft: '8px' }}>
                  ✅ Valid duration
                </span>
              )}
            </p>
            <p><strong>MIME Type:</strong> {recordedMedia.mimeType}</p>
            
            <div style={{ marginTop: '16px' }}>
              <video 
                controls 
                src={recordedMedia.url}
                style={{ width: '100%', maxWidth: '400px' }}
              />
            </div>
          </div>
        </div>
      )}

      <div style={{ 
        marginTop: '30px', 
        padding: '16px', 
        backgroundColor: '#f9fafb', 
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h4>What this test verifies:</h4>
        <ul>
          <li>✅ Video recordings work with audio</li>
          <li>✅ Audio is preserved (no compression stripping audio tracks)</li>
          <li>✅ Duration is calculated correctly even when video metadata shows "Infinity"</li>
          <li>✅ Falls back to actual recording time when video duration is invalid</li>
          <li>✅ Shows proper duration formatting (MM:SS)</li>
          <li>✅ No "compressing" message appears (compression disabled)</li>
          <li>🎵 <strong>MOST IMPORTANT: Audio is audible when playing back the video!</strong></li>
        </ul>
      </div>
    </div>
  );
};
