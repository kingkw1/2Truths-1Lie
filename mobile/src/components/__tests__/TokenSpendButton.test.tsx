import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { TokenSpendButton } from '../TokenSpendButton';
import * as useTokenBalanceModule from '../../hooks/useTokenBalance';

// Mock the useTokenBalance hook and spendTokens function
jest.mock('../../hooks/useTokenBalance');
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const mockUseTokenBalance = useTokenBalanceModule.useTokenBalance as jest.MockedFunction<typeof useTokenBalanceModule.useTokenBalance>;
const mockSpendTokens = useTokenBalanceModule.spendTokens as jest.MockedFunction<typeof useTokenBalanceModule.spendTokens>;
const mockAlert = Alert.alert as jest.MockedFunction<typeof Alert.alert>;

describe('TokenSpendButton', () => {
  const defaultProps = {
    tokensRequired: 10,
    buttonText: 'Buy Item',
    actionDescription: 'purchase this item',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockSpendTokens.mockClear();
  });

  describe('Sufficient Balance', () => {
    it('should show enabled button when user has enough tokens', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      expect(button).toBeTruthy();
      
      // Should show token amount
      expect(getByText('10')).toBeTruthy();
      expect(getByText('🪙')).toBeTruthy();
    });

    it('should call spendTokens when button is pressed with sufficient balance', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockSpendTokens.mockResolvedValue(40); // New balance after spending

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSpendTokens).toHaveBeenCalledWith(10);
      });
    });

    it('should show success alert after successful spend', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockSpendTokens.mockResolvedValue(40);

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Success!',
          'Spent 10 tokens to purchase this item. New balance: 40'
        );
      });
    });

    it('should call onSpendSuccess callback when spending succeeds', async () => {
      const mockOnSpendSuccess = jest.fn();
      
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      mockSpendTokens.mockResolvedValue(40);

      const { getByText } = render(
        <TokenSpendButton 
          {...defaultProps} 
          onSpendSuccess={mockOnSpendSuccess}
        />
      );

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockOnSpendSuccess).toHaveBeenCalledWith(40);
      });
    });
  });

  describe('Insufficient Balance', () => {
    it('should show disabled button when user has insufficient tokens', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5, // Less than required 10
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      expect(button).toBeTruthy();
    });

    it('should show warning message when user has insufficient tokens', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      expect(getByText('⚠️')).toBeTruthy();
      expect(getByText('Need 10 tokens, you have 5')).toBeTruthy();
    });

    it('should show custom insufficient message when provided', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const customMessage = 'Not enough coins for this action!';

      const { getByText } = render(
        <TokenSpendButton 
          {...defaultProps} 
          customInsufficientMessage={customMessage}
        />
      );

      expect(getByText(customMessage)).toBeTruthy();
    });

    it('should not show warning when showDetailedWarning is false', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { queryByText } = render(
        <TokenSpendButton 
          {...defaultProps} 
          showDetailedWarning={false}
        />
      );

      expect(queryByText('⚠️')).toBeNull();
      expect(queryByText('Need 10 tokens, you have 5')).toBeNull();
    });

    it('should show insufficient funds alert when pressed with insufficient balance', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Insufficient Tokens',
          'You need 10 tokens but only have 5. This is required to purchase this item.',
          expect.any(Array)
        );
      });
    });

    it('should not call spendTokens when insufficient balance', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockSpendTokens).not.toHaveBeenCalled();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading button when balance is being fetched', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: true,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      expect(getByText('Loading...')).toBeTruthy();
    });

    it('should show processing state during spend transaction', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      // Make spendTokens take time to resolve
      mockSpendTokens.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(40), 100)));

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      // Should show processing state
      await waitFor(() => {
        expect(getByText('Processing...')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when spend transaction fails', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const mockError = new Error('Network error');
      mockSpendTokens.mockRejectedValue(mockError);

      const { getByText } = render(<TokenSpendButton {...defaultProps} />);

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          'Transaction Failed',
          'Network error'
        );
      });
    });

    it('should call onSpendError callback when spending fails', async () => {
      const mockOnSpendError = jest.fn();
      
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const mockError = new Error('Network error');
      mockSpendTokens.mockRejectedValue(mockError);

      const { getByText } = render(
        <TokenSpendButton 
          {...defaultProps} 
          onSpendError={mockOnSpendError}
        />
      );

      const button = getByText('Buy Item');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockOnSpendError).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Size Variants', () => {
    it('should render small size variant', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(
        <TokenSpendButton {...defaultProps} size="small" />
      );

      expect(getByText('Buy Item')).toBeTruthy();
    });

    it('should render large size variant', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(
        <TokenSpendButton {...defaultProps} size="large" />
      );

      expect(getByText('Buy Item')).toBeTruthy();
    });
  });

  describe('Custom Props', () => {
    it('should be disabled when disabled prop is true', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByText } = render(
        <TokenSpendButton {...defaultProps} disabled />
      );

      const button = getByText('Buy Item');
      fireEvent.press(button);

      expect(mockSpendTokens).not.toHaveBeenCalled();
    });

    it('should accept custom style prop', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const customStyle = { backgroundColor: 'red' };
      const { getByText } = render(
        <TokenSpendButton {...defaultProps} style={customStyle} />
      );

      expect(getByText('Buy Item')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels for sufficient balance', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 50,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByLabelText } = render(<TokenSpendButton {...defaultProps} />);

      expect(getByLabelText('Spend 10 tokens to purchase this item')).toBeTruthy();
    });

    it('should have proper accessibility labels for insufficient balance', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 5,
        loading: false,
        error: null,
        refresh: jest.fn(),
      });

      const { getByLabelText } = render(<TokenSpendButton {...defaultProps} />);

      expect(getByLabelText('Insufficient tokens. Need 10, have 5')).toBeTruthy();
    });

    it('should have loading accessibility label', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: true,
        error: null,
        refresh: jest.fn(),
      });

      const { getByLabelText } = render(<TokenSpendButton {...defaultProps} />);

      expect(getByLabelText('Loading token balance')).toBeTruthy();
    });
  });
});