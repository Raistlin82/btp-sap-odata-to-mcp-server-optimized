#!/usr/bin/env node

/**
 * MCP Protocol Test Suite
 * Tests the Model Context Protocol implementation
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class MCPProtocolTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 10000;
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
        this.log('Starting MCP Protocol Test Suite', 'info');

        try {
            const result = await this.testMCPProtocol();
            this.recordResult('MCP Protocol', result);
            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    testMCPProtocol() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let responseBuffer = '';
            const testResults = {
                serverConnected: false,
                initializeResponse: false,
                toolsListReceived: false,
                protocolVersion: null,
                toolCount: 0
            };

            const timeout = setTimeout(() => {
                child.kill();
                resolve(this.evaluateProtocolResults(testResults));
            }, this.timeout);

            // Handle stdout (MCP protocol messages)
            child.stdout.on('data', (data) => {
                responseBuffer += data.toString();
                const lines = responseBuffer.split('\n');
                responseBuffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        try {
                            const message = JSON.parse(line.trim());
                            this.log(`Received MCP message: ${JSON.stringify(message).substring(0, 100)}...`, 'debug');

                            // Check initialize response
                            if (message.id === 1 && message.result) {
                                testResults.initializeResponse = true;
                                testResults.protocolVersion = message.result.protocolVersion;

                                // Send initialized notification
                                const initializedMsg = JSON.stringify({
                                    jsonrpc: "2.0",
                                    method: "notifications/initialized",
                                    params: {}
                                });
                                child.stdin.write(initializedMsg + '\n');

                                // Request tools list
                                setTimeout(() => {
                                    const toolsMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/list"
                                    });
                                    child.stdin.write(toolsMsg + '\n');
                                }, 500);
                            }

                            // Check tools list response
                            if (message.id === 2 && message.result?.tools) {
                                testResults.toolsListReceived = true;
                                testResults.toolCount = message.result.tools.length;

                                clearTimeout(timeout);
                                child.kill();
                                resolve(this.evaluateProtocolResults(testResults));
                            }
                        } catch (e) {
                            // Ignore non-JSON lines
                        }
                    }
                }
            });

            // Handle stderr (logs)
            child.stderr.on('data', (data) => {
                const stderr = data.toString();
                if (stderr.includes('Connected to stdio transport')) {
                    testResults.serverConnected = true;

                    // Send initialize message
                    setTimeout(() => {
                        const initMessage = JSON.stringify({
                            jsonrpc: "2.0",
                            id: messageId,
                            method: "initialize",
                            params: {
                                protocolVersion: "2024-11-05",
                                capabilities: { tools: {} },
                                clientInfo: { name: "test-suite", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                        this.log('Sent initialize message', 'debug');
                    }, 1000);
                }
            });

            child.on('error', (error) => {
                this.log(`Process error: ${error.message}`, 'error');
                clearTimeout(timeout);
                resolve({ passed: false, error: error.message });
            });
        });
    }

    evaluateProtocolResults(results) {
        const checks = [
            { name: 'Server Connection', passed: results.serverConnected },
            { name: 'Initialize Response', passed: results.initializeResponse },
            { name: 'Protocol Version', passed: results.protocolVersion === '2024-11-05' },
            { name: 'Tools List', passed: results.toolsListReceived },
            { name: 'Tools Count', passed: results.toolCount >= 12 }
        ];

        const failedChecks = checks.filter(c => !c.passed);

        if (failedChecks.length === 0) {
            this.log(`All MCP protocol checks passed (${results.toolCount} tools registered)`, 'success');
            return {
                passed: true,
                details: {
                    protocolVersion: results.protocolVersion,
                    toolCount: results.toolCount
                }
            };
        } else {
            failedChecks.forEach(check => {
                this.log(`Failed: ${check.name}`, 'error');
            });
            return {
                passed: false,
                failedChecks: failedChecks.map(c => c.name)
            };
        }
    }

    recordResult(testName, result) {
        if (result.passed) {
            this.results.passed++;
            this.log(`${testName}: PASSED`, 'success');
        } else {
            this.results.failed++;
            this.log(`${testName}: FAILED`, 'error');
        }
        this.results.tests.push({ name: testName, ...result });
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new MCPProtocolTest({ verbose: process.argv.includes('--verbose') });
    test.runTest().then(results => {
        console.log('\n' + chalk.bold('Test Results:'));
        console.log(chalk.green(`Passed: ${results.passed}`));
        console.log(chalk.red(`Failed: ${results.failed}`));
        process.exit(results.failed > 0 ? 1 : 0);
    });
}