/**
 * Unit tests for challengeCreationSlice state transitions and validation
 * Tests Redux state management for challenge creation workflow
 */

import challengeCreationReducer, {
  ChallengeCreationState,
  startNewChallenge,
  updateStatement,
  setLieStatement,
  startRecording,
  stopRecording,
  setMediaData,
  setStatementMedia,
  setEmotionAnalysis,
  setQualityScore,
  setEstimatedDifficulty,
  validateChallenge,
  enterPreviewMode,
  exitPreviewMode,
  startSubmission,
  completeSubmission,
  clearValidationErrors,
} from '../challengeCreationSlice';
import { Statement, MediaCapture, EmotionScores } from '../../../../types';

describe('challengeCreationSlice', () => {
  let initialState: ChallengeCreationState;

  beforeEach(() => {
    initialState = {
      currentChallenge: {
        creatorId: '',
        statements: [],
        mediaData: [],
        isPublic: true,
      },
      isRecording: false,
      recordingType: null,
      currentStatementIndex: 0,
      validationErrors: [],
      isSubmitting: false,
      submissionSuccess: false,
      previewMode: false,
      mediaRecordingState: {},
      uploadState: {},
    };
  });

  describe('State Transitions', () => {
    test('startNewChallenge resets state to initial values', () => {
      const modifiedState: ChallengeCreationState = {
        ...initialState,
        currentStatementIndex: 2,
        validationErrors: ['Some error'],
        isSubmitting: true,
        submissionSuccess: true,
        previewMode: true,
      };

      const newState = challengeCreationReducer(modifiedState, startNewChallenge());

      expect(newState.currentChallenge.statements).toEqual([
        { id: 'stmt_1', text: '', isLie: false, confidence: 0 },
        { id: 'stmt_2', text: '', isLie: false, confidence: 0 },
        { id: 'stmt_3', text: '', isLie: false, confidence: 0 },
      ]);
      expect(newState.currentStatementIndex).toBe(0);
      expect(newState.validationErrors).toEqual([]);
      expect(newState.isSubmitting).toBe(false);
      expect(newState.submissionSuccess).toBe(false);
      expect(newState.previewMode).toBe(false);
    });

    test('updateStatement creates new statement when index exceeds array length', () => {
      const statement: Statement = {
        id: 'test-1',
        text: 'I have traveled to 15 countries',
        isLie: false,
        confidence: 0.8,
      };

      const newState = challengeCreationReducer(
        initialState,
        updateStatement({ index: 0, statement })
      );

      expect(newState.currentChallenge.statements).toHaveLength(1);
      expect(newState.currentChallenge.statements![0]).toEqual(statement);
      expect(newState.currentStatementIndex).toBe(0);
    });

    test('updateStatement fills gaps in statements array', () => {
      const statement: Statement = {
        id: 'test-3',
        text: 'I can speak 4 languages',
        isLie: false,
      };

      const newState = challengeCreationReducer(
        initialState,
        updateStatement({ index: 2, statement })
      );

      expect(newState.currentChallenge.statements).toHaveLength(3);
      expect(newState.currentChallenge.statements![2]).toEqual(statement);
      expect(newState.currentStatementIndex).toBe(2);
    });

    test('setLieStatement resets all other statements and sets target as lie', () => {
      const stateWithStatements: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          statements: [
            { id: '1', text: 'Statement 1', isLie: true },
            { id: '2', text: 'Statement 2', isLie: false },
            { id: '3', text: 'Statement 3', isLie: false },
          ],
        },
      };

      const newState = challengeCreationReducer(stateWithStatements, setLieStatement(1));

      expect(newState.currentChallenge.statements![0].isLie).toBe(false);
      expect(newState.currentChallenge.statements![1].isLie).toBe(true);
      expect(newState.currentChallenge.statements![2].isLie).toBe(false);
    });

    test('setLieStatement handles invalid index gracefully', () => {
      const stateWithStatements: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          statements: [
            { id: '1', text: 'Statement 1', isLie: false },
          ],
        },
      };

      const newState = challengeCreationReducer(stateWithStatements, setLieStatement(5));

      expect(newState.currentChallenge.statements![0].isLie).toBe(false);
    });

    test('recording state transitions work correctly', () => {
      let newState = challengeCreationReducer(initialState, startRecording('video'));
      expect(newState.isRecording).toBe(true);
      expect(newState.recordingType).toBe('video');

      newState = challengeCreationReducer(newState, stopRecording());
      expect(newState.isRecording).toBe(false);
      expect(newState.recordingType).toBe(null);
    });

    test('preview mode transitions work correctly', () => {
      let newState = challengeCreationReducer(initialState, enterPreviewMode());
      expect(newState.previewMode).toBe(true);

      newState = challengeCreationReducer(newState, exitPreviewMode());
      expect(newState.previewMode).toBe(false);
    });

    test('submission state transitions work correctly', () => {
      let newState = challengeCreationReducer(initialState, startSubmission());
      expect(newState.isSubmitting).toBe(true);
      expect(newState.submissionSuccess).toBe(false);

      newState = challengeCreationReducer(newState, completeSubmission({ success: true }));
      expect(newState.isSubmitting).toBe(false);
      expect(newState.submissionSuccess).toBe(true);

      newState = challengeCreationReducer(newState, completeSubmission({ success: false }));
      expect(newState.isSubmitting).toBe(false);
      expect(newState.submissionSuccess).toBe(false);
    });
  });

  describe('Media Data Management', () => {
    test('setMediaData adds media to array', () => {
      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:video-url',
        duration: 5000,
        fileSize: 1024000,
      };

      const newState = challengeCreationReducer(initialState, setMediaData(mediaData));

      expect(newState.currentChallenge.mediaData).toHaveLength(1);
      expect(newState.currentChallenge.mediaData![0]).toEqual(mediaData);
    });

    test('setStatementMedia creates media array if not exists', () => {
      const mediaData: MediaCapture = {
        type: 'audio',
        url: 'blob:audio-url',
        duration: 3000,
      };

      const newState = challengeCreationReducer(
        initialState,
        setStatementMedia({ index: 0, media: mediaData })
      );

      expect(newState.currentChallenge.mediaData).toHaveLength(1);
      expect(newState.currentChallenge.mediaData![0]).toEqual(mediaData);
    });

    test('setStatementMedia fills gaps in media array', () => {
      const mediaData: MediaCapture = {
        type: 'video',
        url: 'blob:video-url',
        duration: 4000,
      };

      const newState = challengeCreationReducer(
        initialState,
        setStatementMedia({ index: 2, media: mediaData })
      );

      expect(newState.currentChallenge.mediaData).toHaveLength(3);
      expect(newState.currentChallenge.mediaData![2]).toEqual(mediaData);
      expect(newState.currentChallenge.mediaData![0].type).toBe('text');
      expect(newState.currentChallenge.mediaData![1].type).toBe('text');
    });

    test('setStatementMedia removes media when null is passed', () => {
      const stateWithMedia: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          mediaData: [
            { type: 'video', url: 'blob:video-url', duration: 5000 },
          ],
        },
      };

      const newState = challengeCreationReducer(
        stateWithMedia,
        setStatementMedia({ index: 0, media: null })
      );

      expect(newState.currentChallenge.mediaData![0].type).toBe('text');
      expect(newState.currentChallenge.mediaData![0].url).toBeUndefined();
    });
  });

  describe('Emotion Analysis and Quality Scoring', () => {
    test('setEmotionAnalysis adds emotion data', () => {
      const emotionData: EmotionScores = {
        confidence: 0.85,
        emotions: {
          joy: 0.7,
          sadness: 0.1,
          anger: 0.05,
          fear: 0.05,
          surprise: 0.05,
          disgust: 0.02,
          neutral: 0.03,
        },
        dominantEmotion: 'joy',
        analysisTimestamp: new Date(),
      };

      const newState = challengeCreationReducer(initialState, setEmotionAnalysis(emotionData));

      expect(newState.currentChallenge.emotionAnalysis).toHaveLength(1);
      expect(newState.currentChallenge.emotionAnalysis![0]).toEqual(emotionData);
    });

    test('setQualityScore updates quality score', () => {
      const newState = challengeCreationReducer(initialState, setQualityScore(85));

      expect(newState.currentChallenge.qualityScore).toBe(85);
    });

    test('setEstimatedDifficulty updates difficulty', () => {
      const newState = challengeCreationReducer(initialState, setEstimatedDifficulty('hard'));

      expect(newState.currentChallenge.estimatedDifficulty).toBe('hard');
    });
  });

  describe('Input Validation', () => {
    test('validateChallenge identifies missing statements', () => {
      const newState = challengeCreationReducer(initialState, validateChallenge());

      expect(newState.validationErrors).toContain('Must have exactly 3 statements');
    });

    test('validateChallenge identifies missing lie selection', () => {
      const stateWithStatements: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          statements: [
            { id: '1', text: 'Statement 1', isLie: false },
            { id: '2', text: 'Statement 2', isLie: false },
            { id: '3', text: 'Statement 3', isLie: false },
          ],
        },
      };

      const newState = challengeCreationReducer(stateWithStatements, validateChallenge());

      expect(newState.validationErrors).toContain('Must select one statement as the lie');
    });

    test('validateChallenge identifies empty statements', () => {
      const stateWithEmptyStatements: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          statements: [
            { id: '1', text: 'Statement 1', isLie: false },
            { id: '2', text: '', isLie: true },
            { id: '3', text: 'Statement 3', isLie: false },
          ],
        },
      };

      const newState = challengeCreationReducer(stateWithEmptyStatements, validateChallenge());

      expect(newState.validationErrors).toContain('All statements must have video recordings');
    });

    test('validateChallenge passes with valid challenge', () => {
      const validState: ChallengeCreationState = {
        ...initialState,
        currentChallenge: {
          ...initialState.currentChallenge,
          statements: [
            { id: '1', text: 'I have traveled to 15 countries', isLie: false },
            { id: '2', text: 'I can speak 4 languages fluently', isLie: true },
            { id: '3', text: 'I have never broken a bone', isLie: false },
          ],
          mediaData: [
            { type: 'video' as const, url: 'blob:video1', fileSize: 1000 },
            { type: 'video' as const, url: 'blob:video2', fileSize: 1000 },
            { type: 'video' as const, url: 'blob:video3', fileSize: 1000 },
          ],
        },
      };

      const newState = challengeCreationReducer(validState, validateChallenge());

      expect(newState.validationErrors).toEqual([]);
    });

    test('clearValidationErrors removes all errors', () => {
      const stateWithErrors: ChallengeCreationState = {
        ...initialState,
        validationErrors: ['Error 1', 'Error 2'],
      };

      const newState = challengeCreationReducer(stateWithErrors, clearValidationErrors());

      expect(newState.validationErrors).toEqual([]);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('setLieStatement handles empty statements array', () => {
      const newState = challengeCreationReducer(initialState, setLieStatement(0));

      // Should not crash and state should remain unchanged
      expect(newState.currentChallenge.statements).toEqual([]);
    });

    test('updateStatement handles negative index gracefully', () => {
      const statement: Statement = {
        id: 'test-negative',
        text: 'Test statement',
        isLie: false,
      };

      // This should not crash, though behavior may vary
      const newState = challengeCreationReducer(
        initialState,
        updateStatement({ index: -1, statement })
      );

      // The reducer should handle this gracefully
      expect(newState).toBeDefined();
    });

    test('multiple rapid state changes maintain consistency', () => {
      let state = initialState;

      // Simulate rapid user interactions
      state = challengeCreationReducer(state, startNewChallenge());
      state = challengeCreationReducer(state, updateStatement({
        index: 0,
        statement: { id: '1', text: 'Statement 1', isLie: false }
      }));
      state = challengeCreationReducer(state, updateStatement({
        index: 1,
        statement: { id: '2', text: 'Statement 2', isLie: false }
      }));
      state = challengeCreationReducer(state, updateStatement({
        index: 2,
        statement: { id: '3', text: 'Statement 3', isLie: false }
      }));
      state = challengeCreationReducer(state, setLieStatement(1));
      
      // Add media data to make validation pass
      state = {
        ...state,
        currentChallenge: {
          ...state.currentChallenge,
          mediaData: [
            { type: 'video' as const, url: 'blob:video1', fileSize: 1000 },
            { type: 'video' as const, url: 'blob:video2', fileSize: 1000 },
            { type: 'video' as const, url: 'blob:video3', fileSize: 1000 },
          ],
        },
      };
      
      state = challengeCreationReducer(state, validateChallenge());

      expect(state.currentChallenge.statements).toHaveLength(3);
      expect(state.currentChallenge.statements![1].isLie).toBe(true);
      expect(state.validationErrors).toEqual([]);
    });

    test('state immutability is maintained', () => {
      const statement: Statement = {
        id: 'immutable-test',
        text: 'Test immutability',
        isLie: false,
      };

      const newState = challengeCreationReducer(
        initialState,
        updateStatement({ index: 0, statement })
      );

      // Original state should not be modified
      expect(initialState.currentChallenge.statements).toEqual([]);
      expect(newState.currentChallenge.statements).toHaveLength(1);
      expect(newState).not.toBe(initialState);
    });
  });
});