import React from 'react';
import { render } from '@testing-library/react-native';
import { Toast } from '../Toast';

describe('Toast', () => {
  const mockOnHide = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when visible is true', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Test message"
        type="info"
        onHide={mockOnHide}
      />
    );
    
    expect(getByText('Test message')).toBeTruthy();
  });

  it('does not render when visible is false', () => {
    const { queryByText } = render(
      <Toast
        visible={false}
        message="Test message"
        type="info"
        onHide={mockOnHide}
      />
    );
    
    expect(queryByText('Test message')).toBeNull();
  });

  it('renders success toast with correct icon', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Success message"
        type="success"
        onHide={mockOnHide}
      />
    );
    
    expect(getByText('Success message')).toBeTruthy();
    expect(getByText('✅')).toBeTruthy();
  });

  it('renders error toast with correct icon', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Error message"
        type="error"
        onHide={mockOnHide}
      />
    );
    
    expect(getByText('Error message')).toBeTruthy();
    expect(getByText('❌')).toBeTruthy();
  });

  it('renders warning toast with correct icon', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Warning message"
        type="warning"
        onHide={mockOnHide}
      />
    );
    
    expect(getByText('Warning message')).toBeTruthy();
    expect(getByText('⚠️')).toBeTruthy();
  });

  it('renders info toast with correct icon', () => {
    const { getByText } = render(
      <Toast
        visible={true}
        message="Info message"
        type="info"
        onHide={mockOnHide}
      />
    );
    
    expect(getByText('Info message')).toBeTruthy();
    expect(getByText('ℹ️')).toBeTruthy();
  });
});