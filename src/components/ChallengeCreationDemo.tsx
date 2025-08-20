/**
 * Demo component for Challenge Creation Form
 * Demonstrates the UI for entering 3 statements with lie selection and validation
 */

import React, { useState } from 'react';
import { ChallengeCreationForm } from './ChallengeCreationForm';

export const ChallengeCreationDemo: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<string | null>(null);

  const handleStartChallenge = () => {
    setShowForm(true);
    setSubmissionResult(null);
  };

  const handleSubmit = () => {
    // Simulate challenge submission
    setSubmissionResult('Challenge created successfully! 🎉');
    setShowForm(false);
    
    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      setSubmissionResult(null);
    }, 3000);
  };

  const handleCancel = () => {
    setShowForm(false);
    setSubmissionResult(null);
  };

  if (showForm) {
    return (
      <div style={styles.container}>
        <ChallengeCreationForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.welcomeCard}>
        <h2 style={styles.title}>Challenge Creation</h2>
        <p style={styles.description}>
          Create your own "Two Truths and a Lie" challenge! Write three statements about yourself - 
          two that are true and one that's a lie. Other players will try to guess which one is false.
        </p>
        
        <div style={styles.features}>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✍️</span>
            <span>Write 3 statements</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>🎭</span>
            <span>Mark one as a lie</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>✅</span>
            <span>Real-time validation</span>
          </div>
          <div style={styles.feature}>
            <span style={styles.featureIcon}>👀</span>
            <span>Preview before publishing</span>
          </div>
        </div>

        <button 
          onClick={handleStartChallenge}
          style={styles.startButton}
        >
          Create New Challenge
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
    maxWidth: '800px',
    margin: '0 auto',
  } as React.CSSProperties,

  welcomeCard: {
    padding: '32px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '16px',
  } as React.CSSProperties,

  description: {
    fontSize: '18px',
    color: '#6B7280',
    lineHeight: '1.6',
    marginBottom: '32px',
    maxWidth: '600px',
    margin: '0 auto 32px auto',
  } as React.CSSProperties,

  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  } as React.CSSProperties,

  feature: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    fontSize: '16px',
    color: '#374151',
  } as React.CSSProperties,

  featureIcon: {
    fontSize: '20px',
  } as React.CSSProperties,

  startButton: {
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
  } as React.CSSProperties,
};

export default ChallengeCreationDemo;