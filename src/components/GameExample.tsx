/**
 * Example React component demonstrating Redux store usage
 * Shows how to use the game state management system
 */

import React from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { 
  startGameSession, 
  updateActivity, 
  addPoints 
} from '../store/slices/gameSessionSlice';
import { 
  addExperience, 
  updateGameStats 
} from '../store/slices/playerProgressionSlice';
import { 
  showNotification 
} from '../store/slices/uiSlice';
import { 
  selectCurrentSession, 
  selectPlayerLevel, 
  selectPlayerXP,
  selectNotifications 
} from '../store/selectors';

export const GameExample: React.FC = () => {
  const dispatch = useAppDispatch();
  
  // Select state from the store
  const currentSession = useAppSelector(selectCurrentSession);
  const playerLevel = useAppSelector(selectPlayerLevel);
  const playerXP = useAppSelector(selectPlayerXP);
  const notifications = useAppSelector(selectNotifications);

  const handleStartGame = () => {
    const playerId = `player_${Date.now()}`;
    dispatch(startGameSession({ playerId }));
    dispatch(showNotification({
      type: 'success',
      message: 'Game session started!',
    }));
  };

  const handleCreateChallenge = () => {
    if (!currentSession) {
      dispatch(showNotification({
        type: 'error',
        message: 'Please start a game session first',
      }));
      return;
    }

    dispatch(updateActivity('creating'));
    dispatch(addPoints(10));
    dispatch(addExperience(15));
    dispatch(updateGameStats({ gamesPlayed: 1 }));
    
    dispatch(showNotification({
      type: 'success',
      message: 'Challenge created! +15 XP',
    }));
  };

  const handleGuessChallenge = () => {
    if (!currentSession) {
      dispatch(showNotification({
        type: 'error',
        message: 'Please start a game session first',
      }));
      return;
    }

    dispatch(updateActivity('guessing'));
    
    // Simulate correct guess
    const isCorrect = Math.random() > 0.5;
    if (isCorrect) {
      dispatch(addPoints(20));
      dispatch(addExperience(10));
      dispatch(updateGameStats({ 
        gamesPlayed: 1, 
        correctGuess: true, 
        streakIncrement: true 
      }));
      dispatch(showNotification({
        type: 'success',
        message: 'Correct guess! +10 XP',
      }));
    } else {
      dispatch(updateGameStats({ 
        gamesPlayed: 1, 
        correctGuess: false, 
        streakIncrement: false 
      }));
      dispatch(showNotification({
        type: 'error',
        message: 'Wrong guess! Better luck next time.',
      }));
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Two Truths and a Lie - Redux Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Player Stats</h2>
        <p>Level: {playerLevel}</p>
        <p>Experience: {playerXP} XP</p>
        <p>Session Active: {currentSession ? 'Yes' : 'No'}</p>
        {currentSession && (
          <div>
            <p>Session ID: {currentSession.sessionId}</p>
            <p>Current Activity: {currentSession.currentActivity}</p>
            <p>Points Earned: {currentSession.pointsEarned}</p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Actions</h2>
        <button 
          onClick={handleStartGame}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          Start Game Session
        </button>
        <button 
          onClick={handleCreateChallenge}
          style={{ marginRight: '10px', padding: '10px' }}
          disabled={!currentSession}
        >
          Create Challenge
        </button>
        <button 
          onClick={handleGuessChallenge}
          style={{ padding: '10px' }}
          disabled={!currentSession}
        >
          Guess Challenge
        </button>
      </div>

      <div>
        <h2>Notifications</h2>
        {notifications.length === 0 ? (
          <p>No notifications</p>
        ) : (
          <ul>
            {notifications.map(notification => (
              <li 
                key={notification.id}
                style={{ 
                  color: notification.type === 'error' ? 'red' : 
                         notification.type === 'success' ? 'green' : 'blue',
                  marginBottom: '5px'
                }}
              >
                [{notification.type.toUpperCase()}] {notification.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};