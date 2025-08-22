/**
 * Challenge Browser Component
 * Provides UI for browsing challenges with filtering and sorting capabilities
 * Relates to Requirements 4: Social Guessing and Interaction
 */

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  loadChallenges, 
  updateFilters, 
  applyFilters, 
  selectChallenge, 
  setLoading 
} from '../store/slices/guessingGameSlice';
import { EnhancedChallenge } from '../types/challenge';

interface ChallengeBrowserProps {
  onChallengeSelect?: (challenge: EnhancedChallenge) => void;
  skipMockDataLoad?: boolean; // For testing purposes
}

export const ChallengeBrowser: React.FC<ChallengeBrowserProps> = ({ onChallengeSelect, skipMockDataLoad = false }) => {
  const dispatch = useAppDispatch();
  const { 
    availableChallenges, 
    isLoading, 
    filters,
    selectedChallenge 
  } = useAppSelector(state => state.guessingGame);

  const [searchTerm, setSearchTerm] = useState('');

  // Mock data for demonstration - in real app this would come from API
  const mockChallenges: EnhancedChallenge[] = [
    {
      id: 'challenge_1',
      creatorId: 'user_1',
      creatorName: 'Alice Johnson',
      statements: [
        {
          id: 'stmt_1',
          text: 'I once met a celebrity at a coffee shop',
          isLie: false,
          viewCount: 45,
          guessAccuracy: 0.67,
          averageConfidence: 0.72,
          popularGuess: false
        },
        {
          id: 'stmt_2', 
          text: 'I have traveled to 15 countries',
          isLie: true,
          viewCount: 45,
          guessAccuracy: 0.33,
          averageConfidence: 0.58,
          popularGuess: true
        },
        {
          id: 'stmt_3',
          text: 'I can speak three languages fluently',
          isLie: false,
          viewCount: 45,
          guessAccuracy: 0.78,
          averageConfidence: 0.81,
          popularGuess: false
        }
      ],
      mediaData: [
        { type: 'video', url: 'mock_video_1.mp4', duration: 15000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_2.mp4', duration: 12000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_3.mp4', duration: 18000, mimeType: 'video/mp4' }
      ],
      difficultyRating: 65,
      averageGuessTime: 25000,
      popularityScore: 87,
      emotionComplexity: 72,
      recommendationWeight: 0.85,
      totalGuesses: 45,
      correctGuessRate: 0.33,
      createdAt: new Date('2024-01-15'),
      lastPlayed: new Date('2024-01-20'),
      tags: ['travel', 'languages', 'celebrity'],
      isActive: true
    },
    {
      id: 'challenge_2',
      creatorId: 'user_2',
      creatorName: 'Bob Smith',
      statements: [
        {
          id: 'stmt_4',
          text: 'I won a local cooking competition',
          isLie: false,
          viewCount: 32,
          guessAccuracy: 0.81,
          averageConfidence: 0.75,
          popularGuess: false
        },
        {
          id: 'stmt_5',
          text: 'I once ate a whole pizza by myself',
          isLie: false,
          viewCount: 32,
          guessAccuracy: 0.69,
          averageConfidence: 0.62,
          popularGuess: false
        },
        {
          id: 'stmt_6',
          text: 'I have never broken a bone',
          isLie: true,
          viewCount: 32,
          guessAccuracy: 0.44,
          averageConfidence: 0.51,
          popularGuess: true
        }
      ],
      mediaData: [
        { type: 'video', url: 'mock_video_4.mp4', duration: 20000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_5.mp4', duration: 14000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_6.mp4', duration: 16000, mimeType: 'video/mp4' }
      ],
      difficultyRating: 45,
      averageGuessTime: 18000,
      popularityScore: 72,
      emotionComplexity: 58,
      recommendationWeight: 0.72,
      totalGuesses: 32,
      correctGuessRate: 0.44,
      createdAt: new Date('2024-01-18'),
      lastPlayed: new Date('2024-01-22'),
      tags: ['cooking', 'food', 'personal'],
      isActive: true
    },
    {
      id: 'challenge_3',
      creatorId: 'user_3',
      creatorName: 'Carol Davis',
      statements: [
        {
          id: 'stmt_7',
          text: 'I have a pet snake named Charlie',
          isLie: true,
          viewCount: 28,
          guessAccuracy: 0.25,
          averageConfidence: 0.43,
          popularGuess: true
        },
        {
          id: 'stmt_8',
          text: 'I work as a software engineer',
          isLie: false,
          viewCount: 28,
          guessAccuracy: 0.89,
          averageConfidence: 0.92,
          popularGuess: false
        },
        {
          id: 'stmt_9',
          text: 'I enjoy hiking on weekends',
          isLie: false,
          viewCount: 28,
          guessAccuracy: 0.75,
          averageConfidence: 0.68,
          popularGuess: false
        }
      ],
      mediaData: [
        { type: 'video', url: 'mock_video_7.mp4', duration: 22000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_8.mp4', duration: 19000, mimeType: 'video/mp4' },
        { type: 'video', url: 'mock_video_9.mp4', duration: 17000, mimeType: 'video/mp4' }
      ],
      difficultyRating: 85,
      averageGuessTime: 32000,
      popularityScore: 91,
      emotionComplexity: 88,
      recommendationWeight: 0.91,
      totalGuesses: 28,
      correctGuessRate: 0.25,
      createdAt: new Date('2024-01-20'),
      lastPlayed: new Date('2024-01-23'),
      tags: ['pets', 'work', 'outdoors'],
      isActive: true
    }
  ];

  useEffect(() => {
    // Only load mock challenges if we don't already have challenges and not in test mode
    if (!skipMockDataLoad && availableChallenges.length === 0 && !isLoading) {
      dispatch(setLoading(true));
      setTimeout(() => {
        dispatch(loadChallenges(mockChallenges));
      }, 500); // Simulate API delay
    }
  }, [dispatch, availableChallenges.length, isLoading, skipMockDataLoad]);

  const handleFilterChange = (filterType: 'difficulty' | 'sortBy', value: string) => {
    dispatch(updateFilters({ [filterType]: value }));
    dispatch(applyFilters());
  };

  const handleChallengeSelect = (challenge: EnhancedChallenge) => {
    dispatch(selectChallenge(challenge));
    onChallengeSelect?.(challenge);
  };

  const getDifficultyLabel = (rating: number): string => {
    if (rating < 33) return 'Easy';
    if (rating < 66) return 'Medium';
    return 'Hard';
  };

  const getDifficultyColor = (rating: number): string => {
    if (rating < 33) return '#10B981'; // Green
    if (rating < 66) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const filteredChallenges = availableChallenges.filter(challenge =>
    searchTerm === '' || 
    challenge.creatorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    challenge.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB'
      }}>
        <div style={{ fontSize: '18px', color: '#6B7280' }}>
          🔍 Loading challenges...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      backgroundColor: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0',
        color: '#1F2937',
        fontSize: '24px',
        fontWeight: '600'
      }}>
        🎯 Browse Challenges
      </h2>

      {/* Search and Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Search by creator or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />

        <select
          value={filters.difficulty}
          onChange={(e) => handleFilterChange('difficulty', e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: '#FFFFFF'
          }}
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>

        <select
          value={filters.minPopularity || 'all'}
          onChange={(e) => {
            dispatch(updateFilters({ minPopularity: e.target.value as any }));
            dispatch(applyFilters());
          }}
          style={{
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: '#FFFFFF'
          }}
        >
          <option value="all">All Popularity</option>
          <option value="50">Popular (50+)</option>
          <option value="70">Very Popular (70+)</option>
          <option value="90">Trending (90+)</option>
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => handleFilterChange('sortBy', e.target.value as any)}
          style={{
            padding: '8px 12px',
            border: '1px solid #D1D5DB',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: '#FFFFFF'
          }}
        >
          <option value="popularity">Most Popular</option>
          <option value="difficulty">Hardest First</option>
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest First</option>
          <option value="most_played">Most Played</option>
          <option value="highest_rated">Highest Rated</option>
        </select>
      </div>

      {/* Results Summary */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#F9FAFB',
        borderRadius: '6px',
        border: '1px solid #E5E7EB',
        marginBottom: '16px'
      }}>
        <span style={{ fontSize: '14px', color: '#6B7280' }}>
          {filteredChallenges.length === 0 ? 
            'No challenges found' : 
            `Showing ${filteredChallenges.length} challenge${filteredChallenges.length !== 1 ? 's' : ''}`
          }
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
        {filteredChallenges.length > 0 && (
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            Sorted by {filters.sortBy.replace('_', ' ')}
            {filters.difficulty !== 'all' && ` • ${filters.difficulty} difficulty`}
            {filters.minPopularity && filters.minPopularity !== 'all' && ` • ${filters.minPopularity}+ popularity`}
          </span>
        )}
      </div>

      {/* Challenge List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredChallenges.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6B7280',
            backgroundColor: '#F9FAFB',
            borderRadius: '8px',
            border: '1px solid #E5E7EB'
          }}>
            {searchTerm ? 
              `No challenges found matching "${searchTerm}"` : 
              'No challenges available'
            }
          </div>
        ) : (
          filteredChallenges.map((challenge) => (
            <div
              key={challenge.id}
              onClick={() => handleChallengeSelect(challenge)}
              style={{
                padding: '16px',
                border: selectedChallenge?.id === challenge.id ? 
                  '2px solid #3B82F6' : '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: selectedChallenge?.id === challenge.id ? 
                  '#EFF6FF' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (selectedChallenge?.id !== challenge.id) {
                  e.currentTarget.style.borderColor = '#3B82F6';
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedChallenge?.id !== challenge.id) {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '12px'
              }}>
                <div>
                  <h3 style={{ 
                    margin: '0 0 4px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#1F2937'
                  }}>
                    Challenge by {challenge.creatorName}
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center',
                    fontSize: '14px',
                    color: '#6B7280',
                    flexWrap: 'wrap'
                  }}>
                    <span>📅 {challenge.createdAt.toLocaleDateString()}</span>
                    <span>•</span>
                    <span>👥 {challenge.totalGuesses} guesses</span>
                    <span>•</span>
                    <span>🎯 {Math.round(challenge.correctGuessRate * 100)}% accuracy</span>
                    <span>•</span>
                    <span>⏱️ {Math.round(challenge.averageGuessTime / 1000)}s avg</span>
                    {challenge.emotionComplexity > 80 && (
                      <>
                        <span>•</span>
                        <span style={{ color: '#7C3AED', fontWeight: '600' }}>🧠 Complex</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#FFFFFF',
                    backgroundColor: getDifficultyColor(challenge.difficultyRating)
                  }}>
                    {getDifficultyLabel(challenge.difficultyRating)}
                  </div>
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1F2937',
                    backgroundColor: '#F3F4F6'
                  }}>
                    ⭐ {challenge.popularityScore}
                  </div>
                  {challenge.totalGuesses > 50 && (
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#FFFFFF',
                      backgroundColor: '#10B981'
                    }}>
                      🔥 Hot
                    </div>
                  )}
                </div>
              </div>

              {/* Preview of statements */}
              <div style={{ 
                display: 'grid', 
                gap: '8px',
                marginBottom: '12px'
              }}>
                {challenge.statements.slice(0, 2).map((statement, index) => (
                  <div
                    key={statement.id}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '6px',
                      fontSize: '14px',
                      color: '#374151',
                      border: '1px solid #E5E7EB'
                    }}
                  >
                    {index + 1}. {statement.text}
                  </div>
                ))}
                {challenge.statements.length > 2 && (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: '#6B7280',
                    fontStyle: 'italic',
                    textAlign: 'center'
                  }}>
                    +1 more statement...
                  </div>
                )}
              </div>

              {/* Tags */}
              {challenge.tags.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  flexWrap: 'wrap' 
                }}>
                  {challenge.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#EBF8FF',
                        color: '#1E40AF',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selected Challenge Info */}
      {selectedChallenge && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #3B82F6',
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            margin: '0 0 8px 0',
            color: '#1E40AF',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            ✅ Selected: Challenge by {selectedChallenge.creatorName}
          </h4>
          <p style={{ 
            margin: '0',
            fontSize: '14px',
            color: '#1E40AF'
          }}>
            Ready to start guessing! This challenge has {selectedChallenge.statements.length} statements 
            and an average guess time of {Math.round(selectedChallenge.averageGuessTime / 1000)} seconds.
          </p>
        </div>
      )}
    </div>
  );
};