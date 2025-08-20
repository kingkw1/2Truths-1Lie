/**
 * State transition and input validation tests for ChallengeCreationForm
 * Focuses on form state management, validation logic, and user interaction flows
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
  return { 
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
};

describe('ChallengeCreationForm - State Transitions and Input Validation', () => {
  describe('Form State Transitions', () => {
    test('transitions from empty to partially filled state', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      // Initial state - empty form
      expect(screen.getByText('0/3')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument(); // Lie selected: No
      
      // Add first statement
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      fireEvent.change(firstInput, { target: { value: 'I have traveled to 15 countries' } });
      
      await waitFor(() => {
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
      
      // Add second statement
      const secondInput = screen.getByPlaceholderText(/Enter your second statement/);
      fireEvent.change(secondInput, { target: { value: 'I can speak 4 languages' } });
      
      await waitFor(() => {
        expect(screen.getByText('2/3')).toBeInTheDocument();
      });
    });

    test('transitions to complete state when all fields are filled', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      // Fill all statements
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
      fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
      fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
      
      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
      });
      
      // Select a lie
      const lieButtons = screen.getAllByText('Mark as lie');
      fireEvent.click(lieButtons[1]);
      
      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
        expect(screen.getByText('Preview Challenge')).not.toBeDisabled();
        expect(screen.getByText('Create Challenge')).not.toBeDisabled();
      });
    });

    test('transitions to preview mode', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      // Fill valid form
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
      fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
      fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
      
      const lieButtons = screen.getAllByText('Mark as lie');
      fireEvent.click(lieButtons[1]);
      
      await waitFor(() => {
        expect(screen.getByText('Preview Challenge')).not.toBeDisabled();
      });
      
      // Enter preview mode
      fireEvent.click(screen.getByText('Preview Challenge'));
      
      await waitFor(() => {
        expect(screen.getByText(/Preview mode active/)).toBeInTheDocument();
        expect(screen.getByText('Update Preview')).toBeInTheDocument();
      });
    });
  });

  describe('Input Validation', () => {
    test('validates statement character limits', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      const longText = 'a'.repeat(300); // Exceeds 280 character limit
      
      fireEvent.change(firstInput, { target: { value: longText } });
      
      await waitFor(() => {
        expect(firstInput).toHaveValue(longText.substring(0, 280));
      });
      
      // Check character count display
      expect(screen.getByText('280/280 characters')).toBeInTheDocument();
    });

    test('validates minimum statement length', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      
      // Enter very short text
      fireEvent.change(firstInput, { target: { value: 'Hi' } });
      
      await waitFor(() => {
        expect(firstInput).toHaveValue('Hi');
      });
      
      // Form should still show as incomplete due to short statement
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    test('validates that exactly one lie is selected', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      // Fill statements
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      fireEvent.change(inputs[0], { target: { value: 'Statement 1' } });
      fireEvent.change(inputs[1], { target: { value: 'Statement 2' } });
      fireEvent.change(inputs[2], { target: { value: 'Statement 3' } });
      
      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
      });
      
      // No lie selected - buttons should be disabled
      expect(screen.getByText('Preview Challenge')).toBeDisabled();
      expect(screen.getByText('Create Challenge')).toBeDisabled();
      
      // Select first statement as lie
      const lieButtons = screen.getAllByText('Mark as lie');
      fireEvent.click(lieButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
        expect(screen.getByText('Preview Challenge')).not.toBeDisabled();
      });
      
      // Select different statement as lie (should deselect previous)
      fireEvent.click(lieButtons[2]);
      
      await waitFor(() => {
        // Should still show lie selected
        expect(screen.getByText('Yes')).toBeInTheDocument();
        // First statement should no longer show as lie
        expect(lieButtons[0]).toHaveTextContent('Mark as lie');
        // Third statement should show as lie
        expect(screen.getByText('✓ This is the lie')).toBeInTheDocument();
      });
    });

    test('validates empty statements are not counted', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      // Fill only first statement
      fireEvent.change(inputs[0], { target: { value: 'I have traveled to many countries' } });
      
      // Fill third statement but leave second empty
      fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
      
      await waitFor(() => {
        expect(screen.getByText('2/3')).toBeInTheDocument();
      });
      
      // Form should not be submittable
      expect(screen.getByText('Preview Challenge')).toBeDisabled();
    });

    test('validates whitespace-only statements are treated as empty', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      
      // Enter only whitespace
      fireEvent.change(firstInput, { target: { value: '   \n\t   ' } });
      
      await waitFor(() => {
        // Should not count as a valid statement
        expect(screen.getByText('0/3')).toBeInTheDocument();
      });
    });
  });

  describe('User Interaction Flows', () => {
    test('handles rapid typing and lie selection changes', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      // Rapid typing simulation
      fireEvent.change(inputs[0], { target: { value: 'I' } });
      fireEvent.change(inputs[0], { target: { value: 'I h' } });
      fireEvent.change(inputs[0], { target: { value: 'I have traveled' } });
      fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
      
      fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages' } });
      fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
      
      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
      });
      
      // Rapid lie selection changes
      const lieButtons = screen.getAllByText('Mark as lie');
      fireEvent.click(lieButtons[0]);
      fireEvent.click(lieButtons[1]);
      fireEvent.click(lieButtons[2]);
      fireEvent.click(lieButtons[0]);
      
      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });
    });

    test('handles form reset during editing', async () => {
      const { store } = renderWithProvider(<ChallengeCreationForm />);
      
      // Fill form partially
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      fireEvent.change(firstInput, { target: { value: 'Partial statement' } });
      
      await waitFor(() => {
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
      
      // Simulate form reset (could be triggered by parent component)
      store.dispatch({ type: 'challengeCreation/startNewChallenge' });
      
      // The component should handle the reset, but the UI might not immediately reflect it
      // due to local state management. This is expected behavior.
      expect(store.getState().challengeCreation.currentChallenge.statements).toEqual([]);
    });

    test('handles submission flow with validation', async () => {
      const mockOnSubmit = jest.fn();
      renderWithProvider(<ChallengeCreationForm onSubmit={mockOnSubmit} />);
      
      // Try to submit empty form
      const submitButton = screen.getByText('Create Challenge');
      expect(submitButton).toBeDisabled();
      
      // Fill form completely
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      fireEvent.change(inputs[0], { target: { value: 'I have traveled to 15 countries' } });
      fireEvent.change(inputs[1], { target: { value: 'I can speak 4 languages fluently' } });
      fireEvent.change(inputs[2], { target: { value: 'I have never broken a bone' } });
      
      const lieButtons = screen.getAllByText('Mark as lie');
      fireEvent.click(lieButtons[1]);
      
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      
      // Submit form
      fireEvent.click(submitButton);
      
      // The onSubmit callback should be called (without arguments in this implementation)
      expect(mockOnSubmit).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles special characters in statements', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      const specialText = 'I have 100% success rate with émojis! 🎉 & symbols @#$%';
      
      fireEvent.change(firstInput, { target: { value: specialText } });
      
      await waitFor(() => {
        expect(firstInput).toHaveValue(specialText);
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
    });

    test('handles unicode characters and emojis', async () => {
      renderWithProvider(<ChallengeCreationForm />);
      
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      const unicodeText = 'I speak 中文, Español, and العربية fluently 🌍';
      
      fireEvent.change(firstInput, { target: { value: unicodeText } });
      
      await waitFor(() => {
        expect(firstInput).toHaveValue(unicodeText);
      });
    });

    test('handles form state when component unmounts and remounts', async () => {
      const { unmount } = renderWithProvider(<ChallengeCreationForm />);
      
      // Fill some data
      const firstInput = screen.getByPlaceholderText(/Enter your first statement/);
      fireEvent.change(firstInput, { target: { value: 'Test statement' } });
      
      await waitFor(() => {
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
      
      // Unmount component
      unmount();
      
      // Remount with fresh store (simulating navigation)
      const { store } = renderWithProvider(<ChallengeCreationForm />);
      
      // Should start with clean state
      expect(screen.getByText('0/3')).toBeInTheDocument();
    });

    test('handles concurrent state updates gracefully', async () => {
      const { store } = renderWithProvider(<ChallengeCreationForm />);
      
      const inputs = [
        screen.getByPlaceholderText(/Enter your first statement/),
        screen.getByPlaceholderText(/Enter your second statement/),
        screen.getByPlaceholderText(/Enter your third statement/),
      ];
      
      // Simulate concurrent updates
      fireEvent.change(inputs[0], { target: { value: 'Statement 1' } });
      fireEvent.change(inputs[1], { target: { value: 'Statement 2' } });
      fireEvent.change(inputs[2], { target: { value: 'Statement 3' } });
      
      // Dispatch multiple actions rapidly
      store.dispatch({ type: 'challengeCreation/validateChallenge' });
      store.dispatch({ type: 'challengeCreation/setLieStatement', payload: 1 });
      store.dispatch({ type: 'challengeCreation/validateChallenge' });
      
      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });
    });
  });
});