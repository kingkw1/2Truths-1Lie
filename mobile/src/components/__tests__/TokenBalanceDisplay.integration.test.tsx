import React from 'react';
import { render } from '@testing-library/react-native';
import { TokenBalanceDisplay } from '../TokenBalanceDisplay';

// Simple integration test to verify component renders correctly
describe('TokenBalanceDisplay Integration', () => {
  it('should render without crashing', () => {
    // This test verifies the component can be imported and rendered
    // The actual functionality is tested through the hook tests
    expect(() => {
      render(<TokenBalanceDisplay />);
    }).not.toThrow();
  });

  it('should accept all props without TypeScript errors', () => {
    expect(() => {
      render(
        <TokenBalanceDisplay 
          size="large"
          showRefreshButton
          textColor="#FF6B6B"
          style={{ backgroundColor: 'red' }}
          onRefresh={() => console.log('refresh')}
        />
      );
    }).not.toThrow();
  });
});