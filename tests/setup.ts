// Jest setup file
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: 'env.test' });

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error'; // Reduce log noise during tests
process.env['PORT'] = '3001'; // Set a test port to avoid conflicts

// Global test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise during tests
const originalConsole = global.console;
beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});
