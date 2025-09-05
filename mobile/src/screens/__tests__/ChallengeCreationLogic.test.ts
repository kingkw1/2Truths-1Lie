/**
 * Challenge Creation Logic Tests
 * Tests the core logic for video merging and validation
 */

import { configureStore } from '@reduxjs/toolkit';
import challengeCreationReducer, {
  setIndividualRecording,
  completeVideoMerging,
  setLieStatement,
  validateChallenge,
} from '../../store/slices/challengeCreationSlice';

describe('Challenge Creation Video Merging Logic', () => {
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

  it('should validate successfully with merged video', () => {
    // Set up merged video
    store.dispatch(completeVideoMerging({
      mergedVideo: {
        type: 'video',
        isMergedVideo: true,
        segments: [
          { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
          { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
          { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
        ],
        duration: 15000,
        url: 'file:///merged-video.mp4',
        mediaId: 'merged-123',
        isUploaded: true,
      },
    }));

    // Set lie statement
    store.dispatch(setLieStatement(1));

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

  it('should handle merged video state correctly', () => {
    const mergedVideo = {
      type: 'video' as const,
      isMergedVideo: true,
      segments: [
        { statementIndex: 0, startTime: 0, endTime: 5000, duration: 5000 },
        { statementIndex: 1, startTime: 5000, endTime: 10000, duration: 5000 },
        { statementIndex: 2, startTime: 10000, endTime: 15000, duration: 5000 },
      ],
      duration: 15000,
      url: 'file:///merged-video.mp4',
      mediaId: 'merged-123',
      isUploaded: true,
    };

    store.dispatch(completeVideoMerging({ mergedVideo }));

    const state = store.getState().challengeCreation;
    expect(state.mergedVideo).toEqual(mergedVideo);
    expect(state.currentChallenge.mediaData).toEqual([mergedVideo]);
  });
});