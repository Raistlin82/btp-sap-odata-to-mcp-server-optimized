/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testEnvironment: 'node',

  // Define where to look for tests (only .test. files to avoid custom test suite)
  testMatch: [
    '**/tests/**/*.test.{js,ts}',
    '**/src/**/*.test.{js,ts}'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/mta_archives/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/public/**',
    '!dist/**'
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],

  // Timeouts
  testTimeout: 30000,

  // Transform configuration for ES modules
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2022'
      }
    }]
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Verbose output for debugging
  verbose: true,

  // Allow tests to run in parallel
  maxWorkers: '50%'
};