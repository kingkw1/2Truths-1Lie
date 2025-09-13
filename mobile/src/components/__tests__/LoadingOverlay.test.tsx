import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingOverlay } from '../LoadingOverlay';

describe('LoadingOverlay', () => {
  it('renders when visible is true', () => {
    const { getByText } = render(
      <LoadingOverlay visible={true} message="Loading..." />
    );
    
    expect(getByText('Loading...')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(
      <LoadingOverlay visible={false} message="Loading..." />
    );
    
    expect(queryByText('Loading...')).toBeNull();
  });

  it('renders with custom message', () => {
    const customMessage = 'Creating your account...';
    const { getByText } = render(
      <LoadingOverlay visible={true} message={customMessage} />
    );
    
    expect(getByText(customMessage)).toBeTruthy();
  });

  it('renders with default message when no message provided', () => {
    const { getByText } = render(
      <LoadingOverlay visible={true} />
    );
    
    expect(getByText('Loading...')).toBeTruthy();
  });
});