/**
 * Quality Assessment Utilities
 * Provides real-time feedback on recording and statement quality
 * Requirements: Immediate feedback on recording and statement quality
 */

import { MediaCapture, Statement } from '../types/challenge';

// ============================================================================
// STATEMENT QUALITY ASSESSMENT
// ============================================================================

export interface StatementQuality {
  score: number; // 0-100 overall quality score
  length: QualityMetric;
  clarity: QualityMetric;
  specificity: QualityMetric;
  believability: QualityMetric;
  suggestions: string[];
}

export interface QualityMetric {
  score: number; // 0-100
  status: 'poor' | 'fair' | 'good' | 'excellent';
  message: string;
}

/**
 * Analyzes statement text quality in real-time
 */
export function analyzeStatementQuality(text: string): StatementQuality {
  const trimmedText = text.trim();
  
  // Length analysis
  const length = analyzeLength(trimmedText);
  
  // Clarity analysis (grammar, readability)
  const clarity = analyzeClarity(trimmedText);
  
  // Specificity analysis (details, concrete facts)
  const specificity = analyzeSpecificity(trimmedText);
  
  // Believability analysis (realistic, not obviously fake)
  const believability = analyzeBelievability(trimmedText);
  
  // Calculate overall score
  const overallScore = Math.round(
    (length.score * 0.2 + clarity.score * 0.3 + specificity.score * 0.3 + believability.score * 0.2)
  );
  
  // Generate suggestions
  const suggestions = generateSuggestions(length, clarity, specificity, believability);
  
  return {
    score: overallScore,
    length,
    clarity,
    specificity,
    believability,
    suggestions,
  };
}

function analyzeLength(text: string): QualityMetric {
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = text.length;
  
  if (charCount === 0) {
    return {
      score: 0,
      status: 'poor',
      message: 'Statement is empty',
    };
  }
  
  if (wordCount < 3) {
    return {
      score: 20,
      status: 'poor',
      message: 'Too short - add more details',
    };
  }
  
  if (wordCount < 8) {
    return {
      score: 60,
      status: 'fair',
      message: 'Could be more detailed',
    };
  }
  
  if (wordCount <= 25) {
    return {
      score: 90,
      status: 'excellent',
      message: 'Good length',
    };
  }
  
  if (wordCount <= 40) {
    return {
      score: 75,
      status: 'good',
      message: 'A bit long but okay',
    };
  }
  
  return {
    score: 50,
    status: 'fair',
    message: 'Too long - consider shortening',
  };
}

function analyzeClarity(text: string): QualityMetric {
  if (text.length === 0) {
    return {
      score: 0,
      status: 'poor',
      message: 'No text to analyze',
    };
  }
  
  let score = 70; // Base score
  let issues: string[] = [];
  
  // Check for basic punctuation
  if (!/[.!?]$/.test(text.trim())) {
    score -= 10;
    issues.push('missing punctuation');
  }
  
  // Check for excessive repetition
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  
  if (repetitionRatio < 0.7 && words.length > 5) {
    score -= 15;
    issues.push('repetitive words');
  }
  
  // Check for excessive capitalization
  const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (upperCaseRatio > 0.3) {
    score -= 10;
    issues.push('too much capitalization');
  }
  
  // Check for basic grammar patterns
  if (text.includes('  ')) {
    score -= 5;
    issues.push('extra spaces');
  }
  
  // Determine status and message
  let status: QualityMetric['status'];
  let message: string;
  
  if (score >= 85) {
    status = 'excellent';
    message = 'Clear and well-written';
  } else if (score >= 70) {
    status = 'good';
    message = 'Generally clear';
  } else if (score >= 50) {
    status = 'fair';
    message = `Could improve: ${issues.join(', ')}`;
  } else {
    status = 'poor';
    message = `Needs work: ${issues.join(', ')}`;
  }
  
  return { score: Math.max(0, score), status, message };
}

