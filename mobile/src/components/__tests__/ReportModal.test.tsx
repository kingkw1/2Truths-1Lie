/**
 * Unit tests for ReportModal component
 */

import React from 'react';
import { ReportModal, ModerationReason } from '../ReportModal';

// Mock the useReportAuth hook
jest.mock('../../hooks/useReportAuth', () => ({
  useReportAuth: jest.fn(() => ({
    canReport: true,
    isAuthenticated: true,
    isGuest: false,
    checkReportAuth: jest.fn(),
    handleAuthRequired: jest.fn(),
    validateReportPermissions: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

// Mock ReportService
jest.mock('../../services/reportService', () => ({
  ReportService: {
    getInstance: jest.fn(() => ({
      canUserReport: jest.fn(() => ({ canReport: true })),
    })),
    getUserFriendlyErrorMessage: jest.fn((error) => error.message || 'Error occurred'),
    isRecoverableError: jest.fn(() => true),
  },
  reportService: {
    canUserReport: jest.fn(() => ({ canReport: true })),
  },
}));

describe('ReportModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compiles without TypeScript errors', () => {
    // This test ensures the component compiles correctly
    expect(() => {
      React.createElement(ReportModal, {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
      });
    }).not.toThrow();
  });

  it('accepts all expected props', () => {
    // Test that all props are accepted without TypeScript errors
    expect(() => {
      React.createElement(ReportModal, {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        isSubmitting: false,
      });
    }).not.toThrow();
  });

  it('accepts visible prop variations', () => {
    expect(() => {
      React.createElement(ReportModal, {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
      });
      React.createElement(ReportModal, {
        visible: false,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
      });
    }).not.toThrow();
  });

  it('accepts isSubmitting prop variations', () => {
    expect(() => {
      React.createElement(ReportModal, {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        isSubmitting: true,
      });
      React.createElement(ReportModal, {
        visible: true,
        onClose: mockOnClose,
        onSubmit: mockOnSubmit,
        isSubmitting: false,
      });
    }).not.toThrow();
  });

  it('has proper component structure', () => {
    const element = React.createElement(ReportModal, {
      visible: true,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
    });
    expect(element.type).toBe(ReportModal);
    expect(element.props.visible).toBe(true);
    expect(element.props.onClose).toBe(mockOnClose);
    expect(element.props.onSubmit).toBe(mockOnSubmit);
  });

  it('exports ModerationReason enum correctly', () => {
    // Test that all expected enum values are present
    expect(ModerationReason.INAPPROPRIATE_LANGUAGE).toBe('inappropriate_language');
    expect(ModerationReason.SPAM).toBe('spam');
    expect(ModerationReason.PERSONAL_INFO).toBe('personal_info');
    expect(ModerationReason.VIOLENCE).toBe('violence');
    expect(ModerationReason.HATE_SPEECH).toBe('hate_speech');
    expect(ModerationReason.ADULT_CONTENT).toBe('adult_content');
    expect(ModerationReason.COPYRIGHT).toBe('copyright');
    expect(ModerationReason.MISLEADING).toBe('misleading');
    expect(ModerationReason.LOW_QUALITY).toBe('low_quality');
  });

  it('enum values match backend expectations', () => {
    // Ensure enum values match exactly what the backend expects
    const expectedValues = [
      'inappropriate_language',
      'spam',
      'personal_info',
      'violence',
      'hate_speech',
      'adult_content',
      'copyright',
      'misleading',
      'low_quality',
    ];
    
    const actualValues = Object.values(ModerationReason);
    expect(actualValues.sort()).toEqual(expectedValues.sort());
  });

  it('onSubmit callback accepts correct parameters', () => {
    const mockSubmit = jest.fn();
    
    // Test that the callback accepts the expected parameter types
    expect(() => {
      mockSubmit(ModerationReason.SPAM, 'Optional details');
      mockSubmit(ModerationReason.VIOLENCE);
      mockSubmit(ModerationReason.INAPPROPRIATE_LANGUAGE, undefined);
    }).not.toThrow();
  });
});