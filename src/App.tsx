/**
 * Main App component with page navigation
 */

import React, { useState } from "react";
import { Navigation } from "./components/Navigation";
import { MainGame } from "./pages/MainGame";
import { ReduxDemo } from "./pages/ReduxDemo";
import { WebSocketDemo } from "./pages/WebSocketDemo";
import { FeedbackDemo } from "./pages/FeedbackDemo";

type PageType = 'game' | 'redux' | 'websocket' | 'feedback';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('game');

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'game':
        return <MainGame />;
      case 'feedback':
        return <FeedbackDemo />;
      case 'redux':
        return <ReduxDemo />;
      case 'websocket':
        return <WebSocketDemo />;
      default:
        return <MainGame />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F3F4F6" }}>
      <Navigation currentPage={currentPage} onPageChange={setCurrentPage} />
      {renderCurrentPage()}
    </div>
  );
};

export default App;
