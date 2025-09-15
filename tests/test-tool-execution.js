#!/usr/bin/env node

/**
 * Tool Execution Test Suite
 * Tests that all MCP tools execute without "Tool execution failed" errors
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class ToolExecutionTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 25000;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Tools to test with their arguments
        this.toolsToTest = [
            {
                name: 'search-sap-services',
                args: { limit: 3 },
                description: 'Search SAP services'
            },
            {
                name: 'check-sap-authentication',
                args: { validateSession: true },
                description: 'Check authentication'
            },
            {
                name: 'sap-smart-query',
                args: {
                    userRequest: 'test routing',
                    context: { previousTools: [] }
                },
                description: 'Smart query router'
            },
            {
                name: 'realtime-data-stream',
                args: { action: 'status' },
                description: 'Real-time data stream'
            },
            {
                name: 'kpi-dashboard-builder',
                args: {
                    action: 'list'
                },
                description: 'KPI dashboard builder'
            }
        ];
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
        this.log('Starting Tool Execution Test Suite', 'info');

        try {
            // Test 1: All tools execution
            const result = await this.testAllToolsExecution();
            this.recordResult('All Tools Execution', result);

            // Test 2: Tool schema validation
            const schemaResult = await this.testToolSchemas();
            this.recordResult('Tool Schema Validation', schemaResult);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    testAllToolsExecution() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let toolTestIndex = 0;
            let toolResults = [];
            let toolsList = [];

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during tool execution tests'
                });
            }, this.timeout);

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');

                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        try {
                            const message = JSON.parse(line.trim());

                            // Initialize response
                            if (message.id === 1 && message.result) {
                                const initializedMsg = JSON.stringify({
                                    jsonrpc: "2.0",
                                    method: "notifications/initialized",
                                    params: {}
                                });
                                child.stdin.write(initializedMsg + '\n');

                                // Get tools list
                                setTimeout(() => {
                                    const toolsListMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/list"
                                    });
                                    child.stdin.write(toolsListMsg + '\n');
                                }, 500);
                            }

                            // Tools list response
                            if (message.id === 2 && message.result?.tools) {
                                toolsList = message.result.tools;
                                this.log(`Found ${toolsList.length} tools`, 'debug');

                                // Start testing tools
                                this.testNextTool(child, ++messageId, 0, toolsList);
                            }

                            // Tool execution responses
                            if (message.id > 2) {
                                const toolIndex = message.id - 3; // message ids start from 3 for tools
                                const currentTool = this.toolsToTest[toolIndex];
                                if (currentTool) {
                                    if (message.result) {
                                        toolResults.push({
                                            name: currentTool.name,
                                            passed: true,
                                            response: 'Success'
                                        });
                                        this.log(`Tool ${currentTool.name}: Success`, 'success');
                                    } else if (message.error) {
                                        toolResults.push({
                                            name: currentTool.name,
                                            passed: false,
                                            error: message.error.message
                                        });
                                        this.log(`Tool ${currentTool.name}: Error - ${message.error.message}`, 'error');
                                    }

                                    // Test next tool or finish
                                    if (toolIndex + 1 < this.toolsToTest.length) {
                                        setTimeout(() => {
                                            this.testNextTool(child, ++messageId, toolIndex + 1, toolsList);
                                        }, 1000);
                                    } else {
                                        clearTimeout(timeout);
                                        child.kill();

                                        const passedCount = toolResults.filter(r => r.passed).length;
                                        const totalCount = toolResults.length;

                                        resolve({
                                            passed: passedCount === totalCount,
                                            details: {
                                                totalTools: totalCount,
                                                passedTools: passedCount,
                                                failedTools: totalCount - passedCount,
                                                results: toolResults
                                            }
                                        });
                                    }
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
                                clientInfo: { name: "tool-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 1000);
                }
            });
        });
    }

    testNextTool(child, messageId, currentIndex, toolsList) {
        if (currentIndex >= this.toolsToTest.length) return;

        const tool = this.toolsToTest[currentIndex];
        // toolTestIndex = currentIndex;

        // Check if tool exists in the tools list
        const toolExists = toolsList.some(t => t.name === tool.name);
        if (!toolExists) {
            this.log(`Tool ${tool.name} not found in tools list`, 'warning');
            return;
        }

        this.log(`Testing tool: ${tool.name}`, 'debug');

        const toolCallMsg = JSON.stringify({
            jsonrpc: "2.0",
            id: messageId,
            method: "tools/call",
            params: {
                name: tool.name,
                arguments: tool.args
            }
        });

        child.stdin.write(toolCallMsg + '\n');
    }

    testToolSchemas() {
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let schemaResults = {
                validSchemas: 0,
                invalidSchemas: 0,
                totalTools: 0,
                issues: []
            };

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during schema validation'
                });
            }, 8000);

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
                                    const toolsListMsg = JSON.stringify({
                                        jsonrpc: "2.0",
                                        id: ++messageId,
                                        method: "tools/list"
                                    });
                                    child.stdin.write(toolsListMsg + '\n');
                                }, 500);
                            }

                            if (message.id === 2 && message.result?.tools) {
                                const tools = message.result.tools;
                                schemaResults.totalTools = tools.length;

                                tools.forEach(tool => {
                                    // Check basic schema structure
                                    const hasName = !!tool.name;
                                    const hasDescription = !!tool.description;
                                    const hasInputSchema = !!tool.inputSchema;
                                    const hasSchemaType = tool.inputSchema?.type === 'object';

                                    if (hasName && hasDescription && hasInputSchema && hasSchemaType) {
                                        schemaResults.validSchemas++;
                                    } else {
                                        schemaResults.invalidSchemas++;
                                        schemaResults.issues.push({
                                            tool: tool.name,
                                            missing: [
                                                !hasName && 'name',
                                                !hasDescription && 'description',
                                                !hasInputSchema && 'inputSchema',
                                                !hasSchemaType && 'schema.type'
                                            ].filter(Boolean)
                                        });
                                    }
                                });

                                clearTimeout(timeout);
                                child.kill();

                                resolve({
                                    passed: schemaResults.invalidSchemas === 0,
                                    details: schemaResults
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
                                clientInfo: { name: "schema-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 1000);
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
    const test = new ToolExecutionTest({ verbose: process.argv.includes('--verbose') });
    test.runTest().then(results => {
        console.log('\n' + chalk.bold('Test Results:'));
        console.log(chalk.green(`Passed: ${results.passed}`));
        console.log(chalk.red(`Failed: ${results.failed}`));

        if (results.tests.length > 0) {
            console.log('\nDetailed Results:');
            results.tests.forEach(test => {
                if (test.details?.results) {
                    test.details.results.forEach(tool => {
                        const status = tool.passed ? chalk.green('✅') : chalk.red('❌');
                        console.log(`  ${status} ${tool.name}`);
                    });
                }
            });
        }

        process.exit(results.failed > 0 ? 1 : 0);
    });
}