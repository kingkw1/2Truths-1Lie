import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SignupScreen } from '../SignupScreen';
import { authService } from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  authService: {
    signup: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('SignupScreen', () => {
  const mockProps = {
    onSignupSuccess: jest.fn(),
    onNavigateToLogin: jest.fn(),
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(
      <SignupScreen {...mockProps} />
    );

    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('Sign up to save your progress and compete with friends')).toBeTruthy();
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Create a password')).toBeTruthy();
    expect(getByPlaceholderText('Confirm your password')).toBeTruthy();
    expect(getByText('Create Account')).toBeTruthy();
    expect(getByText('Already have an account?')).toBeTruthy();
    expect(getByText('Sign in')).toBeTruthy();
  });

  it('shows validation errors for empty fields', async () => {
    const { getByText } = render(<SignupScreen {...mockProps} />);

    const signupButton = getByText('Create Account');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
      expect(getByText('Password is required')).toBeTruthy();
      expect(getByText('Please confirm your password')).toBeTruthy();
    });
  });

  it('shows validation error for invalid email', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const emailInput = getByPlaceholderText('Enter your email');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Please enter a valid email address')).toBeTruthy();
    });
  });

  it('shows validation error for weak password', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const passwordInput = getByPlaceholderText('Create a password');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(passwordInput, '123');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Password must be at least 8 characters')).toBeTruthy();
    });
  });

  it('shows validation error for password without letters and numbers', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const passwordInput = getByPlaceholderText('Create a password');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(passwordInput, 'onlyletters');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Password must contain at least one letter and one number')).toBeTruthy();
    });
  });

  it('shows validation error for mismatched passwords', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const passwordInput = getByPlaceholderText('Create a password');
    const confirmPasswordInput = getByPlaceholderText('Confirm your password');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.changeText(confirmPasswordInput, 'different123');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Passwords do not match')).toBeTruthy();
    });
  });

  it('calls authService.signup with correct parameters on valid form submission', async () => {
    mockAuthService.signup.mockResolvedValueOnce({
      id: 'user123',
      name: 'testuser',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const emailInput = getByPlaceholderText('Enter your email');
    const passwordInput = getByPlaceholderText('Create a password');
    const confirmPasswordInput = getByPlaceholderText('Confirm your password');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.changeText(confirmPasswordInput, 'password123');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(mockAuthService.signup).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockProps.onSignupSuccess).toHaveBeenCalled();
    });
  });

  it('shows error message when signup fails', async () => {
    mockAuthService.signup.mockRejectedValueOnce(new Error('Email already exists'));

    const { getByPlaceholderText, getByText } = render(
      <SignupScreen {...mockProps} />
    );

    const emailInput = getByPlaceholderText('Enter your email');
    const passwordInput = getByPlaceholderText('Create a password');
    const confirmPasswordInput = getByPlaceholderText('Confirm your password');
    const signupButton = getByText('Create Account');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.changeText(confirmPasswordInput, 'password123');
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('An account with this email already exists. Please try logging in instead.')).toBeTruthy();
    });
  });

  it('calls onNavigateToLogin when sign in link is pressed', () => {
    const { getByText } = render(<SignupScreen {...mockProps} />);

    const signInLink = getByText('Sign in');
    fireEvent.press(signInLink);

    expect(mockProps.onNavigateToLogin).toHaveBeenCalled();
  });

  it('calls onBack when back button is pressed', () => {
    const { getByText } = render(<SignupScreen {...mockProps} />);

    const backButton = getByText('← Back');
    fireEvent.press(backButton);

    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it('clears errors when user starts typing', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <SignupScreen {...mockProps} />
    );

    const emailInput = getByPlaceholderText('Enter your email');
    const signupButton = getByText('Create Account');

    // Trigger validation error
    fireEvent.press(signupButton);

    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });

    // Start typing to clear error
    fireEvent.changeText(emailInput, 'test@example.com');

    await waitFor(() => {
      expect(queryByText('Email is required')).toBeNull();
    });
  });
});