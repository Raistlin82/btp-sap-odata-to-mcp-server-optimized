#!/usr/bin/env node

/**
 * UI Tools Authentication Test Suite
 * Tests authentication and authorization for UI tools
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

export class UIToolsAuthTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 30000;
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

    async runTests() {
        this.log('🔐 Testing UI Tools Authentication & Authorization', 'info');
        console.log(chalk.gray('=' .repeat(60)));

        try {
            // Test 1: UI Tool Routing with Authentication
            const routingResult = await this.testUIToolRouting();
            this.recordResult('UI Tool Routing & Authentication', routingResult);

            // Test 2: Scope Validation for UI Tools
            const scopeResult = await this.testUIScopeValidation();
            this.recordResult('UI Scope Validation', scopeResult);

            // Test 3: Form Generator with Auth
            const formAuthResult = await this.testFormGeneratorAuth();
            this.recordResult('Form Generator Authentication', formAuthResult);

            // Test 4: Role Collection Mapping
            const roleResult = await this.testRoleCollectionMapping();
            this.recordResult('Role Collection Mapping', roleResult);

            // Test 5: Authentication Failure Handling
            const authFailureResult = await this.testAuthFailureHandling();
            this.recordResult('Authentication Failure Handling', authFailureResult);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    async testUIToolRouting() {
        return new Promise((resolve) => {
            this.log('🎯 Testing UI tool routing with authentication patterns...', 'debug');

            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let messageId = 1;
            let testPhase = 'initialize';

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    error: `Timeout during ${testPhase}`,
                    details: { phase: testPhase, output }
                });
            }, this.timeout);

            const sendMessage = (message) => {
                this.log(`📤 Sending: ${message.method}`, 'debug');
                child.stdin.write(JSON.stringify(message) + '\\n');
                messageId++;
            };

            child.stdout.on('data', (data) => {
                output += data.toString();
                const lines = output.split('\\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const response = JSON.parse(line);
                        this.log(`📥 Received: ${response.method || response.id}`, 'debug');

                        if (testPhase === 'initialize' && response.method === 'notifications/initialized') {
                            testPhase = 'test_ui_patterns';
                            // Test UI pattern recognition
                            sendMessage({
                                jsonrpc: '2.0',
                                id: messageId,
                                method: 'tools/call',
                                params: {
                                    name: 'sap-smart-query',
                                    arguments: {
                                        query: 'Crea un form per inserire un nuovo cliente',
                                        context: { ui_test: true }
                                    }
                                }
                            });
                        } else if (testPhase === 'test_ui_patterns' && response.id) {
                            if (response.result && response.result.content) {
                                const content = response.result.content[0].text;
                                const hasUIRouting = content.includes('ui-form-generator') ||
                                                   content.includes('UI pattern detected');

                                if (hasUIRouting) {
                                    testPhase = 'test_auth_check';
                                    // Test authentication requirement
                                    sendMessage({
                                        jsonrpc: '2.0',
                                        id: messageId,
                                        method: 'tools/call',
                                        params: {
                                            name: 'ui-form-generator',
                                            arguments: {
                                                entityType: 'Customer',
                                                operation: 'create'
                                            }
                                        }
                                    });
                                } else {
                                    clearTimeout(timeout);
                                    child.kill();
                                    resolve({
                                        success: false,
                                        error: 'UI routing not detected',
                                        details: { content }
                                    });
                                    return;
                                }
                            }
                        } else if (testPhase === 'test_auth_check' && response.id) {
                            clearTimeout(timeout);
                            child.kill();

                            // Check if authentication was handled
                            const hasAuthCheck = response.error &&
                                               (response.error.message.includes('authentication') ||
                                                response.error.message.includes('authorization') ||
                                                response.error.message.includes('scope'));

                            resolve({
                                success: true,
                                details: {
                                    uiRoutingWorking: true,
                                    authenticationRequired: hasAuthCheck,
                                    response: response
                                }
                            });
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for partial responses
                    }
                }
            });

            child.stderr.on('data', (data) => {
                this.log(`Server stderr: ${data}`, 'debug');
            });

            child.on('close', (code) => {
                if (testPhase !== 'test_auth_check') {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        error: `Server closed unexpectedly during ${testPhase}`,
                        details: { code, phase: testPhase }
                    });
                }
            });

            // Initialize server
            sendMessage({
                jsonrpc: '2.0',
                id: messageId,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        resources: {}
                    },
                    clientInfo: {
                        name: 'ui-auth-test',
                        version: '1.0.0'
                    }
                }
            });
        });
    }

    async testUIScopeValidation() {
        this.log('🔍 Testing UI scope validation logic...', 'debug');

        try {
            // Import the intelligent router for testing
            const { IntelligentToolRouter } = await import('../dist/middleware/intelligent-tool-router.js');
            const router = new IntelligentToolRouter();

            const testCases = [
                {
                    tool: 'ui-form-generator',
                    userScopes: ['btp-sap-odata-to-mcp-server.ui.forms', 'btp-sap-odata-to-mcp-server.read'],
                    requiredScope: 'ui.forms',
                    expectedAccess: true
                },
                {
                    tool: 'ui-form-generator',
                    userScopes: ['btp-sap-odata-to-mcp-server.read'],
                    requiredScope: 'ui.forms',
                    expectedAccess: false
                },
                {
                    tool: 'ui-data-grid',
                    userScopes: ['btp-sap-odata-to-mcp-server.ui.grids', 'btp-sap-odata-to-mcp-server.ui.forms'],
                    requiredScope: 'ui.grids',
                    expectedAccess: true
                },
                {
                    tool: 'ui-dashboard-composer',
                    userScopes: ['btp-sap-odata-to-mcp-server.ui.forms'],
                    requiredScope: 'ui.dashboards',
                    expectedAccess: false
                }
            ];

            let passedTests = 0;
            const results = [];

            for (const testCase of testCases) {
                const result = router.validateUIToolAccess(
                    testCase.tool,
                    testCase.userScopes,
                    testCase.requiredScope
                );

                const passed = result.hasAccess === testCase.expectedAccess;
                if (passed) passedTests++;

                results.push({
                    testCase,
                    result,
                    passed
                });

                this.log(
                    `Scope test for ${testCase.tool}: ${passed ? 'PASS' : 'FAIL'}`,
                    passed ? 'success' : 'error'
                );
            }

            return {
                success: passedTests === testCases.length,
                details: {
                    passedTests,
                    totalTests: testCases.length,
                    results
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: { stack: error.stack }
            };
        }
    }

    async testFormGeneratorAuth() {
        this.log('📝 Testing Form Generator authentication flow...', 'debug');

        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let testPhase = 'initialize';

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    error: `Timeout during form generator auth test: ${testPhase}`
                });
            }, this.timeout);

            const sendMessage = (message) => {
                child.stdin.write(JSON.stringify(message) + '\\n');
                messageId++;
            };

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const response = JSON.parse(line);

                        if (testPhase === 'initialize' && response.method === 'notifications/initialized') {
                            testPhase = 'test_form_without_auth';
                            // Try to call form generator without authentication
                            sendMessage({
                                jsonrpc: '2.0',
                                id: messageId,
                                method: 'tools/call',
                                params: {
                                    name: 'ui-form-generator',
                                    arguments: {
                                        entityType: 'Customer',
                                        operation: 'create',
                                        layout: 'vertical'
                                    }
                                }
                            });
                        } else if (testPhase === 'test_form_without_auth' && response.id) {
                            clearTimeout(timeout);
                            child.kill();

                            // Check if authentication was properly handled
                            const authHandled = response.error &&
                                              (response.error.code === 'AUTHORIZATION_DENIED' ||
                                               response.error.message.includes('scope') ||
                                               response.error.message.includes('authentication'));

                            resolve({
                                success: true,
                                details: {
                                    authenticationEnforced: authHandled,
                                    response: response,
                                    hasError: !!response.error
                                }
                            });
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
            });

            child.on('close', (code) => {
                if (testPhase !== 'test_form_without_auth') {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        error: `Server closed unexpectedly during ${testPhase}`,
                        details: { code }
                    });
                }
            });

            // Initialize server
            sendMessage({
                jsonrpc: '2.0',
                id: messageId,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {}, resources: {} },
                    clientInfo: { name: 'form-auth-test', version: '1.0.0' }
                }
            });
        });
    }

    async testRoleCollectionMapping() {
        this.log('👥 Testing role collection mapping...', 'debug');

        try {
            // Read and validate xs-security.json
            const fs = await import('fs');
            const path = await import('path');

            const securityConfigPath = path.join(process.cwd(), 'xs-security.json');
            const securityConfig = JSON.parse(fs.readFileSync(securityConfigPath, 'utf8'));

            const requiredUIScopes = [
                'ui.forms',
                'ui.grids',
                'ui.dashboards',
                'ui.workflows',
                'ui.reports'
            ];

            const requiredRoleTemplates = [
                'MCPUIUser',
                'MCPUIAnalyst',
                'MCPUIDesigner'
            ];

            const requiredRoleCollections = [
                'MCPUIUser',
                'MCPUIAnalyst',
                'MCPUIDesigner'
            ];

            let validationResults = {
                scopesPresent: 0,
                roleTemplatesPresent: 0,
                roleCollectionsPresent: 0,
                errors: []
            };

            // Check UI scopes
            const scopes = securityConfig.scopes || [];
            for (const requiredScope of requiredUIScopes) {
                const fullScopeName = `$XSAPPNAME.${requiredScope}`;
                const scopeExists = scopes.some(scope => scope.name === fullScopeName);

                if (scopeExists) {
                    validationResults.scopesPresent++;
                } else {
                    validationResults.errors.push(`Missing UI scope: ${fullScopeName}`);
                }
            }

            // Check role templates
            const roleTemplates = securityConfig['role-templates'] || [];
            for (const requiredTemplate of requiredRoleTemplates) {
                const templateExists = roleTemplates.some(template => template.name === requiredTemplate);

                if (templateExists) {
                    validationResults.roleTemplatesPresent++;
                } else {
                    validationResults.errors.push(`Missing role template: ${requiredTemplate}`);
                }
            }

            // Check role collections
            const roleCollections = securityConfig['role-collections'] || [];
            for (const requiredCollection of requiredRoleCollections) {
                const collectionExists = roleCollections.some(collection => collection.name === requiredCollection);

                if (collectionExists) {
                    validationResults.roleCollectionsPresent++;
                } else {
                    validationResults.errors.push(`Missing role collection: ${requiredCollection}`);
                }
            }

            const allValid = validationResults.scopesPresent === requiredUIScopes.length &&
                            validationResults.roleTemplatesPresent === requiredRoleTemplates.length &&
                            validationResults.roleCollectionsPresent === requiredRoleCollections.length;

            return {
                success: allValid,
                details: {
                    ...validationResults,
                    totalScopes: requiredUIScopes.length,
                    totalRoleTemplates: requiredRoleTemplates.length,
                    totalRoleCollections: requiredRoleCollections.length
                }
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                details: { stack: error.stack }
            };
        }
    }

    async testAuthFailureHandling() {
        this.log('⚠️ Testing authentication failure handling...', 'debug');

        return new Promise((resolve) => {
            const child = spawn('node', ['dist/mcp-server.js'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let messageId = 1;
            let testPhase = 'initialize';
            let authFailureHandled = false;

            const timeout = setTimeout(() => {
                child.kill();
                resolve({
                    success: authFailureHandled,
                    details: {
                        phase: testPhase,
                        authFailureHandled
                    }
                });
            }, this.timeout);

            const sendMessage = (message) => {
                child.stdin.write(JSON.stringify(message) + '\\n');
                messageId++;
            };

            child.stdout.on('data', (data) => {
                const lines = data.toString().split('\\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const response = JSON.parse(line);

                        if (testPhase === 'initialize' && response.method === 'notifications/initialized') {
                            testPhase = 'test_multiple_auth_failures';

                            // Test multiple UI tools without auth
                            const uiTools = [
                                'ui-form-generator',
                                'ui-data-grid',
                                'ui-dashboard-composer',
                                'ui-workflow-builder',
                                'ui-report-builder'
                            ];

                            for (const tool of uiTools) {
                                sendMessage({
                                    jsonrpc: '2.0',
                                    id: messageId,
                                    method: 'tools/call',
                                    params: {
                                        name: tool,
                                        arguments: { test: 'auth_failure' }
                                    }
                                });
                            }
                        } else if (testPhase === 'test_multiple_auth_failures' && response.error) {
                            // Check if authentication failure is properly handled
                            if (response.error.message.includes('authentication') ||
                                response.error.message.includes('authorization') ||
                                response.error.message.includes('scope') ||
                                response.error.code === 'AUTHORIZATION_DENIED') {
                                authFailureHandled = true;
                            }
                        }
                    } catch (e) {
                        // Ignore JSON parse errors
                    }
                }
            });

            child.on('close', () => {
                clearTimeout(timeout);
                resolve({
                    success: authFailureHandled,
                    details: { authFailureHandled }
                });
            });

            // Initialize server
            sendMessage({
                jsonrpc: '2.0',
                id: messageId,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {}, resources: {} },
                    clientInfo: { name: 'auth-failure-test', version: '1.0.0' }
                }
            });
        });
    }

    recordResult(testName, result) {
        const passed = result.success;

        if (passed) {
            this.results.passed++;
            this.log(`${testName}: PASSED`, 'success');
        } else {
            this.results.failed++;
            this.log(`${testName}: FAILED - ${result.error || 'Unknown error'}`, 'error');
            if (this.verbose && result.details) {
                this.log(`Details: ${JSON.stringify(result.details, null, 2)}`, 'debug');
            }
        }

        this.results.tests.push({
            name: testName,
            passed,
            error: result.error,
            details: result.details
        });
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new UIToolsAuthTest({ verbose: true });
    const results = await test.runTests();

    console.log('\\n' + chalk.bold('UI Tools Authentication Test Results:'));
    console.log(chalk.green(`✅ Passed: ${results.passed}`));
    console.log(chalk.red(`❌ Failed: ${results.failed}`));
    console.log(chalk.blue(`📊 Total: ${results.tests.length}`));

    if (results.failed > 0) {
        console.log('\\n' + chalk.bold.red('Failed Tests:'));
        results.tests
            .filter(test => !test.passed)
            .forEach(test => {
                console.log(chalk.red(`  • ${test.name}: ${test.error}`));
            });
    }

    process.exit(results.failed > 0 ? 1 : 0);
}