/**
 * WebSocket Demo Page - Development tool for testing real-time features
 */

import React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { WebSocketExample } from "../components/WebSocketExample";

export const WebSocketDemo: React.FC = () => {
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
            🌐 WebSocket Real-time Demo
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
          backgroundColor: "#DBEAFE",
          border: "1px solid #3B82F6",
          borderRadius: "8px",
          marginBottom: "30px"
        }}>
          <h3 style={{ color: "#1E40AF", margin: "0 0 10px 0" }}>
            🚀 Multiplayer Features (In Development)
          </h3>
          <p style={{ color: "#1E3A8A", margin: 0, fontSize: "14px" }}>
            This page demonstrates real-time WebSocket functionality for multiplayer 
            features like live leaderboards, real-time notifications, and connection 
            status monitoring.
          </p>
        </div>

        <div style={{
          padding: "20px",
          backgroundColor: "#FEF2F2",
          border: "1px solid #EF4444",
          borderRadius: "8px",
          marginBottom: "30px"
        }}>
          <h3 style={{ color: "#DC2626", margin: "0 0 10px 0" }}>
            ⚠️ Currently Disabled
          </h3>
          <p style={{ color: "#B91C1C", margin: 0, fontSize: "14px" }}>
            WebSocket features are disabled during development to prevent console 
            errors. Enable when backend WebSocket server is ready.
          </p>
        </div>

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
            <p style={{ fontSize: "14px", color: "#6B7280", marginTop: "20px" }}>
              When enabled, this will demonstrate:
            </p>
            <ul style={{ 
              color: "#6B7280", 
              fontSize: "14px", 
              textAlign: "left",
              maxWidth: "600px",
              margin: "15px auto",
              lineHeight: "1.6"
            }}>
              <li>Real-time connection status monitoring</li>
              <li>Live leaderboard updates</li>
              <li>Instant guess result notifications</li>
              <li>Player activity broadcasts</li>
              <li>Game session coordination</li>
            </ul>
          </div>
        </ErrorBoundary>

        <div style={{
          marginTop: "40px",
          padding: "20px",
          backgroundColor: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: "8px"
        }}>
          <h3 style={{ color: "#374151", marginBottom: "15px" }}>
            Planned WebSocket Features:
          </h3>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
            gap: "20px" 
          }}>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>🏆 Live Leaderboards</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Real-time ranking updates as players earn points and complete challenges.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>⚡ Instant Feedback</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                Immediate notifications when guesses are submitted and scored.
              </p>
            </div>
            <div>
              <h4 style={{ color: "#1F2937", marginBottom: "8px" }}>👥 Player Activity</h4>
              <p style={{ color: "#6B7280", fontSize: "14px", margin: 0 }}>
                See who's online, creating challenges, or actively playing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSocketDemo;
