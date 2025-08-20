/**
 * Unit tests for ChallengeCreationForm component
 * Tests statement input, lie selection, and validation functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('ChallengeCreationForm', () => {
  beforeEach(() => {
    // Clear any previous test state
    jest.clearAllMocks();
  });

  test('renders form with initial state', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByText('Create Your Challenge')).toBeInTheDocument();
    expect(screen.getByText(/Write three statements about yourself/)).toBeInTheDocument();
    
    // Check for 3 statement inputs
    expect(screen.getByPlaceholderText(/Enter your first statement/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your second statement/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your third statement/)).toBeInTheDocument();
    
    // Check for lie selection buttons
    const lieButtons = screen.getAllByText('Mark as lie');
    expect(lieButtons).toHaveLength(3);
  });

  test('allows entering text in statement inputs', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
    
    fireEvent.change(firstInput, { target: { value: 'I have traveled to 15 countries' } });
    
    await waitFor(() => {
      expect(firstInput).toHaveValue('I have traveled to 15 countries');
    });
  });

  test('allows selecting a statement as the lie', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const lieButtons = screen.getAllByText('Mark as lie');
    
    fireEvent.click(lieButtons[1]); // Select second statement as lie
    
    await waitFor(() => {
      expect(screen.getByText('✓ This is the lie')).toBeInTheDocument();
    });
  });

  test('shows character count for statements', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const characterCounts = screen.getAllByText(/\/280 characters/);
    expect(characterCounts).toHaveLength(3);
  });

  test('shows validation status indicators', () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    expect(screen.getByText('Statements:')).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText('Lie selected:')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  test('enables preview button when form is valid', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    // Fill in all statements
    const inputs = [
      screen.getByPlaceholderText(/Enter your first statement/),
      screen.getByPlaceholderText(/Enter your second statement/),
      screen.getByPlaceholderText(/Enter your third statement/),
    ];
    
    fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
    fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
    fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
    
    // Wait for state to update
    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });
    
    // Select a lie using a more specific selector
    const allButtons = screen.getAllByRole('button');
    const lieButton = allButtons.find(button => button.textContent === 'Mark as lie');
    if (lieButton) {
      fireEvent.click(lieButton);
    }
    
    await waitFor(() => {
      const previewButton = screen.getByText('Preview Challenge');
      expect(previewButton).not.toBeDisabled();
    });
  });

  test('shows validation errors when form is incomplete', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const previewButton = screen.getByText('Preview Challenge');
    expect(previewButton).toBeDisabled();
  });

  test('updates statement count as user types', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
    
    fireEvent.change(firstInput, { target: { value: 'I have traveled to 15 countries' } });
    
    await waitFor(() => {
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });
  });

  test('updates lie selection status when lie is selected', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const lieButtons = screen.getAllByText('Mark as lie');
    fireEvent.click(lieButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });

  test('calls onSubmit when form is submitted with valid data', async () => {
    const mockOnSubmit = jest.fn();
    renderWithProvider(<ChallengeCreationForm onSubmit={mockOnSubmit} />);
    
    // Fill in all statements
    const inputs = [
      screen.getByPlaceholderText(/Enter your first statement/),
      screen.getByPlaceholderText(/Enter your second statement/),
      screen.getByPlaceholderText(/Enter your third statement/),
    ];
    
    fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
    fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
    fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
    
    // Wait for statements to be filled
    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });
    
    // Select a lie
    const allButtons = screen.getAllByRole('button');
    const lieButton = allButtons.find(button => button.textContent === 'Mark as lie');
    if (lieButton) {
      fireEvent.click(lieButton);
    }
    
    // Wait for lie to be selected
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
    
    // Submit the form
    const submitButton = screen.getByText('Create Challenge');
    fireEvent.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test('calls onCancel when cancel button is clicked', () => {
    const mockOnCancel = jest.fn();
    renderWithProvider(<ChallengeCreationForm onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('prevents submission when statements are empty', async () => {
    const mockOnSubmit = jest.fn();
    renderWithProvider(<ChallengeCreationForm onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByText('Create Challenge');
    expect(submitButton).toBeDisabled();
    
    // Try to click disabled button
    fireEvent.click(submitButton);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('prevents submission when no lie is selected', async () => {
    const mockOnSubmit = jest.fn();
    renderWithProvider(<ChallengeCreationForm onSubmit={mockOnSubmit} />);
    
    // Fill in all statements but don't select a lie
    const inputs = [
      screen.getByPlaceholderText(/Enter your first statement/),
      screen.getByPlaceholderText(/Enter your second statement/),
      screen.getByPlaceholderText(/Enter your third statement/),
    ];
    
    fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
    fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
    fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
    
    await waitFor(() => {
      const submitButton = screen.getByText('Create Challenge');
      expect(submitButton).toBeDisabled();
    });
  });

  test('enforces character limit on statements', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
    const longText = 'a'.repeat(300); // Exceeds 280 character limit
    
    fireEvent.change(firstInput, { target: { value: longText } });
    
    await waitFor(() => {
      expect(firstInput).toHaveValue(longText.substring(0, 280));
    });
  });

  test('shows preview mode indicator when preview is activated', async () => {
    renderWithProvider(<ChallengeCreationForm />);
    
    // Fill in valid form data
    const inputs = [
      screen.getByPlaceholderText(/Enter your first statement/),
      screen.getByPlaceholderText(/Enter your second statement/),
      screen.getByPlaceholderText(/Enter your third statement/),
    ];
    
    fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
    fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
    fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
    
    // Wait for statements to be filled
    await waitFor(() => {
      expect(screen.getByText('3/3')).toBeInTheDocument();
    });
    
    // Select a lie
    const allButtons = screen.getAllByRole('button');
    const lieButton = allButtons.find(button => button.textContent === 'Mark as lie');
    if (lieButton) {
      fireEvent.click(lieButton);
    }
    
    // Wait for lie to be selected and form to be valid
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
    
    // Click preview button
    const previewButton = screen.getByText('Preview Challenge');
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Preview mode active/)).toBeInTheDocument();
    });
  });
});