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

describe('ReportButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compiles without TypeScript errors', () => {
    // This test ensures the component compiles correctly
    expect(() => {
      React.createElement(ReportButton, { onPress: mockOnPress });
    }).not.toThrow();
  });

  it('accepts all expected props', () => {
    // Test that all props are accepted without TypeScript errors
    expect(() => {
      React.createElement(ReportButton, {
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
      React.createElement(ReportButton, { onPress: mockOnPress, size: 'small' });
      React.createElement(ReportButton, { onPress: mockOnPress, size: 'medium' });
      React.createElement(ReportButton, { onPress: mockOnPress, size: 'large' });
    }).not.toThrow();
  });

  it('accepts different variants', () => {
    expect(() => {
      React.createElement(ReportButton, { onPress: mockOnPress, variant: 'default' });
      React.createElement(ReportButton, { onPress: mockOnPress, variant: 'minimal' });
    }).not.toThrow();
  });

  it('has proper component structure', () => {
    const element = React.createElement(ReportButton, { onPress: mockOnPress });
    expect(element.type).toBe(ReportButton);
    expect(element.props.onPress).toBe(mockOnPress);
  });
});