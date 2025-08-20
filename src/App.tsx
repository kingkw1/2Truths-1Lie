/**
 * Main App component with Redux store integration
 */

import React from 'react';
import { StoreProvider } from './store/StoreProvider';
import { GameExample } from './components/GameExample';
import { WebSocketExample } from './components/WebSocketExample';

export const App: React.FC = () => {
  return (
    <StoreProvider>
      <div>
        <GameExample />
        <hr style={{ margin: '40px 0', border: '1px solid #E5E7EB' }} />
        <WebSocketExample />
      </div>
    </StoreProvider>
  );
};

export default App;