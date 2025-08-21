/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI or default error message
      return (
        this.props.fallback || (
          <div style={styles.errorContainer}>
            <div style={styles.errorCard}>
              <h2 style={styles.errorTitle}>⚠️ Something went wrong</h2>
              <p style={styles.errorMessage}>
                There was an error rendering this component. Please refresh the page or try again.
              </p>
              {this.state.error && (
                <details style={styles.errorDetails}>
                  <summary style={styles.errorSummary}>Error Details</summary>
                  <pre style={styles.errorPre}>{this.state.error.message}</pre>
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                style={styles.refreshButton}
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

const styles = {
  errorContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '400px',
    padding: '20px',
  } as React.CSSProperties,

  errorCard: {
    maxWidth: '500px',
    padding: '32px',
    backgroundColor: '#FEF2F2',
    border: '2px solid #FECACA',
    borderRadius: '12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  errorTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: '16px',
  } as React.CSSProperties,

  errorMessage: {
    fontSize: '16px',
    color: '#7F1D1D',
    lineHeight: '1.5',
    marginBottom: '24px',
  } as React.CSSProperties,

  errorDetails: {
    textAlign: 'left' as const,
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #FECACA',
    borderRadius: '8px',
  } as React.CSSProperties,

  errorSummary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: '8px',
  } as React.CSSProperties,

  errorPre: {
    fontSize: '12px',
    color: '#7F1D1D',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  } as React.CSSProperties,

  refreshButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
};

export default ErrorBoundary;