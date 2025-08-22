/**
 * Progressive Hint Service
 * Provides sophisticated hints with progressive revelation of analysis and clues
 * Relates to Requirements 1, 3: Core Game Loop and Game Difficulty
 */

import { AnalyzedStatement, EmotionScores } from '../types';

export type HintLevel = 'basic' | 'intermediate' | 'advanced' | 'final';

export interface ProgressiveHint {
  id: string;
  level: HintLevel;
  category: 'emotional' | 'linguistic' | 'behavioral' | 'statistical' | 'contextual';
  title: string;
  content: string;
  confidence: number; // 0-1 scale
  statementIndex?: number; // specific statement this hint relates to
  revealedAt: Date;
  isRevealed: boolean;
}

export interface HintAnalysis {
  statementIndex: number;
  emotionalCues: {
    dominantEmotion: string;
    confidenceLevel: number;
    unusualPatterns: string[];
  };
  linguisticCues: {
    specificityLevel: 'vague' | 'moderate' | 'specific';
    unusualWords: string[];
    sentimentScore: number;
  };
  behavioralCues: {
    hesitationMarkers: string[];
    confidenceIndicators: string[];
    stressSignals: string[];
  };
  statisticalCues: {
    guessAccuracy: number;
    popularChoice: boolean;
    difficultyRating: number;
  };
}

export interface ProgressiveHintConfig {
  maxHintsPerLevel: number;
  timeBetweenHints: number; // milliseconds
  enableEmotionalAnalysis: boolean;
  enableLinguisticAnalysis: boolean;
  enableBehavioralAnalysis: boolean;
  enableStatisticalAnalysis: boolean;
  adaptiveDifficulty: boolean;
}

export class ProgressiveHintService {
  private config: ProgressiveHintConfig;
  private availableHints: ProgressiveHint[] = [];
  private revealedHints: ProgressiveHint[] = [];
  private currentLevel: HintLevel = 'basic';
  private lastHintTime?: Date;
  private hintAnalyses: HintAnalysis[] = [];

  constructor(config: Partial<ProgressiveHintConfig> = {}) {
    this.config = {
      maxHintsPerLevel: 2,
      timeBetweenHints: 15000, // 15 seconds
      enableEmotionalAnalysis: true,
      enableLinguisticAnalysis: true,
      enableBehavioralAnalysis: true,
      enableStatisticalAnalysis: true,
      adaptiveDifficulty: true,
      ...config,
    };
  }

  /**
   * Initialize hints for a set of statements
   */
  initializeHints(statements: AnalyzedStatement[]): void {
    this.availableHints = [];
    this.revealedHints = [];
    this.currentLevel = 'basic';
    this.lastHintTime = undefined;
    this.hintAnalyses = [];

    // Generate analyses for each statement
    this.hintAnalyses = statements.map((statement, index) => 
      this.generateHintAnalysis(statement, index)
    );

    // Generate progressive hints
    this.generateProgressiveHints(statements);
  }

  /**
   * Get the next available hint
   */
  getNextHint(): ProgressiveHint | null {
    // Check if enough time has passed since last hint
    if (this.lastHintTime) {
      const timeSinceLastHint = Date.now() - this.lastHintTime.getTime();
      if (timeSinceLastHint < this.config.timeBetweenHints) {
        return null;
      }
    }

    // Find next hint at current level
    const availableAtCurrentLevel = this.availableHints.filter(
      hint => hint.level === this.currentLevel && !hint.isRevealed
    );

    if (availableAtCurrentLevel.length === 0) {
      // Move to next level if no hints available at current level
      this.advanceToNextLevel();
      
      // Check if there are hints at the new level
      const availableAtNewLevel = this.availableHints.filter(
        hint => hint.level === this.currentLevel && !hint.isRevealed
      );
      
      if (availableAtNewLevel.length === 0) {
        // No more hints available at any level
        return null;
      }
      
      return this.getNextHint();
    }

    // Select best hint based on confidence and category diversity
    const nextHint = this.selectBestHint(availableAtCurrentLevel);
    if (nextHint) {
      nextHint.isRevealed = true;
      nextHint.revealedAt = new Date();
      this.revealedHints.push(nextHint);
      this.lastHintTime = new Date();
    }

    return nextHint;
  }

  /**
   * Get hints for a specific statement
   */
  getStatementHints(statementIndex: number): ProgressiveHint[] {
    return this.revealedHints.filter(hint => 
      hint.statementIndex === statementIndex || hint.statementIndex === undefined
    );
  }

