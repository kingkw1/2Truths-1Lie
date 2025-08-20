/**
 * Main App component with Redux store integration
 */

import React from 'react';
import { StoreProvider } from './store/StoreProvider';
import { GameExample } from './components/GameExample';

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <GameExample />
    </StoreProvider>
  );
};

export default App;