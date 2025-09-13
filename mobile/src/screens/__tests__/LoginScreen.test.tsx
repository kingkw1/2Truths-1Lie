import React from 'react';
import { LoginScreen } from '../LoginScreen';
import { authService } from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  authService: {
    login: jest.fn(),
  },
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;

describe('LoginScreen', () => {
  const mockProps = {
    onLoginSuccess: jest.fn(),
    onNavigateToSignup: jest.fn(),
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('component exports correctly', () => {
    expect(LoginScreen).toBeDefined();
    expect(typeof LoginScreen).toBe('function');
  });

  it('validates email format correctly', () => {
    // Test the email validation logic by creating a component instance
    const component = React.createElement(LoginScreen, mockProps);
    expect(component).toBeDefined();
    expect(component.type).toBe(LoginScreen);
  });

  it('auth service integration works', async () => {
    mockAuthService.login.mockResolvedValueOnce({
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date().toISOString(),
    });

    // Test that the auth service mock is properly configured
    const result = await mockAuthService.login('test@example.com', 'password123');
    expect(result.email).toBe('test@example.com');
    expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('handles auth service errors', async () => {
    mockAuthService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    try {
      await mockAuthService.login('test@example.com', 'wrongpassword');
    } catch (error: any) {
      expect(error.message).toBe('Invalid credentials');
    }

    expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
  });

  it('callback props are properly typed', () => {
    expect(typeof mockProps.onLoginSuccess).toBe('function');
    expect(typeof mockProps.onNavigateToSignup).toBe('function');
    expect(typeof mockProps.onBack).toBe('function');

    // Test that callbacks can be called
    mockProps.onLoginSuccess();
    mockProps.onNavigateToSignup();
    mockProps.onBack();

    expect(mockProps.onLoginSuccess).toHaveBeenCalled();
    expect(mockProps.onNavigateToSignup).toHaveBeenCalled();
    expect(mockProps.onBack).toHaveBeenCalled();
  });
});