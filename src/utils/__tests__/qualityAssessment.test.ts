/**
 * Quality Assessment Utilities Tests
 * Tests statement and media quality analysis functions
 */

import {
  analyzeStatementQuality,
  analyzeMediaQuality,
  createDebouncedQualityAnalyzer,
  getQualityColor,
  getQualityIcon,
} from '../qualityAssessment';
import { MediaCapture } from '../../types/challenge';

describe('Statement Quality Analysis', () => {
  describe('analyzeStatementQuality', () => {
    it('analyzes empty statement correctly', () => {
      const quality = analyzeStatementQuality('');
      
      expect(quality.score).toBe(0);
      expect(quality.length.status).toBe('poor');
      expect(quality.clarity.status).toBe('poor');
      expect(quality.suggestions.length).toBeGreaterThan(0);
    });

    it('analyzes short statement correctly', () => {
      const quality = analyzeStatementQuality('I like cats');
      
      expect(quality.length.status).toBe('fair');
      expect(quality.suggestions.length).toBeGreaterThan(0);
      // Check that it suggests improvements for specificity
      expect(quality.suggestions).toContain('Include specific dates, numbers, or names');
    });

    it('analyzes good length statement correctly', () => {
      const quality = analyzeStatementQuality('I visited Tokyo last year and tried authentic ramen at a small restaurant in Shibuya');
      
      expect(quality.length.status).toBe('excellent');
      expect(quality.length.score).toBeGreaterThan(80);
    });

    it('analyzes overly long statement correctly', () => {
      const longText = 'This is a very long statement that goes on and on and on and provides way too much detail about everything and becomes quite tedious to read and probably loses the attention of the reader because it just keeps going without really adding much value to the overall challenge and makes it difficult for people to guess whether it is true or false because there is just too much information to process and analyze effectively';
      const quality = analyzeStatementQuality(longText);
      
      expect(quality.length.status).toBe('fair');
      expect(quality.length.message).toContain('Too long');
    });

    it('detects clarity issues', () => {
      const quality = analyzeStatementQuality('i went there and did stuff and things happened');
      
      expect(quality.clarity.score).toBeLessThan(70);
    });

    it('rewards specific details', () => {
      const specificStatement = 'I graduated from Stanford University on June 15, 2020, at 3:30 PM';
      const vagueStatement = 'I graduated from college a while ago';
      
      const specificQuality = analyzeStatementQuality(specificStatement);
      const vagueQuality = analyzeStatementQuality(vagueStatement);
      
      expect(specificQuality.specificity.score).toBeGreaterThan(vagueQuality.specificity.score);
    });

    it('detects suspicious/unbelievable content', () => {
      const suspiciousStatement = 'I won a billion dollars in the lottery and met aliens';
      const believableStatement = 'I went to the grocery store and bought milk';
      
      const suspiciousQuality = analyzeStatementQuality(suspiciousStatement);
      const believableQuality = analyzeStatementQuality(believableStatement);
      
      expect(suspiciousQuality.believability.score).toBeLessThan(believableQuality.believability.score);
    });

    it('provides helpful suggestions', () => {
      const quality = analyzeStatementQuality('bad');
      
      expect(quality.suggestions).toContain('Add more details to make your statement more interesting');
      expect(quality.suggestions).toContain('Check your grammar and punctuation');
    });

    it('provides positive feedback for good statements', () => {
      const quality = analyzeStatementQuality('I visited the Louvre Museum in Paris on March 10, 2023, and spent three hours admiring the Mona Lisa.');
      
      if (quality.score >= 80) {
        expect(quality.suggestions).toContain('Great statement! This should work well in your challenge.');
      }
    });
  });
});

