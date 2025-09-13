import React from 'react';
import { render } from '@testing-library/react-native';
import { ErrorMessage } from '../ErrorMessage';

describe('ErrorMessage', () => {
  it('should render inline error message', () => {
    const { getByText } = render(
      <ErrorMessage message="This is an error" variant="inline" />
    );

    expect(getByText('This is an error')).toBeTruthy();
  });

  it('should render banner error message', () => {
    const { getByText } = render(
      <ErrorMessage message="This is a banner error" variant="banner" />
    );

    expect(getByText('This is a banner error')).toBeTruthy();
  });

  it('should not render when message is undefined', () => {
    const { queryByTestId } = render(
      <ErrorMessage message={undefined} testID="error-message" />
    );

    expect(queryByTestId('error-message')).toBeNull();
  });

  it('should not render when message is empty string', () => {
    const { queryByTestId } = render(
      <ErrorMessage message="" testID="error-message" />
    );

    expect(queryByTestId('error-message')).toBeNull();
  });

  it('should render with testID when provided', () => {
    const { getByTestId } = render(
      <ErrorMessage message="Test error" testID="custom-error" />
    );

    expect(getByTestId('custom-error')).toBeTruthy();
  });

  it('should default to inline variant', () => {
    const { getByText } = render(
      <ErrorMessage message="Default variant test" />
    );

    expect(getByText('Default variant test')).toBeTruthy();
  });
});