/**
 * Test utilities for Redux testing
 */

import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer from '../store/slices/challengeCreationSlice';
import guessingGameReducer from '../store/slices/guessingGameSlice';
import gameSessionReducer from '../store/slices/gameSessionSlice';

// Create a test store with default state
export function createTestStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
      guessingGame: guessingGameReducer,
      gameSession: gameSessionReducer,
    },
    preloadedState,
  });
}

// Helper to render components with Redux Provider
export function renderWithStore(
  component: React.ReactElement,
  store = createTestStore()
) {
  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store,
  };
}

// Helper to create mock challenge creation state
export function createMockChallengeCreationState(overrides = {}) {
  return {
    challengeCreation: {
      currentStatementIndex: 0,
      statements: [
        { id: 'stmt-1', text: '', isLie: false },
        { id: 'stmt-2', text: '', isLie: false },
        { id: 'stmt-3', text: '', isLie: false },
      ],
      selectedLieIndex: null,
      mediaData: [null, null, null],
      currentChallenge: {
        mediaData: [null, null, null],
      },
      mediaRecordingState: [
        {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        },
        {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        },
        {
          isRecording: false,
          isPaused: false,
          duration: 0,
          mediaType: null,
          hasPermission: false,
          error: null,
          isCompressing: false,
          compressionProgress: null,
        },
      ],
      uploadState: [
        {
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          sessionId: null,
        },
        {
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          sessionId: null,
        },
        {
          isUploading: false,
          uploadProgress: 0,
          uploadError: null,
          sessionId: null,
        },
      ],
      isSubmitting: false,
      error: null,
      validationErrors: {},
      ...overrides,
    },
  };
}

export default {
  createTestStore,
  renderWithStore,
  createMockChallengeCreationState,
};
