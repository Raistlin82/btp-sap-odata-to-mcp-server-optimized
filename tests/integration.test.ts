/**
 * Integration Tests for SAP MCP Server
 * Jest-based tests that integrate with the custom test suite
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { Logger } from '../src/utils/logger.js';

describe('SAP MCP Server Integration Tests', () => {
  let serverProcess: ChildProcess | null = null;
  const logger = new Logger('IntegrationTest');

  beforeAll(async () => {
    // Ensure build is complete before testing
    logger.info('Setting up integration tests');
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  describe('Core Functionality', () => {
    test('should validate logger functionality', () => {
      const testLogger = new Logger('TestComponent');

      expect(testLogger).toBeDefined();
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.error).toBe('function');
      expect(typeof testLogger.debug).toBe('function');
      expect(typeof testLogger.warn).toBe('function');
    });

    test('should sanitize sensitive data in logs', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'jwt-token-here',
        normalField: 'public-data'
      };

      const sanitized = Logger.sanitize(sensitiveData);

      expect(sanitized).toBeDefined();
      expect((sanitized as any).username).toBe('testuser');
      expect((sanitized as any).password).toContain('*'); // Should be masked with asterisks
      expect((sanitized as any).token).toContain('*'); // Should be masked with asterisks
      expect((sanitized as any).normalField).toBe('public-data');
    });

    test('should handle null and undefined values', () => {
      expect(Logger.sanitize(null)).toBeNull();
      expect(Logger.sanitize(undefined)).toBeUndefined();
      expect(Logger.sanitize('test')).toBe('test');
      expect(Logger.sanitize(123)).toBe(123);
    });
  });

  describe('Configuration Validation', () => {
    test('should have required environment structure', () => {
      const requiredEnvVars = [
        'NODE_ENV',
        'LOG_LEVEL',
        'SAP_CLIENT_ID',
        'SAP_CLIENT_SECRET'
      ];

      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined();
      });
    });

    test('should validate package.json scripts', async () => {
      const { readFileSync } = await import('fs');
      const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

      const requiredScripts = [
        'build',
        'start',
        'test',
        'test:all'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts[script]).toBeDefined();
      });
    });
  });

  describe('Custom Test Suite Integration', () => {
    test('should be able to run custom test suite', async () => {
      const { existsSync } = await import('fs');

      expect(existsSync('tests/run-tests.js')).toBe(true);
      expect(existsSync('tests/test-mcp-protocol.js')).toBe(true);
      expect(existsSync('tests/test-authentication.js')).toBe(true);
    });

    test('should validate test runner configuration', async () => {
      const { readFileSync } = await import('fs');
      const runTestsContent = readFileSync('tests/run-tests.js', 'utf8');

      expect(runTestsContent).toContain('MCPProtocolTest');
      expect(runTestsContent).toContain('AuthenticationTest');
      expect(runTestsContent).toContain('ToolExecutionTest');
    });
  });
});