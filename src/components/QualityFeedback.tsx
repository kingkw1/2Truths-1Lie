/**
 * Quality Feedback Component
 * Provides real-time visual feedback on statement and media quality
 * Requirements: Immediate feedback on recording and statement quality
 */

import React from 'react';
import { StatementQuality, MediaQuality, QualityMetric, getQualityColor, getQualityIcon } from '../utils/qualityAssessment';
import './QualityFeedback.css';

// ============================================================================
// STATEMENT QUALITY FEEDBACK
// ============================================================================

interface StatementQualityFeedbackProps {
  quality: StatementQuality | null;
  isVisible?: boolean;
  compact?: boolean;
}

export const StatementQualityFeedback: React.FC<StatementQualityFeedbackProps> = ({
  quality,
  isVisible = true,
  compact = false,
}) => {
  if (!isVisible || !quality) {
    return null;
  }

  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <div style={styles.compactScore}>
          <span style={{ color: getQualityColor(quality.score) }}>
            {getQualityIcon(getOverallStatus(quality.score))} {quality.score}/100
          </span>
        </div>
        {quality.suggestions.length > 0 && (
          <div style={styles.compactSuggestion}>
            {quality.suggestions[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>Statement Quality</h4>
        <div style={styles.overallScore}>
          <span style={{ color: getQualityColor(quality.score) }}>
            {quality.score}/100
          </span>
        </div>
      </div>

      <div style={styles.metrics}>
        <QualityMetricDisplay label="Length" metric={quality.length} />
        <QualityMetricDisplay label="Clarity" metric={quality.clarity} />
        <QualityMetricDisplay label="Specificity" metric={quality.specificity} />
        <QualityMetricDisplay label="Believability" metric={quality.believability} />
      </div>

      {quality.suggestions.length > 0 && (
        <div style={styles.suggestions}>
          <h5 style={styles.suggestionsTitle}>💡 Suggestions:</h5>
          <ul style={styles.suggestionsList}>
            {quality.suggestions.map((suggestion, index) => (
              <li key={index} style={styles.suggestionItem}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MEDIA QUALITY FEEDBACK
// ============================================================================

interface MediaQualityFeedbackProps {
  quality: MediaQuality | null;
  isVisible?: boolean;
  compact?: boolean;
}

export const MediaQualityFeedback: React.FC<MediaQualityFeedbackProps> = ({
  quality,
  isVisible = true,
  compact = false,
}) => {
  if (!isVisible || !quality) {
    return null;
  }

  if (compact) {
    return (
      <div style={styles.compactContainer}>
        <div style={styles.compactScore}>
          <span style={{ color: getQualityColor(quality.score) }}>
            🎬 {getQualityIcon(getOverallStatus(quality.score))} {quality.score}/100
          </span>
        </div>
        {quality.suggestions.length > 0 && (
          <div style={styles.compactSuggestion}>
            {quality.suggestions[0]}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>Recording Quality</h4>
        <div style={styles.overallScore}>
          <span style={{ color: getQualityColor(quality.score) }}>
            {quality.score}/100
          </span>
        </div>
      </div>

      <div style={styles.metrics}>
        <QualityMetricDisplay label="Technical" metric={quality.technical} />
        <QualityMetricDisplay label="Content" metric={quality.content} />
        <QualityMetricDisplay label="Duration" metric={quality.duration} />
      </div>

      {quality.suggestions.length > 0 && (
        <div style={styles.suggestions}>
          <h5 style={styles.suggestionsTitle}>💡 Suggestions:</h5>
          <ul style={styles.suggestionsList}>
            {quality.suggestions.map((suggestion, index) => (
              <li key={index} style={styles.suggestionItem}>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// QUALITY METRIC DISPLAY
// ============================================================================

interface QualityMetricDisplayProps {
  label: string;
  metric: QualityMetric;
}

const QualityMetricDisplay: React.FC<QualityMetricDisplayProps> = ({ label, metric }) => {
  return (
    <div style={styles.metric}>
      <div style={styles.metricHeader}>
        <span style={styles.metricLabel}>{label}</span>
        <span style={styles.metricIcon}>
          {getQualityIcon(metric.status)}
        </span>
      </div>
      <div style={styles.metricBar}>
        <div
          style={{
            ...styles.metricBarFill,
            width: `${metric.score}%`,
            backgroundColor: getQualityColor(metric.score),
          }}
        />
      </div>
      <div style={styles.metricMessage}>
        {metric.message}
      </div>
    </div>
  );
};

// ============================================================================
// REAL-TIME QUALITY INDICATOR
// ============================================================================

interface RealTimeQualityIndicatorProps {
  score: number;
  isAnalyzing?: boolean;
  showLabel?: boolean;
}

export const RealTimeQualityIndicator: React.FC<RealTimeQualityIndicatorProps> = ({
  score,
  isAnalyzing = false,
  showLabel = true,
}) => {
  const status = getOverallStatus(score);
  const color = getQualityColor(score);
  const icon = getQualityIcon(status);

  return (
    <div style={styles.realTimeIndicator}>
      {isAnalyzing ? (
        <div style={styles.analyzing}>
          <span style={styles.analyzingIcon}>🔄</span>
          {showLabel && <span style={styles.analyzingText}>Analyzing...</span>}
        </div>
      ) : (
        <div style={styles.qualityDisplay}>
          <span style={styles.qualityIcon}>{icon}</span>
          <span style={{ ...styles.qualityScore, color }}>
            {score}
          </span>
          {showLabel && (
            <span style={{ ...styles.qualityStatus, color }}>
              {status}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// ANIMATED FEEDBACK COMPONENT
// ============================================================================

interface AnimatedFeedbackProps {
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  isVisible: boolean;
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const AnimatedFeedback: React.FC<AnimatedFeedbackProps> = ({
  message,
  type,
  isVisible,
  onDismiss,
  autoHide = true,
  duration = 3000,
}) => {
  React.useEffect(() => {
    if (isVisible && autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, autoHide, onDismiss, duration]);

  if (!isVisible) return null;

  const typeStyles = {
    success: { backgroundColor: '#D1FAE5', borderColor: '#10B981', color: '#065F46' },
    warning: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' },
    error: { backgroundColor: '#FEE2E2', borderColor: '#EF4444', color: '#991B1B' },
    info: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', color: '#1E40AF' },
  };

  const typeIcons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  };

  return (
    <div
      style={{
        ...styles.animatedFeedback,
        ...typeStyles[type],
      }}
    >
      <span style={styles.feedbackIcon}>{typeIcons[type]}</span>
      <span style={styles.feedbackMessage}>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={styles.dismissButton}
        >
          ✕
        </button>
      )}
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getOverallStatus(score: number): QualityMetric['status'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    marginTop: '12px',
  } as React.CSSProperties,

  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#F3F4F6',
    borderRadius: '6px',
    fontSize: '12px',
  } as React.CSSProperties,

  compactScore: {
    fontWeight: 'bold',
  } as React.CSSProperties,

  compactSuggestion: {
    color: '#6B7280',
    fontStyle: 'italic',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  } as React.CSSProperties,

  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#374151',
    margin: 0,
  } as React.CSSProperties,

  overallScore: {
    fontSize: '18px',
    fontWeight: 'bold',
  } as React.CSSProperties,

  metrics: {
    display: 'grid',
    gap: '12px',
    marginBottom: '16px',
  } as React.CSSProperties,

  metric: {
    // No specific styles needed
  } as React.CSSProperties,

  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  } as React.CSSProperties,

  metricLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  } as React.CSSProperties,

  metricIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  metricBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#E5E7EB',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  } as React.CSSProperties,

  metricBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  } as React.CSSProperties,

  metricMessage: {
    fontSize: '12px',
    color: '#6B7280',
  } as React.CSSProperties,

  suggestions: {
    borderTop: '1px solid #E5E7EB',
    paddingTop: '12px',
  } as React.CSSProperties,

  suggestionsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#374151',
    margin: '0 0 8px 0',
  } as React.CSSProperties,

  suggestionsList: {
    margin: 0,
    paddingLeft: '20px',
  } as React.CSSProperties,

  suggestionItem: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '4px',
    lineHeight: '1.4',
  } as React.CSSProperties,

  realTimeIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: '#F3F4F6',
    borderRadius: '4px',
    fontSize: '12px',
  } as React.CSSProperties,

  analyzing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#6B7280',
  } as React.CSSProperties,

  analyzingIcon: {
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,

  analyzingText: {
    fontSize: '11px',
  } as React.CSSProperties,

  qualityDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties,

  qualityIcon: {
    fontSize: '14px',
  } as React.CSSProperties,

  qualityScore: {
    fontWeight: 'bold',
    fontSize: '12px',
  } as React.CSSProperties,

  qualityStatus: {
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    fontWeight: '500',
  } as React.CSSProperties,

  animatedFeedback: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    border: '1px solid',
    borderRadius: '6px',
    fontSize: '14px',
    animation: 'slideIn 0.3s ease-out',
    marginTop: '8px',
  } as React.CSSProperties,

  feedbackIcon: {
    fontSize: '16px',
  } as React.CSSProperties,

  feedbackMessage: {
    flex: 1,
  } as React.CSSProperties,

  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '2px',
    opacity: 0.7,
  } as React.CSSProperties,
};

export default {
  StatementQualityFeedback,
  MediaQualityFeedback,
  RealTimeQualityIndicator,
  AnimatedFeedback,
};