function analyzeSpecificity(text: string): QualityMetric {
  if (text.length === 0) {
    return {
      score: 0,
      status: 'poor',
      message: 'No text to analyze',
    };
  }
  
  let score = 50; // Base score
  const lowerText = text.toLowerCase();
  
  // Look for specific details
  const specificIndicators = [
    /\b\d{4}\b/, // Years
    /\b\d{1,2}:\d{2}\b/, // Times
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    /\b\d+\s*(years?|months?|days?|hours?|minutes?)\b/,
    /\b(first|second|third|last|next)\b/,
    /\$\d+/, // Money amounts
    /\b\d+\s*(miles?|kilometers?|feet|meters?)\b/,
  ];
  
  const specificMatches = specificIndicators.filter(pattern => pattern.test(lowerText)).length;
  score += specificMatches * 10;
  
  // Look for vague language (reduces score)
  const vaguePhrases = [
    'kind of', 'sort of', 'maybe', 'probably', 'i think', 'i guess',
    'something like', 'around', 'about', 'roughly', 'approximately'
  ];
  
  const vagueMatches = vaguePhrases.filter(phrase => lowerText.includes(phrase)).length;
  score -= vagueMatches * 8;
  
  // Look for concrete nouns vs abstract concepts
  const concreteIndicators = [
    /\b(car|house|dog|cat|book|phone|computer|restaurant|school|park)\b/,
    /\b(red|blue|green|yellow|black|white|brown|pink)\b/,
    /\b(big|small|tall|short|long|wide|narrow)\b/,
  ];
  
  const concreteMatches = concreteIndicators.filter(pattern => pattern.test(lowerText)).length;
  score += concreteMatches * 5;
  
  // Determine status and message
  let status: QualityMetric['status'];
  let message: string;
  
  if (score >= 80) {
    status = 'excellent';
    message = 'Very specific and detailed';
  } else if (score >= 65) {
    status = 'good';
    message = 'Good level of detail';
  } else if (score >= 45) {
    status = 'fair';
    message = 'Could be more specific';
  } else {
    status = 'poor';
    message = 'Too vague - add specific details';
  }
  
  return { score: Math.min(100, Math.max(0, score)), status, message };
}

function analyzeBelievability(text: string): QualityMetric {
  if (text.length === 0) {
    return {
      score: 0,
      status: 'poor',
      message: 'No text to analyze',
    };
  }
  
  let score = 75; // Base score - assume believable
  const lowerText = text.toLowerCase();
  
  // Check for obviously fake elements
  const suspiciousPatterns = [
    /\b(million|billion|trillion)\s+dollars?\b/,
    /\b(celebrity|famous|movie star|president)\b/,
    /\b(alien|ufo|ghost|magic|supernatural)\b/,
    /\b(won\s+the\s+lottery|inherited\s+millions?)\b/,
    /\b(never|always|everyone|nobody|everything|nothing)\b/, // Absolutes
  ];
  
  const suspiciousMatches = suspiciousPatterns.filter(pattern => pattern.test(lowerText)).length;
  score -= suspiciousMatches * 15;
  
  // Check for overly dramatic language
  const dramaticWords = ['amazing', 'incredible', 'unbelievable', 'fantastic', 'extraordinary'];
  const dramaticCount = dramaticWords.filter(word => lowerText.includes(word)).length;
  score -= dramaticCount * 8;
  
  // Check for realistic personal experiences
  const personalIndicators = [
    /\bi\s+(went|did|saw|met|bought|learned|tried|visited)\b/,
    /\bmy\s+(friend|family|job|school|house)\b/,
    /\bwhen\s+i\s+was\b/,
    /\blast\s+(year|month|week|weekend)\b/,
  ];
  
  const personalMatches = personalIndicators.filter(pattern => pattern.test(lowerText)).length;
  score += personalMatches * 5;
  
  // Determine status and message
  let status: QualityMetric['status'];
  let message: string;
  
  if (score >= 85) {
    status = 'excellent';
    message = 'Sounds believable';
  } else if (score >= 70) {
    status = 'good';
    message = 'Reasonably believable';
  } else if (score >= 50) {
    status = 'fair';
    message = 'Might seem suspicious';
  } else {
    status = 'poor';
    message = 'Seems obviously fake';
  }
  
  return { score: Math.min(100, Math.max(0, score)), status, message };
}

function generateSuggestions(
  length: QualityMetric,
  clarity: QualityMetric,
  specificity: QualityMetric,
  believability: QualityMetric
): string[] {
  const suggestions: string[] = [];
  
  if (length.score < 60) {
    suggestions.push('Add more details to make your statement more interesting');
  }
  
  if (clarity.score < 70) {
    suggestions.push('Check your grammar and punctuation');
  }
  
  if (specificity.score < 60) {
    suggestions.push('Include specific dates, numbers, or names');
  }
  
  if (believability.score < 60) {
    suggestions.push('Make it sound more realistic and personal');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Great statement! This should work well in your challenge.');
  }
  
  return suggestions;
}

// ============================================================================
// MEDIA QUALITY ASSESSMENT
// ============================================================================

export interface MediaQuality {
  score: number; // 0-100 overall quality score
  technical: QualityMetric;
  content: QualityMetric;
  duration: QualityMetric;
  suggestions: string[];
}

/**
 * Analyzes media recording quality
 */
export function analyzeMediaQuality(media: MediaCapture): MediaQuality {
  const technical = analyzeTechnicalQuality(media);
  const content = analyzeContentQuality(media);
  const duration = analyzeDurationQuality(media);
  
  const overallScore = Math.round(
    (technical.score * 0.4 + content.score * 0.3 + duration.score * 0.3)
  );
  
  const suggestions = generateMediaSuggestions(technical, content, duration, media);
  
  return {
    score: overallScore,
    technical,
    content,
    duration,
    suggestions,
  };
}

