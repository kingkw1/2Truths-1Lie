/**
 * Challenge Creation Logic Tests
 * Tests the core logic for individual video validation
 */

import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer, {
  setIndividualRecording,
  setLieStatement,
  validateChallenge,
} from '../../store/slices/challengeCreationSlice';

describe('Challenge Creation Individual Video Logic', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        challengeCreation: challengeCreationReducer,
      },
    });
  });

  it('should validate successfully with individual recordings', () => {
    // Set up individual recordings
    store.dispatch(setIndividualRecording({
      statementIndex: 0,
      recording: {
        type: 'video',
        url: 'file:///video1.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 1,
      recording: {
        type: 'video',
        url: 'file:///video2.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 2,
      recording: {
        type: 'video',
        url: 'file:///video3.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    // Set lie statement
    store.dispatch(setLieStatement(0));

    // Validate
    store.dispatch(validateChallenge());

    const state = store.getState().challengeCreation;
    expect(state.validationErrors).toEqual([]);
  });

  it('should fail validation without any recordings', () => {
    // Set lie statement but no recordings
    store.dispatch(setLieStatement(0));

    // Validate
    store.dispatch(validateChallenge());

    const state = store.getState().challengeCreation;
    expect(state.validationErrors).toContain('Statements 1, 2, 3 must have video recordings');
  });

  it('should fail validation with incomplete individual recordings', () => {
    // Set up only 2 individual recordings
    store.dispatch(setIndividualRecording({
      statementIndex: 0,
      recording: {
        type: 'video',
        url: 'file:///video1.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 1,
      recording: {
        type: 'video',
        url: 'file:///video2.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    // Set lie statement
    store.dispatch(setLieStatement(0));

    // Validate
    store.dispatch(validateChallenge());

    const state = store.getState().challengeCreation;
    expect(state.validationErrors).toContain('Statement 3 must have video recordings');
  });

  it('should fail validation without lie selection', () => {
    // Set up all individual recordings
    store.dispatch(setIndividualRecording({
      statementIndex: 0,
      recording: {
        type: 'video',
        url: 'file:///video1.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 1,
      recording: {
        type: 'video',
        url: 'file:///video2.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    store.dispatch(setIndividualRecording({
      statementIndex: 2,
      recording: {
        type: 'video',
        url: 'file:///video3.mp4',
        duration: 5000,
        fileSize: 1024 * 1024,
        mimeType: 'video/mp4',
      },
    }));

    // Don't set lie statement

    // Validate
    store.dispatch(validateChallenge());

    const state = store.getState().challengeCreation;
    expect(state.validationErrors).toContain('Must select one statement as the lie');
  });

  
});