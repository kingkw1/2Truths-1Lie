/**
 * Simple Navigation Component
 */

import React from "react";

interface NavigationProps {
  currentPage: 'game' | 'redux' | 'websocket' | 'feedback';
  onPageChange: (page: 'game' | 'redux' | 'websocket' | 'feedback') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange }) => {
  const buttonStyle = (isActive: boolean) => ({
    padding: "8px 16px",
    margin: "0 5px",
    backgroundColor: isActive ? "#3B82F6" : "#6B7280",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s"
  });

  return (
    <nav style={{
      padding: "15px 20px",
      backgroundColor: "#FFFFFF",
      borderBottom: "1px solid #E5E7EB",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{
          fontSize: "18px",
          fontWeight: "bold",
          color: "#1F2937"
        }}>
          🎯 Two Truths and a Lie
        </div>
        
        <div>
          <button
            style={buttonStyle(currentPage === 'game')}
            onClick={() => onPageChange('game')}
          >
            🎮 Game
          </button>
          <button
            style={buttonStyle(currentPage === 'feedback')}
            onClick={() => onPageChange('feedback')}
          >
            🎉 Feedback Demo
          </button>
          <button
            style={buttonStyle(currentPage === 'redux')}
            onClick={() => onPageChange('redux')}
          >
            🔧 Redux Demo
          </button>
          <button
            style={buttonStyle(currentPage === 'websocket')}
            onClick={() => onPageChange('websocket')}
          >
            🌐 WebSocket Demo
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
