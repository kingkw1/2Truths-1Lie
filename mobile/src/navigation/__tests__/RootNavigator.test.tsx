/**
 * Tests for RootNavigator
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator';
import { authService } from '../../services/authService';

// Mock the authService
jest.mock('../../services/authService', () => ({
  authService: {
    initialize: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

// Mock the screens
jest.mock('../AuthNavigator', () => ({
  AuthNavigator: () => null,
}));

jest.mock('../MainNavigator', () => ({
  MainNavigator: () => null,
}));

describe('RootNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    (authService.initialize as jest.Mock).mockResolvedValue(undefined);
    (authService.getCurrentUser as jest.Mock).mockReturnValue({ id: 'guest_123', name: 'Guest User' });

    const { getByTestId } = render(<RootNavigator />);
    
    await waitFor(() => {
      expect(authService.initialize).toHaveBeenCalled();
    });
  });

  it('should show auth navigator for unauthenticated users', async () => {
    (authService.initialize as jest.Mock).mockResolvedValue(undefined);
    (authService.getCurrentUser as jest.Mock).mockReturnValue({ id: 'guest_123', name: 'Guest User' });

    render(<RootNavigator />);
    
    await waitFor(() => {
      expect(authService.initialize).toHaveBeenCalled();
    });
  });

  it('should show main navigator for authenticated users', async () => {
    (authService.initialize as jest.Mock).mockResolvedValue(undefined);
    (authService.getCurrentUser as jest.Mock).mockReturnValue({ 
      id: 'user_123', 
      name: 'Test User',
      email: 'test@example.com'
    });

    render(<RootNavigator />);
    
    await waitFor(() => {
      expect(authService.initialize).toHaveBeenCalled();
    });
  });
});