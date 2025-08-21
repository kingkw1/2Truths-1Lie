/**
 * App Health Check Component
 * Simple test component to verify React, Redux, and basic functionality
 */

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';

export const AppHealthCheck: React.FC = () => {
  const [testCounter, setTestCounter] = useState(0);
  const dispatch = useDispatch();
  
  // Test Redux connection
  const challengeCreationState = useSelector((state: RootState) => state.challengeCreation);
  const gameSessionState = useSelector((state: RootState) => state.gameSession);

  const handleTestClick = () => {
    setTestCounter(prev => prev + 1);
    console.log('Test button clicked:', testCounter + 1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h3 style={styles.title}>🔧 App Health Check</h3>
        
        <div style={styles.testGrid}>
          <div style={styles.testItem}>
            <span style={styles.testLabel}>React Rendering:</span>
            <span style={styles.testStatus}>✅ Working</span>
          </div>
          
          <div style={styles.testItem}>
            <span style={styles.testLabel}>Redux Store:</span>
            <span style={styles.testStatus}>
              {challengeCreationState ? '✅ Connected' : '❌ Failed'}
            </span>
          </div>
          
          <div style={styles.testItem}>
            <span style={styles.testLabel}>State Updates:</span>
            <span style={styles.testStatus}>
              <button onClick={handleTestClick} style={styles.testButton}>
                Test ({testCounter})
              </button>
            </span>
          </div>
          
          <div style={styles.testItem}>
            <span style={styles.testLabel}>Challenge State:</span>
            <span style={styles.testStatus}>
              {challengeCreationState?.currentChallenge ? '✅ Initialized' : '❌ Missing'}
            </span>
          </div>
          
          <div style={styles.testItem}>
            <span style={styles.testLabel}>Statements Array:</span>
            <span style={styles.testStatus}>
              {challengeCreationState?.currentChallenge?.statements?.length === 3 
                ? '✅ Ready (3 slots)' 
                : `❌ Wrong length (${challengeCreationState?.currentChallenge?.statements?.length || 0})`}
            </span>
          </div>
        </div>

        <div style={styles.debugInfo}>
          <details style={styles.debugDetails}>
            <summary style={styles.debugSummary}>Debug Info</summary>
            <pre style={styles.debugPre}>
              {JSON.stringify({
                challengeCreation: challengeCreationState ? {
                  hasCurrentChallenge: !!challengeCreationState.currentChallenge,
                  statementsLength: challengeCreationState.currentChallenge?.statements?.length,
                  validationErrors: challengeCreationState.validationErrors?.length,
                  isSubmitting: challengeCreationState.isSubmitting,
                  previewMode: challengeCreationState.previewMode
                } : 'null',
                gameSession: gameSessionState ? {
                  hasCurrentSession: !!gameSessionState.currentSession,
                  isActive: gameSessionState.isActive
                } : 'null'
              }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    margin: '20px 0',
  } as React.CSSProperties,

  card: {
    padding: '20px',
    backgroundColor: '#F0F9FF',
    border: '2px solid #0EA5E9',
    borderRadius: '8px',
    maxWidth: '600px',
    margin: '0 auto',
  } as React.CSSProperties,

  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#0C4A6E',
    marginBottom: '16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  testGrid: {
    display: 'grid',
    gap: '12px',
    marginBottom: '20px',
  } as React.CSSProperties,

  testItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '6px',
    border: '1px solid #E0E7FF',
  } as React.CSSProperties,

  testLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151',
  } as React.CSSProperties,

  testStatus: {
    fontSize: '14px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  testButton: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid #0EA5E9',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    color: '#0EA5E9',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  debugInfo: {
    marginTop: '16px',
  } as React.CSSProperties,

  debugDetails: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E0E7FF',
    borderRadius: '6px',
    padding: '12px',
  } as React.CSSProperties,

  debugSummary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#0C4A6E',
    marginBottom: '8px',
  } as React.CSSProperties,

  debugPre: {
    fontSize: '11px',
    color: '#374151',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    maxHeight: '200px',
    overflow: 'auto',
  } as React.CSSProperties,
};

export default AppHealthCheck;