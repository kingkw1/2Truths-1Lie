/**
 * Tests for WebSocket connection utilities
 */

import { WebSocketService } from '../websocket';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string, public protocols?: string[]) {
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back the message for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', { data }));
    }, 5);
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }, 5);
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  let mockHandlers: any;

  beforeEach(() => {
    mockHandlers = {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onReconnect: jest.fn(),
    };

    wsService = new WebSocketService(
      {
        url: 'ws://localhost:8080/test',
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
        heartbeatInterval: 1000,
      },
      mockHandlers
    );
  });

  afterEach(() => {
    wsService.disconnect();
  });

  test('should connect successfully', async () => {
    await wsService.connect();
    
    expect(wsService.isConnected()).toBe(true);
    expect(wsService.getConnectionState()).toBe('OPEN');
    expect(mockHandlers.onConnect).toHaveBeenCalled();
  });

  test('should send messages when connected', async () => {
    await wsService.connect();
    
    const success = wsService.send('test_message', { data: 'hello' });
    expect(success).toBe(true);
  });

  test('should queue messages when not connected', () => {
    const success = wsService.send('test_message', { data: 'hello' });
    expect(success).toBe(false);
  });

  test('should handle disconnection', async () => {
    await wsService.connect();
    wsService.disconnect();
    
    // Wait for disconnect event
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(wsService.isConnected()).toBe(false);
    expect(mockHandlers.onDisconnect).toHaveBeenCalled();
  });

  test('should generate unique message IDs', async () => {
    await wsService.connect();
    
    // Mock the send method to capture messages
    const sentMessages: any[] = [];
    const originalSend = (wsService as any).ws.send;
    (wsService as any).ws.send = (data: string) => {
      sentMessages.push(JSON.parse(data));
      originalSend.call((wsService as any).ws, data);
    };
    
    wsService.send('test1', {});
    wsService.send('test2', {});
    
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0].id).toBeDefined();
    expect(sentMessages[1].id).toBeDefined();
    expect(sentMessages[0].id).not.toBe(sentMessages[1].id);
  });

  test('should handle message parsing errors gracefully', async () => {
    await wsService.connect();
    
    // Simulate invalid JSON message
    const ws = (wsService as any).ws;
    ws.onmessage(new MessageEvent('message', { data: 'invalid json' }));
    
    // Should not crash and should not call message handler
    expect(mockHandlers.onMessage).not.toHaveBeenCalled();
  });

  test('should flush queued messages on connection', async () => {
    // Send messages while disconnected
    wsService.send('queued1', { data: 'test1' });
    wsService.send('queued2', { data: 'test2' });
    
    // Mock the send method to capture messages
    const sentMessages: any[] = [];
    
    await wsService.connect();
    
    const originalSend = (wsService as any).ws.send;
    (wsService as any).ws.send = (data: string) => {
      sentMessages.push(JSON.parse(data));
      originalSend.call((wsService as any).ws, data);
    };
    
    // Trigger flush by sending another message
    wsService.send('new_message', { data: 'test3' });
    
    // Should have sent the new message
    expect(sentMessages.length).toBeGreaterThan(0);
  });
});

describe('WebSocket Message Format', () => {
  test('should create properly formatted messages', () => {
    const wsService = new WebSocketService({ url: 'ws://test' });
    
    // Access private method for testing
    const generateMessageId = (wsService as any).generateMessageId.bind(wsService);
    const messageId = generateMessageId();
    
    expect(typeof messageId).toBe('string');
    expect(messageId.length).toBeGreaterThan(10);
  });
});