  /**
   * Get all revealed hints
   */
  getRevealedHints(): ProgressiveHint[] {
    return [...this.revealedHints];
  }

  /**
   * Get current hint level
   */
  getCurrentLevel(): HintLevel {
    return this.currentLevel;
  }

  /**
   * Get hint analysis for a statement
   */
  getHintAnalysis(statementIndex: number): HintAnalysis | undefined {
    return this.hintAnalyses[statementIndex];
  }

  /**
   * Check if more hints are available
   */
  hasMoreHints(): boolean {
    return this.availableHints.some(hint => !hint.isRevealed);
  }

  /**
   * Get hint progress (percentage of hints revealed)
   */
  getHintProgress(): number {
    const totalHints = this.availableHints.length;
    const revealedCount = this.revealedHints.length;
    return totalHints > 0 ? (revealedCount / totalHints) * 100 : 0;
  }

  /**
   * Force reveal a hint of specific category
   */
  revealHintByCategory(category: ProgressiveHint['category']): ProgressiveHint | null {
    const availableHints = this.availableHints.filter(
      hint => hint.category === category && !hint.isRevealed
    );

    if (availableHints.length === 0) {
      return null;
    }

    const hint = availableHints[0];
    hint.isRevealed = true;
    hint.revealedAt = new Date();
    this.revealedHints.push(hint);
    this.lastHintTime = new Date();

    return hint;
  }

  // Private methods

  private generateHintAnalysis(statement: AnalyzedStatement, index: number): HintAnalysis {
    return {
      statementIndex: index,
      emotionalCues: this.analyzeEmotionalCues(statement),
      linguisticCues: this.analyzeLinguisticCues(statement),
      behavioralCues: this.analyzeBehavioralCues(statement),
      statisticalCues: this.analyzeStatisticalCues(statement),
    };
  }

  private analyzeEmotionalCues(statement: AnalyzedStatement) {
    const emotions = statement.emotionScores?.emotions;
    const dominantEmotion = statement.emotionScores?.dominantEmotion || 'neutral';
    const confidenceLevel = statement.emotionScores?.confidence || 0;

    const unusualPatterns: string[] = [];
    
    if (emotions) {
      // Detect unusual emotional patterns
      if (emotions.joy > 0.7 && statement.isLie) {
        unusualPatterns.push('High joy levels in potentially deceptive content');
      }
      if (emotions.fear > 0.5) {
        unusualPatterns.push('Elevated stress indicators detected');
      }
      if (emotions.surprise > 0.6) {
        unusualPatterns.push('Unexpected surprise levels');
      }
    }

    return {
      dominantEmotion,
      confidenceLevel,
      unusualPatterns,
    };
  }

