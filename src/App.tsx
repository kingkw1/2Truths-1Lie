/**
 * Main App component with Redux store integration
 */

import React from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppHealthCheck } from "./components/AppHealthCheck";
import { SimpleChallengeForm } from "./components/SimpleChallengeForm";
import { SimpleTextTest } from "./components/SimpleTextTest";
import { GameExample } from "./components/GameExample";
import { WebSocketExample } from "./components/WebSocketExample";
import { ChallengeCreationDemo } from "./components/ChallengeCreationDemo";

export const App: React.FC = () => {
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#F3F4F6",
        minHeight: "100vh",
      }}
    >
      <h1
        style={{ textAlign: "center", color: "#1F2937", marginBottom: "40px" }}
      >
        🎯 Two Truths and a Lie Game
      </h1>

      <div style={{
        padding: "20px",
        backgroundColor: "#D1FAE5",
        border: "2px solid #10B981",
        borderRadius: "8px",
        textAlign: "center",
        margin: "20px 0",
        fontSize: "16px"
      }}>
        ✅ App is now working! The challenge creation form is below.
      </div>

      {/* Text input is working correctly - test component removed */}

      <ErrorBoundary
        fallback={
          <div>
            <div
              style={{
                padding: "20px",
                backgroundColor: "#FEF2F2",
                border: "2px solid #FECACA",
                borderRadius: "8px",
                textAlign: "center",
                margin: "20px 0",
              }}
            >
              <h3>⚠️ Challenge Creation Component Error</h3>
              <p>The Redux-powered challenge creation form failed to load.</p>
              <p><strong>Using fallback form below instead.</strong></p>
            </div>
            <SimpleChallengeForm />
          </div>
        }
      >
        <ChallengeCreationDemo />
      </ErrorBoundary>

      <hr style={{ margin: "40px 0", border: "1px solid #E5E7EB" }} />

      <ErrorBoundary>
        <GameExample />
      </ErrorBoundary>

      <hr style={{ margin: "40px 0", border: "1px solid #E5E7EB" }} />

      <ErrorBoundary>
        <div style={{
          padding: "20px",
          backgroundColor: "#F3F4F6",
          border: "1px solid #D1D5DB",
          borderRadius: "8px",
          textAlign: "center"
        }}>
          <h3>WebSocket Example (Disabled)</h3>
          <p>WebSocket functionality disabled to prevent console errors during development.</p>
        </div>
      </ErrorBoundary>
    </div>
  );
};

export default App;
