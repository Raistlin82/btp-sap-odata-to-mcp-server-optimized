/**
 * Custom Test Suite Bridge
 * Allows Jest to execute the custom test suite and report results
 */

import { describe, test, expect } from '@jest/globals';
import { spawn } from 'child_process';
import { Logger } from '../src/utils/logger.js';

describe('Custom Test Suite Integration', () => {
  const logger = new Logger('CustomTestBridge');
  const timeout = 60000; // 1 minute timeout for custom tests

  test('should run MCP Protocol Tests successfully', async () => {
    const result = await runCustomTestSuite('protocol');
    expect(result.success).toBe(true);
    expect(result.output).toContain('MCP Protocol: PASSED');
  }, timeout);

  test('should run Authentication Tests successfully', async () => {
    const result = await runCustomTestSuite('auth');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Authentication');
  }, timeout);

  test('should run Tool Execution Tests successfully', async () => {
    const result = await runCustomTestSuite('tools');
    expect(result.success).toBe(true);
    expect(result.output).toContain('Tool Execution');
  }, timeout);

  async function runCustomTestSuite(suite: string): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('node', ['tests/run-tests.js', `--suite=${suite}`], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const success = code === 0;
        resolve({
          success,
          output: stdout,
          error: success ? undefined : stderr
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }
});