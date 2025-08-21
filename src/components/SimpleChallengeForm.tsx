/**
 * Simple Challenge Form - Fallback Component
 * Basic challenge creation form without Redux for testing
 */

import React, { useState } from 'react';

export const SimpleChallengeForm: React.FC = () => {
  const [statements, setStatements] = useState(['', '', '']);
  const [selectedLie, setSelectedLie] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleStatementChange = (index: number, value: string) => {
    const newStatements = [...statements];
    newStatements[index] = value;
    setStatements(newStatements);
  };

  const handleSubmit = () => {
    if (statements.every(s => s.trim()) && selectedLie !== null) {
      setSubmitted(true);
      console.log('Challenge submitted:', { statements, lieIndex: selectedLie });
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSubmitted(false);
        setStatements(['', '', '']);
        setSelectedLie(null);
      }, 3000);
    }
  };

  const isValid = statements.every(s => s.trim()) && selectedLie !== null;

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <h3>🎉 Challenge Created Successfully!</h3>
          <p>Your challenge has been submitted.</p>
          <div style={styles.submittedData}>
            <h4>Your Statements:</h4>
            {statements.map((stmt, index) => (
              <div key={index} style={{
                ...styles.submittedStatement,
                ...(index === selectedLie ? styles.lieStatement : {})
              }}>
                <strong>Statement {index + 1}:</strong> {stmt}
                {index === selectedLie && <span style={styles.lieLabel}> (LIE)</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h3 style={styles.title}>🎯 Simple Challenge Creator</h3>
        <p style={styles.subtitle}>
          This is a fallback form that works without Redux. Create your challenge below!
        </p>

        <div style={styles.statementsContainer}>
          {statements.map((statement, index) => (
            <div key={index} style={styles.statementGroup}>
              <div style={styles.statementHeader}>
                <label style={styles.statementLabel}>Statement {index + 1}</label>
                <button
                  type="button"
                  onClick={() => setSelectedLie(index)}
                  style={{
                    ...styles.lieButton,
                    ...(selectedLie === index ? styles.lieButtonSelected : {})
                  }}
                >
                  {selectedLie === index ? '✓ This is the lie' : 'Mark as lie'}
                </button>
              </div>
              
              <textarea
                value={statement}
                onChange={(e) => handleStatementChange(index, e.target.value)}
                placeholder={`Enter statement ${index + 1} (true or false)...`}
                style={{
                  ...styles.textarea,
                  ...(selectedLie === index ? styles.textareaLie : {})
                }}
                rows={3}
              />
            </div>
          ))}
        </div>

        <div style={styles.statusBar}>
          <div>
            <strong>Progress:</strong> {statements.filter(s => s.trim()).length}/3 statements
          </div>
          <div>
            <strong>Lie selected:</strong> {selectedLie !== null ? 'Yes' : 'No'}
          </div>
        </div>

        <div style={styles.buttonContainer}>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              ...styles.submitButton,
              ...(isValid ? {} : styles.submitButtonDisabled)
            }}
          >
            Create Challenge
          </button>
        </div>

        <div style={styles.instructions}>
          <h4>📝 How to test:</h4>
          <ol style={styles.instructionsList}>
            <li>Fill in all 3 statements with different content</li>
            <li>Click "Mark as lie" on exactly one statement</li>
            <li>Click "Create Challenge" to submit</li>
            <li>Check the console for submitted data</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '20px',
  } as React.CSSProperties,

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    border: '2px solid #10B981',
  } as React.CSSProperties,

  successCard: {
    backgroundColor: '#D1FAE5',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center' as const,
    border: '2px solid #10B981',
  } as React.CSSProperties,

  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: '8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    textAlign: 'center' as const,
    marginBottom: '24px',
  } as React.CSSProperties,

  statementsContainer: {
    marginBottom: '20px',
  } as React.CSSProperties,

  statementGroup: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
  } as React.CSSProperties,

  statementHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  } as React.CSSProperties,

  statementLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151',
  } as React.CSSProperties,

  lieButton: {
    padding: '4px 8px',
    fontSize: '12px',
    border: '1px solid #D1D5DB',
    borderRadius: '4px',
    backgroundColor: '#FFFFFF',
    color: '#374151',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  lieButtonSelected: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    borderColor: '#EF4444',
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,

  textareaLie: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  } as React.CSSProperties,

  statusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#F3F4F6',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '20px',
  } as React.CSSProperties,

  buttonContainer: {
    textAlign: 'center' as const,
    marginBottom: '20px',
  } as React.CSSProperties,

  submitButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#10B981',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,

  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    cursor: 'not-allowed',
  } as React.CSSProperties,

  instructions: {
    backgroundColor: '#EBF8FF',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #93C5FD',
  } as React.CSSProperties,

  instructionsList: {
    margin: '8px 0 0 20px',
    color: '#1E40AF',
  } as React.CSSProperties,

  submittedData: {
    textAlign: 'left' as const,
    marginTop: '16px',
  } as React.CSSProperties,

  submittedStatement: {
    padding: '8px',
    margin: '4px 0',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    border: '1px solid #D1D5DB',
  } as React.CSSProperties,

  lieStatement: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  } as React.CSSProperties,

  lieLabel: {
    color: '#EF4444',
    fontWeight: 'bold',
  } as React.CSSProperties,
};

export default SimpleChallengeForm;