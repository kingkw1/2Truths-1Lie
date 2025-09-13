import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FormInput } from '../FormInput';

describe('FormInput', () => {
  it('should render label and input', () => {
    const { getByText, getByDisplayValue } = render(
      <FormInput
        label="Email"
        value="test@example.com"
        onChangeText={() => {}}
      />
    );

    expect(getByText('Email')).toBeTruthy();
    expect(getByDisplayValue('test@example.com')).toBeTruthy();
  });

  it('should show required indicator when required', () => {
    const { getByText } = render(
      <FormInput
        label="Email"
        value=""
        onChangeText={() => {}}
        required
      />
    );

    expect(getByText('*')).toBeTruthy();
  });

  it('should display error message when error exists', () => {
    const { getByText } = render(
      <FormInput
        label="Email"
        value=""
        onChangeText={() => {}}
        error="Email is required"
      />
    );

    expect(getByText('Email is required')).toBeTruthy();
  });

  it('should display helper text when no error exists', () => {
    const { getByText } = render(
      <FormInput
        label="Password"
        value=""
        onChangeText={() => {}}
        helperText="Must be at least 8 characters"
      />
    );

    expect(getByText('Must be at least 8 characters')).toBeTruthy();
  });

  it('should hide helper text when error exists', () => {
    const { queryByText } = render(
      <FormInput
        label="Password"
        value=""
        onChangeText={() => {}}
        error="Password is required"
        helperText="Must be at least 8 characters"
      />
    );

    expect(queryByText('Must be at least 8 characters')).toBeNull();
  });

  it('should call onChangeText when text changes', () => {
    const mockOnChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <FormInput
        label="Email"
        value="test"
        onChangeText={mockOnChangeText}
      />
    );

    const input = getByDisplayValue('test');
    fireEvent.changeText(input, 'test@example.com');

    expect(mockOnChangeText).toHaveBeenCalledWith('test@example.com');
  });

  it('should apply error styling when error exists', () => {
    const { getByDisplayValue } = render(
      <FormInput
        label="Email"
        value="invalid-email"
        onChangeText={() => {}}
        error="Invalid email"
      />
    );

    const input = getByDisplayValue('invalid-email');
    expect(input.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          borderColor: '#ff4444',
          backgroundColor: '#fff5f5',
        }),
      ])
    );
  });

  it('should pass through TextInput props', () => {
    const { getByDisplayValue } = render(
      <FormInput
        label="Password"
        value="password"
        onChangeText={() => {}}
        secureTextEntry
        placeholder="Enter password"
      />
    );

    const input = getByDisplayValue('password');
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.placeholder).toBe('Enter password');
  });
});