describe('Media Quality Analysis', () => {
  describe('analyzeMediaQuality', () => {
    it('analyzes video media correctly', () => {
      const videoMedia: MediaCapture = {
        type: 'video',
        url: 'blob:test',
        duration: 15000, // 15 seconds
        fileSize: 2000000, // 2MB
        mimeType: 'video/webm',
      };
      
      const quality = analyzeMediaQuality(videoMedia);
      
      expect(quality.score).toBeGreaterThan(0);
      expect(quality.technical).toBeDefined();
      expect(quality.content).toBeDefined();
      expect(quality.duration).toBeDefined();
    });

    it('analyzes audio media correctly', () => {
      const audioMedia: MediaCapture = {
        type: 'audio',
        url: 'blob:test',
        duration: 10000, // 10 seconds
        fileSize: 500000, // 500KB
        mimeType: 'audio/webm',
      };
      
      const quality = analyzeMediaQuality(audioMedia);
      
      expect(quality.duration.status).toBe('excellent');
      expect(quality.technical.score).toBeGreaterThan(50);
    });

    it('analyzes text media correctly', () => {
      const textMedia: MediaCapture = {
        type: 'text',
        url: 'data:text/plain;base64,dGVzdA==',
        duration: 0,
        fileSize: 100,
        mimeType: 'text/plain',
      };
      
      const quality = analyzeMediaQuality(textMedia);
      
      expect(quality.content.status).toBe('good');
      expect(quality.duration.message).toContain('not applicable');
    });

    it('penalizes very short recordings', () => {
      const shortMedia: MediaCapture = {
        type: 'audio',
        url: 'blob:test',
        duration: 1500, // 1.5 seconds
        fileSize: 10000,
        mimeType: 'audio/webm',
      };
      
      const quality = analyzeMediaQuality(shortMedia);
      
      expect(quality.duration.status).toBe('poor');
      expect(quality.duration.message).toContain('Too short');
    });

    it('penalizes very long recordings', () => {
      const longMedia: MediaCapture = {
        type: 'video',
        url: 'blob:test',
        duration: 35000, // 35 seconds
        fileSize: 10000000,
        mimeType: 'video/webm',
      };
      
      const quality = analyzeMediaQuality(longMedia);
      
      expect(quality.duration.status).toBe('fair');
      expect(quality.duration.message).toContain('bit long');
    });

    it('provides appropriate suggestions', () => {
      const poorMedia: MediaCapture = {
        type: 'audio',
        url: 'blob:test',
        duration: 1000, // Too short
        fileSize: 1000, // Very small
        mimeType: 'audio/webm',
      };
      
      const quality = analyzeMediaQuality(poorMedia);
      
      expect(quality.suggestions.length).toBeGreaterThan(0);
      expect(quality.suggestions.some(s => s.includes('seconds'))).toBe(true);
    });
  });
});

describe('Utility Functions', () => {
  describe('createDebouncedQualityAnalyzer', () => {
    jest.useFakeTimers();

    it('debounces quality analysis calls', () => {
      const callback = jest.fn();
      const analyzer = createDebouncedQualityAnalyzer(callback, 500);
      
      analyzer('test 1');
      analyzer('test 2');
      analyzer('test 3');
      
      expect(callback).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(500);
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        score: expect.any(Number),
      }));
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('getQualityColor', () => {
    it('returns correct colors for different scores', () => {
      expect(getQualityColor(90)).toBe('#10B981'); // Green
      expect(getQualityColor(70)).toBe('#F59E0B'); // Yellow
      expect(getQualityColor(50)).toBe('#EF4444'); // Red
      expect(getQualityColor(30)).toBe('#6B7280'); // Gray
    });
  });

  describe('getQualityIcon', () => {
    it('returns correct icons for different statuses', () => {
      expect(getQualityIcon('excellent')).toBe('✅');
      expect(getQualityIcon('good')).toBe('👍');
      expect(getQualityIcon('fair')).toBe('⚠️');
      expect(getQualityIcon('poor')).toBe('❌');
    });
  });
});

describe('Edge Cases', () => {
  it('handles null and undefined inputs gracefully', () => {
    expect(() => analyzeStatementQuality('')).not.toThrow();
    
    const emptyMedia: MediaCapture = {
      type: 'text',
      url: '',
    };
    expect(() => analyzeMediaQuality(emptyMedia)).not.toThrow();
  });

  it('handles special characters in statements', () => {
    const specialStatement = 'I went to café "Le Petit Prince" & ordered crème brûlée for $15.99!';
    const quality = analyzeStatementQuality(specialStatement);
    
    expect(quality.score).toBeGreaterThan(0);
    expect(quality.specificity.score).toBeGreaterThan(50); // Should detect price
  });

  it('handles very large file sizes', () => {
    const largeMedia: MediaCapture = {
      type: 'video',
      url: 'blob:test',
      duration: 20000,
      fileSize: 100000000, // 100MB
      mimeType: 'video/webm',
    };
    
    const quality = analyzeMediaQuality(largeMedia);
    
    expect(quality.technical.score).toBeLessThan(100); // Should be penalized
  });
});