  private analyzeLinguisticCues(statement: AnalyzedStatement) {
    const text = statement.text;
    const words = text.toLowerCase().split(/\s+/);
    
    // Analyze specificity
    const specificWords = ['exactly', 'precisely', 'specifically', 'particularly'];
    const vageWords = ['maybe', 'probably', 'sort of', 'kind of', 'somewhat'];
    
    const specificityScore = specificWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length - vageWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;

    const specificityLevel: 'vague' | 'moderate' | 'specific' = 
      specificityScore > 1 ? 'specific' : 
      specificityScore < -1 ? 'vague' : 'moderate';

    // Detect unusual words (simplified)
    const unusualWords = words.filter(word => 
      word.length > 8 || /[0-9]/.test(word)
    );

    // Simple sentiment analysis (simplified)
    const positiveWords = ['good', 'great', 'amazing', 'wonderful', 'excellent'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst'];
    
    const positiveCount = positiveWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    const negativeCount = negativeWords.filter(word => 
      text.toLowerCase().includes(word)
    ).length;
    
    const sentimentScore = (positiveCount - negativeCount) / words.length;

    return {
      specificityLevel,
      unusualWords,
      sentimentScore,
    };
  }

  private analyzeBehavioralCues(statement: AnalyzedStatement) {
    const text = statement.text;
    
    // Detect hesitation markers
    const hesitationMarkers: string[] = [];
    const hesitationWords = ['um', 'uh', 'well', 'you know', 'like'];
    hesitationWords.forEach(word => {
      if (text.toLowerCase().includes(word)) {
        hesitationMarkers.push(`Hesitation marker: "${word}"`);
      }
    });

    // Detect confidence indicators
    const confidenceIndicators: string[] = [];
    const confidenceWords = ['definitely', 'absolutely', 'certainly', 'sure'];
    confidenceWords.forEach(word => {
      if (text.toLowerCase().includes(word)) {
        confidenceIndicators.push(`Strong confidence: "${word}"`);
      }
    });

    // Detect stress signals
    const stressSignals: string[] = [];
    if (text.includes('...') || text.includes('--')) {
      stressSignals.push('Pauses or interruptions in speech');
    }
    if (text.length < 20) {
      stressSignals.push('Unusually brief response');
    }
    if (text.length > 200) {
      stressSignals.push('Unusually detailed response');
    }

    return {
      hesitationMarkers,
      confidenceIndicators,
      stressSignals,
    };
  }

  private analyzeStatisticalCues(statement: AnalyzedStatement) {
    return {
      guessAccuracy: statement.guessAccuracy,
      popularChoice: statement.popularGuess || false,
      difficultyRating: statement.averageConfidence,
    };
  }

  private generateProgressiveHints(statements: AnalyzedStatement[]): void {
    // Generate basic level hints
    this.generateBasicHints(statements);
    
    // Generate intermediate level hints
    this.generateIntermediateHints(statements);
    
    // Generate advanced level hints
    this.generateAdvancedHints(statements);
    
    // Generate final level hints
    this.generateFinalHints(statements);
  }

  private generateBasicHints(statements: AnalyzedStatement[]): void {
    // General strategy hints
    this.availableHints.push({
      id: this.generateHintId(),
      level: 'basic',
      category: 'contextual',
      title: 'General Strategy',
      content: 'Look for the statement that feels different from the others in tone or detail level.',
      confidence: 0.7,
      revealedAt: new Date(),
      isRevealed: false,
    });

    this.availableHints.push({
      id: this.generateHintId(),
      level: 'basic',
      category: 'behavioral',
      title: 'Body Language Clue',
      content: 'Pay attention to confidence levels and hesitation patterns in the video recordings.',
      confidence: 0.8,
      revealedAt: new Date(),
      isRevealed: false,
    });

    // Basic emotional hint
    this.availableHints.push({
      id: this.generateHintId(),
      level: 'basic',
      category: 'emotional',
      title: 'Emotional Consistency',
      content: 'Notice if one statement has different emotional energy compared to the others.',
      confidence: 0.7,
      revealedAt: new Date(),
      isRevealed: false,
    });

    // Basic linguistic hint
    this.availableHints.push({
      id: this.generateHintId(),
      level: 'basic',
      category: 'linguistic',
      title: 'Language Patterns',
      content: 'Look for differences in how detailed or specific each statement is.',
      confidence: 0.6,
      revealedAt: new Date(),
      isRevealed: false,
    });

    // Statistical hints for popular choices
    const popularStatement = statements.findIndex(stmt => stmt.popularGuess);
    if (popularStatement !== -1) {
      this.availableHints.push({
        id: this.generateHintId(),
        level: 'basic',
        category: 'statistical',
        title: 'Popular Choice',
        content: `Statement ${popularStatement + 1} is commonly chosen by other players. Consider why that might be.`,
        confidence: 0.6,
        statementIndex: popularStatement,
        revealedAt: new Date(),
        isRevealed: false,
      });
    }
  }

  private generateIntermediateHints(statements: AnalyzedStatement[]): void {
    statements.forEach((statement, index) => {
      const analysis = this.hintAnalyses[index];
      
      // Emotional analysis hints
      if (this.config.enableEmotionalAnalysis && analysis.emotionalCues.unusualPatterns.length > 0) {
        this.availableHints.push({
          id: this.generateHintId(),
          level: 'intermediate',
          category: 'emotional',
          title: `Emotional Pattern - Statement ${index + 1}`,
          content: `${analysis.emotionalCues.unusualPatterns[0]}. This could indicate deception or truth.`,
          confidence: analysis.emotionalCues.confidenceLevel,
          statementIndex: index,
          revealedAt: new Date(),
          isRevealed: false,
        });
      }

      // Linguistic analysis hints
      if (this.config.enableLinguisticAnalysis) {
        if (analysis.linguisticCues.specificityLevel === 'specific') {
          this.availableHints.push({
            id: this.generateHintId(),
            level: 'intermediate',
            category: 'linguistic',
            title: `Detail Level - Statement ${index + 1}`,
            content: 'This statement contains very specific details. Liars sometimes over-elaborate to seem convincing.',
            confidence: 0.7,
            statementIndex: index,
            revealedAt: new Date(),
            isRevealed: false,
          });
        } else if (analysis.linguisticCues.specificityLevel === 'vague') {
          this.availableHints.push({
            id: this.generateHintId(),
            level: 'intermediate',
            category: 'linguistic',
            title: `Vagueness - Statement ${index + 1}`,
            content: 'This statement is quite vague. Sometimes liars avoid details to prevent being caught.',
            confidence: 0.6,
            statementIndex: index,
            revealedAt: new Date(),
            isRevealed: false,
          });
        }
      }
    });
  }

  private generateAdvancedHints(statements: AnalyzedStatement[]): void {
    statements.forEach((statement, index) => {
      const analysis = this.hintAnalyses[index];
      
      // Behavioral analysis hints
      if (this.config.enableBehavioralAnalysis) {
        if (analysis.behavioralCues.hesitationMarkers.length > 0) {
          this.availableHints.push({
            id: this.generateHintId(),
            level: 'advanced',
            category: 'behavioral',
            title: `Speech Pattern - Statement ${index + 1}`,
            content: `Detected: ${analysis.behavioralCues.hesitationMarkers[0]}. This could indicate uncertainty or deception.`,
            confidence: 0.8,
            statementIndex: index,
            revealedAt: new Date(),
            isRevealed: false,
          });
        }

        if (analysis.behavioralCues.stressSignals.length > 0) {
          this.availableHints.push({
            id: this.generateHintId(),
            level: 'advanced',
            category: 'behavioral',
            title: `Stress Indicator - Statement ${index + 1}`,
            content: `${analysis.behavioralCues.stressSignals[0]}. This might indicate discomfort with the content.`,
            confidence: 0.7,
            statementIndex: index,
            revealedAt: new Date(),
            isRevealed: false,
          });
        }
      }

      // Statistical analysis hints
      if (this.config.enableStatisticalAnalysis) {
        if (analysis.statisticalCues.guessAccuracy < 0.3) {
          this.availableHints.push({
            id: this.generateHintId(),
            level: 'advanced',
            category: 'statistical',
            title: `Difficulty Pattern - Statement ${index + 1}`,
            content: `Only ${Math.round(analysis.statisticalCues.guessAccuracy * 100)}% of players guess this correctly. It might be trickier than it seems.`,
            confidence: 0.9,
            statementIndex: index,
            revealedAt: new Date(),
            isRevealed: false,
          });
        }
      }
    });
  }

  private generateFinalHints(statements: AnalyzedStatement[]): void {
    // Process of elimination hint
    this.availableHints.push({
      id: this.generateHintId(),
      level: 'final',
      category: 'contextual',
      title: 'Process of Elimination',
      content: 'Consider which two statements seem most believable, then focus on the remaining one.',
      confidence: 0.9,
      revealedAt: new Date(),
      isRevealed: false,
    });

    // Direct statistical hint about the lie
    const lieIndex = statements.findIndex(stmt => stmt.isLie);
    if (lieIndex !== -1) {
      this.availableHints.push({
        id: this.generateHintId(),
        level: 'final',
        category: 'statistical',
        title: 'Strong Statistical Indicator',
        content: `Based on analysis patterns, one statement shows significantly different characteristics from the others.`,
        confidence: 0.95,
        revealedAt: new Date(),
        isRevealed: false,
      });
    }
  }

  private selectBestHint(availableHints: ProgressiveHint[]): ProgressiveHint | null {
    if (availableHints.length === 0) {
      return null;
    }

    // Sort by confidence and category diversity
    const revealedCategories = new Set(this.revealedHints.map(hint => hint.category));
    
    return availableHints.sort((a, b) => {
      // Prefer hints from categories we haven't shown yet
      const aCategoryBonus = revealedCategories.has(a.category) ? 0 : 0.2;
      const bCategoryBonus = revealedCategories.has(b.category) ? 0 : 0.2;
      
      const aScore = a.confidence + aCategoryBonus;
      const bScore = b.confidence + bCategoryBonus;
      
      return bScore - aScore;
    })[0];
  }

  private advanceToNextLevel(): void {
    const levels: HintLevel[] = ['basic', 'intermediate', 'advanced', 'final'];
    const currentIndex = levels.indexOf(this.currentLevel);
    
    if (currentIndex < levels.length - 1) {
      this.currentLevel = levels[currentIndex + 1];
    }
  }

  private generateHintId(): string {
    return `hint_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}