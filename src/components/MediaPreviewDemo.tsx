/**
 * Demo component for MediaPreview
 * Showcases video, audio, and text media preview functionality
 */

import React, { useState } from 'react';
import MediaPreview from './MediaPreview';
import { MediaCapture, MediaType } from '../types/challenge';

interface MediaPreviewDemoProps {
  className?: string;
}

export const MediaPreviewDemo: React.FC<MediaPreviewDemoProps> = ({ className = '' }) => {
  const [selectedDemo, setSelectedDemo] = useState<MediaType>('video');
  const [showReRecordConfirm, setShowReRecordConfirm] = useState(false);

  // Sample media data for demonstration
  const sampleMediaData: Record<MediaType, MediaCapture> = {
    video: {
      type: 'video',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      duration: 30000,
      fileSize: 2048000,
      mimeType: 'video/mp4',
    },
    audio: {
      type: 'audio',
      url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
      duration: 15000,
      fileSize: 512000,
      mimeType: 'audio/wav',
    },
    text: {
      type: 'text',
      url: 'data:text/plain;base64,VGhpcyBpcyBhIHNhbXBsZSB0ZXh0IHJlY29yZGluZyBmb3IgdGhlIDJUcnV0aHMtMUxpZSBnYW1lLiBJdCBkZW1vbnN0cmF0ZXMgaG93IHRleHQgY29udGVudCBpcyBkaXNwbGF5ZWQgaW4gdGhlIE1lZGlhUHJldmlldyBjb21wb25lbnQuIFRoaXMgY291bGQgYmUgb25lIG9mIHlvdXIgdGhyZWUgc3RhdGVtZW50cyE=',
      duration: 0,
      fileSize: 234,
      mimeType: 'text/plain',
    },
  };

  const handleReRecord = () => {
    setShowReRecordConfirm(true);
    setTimeout(() => {
      setShowReRecordConfirm(false);
      alert('Re-recording would start here! This would typically navigate back to the MediaRecorder component.');
    }, 1000);
  };

  const handleConfirm = () => {
    alert(`${selectedDemo.toUpperCase()} recording confirmed! This would typically save the media and proceed to the next step.`);
  };

  const handleDemoChange = (type: MediaType) => {
    setSelectedDemo(type);
  };

  return (
    <div className={className} style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>MediaPreview Component Demo</h2>
        <p style={styles.description}>
          This demo showcases the MediaPreview component's ability to handle different media types
          with full playback controls and user interaction options.
        </p>
      </div>

      {/* Demo Type Selection */}
      <div style={styles.demoSelection}>
        <h3 style={styles.sectionTitle}>Select Media Type to Preview:</h3>
        <div style={styles.typeButtons}>
          {(['video', 'audio', 'text'] as MediaType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleDemoChange(type)}
              style={{
                ...styles.typeButton,
                ...(selectedDemo === type ? styles.typeButtonActive : {}),
              }}
            >
              <span style={styles.typeIcon}>
                {type === 'video' ? '🎥' : type === 'audio' ? '🎤' : '📝'}
              </span>
              <span style={styles.typeLabel}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Feature Highlights */}
      <div style={styles.features}>
        <h3 style={styles.sectionTitle}>Current Demo Features:</h3>
        <div style={styles.featureList}>
          {selectedDemo === 'video' && (
            <>
              <div style={styles.feature}>✓ Full video playback with native controls</div>
              <div style={styles.feature}>✓ Play/pause, seek, and volume control</div>
              <div style={styles.feature}>✓ Progress bar with click-to-seek</div>
              <div style={styles.feature}>✓ Loading states and error handling</div>
            </>
          )}
          {selectedDemo === 'audio' && (
            <>
              <div style={styles.feature}>✓ Audio playback with visual feedback</div>
              <div style={styles.feature}>✓ Audio visualizer with playback status</div>
              <div style={styles.feature}>✓ File size and duration display</div>
              <div style={styles.feature}>✓ Full playback controls</div>
            </>
          )}
          {selectedDemo === 'text' && (
            <>
              <div style={styles.feature}>✓ Text content display with formatting</div>
              <div style={styles.feature}>✓ Character count and metadata</div>
              <div style={styles.feature}>✓ Clean, readable text presentation</div>
              <div style={styles.feature}>✓ No unnecessary playback controls</div>
            </>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {showReRecordConfirm && (
        <div style={styles.statusMessage}>
          <span style={styles.statusIcon}>🔄</span>
          <span>Initiating re-recording...</span>
        </div>
      )}

      {/* MediaPreview Component */}
      <div style={styles.previewSection}>
        <MediaPreview
          mediaData={sampleMediaData[selectedDemo]}
          onReRecord={handleReRecord}
          onConfirm={handleConfirm}
          showControls={true}
          autoPlay={false}
        />
      </div>

      {/* Implementation Notes */}
      <div style={styles.notes}>
        <h3 style={styles.sectionTitle}>Implementation Notes:</h3>
        <div style={styles.notesList}>
          <div style={styles.note}>
            <strong>Video Preview:</strong> Supports all modern video formats with full HTML5 video controls,
            including play/pause, seeking, volume control, and mute functionality.
          </div>
          <div style={styles.note}>
            <strong>Audio Preview:</strong> Provides audio playback with a visual interface since audio
            elements are not visible. Includes the same control features as video.
          </div>
          <div style={styles.note}>
            <strong>Text Preview:</strong> Displays text content in a readable format with metadata.
            No playback controls are shown since they're not applicable to text.
          </div>
          <div style={styles.note}>
            <strong>Error Handling:</strong> The component gracefully handles media loading errors,
            unsupported formats, and missing content with user-friendly error messages.
          </div>
          <div style={styles.note}>
            <strong>Accessibility:</strong> All controls include proper ARIA labels and keyboard navigation
            support for screen readers and keyboard-only users.
          </div>
        </div>
      </div>

      {/* Integration Example */}
      <div style={styles.integration}>
        <h3 style={styles.sectionTitle}>Integration Example:</h3>
        <pre style={styles.codeBlock}>
{`import MediaPreview from './components/MediaPreview';

// In your component:
<MediaPreview
  mediaData={recordedMedia}
  onReRecord={() => setStep('recording')}
  onConfirm={() => setStep('publishing')}
  showControls={true}
  autoPlay={false}
/>`}
        </pre>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,

  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  } as React.CSSProperties,

  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '12px',
  } as React.CSSProperties,

  description: {
    fontSize: '16px',
    color: '#6B7280',
    lineHeight: '1.6',
    maxWidth: '600px',
    margin: '0 auto',
  } as React.CSSProperties,

  demoSelection: {
    marginBottom: '32px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '16px',
  } as React.CSSProperties,

  typeButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  typeButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    padding: '16px 24px',
    border: '2px solid #D1D5DB',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '120px',
  } as React.CSSProperties,

  typeButtonActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EBF8FF',
    color: '#1E40AF',
  } as React.CSSProperties,

  typeIcon: {
    fontSize: '32px',
  } as React.CSSProperties,

  typeLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  features: {
    marginBottom: '32px',
    padding: '20px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  featureList: {
    display: 'grid',
    gap: '8px',
  } as React.CSSProperties,

  feature: {
    fontSize: '14px',
    color: '#059669',
    fontWeight: '500',
  } as React.CSSProperties,

  statusMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#EBF8FF',
    border: '1px solid #BFDBFE',
    borderRadius: '8px',
    color: '#1E40AF',
    fontSize: '14px',
    marginBottom: '20px',
  } as React.CSSProperties,

  statusIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  previewSection: {
    marginBottom: '32px',
  } as React.CSSProperties,

  notes: {
    marginBottom: '32px',
  } as React.CSSProperties,

  notesList: {
    display: 'grid',
    gap: '16px',
  } as React.CSSProperties,

  note: {
    padding: '16px',
    backgroundColor: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#92400E',
  } as React.CSSProperties,

  integration: {
    padding: '20px',
    backgroundColor: '#F3F4F6',
    borderRadius: '12px',
    border: '1px solid #D1D5DB',
  } as React.CSSProperties,

  codeBlock: {
    backgroundColor: '#1F2937',
    color: '#F9FAFB',
    padding: '16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'Monaco, Consolas, monospace',
    overflow: 'auto',
    lineHeight: '1.5',
  } as React.CSSProperties,
};

export default MediaPreviewDemo;