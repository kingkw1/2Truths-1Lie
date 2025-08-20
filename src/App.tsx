/**
 * Main App component with Redux store integration
 */

import React from 'react';
import { GameExample } from './components/GameExample';
import { WebSocketExample } from './components/WebSocketExample';

export const App: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Two Truths and a Lie Game</h1>
      <GameExample />
      <hr style={{ margin: '40px 0', border: '1px solid #E5E7EB' }} />
      <WebSocketExample />
    </div>
  );
};

export default App;