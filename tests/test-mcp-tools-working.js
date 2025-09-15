#!/usr/bin/env node

/**
 * Working MCP Tools Test
 * Tests MCP server with proper protocol handshake
 * This should work with the actual server configuration
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class WorkingMCPToolsTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 20000;
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
            debug: chalk.gray('🔍'),
            warning: chalk.yellow('⚠️')
        }[type] || '';

        console.log(`${prefix} ${message}`);
    }

    async runTest() {
        this.log('🔧 Testing MCP Server with proper protocol handshake', 'info');

        try {
            // Test 1: Full MCP Protocol Test
            const mcpResult = await this.testMCPProtocol();
            this.recordResult('MCP Protocol Test', mcpResult);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    testMCPProtocol() {
        return new Promise((resolve) => {
            this.log('🚀 Starting MCP server for protocol test...', 'debug');

            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let currentStep = 'initialize';
            let messageId = 1;
            let toolsList = [];
            let serverCapabilities = null;

            const timeout = setTimeout(() => {
                child.kill();
                this.log(`❌ Test timed out at step: ${currentStep}`, 'error');
                resolve({
                    success: false,
                    error: `Timeout at step: ${currentStep}`,
                    completedSteps: [currentStep],
                    toolsFound: toolsList.length,
                    serverCapabilities
                });
            }, this.timeout);

            const sendMessage = (message) => {
                this.log(`📤 Sending: ${message.method}`, 'debug');
                child.stdin.write(JSON.stringify(message) + '\n');
            };

            const processResponse = (response) => {
                this.log(`📥 Received response for: ${response.id}`, 'debug');

                switch (currentStep) {
                    case 'initialize':
                        if (response.result && response.result.capabilities) {
                            serverCapabilities = response.result.capabilities;
                            this.log(`✅ Server initialized with capabilities`, 'debug');

                            // Step 2: Request tools list
                            currentStep = 'tools_list';
                            sendMessage({
                                jsonrpc: '2.0',
                                id: messageId++,
                                method: 'tools/list'
                            });
                        }
                        break;

                    case 'tools_list':
                        if (response.result && response.result.tools) {
                            toolsList = response.result.tools;
                            this.log(`✅ Got ${toolsList.length} tools from server`, 'debug');

                            // Success - we got the tools list
                            clearTimeout(timeout);
                            child.kill();

                            resolve({
                                success: true,
                                toolsFound: toolsList.length,
                                toolsList: toolsList.map(t => t.name),
                                serverCapabilities,
                                completedSteps: ['initialize', 'tools_list']
                            });
                        }
                        break;
                }
            };

            child.stdout.on('data', (data) => {
                output += data.toString();

                try {
                    const lines = output.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        try {
                            const response = JSON.parse(line);
                            if (response.id) {
                                processResponse(response);
                            }
                        } catch (e) {
                            // Skip non-JSON lines (logs)
                        }
                    }
                } catch (e) {
                    // Continue parsing
                }
            });

            child.stderr.on('data', (data) => {
                const stderr = data.toString();
                if (this.verbose) {
                    this.log(`Server stderr: ${stderr.substring(0, 200)}...`, 'debug');
                }
            });

            child.on('close', () => {
                clearTimeout(timeout);
                if (currentStep !== 'tools_list' || toolsList.length === 0) {
                    resolve({
                        success: false,
                        error: `Server closed at step: ${currentStep}`,
                        completedSteps: [currentStep],
                        toolsFound: toolsList.length,
                        serverCapabilities
                    });
                }
            });

            // Start MCP protocol handshake
            setTimeout(() => {
                currentStep = 'initialize';
                sendMessage({
                    jsonrpc: '2.0',
                    id: messageId++,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            roots: {
                                listChanged: true
                            },
                            sampling: {}
                        },
                        clientInfo: {
                            name: 'test-client',
                            version: '1.0.0'
                        }
                    }
                });
            }, 1000); // Give server time to start
        });
    }

    recordResult(testName, result) {
        this.results.tests.push({
            name: testName,
            success: result.success,
            details: result
        });

        if (result.success) {
            this.results.passed++;
            this.log(`✅ ${testName}: PASSED`, 'success');
        } else {
            this.results.failed++;
            this.log(`❌ ${testName}: FAILED - ${result.error}`, 'error');
        }
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new WorkingMCPToolsTest({ verbose: true });

    console.log(chalk.blue.bold('\n🔧 WORKING MCP TOOLS TEST'));
    console.log(chalk.gray('==========================\n'));

    test.runTest().then(results => {
        console.log('\n📊 RESULTS SUMMARY:');
        console.log(`✅ Passed: ${results.passed}`);
        console.log(`❌ Failed: ${results.failed}`);

        // Show detailed results
        results.tests.forEach(test => {
            console.log(`\n📋 Test: ${test.name}`);
            if (test.success) {
                console.log(`   ✅ Status: SUCCESS`);
                console.log(`   🔧 Tools Found: ${test.details.toolsFound}`);
                if (test.details.toolsList) {
                    console.log(`   📝 Tools List: ${test.details.toolsList.join(', ')}`);
                }
                console.log(`   📡 Completed Steps: ${test.details.completedSteps.join(' → ')}`);
            } else {
                console.log(`   ❌ Status: FAILED`);
                console.log(`   💥 Error: ${test.details.error}`);
                console.log(`   📡 Completed Steps: ${test.details.completedSteps.join(' → ')}`);
            }
        });

        if (results.passed > 0) {
            console.log('\n🎉 MCP SERVER IS WORKING!');
            console.log('The server can communicate via MCP protocol and serves tools correctly.');
        } else {
            console.log('\n⚠️  MCP SERVER NEEDS CONFIGURATION');
            console.log('Check server startup logs and SAP configuration.');
        }

        process.exit(results.failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('\n💥 Test suite crashed:', error.message);
        process.exit(1);
    });
}

export default WorkingMCPToolsTest;