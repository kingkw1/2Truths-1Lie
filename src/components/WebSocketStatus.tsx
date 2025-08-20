/**
 * WebSocket connection status indicator component
 * Shows real-time connection status and provides manual reconnection
 */

import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

export interface WebSocketStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const { isConnected, isAuthenticated, connectionStatus } = useWebSocket();

  const getStatusColor = () => {
    if (isConnected && isAuthenticated) return '#10B981'; // Green
    if (isConnected && !isAuthenticated) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getStatusText = () => {
    if (isConnected && isAuthenticated) return 'Connected';
    if (isConnected && !isAuthenticated) return 'Authenticating';
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnected && isAuthenticated) return '🟢';
    if (isConnected && !isAuthenticated) return '🟡';
    return '🔴';
  };

  if (!showDetails) {
    return (
      <div 
        className={`websocket-status-indicator ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          color: getStatusColor(),
        }}
        title={`Real-time connection: ${getStatusText()}`}
      >
        <span>{getStatusIcon()}</span>
        <span>Live</span>
      </div>
    );
  }

  return (
    <div 
      className={`websocket-status-detailed ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#F3F4F6',
        borderRadius: '6px',
        fontSize: '14px',
        border: `2px solid ${getStatusColor()}`,
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          animation: isConnected && isAuthenticated ? 'pulse 2s infinite' : 'none',
        }}
      />
      <span style={{ fontWeight: 500 }}>
        {getStatusText()}
      </span>
      {showDetails && (
        <span style={{ fontSize: '12px', color: '#6B7280' }}>
          Real-time features {isConnected && isAuthenticated ? 'active' : 'unavailable'}
        </span>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default WebSocketStatus;