function analyzeTechnicalQuality(media: MediaCapture): QualityMetric {
  let score = 70; // Base score
  let issues: string[] = [];
  
  // File size analysis
  if (media.fileSize) {
    const sizeInMB = media.fileSize / (1024 * 1024);
    
    if (media.type === 'video') {
      if (sizeInMB < 0.5) {
        score -= 20;
        issues.push('very small file size');
      } else if (sizeInMB > 50) {
        score -= 10;
        issues.push('large file size');
      }
    } else if (media.type === 'audio') {
      if (sizeInMB < 0.1) {
        score -= 15;
        issues.push('very small file size');
      } else if (sizeInMB > 10) {
        score -= 10;
        issues.push('large file size');
      }
    }
  }
  
  // MIME type analysis
  if (media.mimeType) {
    const supportedFormats = {
      video: ['video/webm', 'video/mp4'],
      audio: ['audio/webm', 'audio/mp4', 'audio/mpeg'],
    };
    
    if (media.type !== 'text') {
      const isSupported = supportedFormats[media.type]?.some(format => 
        media.mimeType!.startsWith(format)
      );
      
      if (!isSupported) {
        score -= 15;
        issues.push('unsupported format');
      }
    }
  }
  
  let status: QualityMetric['status'];
  let message: string;
  
  if (score >= 85) {
    status = 'excellent';
    message = 'High technical quality';
  } else if (score >= 70) {
    status = 'good';
    message = 'Good technical quality';
  } else if (score >= 50) {
    status = 'fair';
    message = `Technical issues: ${issues.join(', ')}`;
  } else {
    status = 'poor';
    message = `Poor quality: ${issues.join(', ')}`;
  }
  
  return { score: Math.max(0, score), status, message };
}

function analyzeContentQuality(media: MediaCapture): QualityMetric {
  // For now, we can't analyze actual audio/video content without additional APIs
  // This is a placeholder for future enhancement with AI analysis
  
  if (media.type === 'text') {
    return {
      score: 80,
      status: 'good',
      message: 'Text content ready',
    };
  }
  
  return {
    score: 75,
    status: 'good',
    message: 'Content analysis not available yet',
  };
}

function analyzeDurationQuality(media: MediaCapture): QualityMetric {
  if (!media.duration || media.type === 'text') {
    return {
      score: 80,
      status: 'good',
      message: 'Duration not applicable',
    };
  }
  
  const durationInSeconds = media.duration / 1000;
  
  if (durationInSeconds < 2) {
    return {
      score: 30,
      status: 'poor',
      message: 'Too short - record for at least 3 seconds',
    };
  }
  
  if (durationInSeconds < 5) {
    return {
      score: 60,
      status: 'fair',
      message: 'A bit short - consider recording more',
    };
  }
  
  if (durationInSeconds <= 20) {
    return {
      score: 90,
      status: 'excellent',
      message: 'Perfect duration',
    };
  }
  
  if (durationInSeconds <= 30) {
    return {
      score: 75,
      status: 'good',
      message: 'Good duration',
    };
  }
  
  return {
    score: 50,
    status: 'fair',
    message: 'A bit long - consider keeping it shorter',
  };
}

function generateMediaSuggestions(
  technical: QualityMetric,
  content: QualityMetric,
  duration: QualityMetric,
  media: MediaCapture
): string[] {
  const suggestions: string[] = [];
  
  if (technical.score < 70) {
    suggestions.push('Try recording in a quieter environment');
  }
  
  if (duration.score < 60 && media.duration && media.duration < 5000) {
    suggestions.push('Record for a few more seconds to make it more engaging');
  }
  
  if (duration.score < 60 && media.duration && media.duration > 25000) {
    suggestions.push('Keep recordings under 25 seconds for better engagement');
  }
  
  if (media.type === 'video') {
    suggestions.push('Make sure you\'re well-lit and clearly visible');
  }
  
  if (media.type === 'audio') {
    suggestions.push('Speak clearly and at a steady pace');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Great recording! This should work well in your challenge.');
  }
  
  return suggestions;
}

// ============================================================================
// REAL-TIME FEEDBACK UTILITIES
// ============================================================================

/**
 * Debounced quality analysis for real-time feedback
 */
export function createDebouncedQualityAnalyzer(
  callback: (quality: StatementQuality) => void,
  delay: number = 500
) {
  let timeoutId: NodeJS.Timeout;
  
  return (text: string) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const quality = analyzeStatementQuality(text);
      callback(quality);
    }, delay);
  };
}

/**
 * Get color for quality score
 */
export function getQualityColor(score: number): string {
  if (score >= 80) return '#10B981'; // Green
  if (score >= 60) return '#F59E0B'; // Yellow
  if (score >= 40) return '#EF4444'; // Red
  return '#6B7280'; // Gray
}

/**
 * Get quality status icon
 */
export function getQualityIcon(status: QualityMetric['status']): string {
  switch (status) {
    case 'excellent': return '✅';
    case 'good': return '👍';
    case 'fair': return '⚠️';
    case 'poor': return '❌';
    default: return '❓';
  }
}