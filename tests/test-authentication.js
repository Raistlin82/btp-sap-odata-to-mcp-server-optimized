#!/usr/bin/env node

/**
 * Authentication Test Suite
 * Tests the authentication system and check-sap-authentication tool
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class AuthenticationTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 8000;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    log(message, type = 'info') {
        if (!this.verbose && type === 'debug') return;

        const prefix = {
            info: chalk.blue('ℹ'),
            success: chalk.green('✅'),
            error: chalk.red('❌'),
            debug: chalk.gray('🔍')
        }[type] || '';

        console.log(`${prefix} ${message}`);
    }

    async runTest() {
        this.log('Starting Authentication Test Suite', 'info');

        try {
            // Test 1: Check auth tool without session
            let result = await this.testAuthWithoutSession();
            this.recordResult('Auth Check Without Session', result);

            // Test 2: Check auth tool with invalid session
            result = await this.testAuthWithInvalidSession();
            this.recordResult('Auth Check With Invalid Session', result);

            // Test 3: Check auth tool response structure
            result = await this.testAuthResponseStructure();
            this.recordResult('Auth Response Structure', result);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    testAuthWithoutSession() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let authResponse = null;
            let hasInitialized = false;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout waiting for auth response'
                });
            }, this.timeout);

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');

                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        try {
                            const message = JSON.parse(line.trim());

                            if (message.id === 1 && message.result) {
                                hasInitialized = true;

                                // Send initialized and test auth
                                const initializedMsg = JSON.stringify({
                                    jsonrpc: "2.0",
                                    method: "notifications/initialized",
                                    params: {}
                                });
                                child.stdin.write(initializedMsg + '\n');

                                setTimeout(() => {
                                    const authTestMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/call",
                                        params: {
                                            name: "check-sap-authentication",
                                            arguments: {
                                                validateSession: true,
                                                requestPreAuth: false
                                            }
                                        }
                                    });
                                    child.stdin.write(authTestMsg + '\n');
                                    this.log('Testing auth without session', 'debug');
                                }, 500);
                            }

                            if (message.id === 2 && message.result) {
                                const resultText = message.result.content[0].text;
                                authResponse = JSON.parse(resultText);

                                clearTimeout(timeout);
                                child.kill();

                                const isValid = authResponse.status === 'auth_disabled' ||
                                              authResponse.status === 'authentication_required';

                                resolve({
                                    passed: isValid,
                                    details: {
                                        status: authResponse.status,
                                        hasAuthUrl: !!authResponse.auth_url
                                    }
                                });
                            }
                        } catch (e) {
                            // Ignore non-JSON
                        }
                    }
                }
            });

            child.stderr.on('data', (data) => {
                const stderr = data.toString();
                if (stderr.includes('Connected to stdio transport')) {
                    setTimeout(() => {
                        const initMessage = JSON.stringify({
                            jsonrpc: "2.0",
                            id: messageId,
                            method: "initialize",
                            params: {
                                protocolVersion: "2024-11-05",
                                capabilities: { tools: {} },
                                clientInfo: { name: "auth-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 500);
                }
            });
        });
    }

    testAuthWithInvalidSession() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let authResponse = null;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout waiting for auth response'
                });
            }, this.timeout);

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');

                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        try {
                            const message = JSON.parse(line.trim());

                            if (message.id === 1 && message.result) {
                                const initializedMsg = JSON.stringify({
                                    jsonrpc: "2.0",
                                    method: "notifications/initialized",
                                    params: {}
                                });
                                child.stdin.write(initializedMsg + '\n');

                                setTimeout(() => {
                                    const authTestMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/call",
                                        params: {
                                            name: "check-sap-authentication",
                                            arguments: {
                                                session_id: "invalid_session_123",
                                                validateSession: true
                                            }
                                        }
                                    });
                                    child.stdin.write(authTestMsg + '\n');
                                    this.log('Testing auth with invalid session', 'debug');
                                }, 500);
                            }

                            if (message.id === 2 && message.result) {
                                const resultText = message.result.content[0].text;
                                authResponse = JSON.parse(resultText);

                                clearTimeout(timeout);
                                child.kill();

                                const isValid = authResponse.status === 'auth_disabled' ||
                                              authResponse.status === 'auth_failed';

                                resolve({
                                    passed: isValid,
                                    details: {
                                        status: authResponse.status,
                                        correctlyRejected: authResponse.status === 'auth_failed'
                                    }
                                });
                            }
                        } catch (e) {
                            // Ignore non-JSON
                        }
                    }
                }
            });

            child.stderr.on('data', (data) => {
                const stderr = data.toString();
                if (stderr.includes('Connected to stdio transport')) {
                    setTimeout(() => {
                        const initMessage = JSON.stringify({
                            jsonrpc: "2.0",
                            id: messageId,
                            method: "initialize",
                            params: {
                                protocolVersion: "2024-11-05",
                                capabilities: { tools: {} },
                                clientInfo: { name: "auth-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 500);
                }
            });
        });
    }

    testAuthResponseStructure() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout waiting for auth response'
                });
            }, this.timeout);

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');

                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        try {
                            const message = JSON.parse(line.trim());

                            if (message.id === 1 && message.result) {
                                const initializedMsg = JSON.stringify({
                                    jsonrpc: "2.0",
                                    method: "notifications/initialized",
                                    params: {}
                                });
                                child.stdin.write(initializedMsg + '\n');

                                setTimeout(() => {
                                    const authTestMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/call",
                                        params: {
                                            name: "check-sap-authentication",
                                            arguments: {
                                                validateSession: true,
                                                context: {
                                                    sessionType: "interactive"
                                                }
                                            }
                                        }
                                    });
                                    child.stdin.write(authTestMsg + '\n');
                                }, 500);
                            }

                            if (message.id === 2) {
                                clearTimeout(timeout);
                                child.kill();

                                if (message.result?.content?.[0]?.text) {
                                    const authResponse = JSON.parse(message.result.content[0].text);

                                    const hasRequiredFields =
                                        authResponse.status !== undefined &&
                                        authResponse.message !== undefined;

                                    resolve({
                                        passed: hasRequiredFields,
                                        details: {
                                            hasStatus: !!authResponse.status,
                                            hasMessage: !!authResponse.message,
                                            hasAuthUrl: !!authResponse.auth_url,
                                            status: authResponse.status
                                        }
                                    });
                                } else {
                                    resolve({
                                        passed: false,
                                        error: 'Invalid response structure'
                                    });
                                }
                            }
                        } catch (e) {
                            // Ignore non-JSON
                        }
                    }
                }
            });

            child.stderr.on('data', (data) => {
                const stderr = data.toString();
                if (stderr.includes('Connected to stdio transport')) {
                    setTimeout(() => {
                        const initMessage = JSON.stringify({
                            jsonrpc: "2.0",
                            id: messageId,
                            method: "initialize",
                            params: {
                                protocolVersion: "2024-11-05",
                                capabilities: { tools: {} },
                                clientInfo: { name: "auth-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 500);
                }
            });
        });
    }

    recordResult(testName, result) {
        if (result.passed) {
            this.results.passed++;
            this.log(`${testName}: PASSED`, 'success');
        } else {
            this.results.failed++;
            this.log(`${testName}: FAILED - ${result.error || 'Check details'}`, 'error');
        }
        this.results.tests.push({ name: testName, ...result });
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new AuthenticationTest({ verbose: process.argv.includes('--verbose') });
    test.runTest().then(results => {
        console.log('\n' + chalk.bold('Test Results:'));
        console.log(chalk.green(`Passed: ${results.passed}`));
        console.log(chalk.red(`Failed: ${results.failed}`));
        process.exit(results.failed > 0 ? 1 : 0);
    });
}