/**
 * Basic functionality tests for ChallengeCreationForm component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChallengeCreationForm } from '../ChallengeCreationForm';
import challengeCreationReducer from '../../store/slices/challengeCreationSlice';

// Mock store setup for testing
const createTestStore = () => {
  return configureStore({
    reducer: {
      challengeCreation: challengeCreationReducer,
    },
  });
};

const renderWithProvider = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('ChallengeCreationForm - Basic Tests', () => {
  test('renders form with title and subtitle', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByText('Create Your Challenge')).toBeInTheDocument();
    expect(screen.getByText(/Write three statements about yourself/)).toBeInTheDocument();
  });

  test('renders three statement input areas', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByPlaceholderText(/Enter your first statement/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your second statement/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your third statement/)).toBeInTheDocument();
  });

  test('renders lie selection buttons', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const lieButtons = screen.getAllByText('Mark as lie');
    expect(lieButtons).toHaveLength(3);
  });

  test('allows typing in statement inputs', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
    fireEvent.change(firstInput, { target: { value: 'Test statement' } });
    
    expect(firstInput).toHaveValue('Test statement');
  });

  test('shows character count for statements', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const characterCounts = screen.getAllByText(/\/280 characters/);
    expect(characterCounts).toHaveLength(3);
  });

  test('shows form validation status', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByText('Statements:')).toBeInTheDocument();
    expect(screen.getByText('Lie selected:')).toBeInTheDocument();
  });

  test('shows action buttons', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByText('Preview Challenge')).toBeInTheDocument();
    expect(screen.getByText('Create Challenge')).toBeInTheDocument();
  });

  test('buttons are initially disabled', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const previewButton = screen.getByText('Preview Challenge');
    const submitButton = screen.getByText('Create Challenge');
    
    expect(previewButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  test('calls onCancel when cancel button is present and clicked', () => {
    const mockOnCancel = jest.fn();
    renderWithProvider(<ChallengeCreationForm onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });
});