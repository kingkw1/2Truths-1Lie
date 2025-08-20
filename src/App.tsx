/**
 * Main App component with Redux store integration
 */

import React from 'react';
import { GameExample } from './components/GameExample';
import { WebSocketExample } from './components/WebSocketExample';
import { ChallengeCreationDemo } from './components/ChallengeCreationDemo';

export const App: React.FC = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#F3F4F6', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#1F2937', marginBottom: '40px' }}>
        Two Truths and a Lie Game
      </h1>
      
      <ChallengeCreationDemo />
      
      <hr style={{ margin: '40px 0', border: '1px solid #E5E7EB' }} />
      <GameExample />
      <hr style={{ margin: '40px 0', border: '1px solid #E5E7EB' }} />
      <WebSocketExample />
    </div>
  );
};

export default App;