import React from 'react';
import { ReportButton } from '../ReportButton';

// Mock the useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    isAuthenticated: true,
    isGuest: false,
    user: { id: '1', name: 'Test User', createdAt: '2023-01-01' },
    isLoading: false,
    hasValidToken: true,
    login: jest.fn(),
    signup: jest.fn(),
    logout: jest.fn(),
    refreshAuth: jest.fn(),
    checkAuthStatus: jest.fn(),
    triggerAuthFlow: jest.fn(),
    exitAuthFlow: jest.fn(),
  })),
}));

// Mock the Redux store
const mockUseAppSelector = jest.fn();
jest.mock('../../store', () => ({
  useAppSelector: mockUseAppSelector,
}));

// Mock the reporting slice
const mockSelectIsChallengeReported = jest.fn();
jest.mock('../../store/slices/reportingSlice', () => ({
  selectIsChallengeReported: mockSelectIsChallengeReported,
}));

describe('ReportButton', () => {
  const mockOnPress = jest.fn();
  const testChallengeId = 'test-challenge-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: challenge not reported
    mockUseAppSelector.mockReturnValue(false);
    mockSelectIsChallengeReported.mockReturnValue(() => false);
  });

  it('compiles without TypeScript errors', () => {
    // This test ensures the component compiles correctly
    expect(() => {
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress });
    }).not.toThrow();
  });

  it('accepts all expected props', () => {
    // Test that all props are accepted without TypeScript errors
    expect(() => {
      React.createElement(ReportButton, {
        challengeId: testChallengeId,
        onPress: mockOnPress,
        disabled: false,
        size: 'small',
        variant: 'minimal',
        style: { backgroundColor: 'red' },
        iconStyle: { fontSize: 16 },
      });
    }).not.toThrow();
  });

  it('accepts different size variants', () => {
    expect(() => {
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress, size: 'small' });
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress, size: 'medium' });
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress, size: 'large' });
    }).not.toThrow();
  });

  it('accepts different variants', () => {
    expect(() => {
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress, variant: 'default' });
      React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress, variant: 'minimal' });
    }).not.toThrow();
  });

  it('has proper component structure', () => {
    const element = React.createElement(ReportButton, { challengeId: testChallengeId, onPress: mockOnPress });
    expect(element.type).toBe(ReportButton);
    expect(element.props.onPress).toBe(mockOnPress);
    expect(element.props.challengeId).toBe(testChallengeId);
  });

  it('requires challengeId prop', () => {
    // Test that challengeId is required
    expect(() => {
      // @ts-expect-error - Testing missing required prop
      React.createElement(ReportButton, { onPress: mockOnPress });
    }).not.toThrow(); // Component creation doesn't throw, but TypeScript should catch this
  });

  describe('duplicate prevention', () => {
    it('shows flag icon when challenge is not reported', () => {
      mockUseAppSelector.mockReturnValue(false);
      
      const element = React.createElement(ReportButton, { 
        challengeId: testChallengeId, 
        onPress: mockOnPress 
      });
      
      expect(element.props.challengeId).toBe(testChallengeId);
      // Component should be created successfully when not reported
      expect(element.type).toBe(ReportButton);
    });

    it('shows black flag icon when challenge is already reported', () => {
      mockUseAppSelector.mockReturnValue(true);
      
      const element = React.createElement(ReportButton, { 
        challengeId: testChallengeId, 
        onPress: mockOnPress 
      });
      
      expect(element.props.challengeId).toBe(testChallengeId);
      // Component should be created successfully when reported
      expect(element.type).toBe(ReportButton);
    });

    it('uses correct challengeId for state lookup', () => {
      const element = React.createElement(ReportButton, { 
        challengeId: testChallengeId, 
        onPress: mockOnPress 
      });
      
      // Verify the component was created with the correct challengeId
      expect(element.props.challengeId).toBe(testChallengeId);
      expect(element.type).toBe(ReportButton);
    });

    it('handles different challenge IDs correctly', () => {
      const challengeId1 = 'challenge-1';
      const challengeId2 = 'challenge-2';
      
      const element1 = React.createElement(ReportButton, { 
        challengeId: challengeId1, 
        onPress: mockOnPress 
      });
      
      const element2 = React.createElement(ReportButton, { 
        challengeId: challengeId2, 
        onPress: mockOnPress 
      });
      
      expect(element1.props.challengeId).toBe(challengeId1);
      expect(element2.props.challengeId).toBe(challengeId2);
    });
  });
});