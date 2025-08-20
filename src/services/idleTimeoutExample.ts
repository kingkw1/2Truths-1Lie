/**
 * Example demonstrating idle timeout handling and hint triggers
 * 
 * This example shows how to use the enhanced GameSessionManager
 * with idle timeout and hint functionality.
 */

import { GameSessionManager, GameSessionManagerConfig } from './gameSessionManager';

export async function demonstrateIdleTimeoutAndHints() {
  // Configure the session manager with hint settings
  const config: GameSessionManagerConfig = {
    playerId: 'demo-player-123',
    idleTimeout: 30000, // 30 seconds as per requirement
    hintConfig: {
      enableIdleHints: true,
      idleHintDelay: 5000, // Show first hint 5 seconds after idle timeout
      maxIdleHints: 3, // Maximum 3 hints per idle period
      hintCooldown: 10000, // 10 seconds between hints
      enableStruggleHints: true,
      failureThreshold: 2, // Show hint after 2 failures
    },
    enableWebSocket: false, // Disabled for demo
  };

  const sessionManager = new GameSessionManager(config);

  // Set up event listeners to handle hints and idle events
  sessionManager.addEventListener('idle_timeout', (event) => {
    console.log('🕐 Player went idle:', {
      sessionId: event.sessionId,
      previousActivity: event.data.previousActivity,
      idleState: event.data.idleState,
    });
  });

  sessionManager.addEventListener('hint_triggered', (event) => {
    const hint = event.data.hint;
    console.log('💡 Hint triggered:', {
      type: hint.type,
      message: hint.message,
      animation: hint.animation,
      actionPrompt: hint.actionPrompt,
      priority: hint.priority,
    });

    // In a real app, you would show this hint in the UI
    showHintInUI(hint);
  });

  sessionManager.addEventListener('engagement_prompt', (event) => {
    console.log('🎯 Engagement prompt:', {
      message: event.data.hint.message,
      idleState: event.data.idleState,
    });
  });

  sessionManager.addEventListener('hint_dismissed', (event) => {
    console.log('❌ Hint dismissed:', {
      hintId: event.data.hintId,
      dismissedAt: event.data.hint.dismissedAt,
    });
  });

  try {
    // Initialize and start session
    await sessionManager.initialize();
    const session = await sessionManager.startGameSession();
    
    console.log('🎮 Game session started:', {
      sessionId: session.sessionId,
      playerId: session.playerId,
    });

    // Simulate player activity
    console.log('\n📝 Player starts creating a challenge...');
    sessionManager.updateActivity('creating');

    // Simulate some gameplay
    await simulateGameplay(sessionManager);

    // Demonstrate struggle hints
    console.log('\n😰 Player struggles with a challenge...');
    sessionManager.recordFailure('challenge-abc-123');
    sessionManager.recordFailure('challenge-abc-123'); // This should trigger a hint

    // Simulate idle behavior
    console.log('\n💤 Player becomes idle...');
    // In real usage, idle timeout would be triggered automatically
    // For demo purposes, we can manually trigger it or wait

    // Get current idle state
    const idleState = sessionManager.getIdleState();
    console.log('📊 Current idle state:', idleState);

    // Manually trigger engagement prompt
    sessionManager.triggerEngagementPrompt();

    // Show active hints
    const activeHints = sessionManager.getActiveHints();
    console.log('🔍 Active hints:', activeHints.length);

    // Dismiss a hint
    if (activeHints.length > 0 && activeHints[0]) {
      sessionManager.dismissHint(activeHints[0].id);
    }

    // Clean up
    await sessionManager.cleanup();
    console.log('✅ Session cleaned up successfully');

  } catch (error) {
    console.error('❌ Error in demo:', error);
  }
}

async function simulateGameplay(sessionManager: GameSessionManager) {
  // Simulate creating a challenge
  sessionManager.updateActivity('creating');
  sessionManager.addPoints(50, 'challenge_created');
  sessionManager.incrementChallengesCompleted();

  // Simulate browsing challenges
  sessionManager.updateActivity('browsing');

  // Simulate guessing
  sessionManager.updateActivity('guessing');
  sessionManager.addPoints(25, 'correct_guess');
  sessionManager.incrementGuessesSubmitted();

  console.log('🎯 Simulated gameplay activities completed');
}

function showHintInUI(hint: any) {
  // In a real application, this would update the UI to show the hint
  // For example:
  // - Display a tooltip or modal with the hint message
  // - Play the specified animation
  // - Show the action prompt button
  // - Style based on priority (high priority hints more prominent)
  
  console.log(`  📱 UI would show: "${hint.message}"`);
  console.log(`  🎬 With animation: ${hint.animation}`);
  console.log(`  👆 Action prompt: ${hint.actionPrompt}`);
  console.log(`  ⚡ Priority: ${hint.priority}`);
}

// Export for use in other parts of the application
export { showHintInUI };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateIdleTimeoutAndHints().catch(console.error);
}