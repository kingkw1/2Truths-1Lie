/**
 * Main Game Page - Core user-facing game functionality
 */

import React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ChallengeCreationDemo } from "../components/ChallengeCreationDemo";
import { ChallengeBrowserDemo } from "../components/ChallengeBrowserDemo";
import { SimpleChallengeForm } from "../components/SimpleChallengeForm";

export const MainGame: React.FC = () => {
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

      {/* Challenge Creation */}
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

      {/* Challenge Browser */}
      <ErrorBoundary>
        <ChallengeBrowserDemo />
      </ErrorBoundary>

      <hr style={{ margin: "40px 0", border: "1px solid #E5E7EB" }} />

      {/* How to Play Instructions */}
      <div style={{
        padding: "30px",
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        marginBottom: "30px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
      }}>
        <h2 style={{ 
          textAlign: "center", 
          color: "#1F2937", 
          marginBottom: "20px",
          fontSize: "24px"
        }}>
          📋 How to Play
        </h2>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "20px" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>✍️</div>
            <h3 style={{ color: "#374151", marginBottom: "8px" }}>1. Create</h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Record yourself telling 2 truths and 1 lie. Make it challenging!
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>🕵️</div>
            <h3 style={{ color: "#374151", marginBottom: "8px" }}>2. Guess</h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Watch other players' videos and spot the lie among their statements.
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "10px" }}>🏆</div>
            <h3 style={{ color: "#374151", marginBottom: "8px" }}>3. Score</h3>
            <p style={{ color: "#6B7280", fontSize: "14px" }}>
              Earn points for correct guesses and creating tricky challenges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainGame;
