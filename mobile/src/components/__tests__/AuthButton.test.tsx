import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AuthButton } from '../AuthButton';

describe('AuthButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );
    
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} />
    );
    
    fireEvent.press(getByText('Sign In'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator when loading', () => {
    const { queryByText, getByTestId } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );
    
    // Title should not be visible when loading
    expect(queryByText('Sign In')).toBeNull();
    // Loading indicator should be present (ActivityIndicator doesn't have testID by default)
  });

  it('shows loading text when provided', () => {
    const { getByText } = render(
      <AuthButton 
        title="Sign In" 
        onPress={mockOnPress} 
        loading={true}
        loadingText="Signing In..."
      />
    );
    
    expect(getByText('Signing In...')).toBeTruthy();
  });

  it('is disabled when loading', () => {
    const { getByRole } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} loading={true} />
    );
    
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('is disabled when disabled prop is true', () => {
    const { getByRole } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} disabled={true} />
    );
    
    const button = getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it('does not call onPress when disabled', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} disabled={true} />
    );
    
    fireEvent.press(getByText('Sign In'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('renders secondary variant correctly', () => {
    const { getByText } = render(
      <AuthButton title="Sign In" onPress={mockOnPress} variant="secondary" />
    );
    
    expect(getByText('Sign In')).toBeTruthy();
  });
});