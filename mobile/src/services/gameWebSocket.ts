/**
 * Game WebSocket service for mobile app
 * Simplified implementation for mobile use
 */

export interface GameWebSocketManager {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(event: string, callback: (data: any) => void): void;
  unsubscribe(event: string, callback: (data: any) => void): void;
  send(data: any): void;
  isReady(): boolean;
  getStatus(): any;
  updateConfig(config: any): void;
  sendGuessResult(result: any): void;
  notifyChallengePublished(challenge: any): void;
  sendActivityHeartbeat(activity: any): void;
  requestLeaderboardUpdate(): Promise<any>;
  joinGameRoom(roomId: string): Promise<any>;
  leaveGameRoom(roomId: string): Promise<any>;
}

class MobileGameWebSocketManager implements GameWebSocketManager {
  private connected = false;
  private listeners = new Map<string, Set<(data: any) => void>>();
  private config: any = {};

  async connect(): Promise<void> {
    // Mobile implementation - could use WebSocket or disable for offline
    console.log('WebSocket connect called on mobile - using offline mode');
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.listeners.clear();
  }

  subscribe(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  unsubscribe(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  send(data: any): void {
    // Mobile implementation - queue for later or send via HTTP
    console.log('WebSocket send called on mobile:', data);
  }

  isReady(): boolean {
    return this.connected;
  }

  getStatus(): any {
    return { connected: this.connected, listeners: this.listeners.size };
  }

  updateConfig(config: any): void {
    this.config = { ...this.config, ...config };
  }

  sendGuessResult(result: any): void {
    this.send({ type: 'guess_result', data: result });
  }

  notifyChallengePublished(challenge: any): void {
    this.send({ type: 'challenge_published', data: challenge });
  }

  sendActivityHeartbeat(activity: any): void {
    this.send({ type: 'activity_heartbeat', data: activity });
  }

  async requestLeaderboardUpdate(): Promise<any> {
    this.send({ type: 'request_leaderboard' });
    return Promise.resolve({ leaderboard: [] });
  }

  async joinGameRoom(roomId: string): Promise<any> {
    this.send({ type: 'join_room', data: { roomId } });
    return Promise.resolve({ joined: true });
  }

  async leaveGameRoom(roomId: string): Promise<any> {
    this.send({ type: 'leave_room', data: { roomId } });
    return Promise.resolve({ left: true });
  }
}

let gameWebSocketInstance: GameWebSocketManager | null = null;

export function initializeGameWebSocket(config?: any): GameWebSocketManager {
  if (!gameWebSocketInstance) {
    gameWebSocketInstance = new MobileGameWebSocketManager();
    if (config) {
      gameWebSocketInstance.updateConfig(config);
    }
  }
  return gameWebSocketInstance;
}

export function getGameWebSocket(): GameWebSocketManager {
  if (!gameWebSocketInstance) {
    gameWebSocketInstance = new MobileGameWebSocketManager();
  }
  return gameWebSocketInstance;
}

export { GameWebSocketManager as default };
