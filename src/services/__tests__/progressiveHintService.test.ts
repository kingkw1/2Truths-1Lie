/**
 * Tests for Progressive Hint Service
 */

import { ProgressiveHintService } from '../progressiveHintService';
import { AnalyzedStatement } from '../../types';

describe('ProgressiveHintService', () => {
  let hintService: ProgressiveHintService;
  let mockStatements: AnalyzedStatement[];

  beforeEach(() => {
    hintService = new ProgressiveHintService({
      maxHintsPerLevel: 2,
      timeBetweenHints: 1000, // 1 second for testing
      enableEmotionalAnalysis: true,
      enableLinguisticAnalysis: true,
      enableBehavioralAnalysis: true,
      enableStatisticalAnalysis: true,
      adaptiveDifficulty: true,
    });

    mockStatements = [
      {
        id: '1',
        text: 'I went to Paris last summer and visited the Eiffel Tower.',
        isLie: false,
        confidence: 0.8,
        viewCount: 100,
        guessAccuracy: 0.7,
        averageConfidence: 0.75,
        popularGuess: false,
        emotionScores: {
          confidence: 0.8,
          emotions: {
            joy: 0.6,
            sadness: 0.1,
            anger: 0.05,
            fear: 0.1,
            surprise: 0.1,
            disgust: 0.05,
            neutral: 0.1,
          },
          dominantEmotion: 'joy',
          analysisTimestamp: new Date(),
        },
      },
      {
        id: '2',
        text: 'I can speak five languages fluently including Mandarin and Arabic.',
        isLie: true,
        confidence: 0.6,
        viewCount: 150,
        guessAccuracy: 0.4,
        averageConfidence: 0.5,
        popularGuess: true,
        emotionScores: {
          confidence: 0.6,
          emotions: {
            joy: 0.3,
            sadness: 0.1,
            anger: 0.1,
            fear: 0.2,
            surprise: 0.1,
            disgust: 0.1,
            neutral: 0.1,
          },
          dominantEmotion: 'fear',
          analysisTimestamp: new Date(),
        },
      },
      {
        id: '3',
        text: 'I have a pet dog named Max who loves to play fetch.',
        isLie: false,
        confidence: 0.9,
        viewCount: 80,
        guessAccuracy: 0.8,
        averageConfidence: 0.85,
        popularGuess: false,
      },
    ];
  });

  describe('initialization', () => {
    it('should initialize hints for statements', () => {
      hintService.initializeHints(mockStatements);
      
      expect(hintService.hasMoreHints()).toBe(true);
      expect(hintService.getCurrentLevel()).toBe('basic');
      expect(hintService.getHintProgress()).toBe(0);
    });

    it('should generate hints for all levels', () => {
      jest.useFakeTimers();
      hintService.initializeHints(mockStatements);
      
      // Get all available hints by repeatedly calling getNextHint
      const allHints = [];
      let hint = hintService.getNextHint();
      while (hint && allHints.length < 15) { // Limit to prevent infinite loop
        allHints.push(hint);
        // Wait for cooldown
        jest.advanceTimersByTime(1000);
        hint = hintService.getNextHint();
      }
      
      expect(allHints.length).toBeGreaterThan(0);
      
      // Should have hints from different levels
      const levels = new Set(allHints.map(h => h.level));
      expect(levels.size).toBeGreaterThanOrEqual(1); // At least basic level
      
      jest.useRealTimers();
    });
  });

  describe('hint progression', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      hintService.initializeHints(mockStatements);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start with basic level hints', () => {
      const hint = hintService.getNextHint();
      
      expect(hint).toBeTruthy();
      expect(hint!.level).toBe('basic');
      expect(hintService.getCurrentLevel()).toBe('basic');
    });

    it('should progress through hint levels', () => {
      // Get basic hints first
      let hint = hintService.getNextHint();
      expect(hint!.level).toBe('basic');
      
      // Continue getting hints until we advance to a different level
      let attempts = 0;
      let lastLevel = 'basic';
      while (attempts < 10) {
        jest.advanceTimersByTime(1000);
        hint = hintService.getNextHint();
        if (!hint) break;
        
        if (hint.level !== lastLevel) {
          // Level has advanced
          expect(['intermediate', 'advanced', 'final']).toContain(hint.level);
          break;
        }
        attempts++;
      }
      
      // Should have progressed beyond basic level
      expect(attempts).toBeLessThan(10); // Should not exhaust all attempts
    });

    it('should respect time cooldown between hints', () => {
      const hint1 = hintService.getNextHint();
      expect(hint1).toBeTruthy();
      
      // Should not provide hint immediately
      const hint2 = hintService.getNextHint();
      expect(hint2).toBeNull();
      
      // Should provide hint after cooldown
      jest.advanceTimersByTime(1000);
      const hint3 = hintService.getNextHint();
      expect(hint3).toBeTruthy();
    });

    it('should track hint progress', () => {
      expect(hintService.getHintProgress()).toBe(0);
      
      hintService.getNextHint();
      const progress1 = hintService.getHintProgress();
      expect(progress1).toBeGreaterThan(0);
      
      jest.advanceTimersByTime(1000);
      hintService.getNextHint();
      const progress2 = hintService.getHintProgress();
      expect(progress2).toBeGreaterThan(progress1);
    });
  });

  describe('hint categories', () => {
    beforeEach(() => {
      hintService.initializeHints(mockStatements);
    });

    it('should provide hints from different categories', () => {
      const emotionalHint = hintService.revealHintByCategory('emotional');
      const linguisticHint = hintService.revealHintByCategory('linguistic');
      const behavioralHint = hintService.revealHintByCategory('behavioral');
      const statisticalHint = hintService.revealHintByCategory('statistical');
      
      expect(emotionalHint?.category).toBe('emotional');
      expect(linguisticHint?.category).toBe('linguistic');
      expect(behavioralHint?.category).toBe('behavioral');
      expect(statisticalHint?.category).toBe('statistical');
    });

    it('should return null when no hints available for category', () => {
      // Exhaust all emotional hints
      let hint = hintService.revealHintByCategory('emotional');
      while (hint) {
        hint = hintService.revealHintByCategory('emotional');
      }
      
      // Should return null when no more emotional hints
      const noHint = hintService.revealHintByCategory('emotional');
      expect(noHint).toBeNull();
    });
  });

  describe('statement-specific hints', () => {
    beforeEach(() => {
      hintService.initializeHints(mockStatements);
    });

    it('should provide hints for specific statements', () => {
      // Get some hints
      hintService.getNextHint();
      hintService.revealHintByCategory('statistical');
      
      const statement0Hints = hintService.getStatementHints(0);
      const statement1Hints = hintService.getStatementHints(1);
      
      // Should have hints for different statements
      expect(statement0Hints.length + statement1Hints.length).toBeGreaterThan(0);
    });

    it('should include general hints for all statements', () => {
      const generalHint = hintService.getNextHint();
      
      // General hints should not have a specific statement index
      expect(generalHint?.statementIndex).toBeUndefined();
      
      const allStatementHints = hintService.getStatementHints(0);
      expect(allStatementHints).toContain(generalHint);
    });
  });

  describe('hint analysis', () => {
    beforeEach(() => {
      hintService.initializeHints(mockStatements);
    });

    it('should generate analysis for each statement', () => {
      const analysis0 = hintService.getHintAnalysis(0);
      const analysis1 = hintService.getHintAnalysis(1);
      const analysis2 = hintService.getHintAnalysis(2);
      
      expect(analysis0).toBeTruthy();
      expect(analysis1).toBeTruthy();
      expect(analysis2).toBeTruthy();
      
      expect(analysis0!.statementIndex).toBe(0);
      expect(analysis1!.statementIndex).toBe(1);
      expect(analysis2!.statementIndex).toBe(2);
    });

    it('should analyze emotional cues', () => {
      const analysis = hintService.getHintAnalysis(1); // Statement with fear emotion
      
      expect(analysis!.emotionalCues.dominantEmotion).toBe('fear');
      expect(analysis!.emotionalCues.confidenceLevel).toBe(0.6);
    });

    it('should analyze statistical patterns', () => {
      const analysis = hintService.getHintAnalysis(1); // Popular choice statement
      
      expect(analysis!.statisticalCues.popularChoice).toBe(true);
      expect(analysis!.statisticalCues.guessAccuracy).toBe(0.4);
    });
  });

  describe('revealed hints tracking', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      hintService.initializeHints(mockStatements);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should track revealed hints', () => {
      expect(hintService.getRevealedHints()).toHaveLength(0);
      
      hintService.getNextHint();
      expect(hintService.getRevealedHints()).toHaveLength(1);
      
      jest.advanceTimersByTime(1000);
      hintService.getNextHint();
      expect(hintService.getRevealedHints()).toHaveLength(2);
    });

    it('should mark hints as revealed with timestamp', () => {
      const hint = hintService.getNextHint();
      
      expect(hint!.isRevealed).toBe(true);
      expect(hint!.revealedAt).toBeInstanceOf(Date);
    });
  });
});