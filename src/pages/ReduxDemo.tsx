/**
 * Redux Demo Page - Development tool for testing Redux store functionality
 */

import React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { GameExample } from "../components/GameExample";

export const ReduxDemo: React.FC = () => {
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#F3F4F6",
        minHeight: "100vh",
      }}
    >
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "30px"
        }}>
          <h1 style={{ color: "#1F2937", margin: 0 }}>
            🔧 Redux State Management Demo
          </h1>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6B7280",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            ← Back to Game
          </button>
        </div>

        <div style={{
          padding: "20px",
          backgroundColor: "#FEF3C7",
          border: "1px solid #F59E0B",
          borderRadius: "8px",
          marginBottom: "30px"
        }}>
          <h3 style={{ color: "#92400E", margin: "0 0 10px 0" }}>
            🚧 Development Tool
          </h3>
          <p style={{ color: "#78350F", margin: 0, fontSize: "14px" }}>
            This page demonstrates the Redux store integration for player progression, 
            game sessions, and notifications. It's used for testing state management 
            during development.
          </p>
        </div>

        <ErrorBoundary>
          <GameExample />
        </ErrorBoundary>

        <div style={{
          marginTop: "40px",
          padding: "20px",
          backgroundColor: "#F3F4F6",
          border: "1px solid #D1D5DB",
          borderRadius: "8px"
        }}>
          <h3 style={{ color: "#374151", marginBottom: "15px" }}>
            Redux Store Features Demonstrated:
          </h3>
          <ul style={{ color: "#6B7280", fontSize: "14px", lineHeight: "1.6" }}>
            <li><strong>Game Session Management:</strong> Start sessions, track activity states</li>
            <li><strong>Player Progression:</strong> XP, levels, points, statistics tracking</li>
            <li><strong>Notification System:</strong> Success, error, and info messages</li>
            <li><strong>State Selectors:</strong> Efficient state selection and updates</li>
            <li><strong>Action Dispatching:</strong> Coordinated state changes across components</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReduxDemo;
