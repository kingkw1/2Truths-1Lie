/**
 * Segmented Video Player Integration Test
 * Tests the integration between GameScreen and SegmentedVideoPlayer
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { GameScreen } from '../screens/GameScreen';
import guessingGameReducer from '../store/slices/guessingGameSlice';

// Mock expo-av
jest.mock('expo-av', () => ({
    Video: jest.fn(({ children, ...props }) => {
        const MockVideo = require('react-native').View;
        return <MockVideo testID="mock-video" {...props}>{children}</MockVideo>;
    }),
    ResizeMode: {
        CONTAIN: 'contain',
    },
}));

// Mock other dependencies
jest.mock('../shared/AnimatedFeedback', () => {
    return jest.fn(() => null);
});

jest.mock('../screens/ChallengeCreationScreen', () => ({
    ChallengeCreationScreen: jest.fn(() => null),
}));

describe('SegmentedVideoPlayer Integration', () => {
    const createMockStore = () => {
        return configureStore({
            reducer: {
                guessingGame: guessingGameReducer,
            },
            preloadedState: {
                guessingGame: {
                    currentSession: null,
                    availableChallenges: [],
                    selectedChallenge: null,
                    isLoading: false,
                    showHint: false,
                    guessSubmitted: false,
                    guessResult: null,
                    timeRemaining: null,
                    currentStreak: 0,
                    showAnimatedFeedback: false,
                    filters: {
                        difficulty: 'all' as const,
                        sortBy: 'popularity' as const,
                        minPopularity: 'all' as const,
                    },
                },
            },
        });
    };

    it('renders GameScreen without crashing', () => {
        const store = createMockStore();

        const { getByText } = render(
            <Provider store={store}>
                <GameScreen />
            </Provider>
        );

        expect(getByText('Two Truths & a Lie')).toBeTruthy();
    });

    it('shows video toggle button when challenge has segmented video', () => {
        const store = createMockStore();

        // Mock a challenge with segmented video
        const mockChallenge = {
            id: 'test-challenge',
            creatorId: 'user-1',
            creatorName: 'Test User',
            statements: [
                { id: 'stmt-1', text: 'Statement 1', isLie: false, viewCount: 0, guessAccuracy: 0, averageConfidence: 0 },
                { id: 'stmt-2', text: 'Statement 2', isLie: true, viewCount: 0, guessAccuracy: 0, averageConfidence: 0 },
                { id: 'stmt-3', text: 'Statement 3', isLie: false, viewCount: 0, guessAccuracy: 0, averageConfidence: 0 },
            ],
            mediaData: [{
                type: 'video' as const,
                streamingUrl: 'https://example.com/video.mp4',
                duration: 30000,
                fileSize: 5000000,
                mimeType: 'video/mp4',
                mediaId: 'test-video',
                isUploaded: true,
                isMergedVideo: true,
                segments: [
                    { statementIndex: 0, startTime: 0, endTime: 10000, duration: 10000 },
                    { statementIndex: 1, startTime: 10000, endTime: 20000, duration: 10000 },
                    { statementIndex: 2, startTime: 20000, endTime: 30000, duration: 10000 },
                ],
            }],
            difficultyRating: 50,
            averageGuessTime: 20000,
            popularityScore: 70,
            emotionComplexity: 40,
            recommendationWeight: 60,
            totalGuesses: 100,
            correctGuessRate: 65,
            createdAt: new Date(),
            lastPlayed: new Date(),
            tags: ['test'],
            isActive: true,
        };

        // Update store with selected challenge and session
        store.dispatch({
            type: 'guessingGame/selectChallenge',
            payload: mockChallenge,
        });

        store.dispatch({
            type: 'guessingGame/startGuessingSession',
            payload: {
                challengeId: mockChallenge.id,
                statements: mockChallenge.statements,
            },
        });

        const { getByText } = render(
            <Provider store={store}>
                <GameScreen />
            </Provider>
        );

        // Should show the video toggle button
        expect(getByText('🎥 Watch Statements')).toBeTruthy();
    });
});