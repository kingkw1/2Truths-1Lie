/**
 * Animated Feedback Demo Page - Development tool for testing feedback animations
 */

import React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AnimatedFeedbackDemo } from "../components/AnimatedFeedbackDemo";

export const FeedbackDemo: React.FC = () => {
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
            🎉 Animated Feedback Demo
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
          backgroundColor: "#ECFDF5",
          border: "1px solid #10B981",
          borderRadius: "8px",
          marginBottom: "30px"
        }}>
          <h3 style={{ color: "#047857", margin: "0 0 10px 0" }}>
            ✨ User Experience Testing
          </h3>
          <p style={{ color: "#065F46", margin: 0, fontSize: "14px" }}>
            This page demonstrates the animated feedback system that provides 
            real-time visual responses to user actions like correct/incorrect guesses, 
            streaks, and achievements.
          </p>
        </div>

        <ErrorBoundary>
          <AnimatedFeedbackDemo />
        </ErrorBoundary>

        <div style={{
          marginTop: "40px",
          padding: "20px",
          backgroundColor: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: "8px"
        }}>
          <h3 style={{ color: "#374151", marginBottom: "15px" }}>
            Feedback Animation Features:
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
            gap: "20px" 
          }}>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>✅ Correct Guess</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Celebration animations with points earned and streak indicators.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>❌ Incorrect Guess</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Gentle feedback with hint suggestions and encouragement.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>🔥 Streak Bonuses</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Progressive animations for building winning streaks.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>🏆 Achievements</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Badge unlock animations and milestone celebrations.
              </p>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#FFFBEB",
          border: "1px solid #F59E0B",
          borderRadius: "8px"
        }}>
          <h3 style={{ color: "#92400E", marginBottom: "15px" }}>
            🎮 Usage in Game:
          </h3>
          <ul style={{ color: "#78350F", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
            <li>Triggers automatically when players submit guesses</li>
            <li>Provides immediate visual feedback for engagement</li>
            <li>Enhances user satisfaction with smooth animations</li>
            <li>Motivates continued play through positive reinforcement</li>
            <li>Accessible with reduced motion preferences support</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDemo;
