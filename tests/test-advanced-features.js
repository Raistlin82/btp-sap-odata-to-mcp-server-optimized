#!/usr/bin/env node

/**
 * Advanced Features Test Suite
 * Tests additional functionality beyond basic MCP compliance
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class AdvancedFeaturesTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 30000;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };

        // Advanced tools to test
        this.advancedToolsToTest = [
            {
                name: 'natural-query-builder',
                args: {
                    naturalQuery: 'show me all business partners',
                    entityType: 'BusinessPartner',
                    serviceId: 'ZAPI_BUSINESS_PARTNER_0001'
                },
                description: 'Natural language query processing'
            },
            {
                name: 'smart-data-analysis',
                args: {
                    data: [{"ID": "1", "Name": "Test"}],
                    analysisType: 'trend',
                    entityType: 'BusinessPartner'
                },
                description: 'AI data analysis'
            },
            {
                name: 'discover-service-entities',
                args: {
                    serviceId: 'ZAPI_BUSINESS_PARTNER_0001',
                    includeMetadata: true
                },
                description: 'Service entity discovery'
            },
            {
                name: 'get-entity-schema',
                args: {
                    serviceId: 'ZAPI_BUSINESS_PARTNER_0001',
                    entityName: 'A_BusinessPartner'
                },
                description: 'Entity schema retrieval'
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
        this.log('Starting Advanced Features Test Suite', 'info');

        try {
            // Test 1: Tool routing and smart query
            const routingResult = await this.testSmartRouting();
            this.recordResult('Smart Query Routing', routingResult);

            // Test 2: Advanced tools execution
            const advancedToolsResult = await this.testAdvancedTools();
            this.recordResult('Advanced Tools Execution', advancedToolsResult);

            // Test 3: Tool schema completeness
            const schemaCompletenessResult = await this.testSchemaCompleteness();
            this.recordResult('Schema Completeness', schemaCompletenessResult);

            // Test 4: Performance under load
            const performanceResult = await this.testPerformance();
            this.recordResult('Performance Under Load', performanceResult);

            return this.results;
        } catch (error) {
            this.log(`Advanced features test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    async testSmartRouting() {
        this.log('Testing smart query routing...', 'debug');

        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let routingTestResults = [];

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during smart routing test'
                });
            }, this.timeout);

            const testQueries = [
                'mostra i business partner',
                'create a new business partner',
                'analyze business partner trends',
                'show me the schema for business partners'
            ];

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

                                // Start smart routing tests
                                setTimeout(() => this.runSmartRoutingTests(child, testQueries, routingTestResults), 1000);
                            }

                            // Handle smart query responses
                            if (message.id > 1 && message.result) {
                                const queryIndex = message.id - 2;
                                if (queryIndex < testQueries.length) {
                                    routingTestResults.push({
                                        query: testQueries[queryIndex],
                                        success: true,
                                        response: message.result
                                    });

                                    if (routingTestResults.length === testQueries.length) {
                                        clearTimeout(timeout);
                                        child.kill();

                                        const successCount = routingTestResults.filter(r => r.success).length;
                                        resolve({
                                            passed: successCount === testQueries.length,
                                            details: {
                                                totalQueries: testQueries.length,
                                                successfulQueries: successCount,
                                                results: routingTestResults
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
                                clientInfo: { name: "advanced-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 1000);
                }
            });
        });
    }

    runSmartRoutingTests(child, testQueries, results) {
        testQueries.forEach((query, index) => {
            setTimeout(() => {
                const smartQueryMsg = JSON.stringify({
                    jsonrpc: "2.0",
                    id: index + 2,
                    method: "tools/call",
                    params: {
                        name: "sap-smart-query",
                        arguments: {
                            userRequest: query,
                            context: {
                                previousTools: []
                            }
                        }
                    }
                });
                child.stdin.write(smartQueryMsg + '\n');
            }, index * 2000);
        });
    }

    async testAdvancedTools() {
        this.log('Testing advanced tools...', 'debug');

        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let toolTestResults = [];

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during advanced tools test'
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

                                // Start advanced tools tests
                                setTimeout(() => this.runAdvancedToolsTests(child, toolTestResults), 1000);
                            }

                            if (message.id > 1) {
                                const toolIndex = message.id - 2;
                                if (toolIndex < this.advancedToolsToTest.length) {
                                    const tool = this.advancedToolsToTest[toolIndex];
                                    toolTestResults.push({
                                        name: tool.name,
                                        success: !!message.result,
                                        error: message.error?.message
                                    });

                                    if (toolTestResults.length === this.advancedToolsToTest.length) {
                                        clearTimeout(timeout);
                                        child.kill();

                                        const successCount = toolTestResults.filter(r => r.success).length;
                                        resolve({
                                            passed: successCount >= this.advancedToolsToTest.length * 0.75, // 75% success rate
                                            details: {
                                                totalTools: this.advancedToolsToTest.length,
                                                successfulTools: successCount,
                                                results: toolTestResults
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
                                clientInfo: { name: "advanced-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 1000);
                }
            });
        });
    }

    runAdvancedToolsTests(child, results) {
        this.advancedToolsToTest.forEach((tool, index) => {
            setTimeout(() => {
                const toolCallMsg = JSON.stringify({
                    jsonrpc: "2.0",
                    id: index + 2,
                    method: "tools/call",
                    params: {
                        name: tool.name,
                        arguments: tool.args
                    }
                });
                child.stdin.write(toolCallMsg + '\n');
            }, index * 1500);
        });
    }

    async testSchemaCompleteness() {
        // Test that all tools have complete schemas with proper descriptions
        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during schema completeness test'
                });
            }, 10000);

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
                                const schemaIssues = [];

                                tools.forEach(tool => {
                                    // Check for complete schema structure
                                    if (!tool.description || tool.description.length < 10) {
                                        schemaIssues.push(`${tool.name}: Incomplete description`);
                                    }

                                    if (!tool.inputSchema || !tool.inputSchema.properties) {
                                        schemaIssues.push(`${tool.name}: Missing input schema`);
                                    }

                                    // Check for array items
                                    const checkArrayItems = (obj, path = '') => {
                                        if (typeof obj === 'object' && obj !== null) {
                                            if (obj.type === 'array' && !obj.items) {
                                                schemaIssues.push(`${tool.name}: Array without items at ${path}`);
                                            }
                                            Object.keys(obj).forEach(key => {
                                                checkArrayItems(obj[key], path ? `${path}.${key}` : key);
                                            });
                                        }
                                    };

                                    if (tool.inputSchema) {
                                        checkArrayItems(tool.inputSchema);
                                    }
                                });

                                clearTimeout(timeout);
                                child.kill();

                                resolve({
                                    passed: schemaIssues.length === 0,
                                    details: {
                                        totalTools: tools.length,
                                        schemaIssues: schemaIssues,
                                        issueCount: schemaIssues.length
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
                                clientInfo: { name: "schema-test", version: "1.0.0" }
                            }
                        });
                        child.stdin.write(initMessage + '\n');
                    }, 1000);
                }
            });
        });
    }

    async testPerformance() {
        // Simple performance test - multiple concurrent tool calls
        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let responses = 0;
            const expectedResponses = 10;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    passed: false,
                    error: 'Timeout during performance test'
                });
            }, 15000);

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

                                // Send multiple concurrent requests
                                setTimeout(() => {
                                    for (let i = 0; i < expectedResponses; i++) {
                                        const toolCallMsg = JSON.stringify({
                                            jsonrpc: "2.0",
                                            id: i + 2,
                                            method: "tools/call",
                                            params: {
                                                name: "search-sap-services",
                                                arguments: { limit: 3 }
                                            }
                                        });
                                        child.stdin.write(toolCallMsg + '\n');
                                    }
                                }, 500);
                            }

                            if (message.id > 1) {
                                responses++;
                                if (responses === expectedResponses) {
                                    const duration = Date.now() - startTime;
                                    clearTimeout(timeout);
                                    child.kill();

                                    resolve({
                                        passed: duration < 10000, // Should complete within 10 seconds
                                        details: {
                                            duration,
                                            requestsPerSecond: (expectedResponses / (duration / 1000)).toFixed(2),
                                            totalRequests: expectedResponses
                                        }
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
                                clientInfo: { name: "perf-test", version: "1.0.0" }
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
    const test = new AdvancedFeaturesTest({ verbose: process.argv.includes('--verbose') });
    test.runTest().then(results => {
        console.log('\n' + chalk.bold('Advanced Features Test Results:'));
        console.log(chalk.green(`Passed: ${results.passed}`));
        console.log(chalk.red(`Failed: ${results.failed}`));

        if (results.tests.length > 0) {
            console.log('\nDetailed Results:');
            results.tests.forEach(test => {
                const status = test.passed ? chalk.green('✅') : chalk.red('❌');
                console.log(`  ${status} ${test.name}`);
                if (test.details && test.details.results) {
                    test.details.results.forEach(item => {
                        const itemStatus = item.success ? chalk.green('  ✓') : chalk.red('  ✗');
                        console.log(`    ${itemStatus} ${item.name || item.query || 'Test item'}`);
                    });
                }
            });
        }

        process.exit(results.failed > 0 ? 1 : 0);
    });
}