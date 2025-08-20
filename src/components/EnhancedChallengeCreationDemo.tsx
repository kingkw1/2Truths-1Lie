/**
 * Enhanced Challenge Creation Demo Component
 * Demonstrates the media recording capabilities integrated with challenge creation
 */

import React, { useState } from 'react';
import EnhancedChallengeCreationForm from './EnhancedChallengeCreationForm';

export const EnhancedChallengeCreationDemo: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<string | null>(null);

  const handleStartChallenge = () => {
    setShowForm(true);
    setSubmissionResult(null);
  };

  const handleSubmit = () => {
    // Simulate challenge submission with media
    setSubmissionResult('Challenge with media created successfully! 🎉🎬');
    setShowForm(false);
    
    // Auto-hide success message after 4 seconds
    setTimeout(() => {
      setSubmissionResult(null);
    }, 4000);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSubmissionResult(null);
  };

  if (showForm) {
    return (
      <div style={styles.container}>
        <EnhancedChallengeCreationForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.welcomeCard}>
        <h2 style={styles.title}>Enhanced Challenge Creation</h2>
        <p style={styles.description}>
          Create your own "Two Truths and a Lie" challenge with multimedia support! 
          Record video, audio, or stick with text-only statements. The system automatically 
          falls back to simpler formats if your device doesn't support advanced recording.
        </p>
        
        <div style={styles.features}>
          <div style={styles.featureSection}>
            <h3 style={styles.featureSectionTitle}>📹 Media Recording</h3>
            <div style={styles.featureGrid}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🎥</span>
                <div>
                  <strong>Video Recording</strong>
                  <p>Record yourself telling each statement with full video and audio</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🎤</span>
                <div>
                  <strong>Audio Recording</strong>
                  <p>Voice-only recording for when you prefer audio-only statements</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>📝</span>
                <div>
                  <strong>Text Only</strong>
                  <p>Traditional text-based statements, always available as fallback</p>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.featureSection}>
            <h3 style={styles.featureSectionTitle}>🔧 Smart Features</h3>
            <div style={styles.featureGrid}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔄</span>
                <div>
                  <strong>Automatic Fallback</strong>
                  <p>Gracefully falls back to supported formats if permissions are denied</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>⏱️</span>
                <div>
                  <strong>Time Limits</strong>
                  <p>30-second recording limit to keep challenges engaging and concise</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>👀</span>
                <div>
                  <strong>Live Preview</strong>
                  <p>See your video/audio recordings before finalizing your challenge</p>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.featureSection}>
            <h3 style={styles.featureSectionTitle}>✨ Enhanced Experience</h3>
            <div style={styles.featureGrid}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🎭</span>
                <div>
                  <strong>Lie Detection</strong>
                  <p>Mark which statement is the lie with clear visual indicators</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>✅</span>
                <div>
                  <strong>Real-time Validation</strong>
                  <p>Instant feedback on form completion and requirements</p>
                </div>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔍</span>
                <div>
                  <strong>Preview Mode</strong>
                  <p>Review your complete challenge before publishing</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.compatibilityInfo}>
          <h4 style={styles.compatibilityTitle}>Device Compatibility</h4>
          <p style={styles.compatibilityText}>
            This system works on all modern browsers and devices. If your device doesn't support 
            video or audio recording, it will automatically fall back to text-only mode while 
            maintaining full functionality.
          </p>
        </div>

        <button 
          onClick={handleStartChallenge}
          style={styles.startButton}
        >
          Create Enhanced Challenge
        </button>

        {submissionResult && (
          <div style={styles.successMessage}>
            {submissionResult}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1000px',
    margin: '0 auto',
  } as React.CSSProperties,

  welcomeCard: {
    padding: '32px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  description: {
    fontSize: '18px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '32px',
    textAlign: 'center' as const,
    maxWidth: '800px',
    margin: '0 auto 32px auto',
  } as React.CSSProperties,

  features: {
    marginBottom: '32px',
  } as React.CSSProperties,

  featureSection: {
    marginBottom: '32px',
  } as React.CSSProperties,

  featureSectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  } as React.CSSProperties,

  feature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  featureIcon: {
    fontSize: '24px',
    flexShrink: 0,
    marginTop: '4px',
  } as React.CSSProperties,

  compatibilityInfo: {
    padding: '20px',
    backgroundColor: '#EBF8FF',
    borderRadius: '8px',
    border: '1px solid #93C5FD',
    marginBottom: '32px',
  } as React.CSSProperties,

  compatibilityTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: '8px',
  } as React.CSSProperties,

  compatibilityText: {
    fontSize: '14px',
    color: '#1E40AF',
    lineHeight: '1.5',
    margin: 0,
  } as React.CSSProperties,

  startButton: {
    display: 'block',
    margin: '0 auto',
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,

  successMessage: {
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#D1FAE5',
    border: '1px solid #A7F3D0',
    borderRadius: '8px',
    color: '#065F46',
    fontSize: '16px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
  } as React.CSSProperties,
};

export default EnhancedChallengeCreationDemo;