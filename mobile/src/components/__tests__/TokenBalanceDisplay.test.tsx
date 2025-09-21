import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TokenBalanceDisplay } from '../TokenBalanceDisplay';
import * as useTokenBalanceModule from '../../hooks/useTokenBalance';

// Mock the useTokenBalance hook
jest.mock('../../hooks/useTokenBalance');

const mockUseTokenBalance = useTokenBalanceModule.useTokenBalance as jest.MockedFunction<typeof useTokenBalanceModule.useTokenBalance>;

describe('TokenBalanceDisplay', () => {
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefresh.mockClear();
  });

  describe('Loading State', () => {
    it('should display loading spinner and text when loading', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: true,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText, getByTestId } = render(<TokenBalanceDisplay />);

      expect(getByText('Loading...')).toBeTruthy();
      // ActivityIndicator should be present (though testing it directly is tricky in RNTL)
    });

    it('should show small spinner for small size variant', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: true,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay size="small" />);
      expect(getByText('Loading...')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('should display error message and retry button when error occurs', () => {
      const mockError = new Error('Network error');
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: mockError,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);

      expect(getByText('⚠️')).toBeTruthy();
      expect(getByText('Error loading balance')).toBeTruthy();
      expect(getByText('Retry')).toBeTruthy();
    });

    it('should call refresh when retry button is pressed', async () => {
      const mockError = new Error('Network error');
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: mockError,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);
      
      const retryButton = getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onRefresh callback when retry succeeds', async () => {
      const mockError = new Error('Network error');
      const mockOnRefresh = jest.fn();
      
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: mockError,
        refresh: mockRefresh,
      });

      const { getByText } = render(
        <TokenBalanceDisplay onRefresh={mockOnRefresh} />
      );
      
      const retryButton = getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockOnRefresh).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Success State', () => {
    it('should display token balance correctly', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 150,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);

      expect(getByText('🪙')).toBeTruthy();
      expect(getByText('150')).toBeTruthy();
      expect(getByText('tokens')).toBeTruthy();
    });

    it('should format large numbers with commas', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 1234567,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);

      expect(getByText('1,234,567')).toBeTruthy();
    });

    it('should show singular "token" for balance of 1', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 1,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);

      expect(getByText('1')).toBeTruthy();
      expect(getByText('token')).toBeTruthy();
    });

    it('should show plural "tokens" for balance other than 1', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);

      expect(getByText('0')).toBeTruthy();
      expect(getByText('tokens')).toBeTruthy();
    });
  });

  describe('Refresh Button', () => {
    it('should show refresh button when showRefreshButton is true', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay showRefreshButton />);

      expect(getByText('🔄')).toBeTruthy();
    });

    it('should not show refresh button by default', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { queryByText } = render(<TokenBalanceDisplay />);

      expect(queryByText('🔄')).toBeNull();
    });

    it('should call refresh when refresh button is pressed', async () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay showRefreshButton />);
      
      const refreshButton = getByText('🔄');
      fireEvent.press(refreshButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onRefresh callback when refresh button succeeds', async () => {
      const mockOnRefresh = jest.fn();
      
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(
        <TokenBalanceDisplay showRefreshButton onRefresh={mockOnRefresh} />
      );
      
      const refreshButton = getByText('🔄');
      fireEvent.press(refreshButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockOnRefresh).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Size Variants', () => {
    it('should apply different styling for small size', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay size="small" />);
      const balanceText = getByText('100');
      
      // Note: In a real app, you'd test the actual style values
      // For now, we just ensure the component renders without errors
      expect(balanceText).toBeTruthy();
    });

    it('should apply different styling for large size', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay size="large" />);
      const balanceText = getByText('100');
      
      expect(balanceText).toBeTruthy();
    });
  });

  describe('Custom Styling', () => {
    it('should accept custom style prop', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const customStyle = { backgroundColor: 'red' };
      const { getByText } = render(<TokenBalanceDisplay style={customStyle} />);
      
      expect(getByText('100')).toBeTruthy();
    });

    it('should accept custom text color', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 100,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay textColor="purple" />);
      
      expect(getByText('100')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      mockUseTokenBalance.mockReturnValue({
        balance: 150,
        loading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { getByLabelText } = render(<TokenBalanceDisplay showRefreshButton />);

      expect(getByLabelText('Current token balance: 150')).toBeTruthy();
      expect(getByLabelText('Refresh token balance')).toBeTruthy();
      expect(getByLabelText('Token icon')).toBeTruthy();
    });

    it('should have accessibility label for retry button in error state', () => {
      const mockError = new Error('Network error');
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: mockError,
        refresh: mockRefresh,
      });

      const { getByLabelText } = render(<TokenBalanceDisplay />);

      expect(getByLabelText('Retry loading token balance')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle refresh errors gracefully', async () => {
      const mockError = new Error('Network error');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockRefresh.mockRejectedValue(new Error('Refresh failed'));
      
      mockUseTokenBalance.mockReturnValue({
        balance: 0,
        loading: false,
        error: mockError,
        refresh: mockRefresh,
      });

      const { getByText } = render(<TokenBalanceDisplay />);
      
      const retryButton = getByText('Retry');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to refresh token balance:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });
});