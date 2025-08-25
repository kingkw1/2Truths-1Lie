/**
 * Quality Feedback Component Tests
 * Tests real-time quality feedback functionality
 */

import React from 'react';
import { render } from '@testing-library/react';
import { screen, fireEvent, waitFor } from '@testing-library/dom';
import '@testing-library/jest-dom';
import { StatementQualityFeedback, MediaQualityFeedback, RealTimeQualityIndicator, AnimatedFeedback } from '../QualityFeedback';
import { analyzeStatementQuality, analyzeMediaQuality } from '../../utils/qualityAssessment';
import { MediaCapture } from '../../types/challenge';

describe('QualityFeedback Components', () => {
  describe('StatementQualityFeedback', () => {
    it('renders quality feedback for a good statement', () => {
      const quality = analyzeStatementQuality('I once traveled to Japan and visited Mount Fuji during cherry blossom season.');
      
      render(<StatementQualityFeedback quality={quality} isVisible={true} />);
      
      expect(screen.getByText('Statement Quality')).toBeInTheDocument();
      expect(screen.getByText(/\/100/)).toBeInTheDocument();
      expect(screen.getByText('Length')).toBeInTheDocument();
      expect(screen.getByText('Clarity')).toBeInTheDocument();
      expect(screen.getByText('Specificity')).toBeInTheDocument();
      expect(screen.getByText('Believability')).toBeInTheDocument();
    });

    it('renders compact version correctly', () => {
      const quality = analyzeStatementQuality('Short text');
      
      render(<StatementQualityFeedback quality={quality} isVisible={true} compact={true} />);
      
      expect(screen.getByText(/\/100/)).toBeInTheDocument();
      expect(screen.queryByText('Statement Quality')).not.toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      const quality = analyzeStatementQuality('Test statement');
      
      render(<StatementQualityFeedback quality={quality} isVisible={false} />);
      
      expect(screen.queryByText('Statement Quality')).not.toBeInTheDocument();
    });

    it('shows suggestions for poor quality statements', () => {
      const quality = analyzeStatementQuality('bad');
      
      render(<StatementQualityFeedback quality={quality} isVisible={true} />);
      
      expect(screen.getByText('💡 Suggestions:')).toBeInTheDocument();
    });
  });

  describe('MediaQualityFeedback', () => {
    it('renders media quality feedback', () => {
      const mediaData: MediaCapture = {
        type: 'audio',
        url: 'blob:test',
        duration: 10000,
        fileSize: 50000,
        mimeType: 'audio/webm',
      };
      
      const quality = analyzeMediaQuality(mediaData);
      
      render(<MediaQualityFeedback quality={quality} isVisible={true} />);
      
      expect(screen.getByText('Recording Quality')).toBeInTheDocument();
      expect(screen.getByText('Technical')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });

    it('renders compact version with media icon', () => {
      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:test',
        duration: 15000,
        fileSize: 1000000,
        mimeType: 'video/webm',
      };
      
      const quality = analyzeMediaQuality(mediaData);
      
      render(<MediaQualityFeedback quality={quality} isVisible={true} compact={true} />);
      
      expect(screen.getByText(/🎬/)).toBeInTheDocument();
      expect(screen.getByText(/\/100/)).toBeInTheDocument();
    });
  });

  describe('RealTimeQualityIndicator', () => {
    it('shows analyzing state', () => {
      render(<RealTimeQualityIndicator score={0} isAnalyzing={true} showLabel={true} />);
      
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });

    it('shows quality score when not analyzing', () => {
      render(<RealTimeQualityIndicator score={85} isAnalyzing={false} showLabel={true} />);
      
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('excellent')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<RealTimeQualityIndicator score={75} isAnalyzing={false} showLabel={false} />);
      
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.queryByText('good')).not.toBeInTheDocument();
    });
  });

  describe('AnimatedFeedback', () => {
    it('renders success message', () => {
      render(
        <AnimatedFeedback
          message="Great job!"
          type="success"
          isVisible={true}
        />
      );
      
      expect(screen.getByText('Great job!')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('renders warning message', () => {
      render(
        <AnimatedFeedback
          message="Could be better"
          type="warning"
          isVisible={true}
        />
      );
      
      expect(screen.getByText('Could be better')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('renders error message', () => {
      render(
        <AnimatedFeedback
          message="Something went wrong"
          type="error"
          isVisible={true}
        />
      );
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
    });

    it('renders info message', () => {
      render(
        <AnimatedFeedback
          message="Here's some info"
          type="info"
          isVisible={true}
        />
      );
      
      expect(screen.getByText("Here's some info")).toBeInTheDocument();
      expect(screen.getByText('ℹ️')).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
      render(
        <AnimatedFeedback
          message="Hidden message"
          type="info"
          isVisible={false}
        />
      );
      
      expect(screen.queryByText('Hidden message')).not.toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      const onDismiss = jest.fn();
      
      render(
        <AnimatedFeedback
          message="Dismissible message"
          type="info"
          isVisible={true}
          onDismiss={onDismiss}
        />
      );
      
      const dismissButton = screen.getByText('✕');
      fireEvent.click(dismissButton);
      
      expect(onDismiss).toHaveBeenCalled();
    });

    it('auto-hides after specified duration', async () => {
      const onDismiss = jest.fn();
      
      render(
        <AnimatedFeedback
          message="Auto-hide message"
          type="info"
          isVisible={true}
          onDismiss={onDismiss}
          autoHide={true}
          duration={100}
        />
      );
      
      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalled();
      }, { timeout: 200 });
    });
  });
});

describe('Quality Assessment Integration', () => {
  it('analyzes statement quality correctly', () => {
    const goodStatement = 'I visited Paris last summer and climbed the Eiffel Tower on July 15th, 2023.';
    const quality = analyzeStatementQuality(goodStatement);
    
    expect(quality.score).toBeGreaterThan(60);
    expect(quality.length.status).toBe('excellent');
    expect(quality.specificity.score).toBeGreaterThan(70);
  });

  it('analyzes poor statement quality correctly', () => {
    const poorStatement = 'bad';
    const quality = analyzeStatementQuality(poorStatement);
    
    expect(quality.score).toBeLessThan(60);
    expect(quality.length.status).toBe('poor');
    expect(quality.suggestions.length).toBeGreaterThan(0);
  });

  it('analyzes media quality correctly', () => {
    const goodMedia: MediaCapture = {
      type: 'audio',
      url: 'blob:test',
      duration: 15000, // 15 seconds
      fileSize: 100000, // 100KB
      mimeType: 'audio/webm',
    };
    
    const quality = analyzeMediaQuality(goodMedia);
    
    expect(quality.score).toBeGreaterThan(60);
    expect(quality.duration.status).toBe('excellent');
  });

  it('analyzes poor media quality correctly', () => {
    const poorMedia: MediaCapture = {
      type: 'audio',
      url: 'blob:test',
      duration: 1000, // 1 second - too short
      fileSize: 1000, // 1KB - very small
      mimeType: 'audio/webm',
    };
    
    const quality = analyzeMediaQuality(poorMedia);
    
    expect(quality.duration.status).toBe('poor');
    expect(quality.suggestions.length).toBeGreaterThan(0);
  });
});