/**
 * Jest Setup File
 * Configures global test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.SAP_CLIENT_ID = 'test-client-id';
process.env.SAP_CLIENT_SECRET = 'test-client-secret';
process.env.SAP_IAS_URL = 'https://test.accounts.ondemand.com';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};