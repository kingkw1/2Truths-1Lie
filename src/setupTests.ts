/**
 * Jest setup file for testing configuration
 */

// Mock environment variables
process.env.REACT_APP_WEBSOCKET_URL = 'ws://localhost:8080/ws';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};