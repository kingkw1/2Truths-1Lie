/**
 * Example component demonstrating WebSocket functionality
 * Shows connection status and real-time notifications
 */

import React, { useState, useEffect } from 'react';
import { useWebSocket, useLeaderboardUpdates, useGuessResults } from '../hooks/useWebSocket';
import { WebSocketStatus } from './WebSocketStatus';

export const WebSocketExample: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  
  const { 
    isConnected, 
    isAuthenticated, 
    subscribe,
    requestLeaderboardUpdate 
  } = useWebSocket();

  const { subscribeToLeaderboard, refreshLeaderboard } = useLeaderboardUpdates();
  const { subscribeToGuessResults } = useGuessResults();

  // Subscribe to notifications
  useEffect(() => {
    const unsubscribe = subscribe('notification', (notification) => {
      setNotifications(prev => [...prev.slice(-4), notification]); // Keep last 5
    });

    return unsubscribe;
  }, [subscribe]);

  // Subscribe to leaderboard updates
  useEffect(() => {
    const unsubscribe = subscribeToLeaderboard((data) => {
      setLeaderboardData(data.players || []);
    });

    return unsubscribe;
  }, [subscribeToLeaderboard]);

  // Subscribe to guess results
  useEffect(() => {
    const unsubscribe = subscribeToGuessResults((result) => {
      setNotifications(prev => [...prev.slice(-4), {
        type: 'guess_result',
        data: result,
        timestamp: Date.now(),
        priority: 'medium'
      }]);
    });

    return unsubscribe;
  }, [subscribeToGuessResults]);

  const handleRefreshLeaderboard = () => {
    const success = refreshLeaderboard();
    if (!success) {
      setNotifications(prev => [...prev.slice(-4), {
        type: 'system_message',
        data: { message: 'Failed to refresh leaderboard - not connected' },
        timestamp: Date.now(),
        priority: 'low'
      }]);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2>WebSocket Real-time Features Demo</h2>
      
      {/* Connection Status */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Connection Status</h3>
        <WebSocketStatus showDetails={true} />
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <div>Connected: {isConnected ? '✅' : '❌'}</div>
          <div>Authenticated: {isAuthenticated ? '✅' : '❌'}</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Controls</h3>
        <button 
          onClick={handleRefreshLeaderboard}
          disabled={!isConnected}
          style={{
            padding: '8px 16px',
            marginRight: '10px',
            backgroundColor: isConnected ? '#10B981' : '#9CA3AF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isConnected ? 'pointer' : 'not-allowed'
          }}
        >
          Refresh Leaderboard
        </button>
        <button 
          onClick={clearNotifications}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6B7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Notifications
        </button>
      </div>

      {/* Real-time Notifications */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Real-time Notifications ({notifications.length})</h3>
        <div style={{
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '10px',
          minHeight: '100px',
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: '#F9FAFB'
        }}>
          {notifications.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
              No notifications yet. {isConnected ? 'Waiting for real-time events...' : 'Connect to see notifications.'}
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div 
                key={index}
                style={{
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  borderLeft: `4px solid ${
                    notification.priority === 'high' ? '#EF4444' :
                    notification.priority === 'medium' ? '#F59E0B' : '#10B981'
                  }`
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#6B7280' }}>
                  {notification.type.toUpperCase()} - {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ marginTop: '4px' }}>
                  {typeof notification.data === 'string' 
                    ? notification.data 
                    : notification.data?.message || JSON.stringify(notification.data, null, 2)
                  }
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Leaderboard Data */}
      <div>
        <h3>Leaderboard Data</h3>
        <div style={{
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          padding: '10px',
          backgroundColor: '#F9FAFB'
        }}>
          {leaderboardData.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontStyle: 'italic' }}>
              No leaderboard data available. Click "Refresh Leaderboard" to request updates.
            </div>
          ) : (
            <div>
              {leaderboardData.slice(0, 5).map((player, index) => (
                <div 
                  key={player.playerId || index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: 'white',
                    borderRadius: '4px'
                  }}
                >
                  <span>#{player.rank || index + 1} {player.playerName || `Player ${index + 1}`}</span>
                  <span style={{ fontWeight: 'bold' }}>{player.score || 0} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#EBF8FF', 
        borderRadius: '6px',
        fontSize: '14px',
        color: '#1E40AF'
      }}>
        <strong>Note:</strong> This demo shows WebSocket functionality. In a real game, 
        notifications would come from server events like other players' actions, 
        leaderboard changes, and system messages.
      </div>
    </div>
  );
};

export default WebSocketExample;