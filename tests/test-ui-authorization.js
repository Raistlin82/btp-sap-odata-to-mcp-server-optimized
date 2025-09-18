#!/usr/bin/env node

/**
 * UI Tools Authorization Test Suite
 * Tests authorization enforcement for UI tools with different scopes
 */

import chalk from 'chalk';

export class UIAuthorizationTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
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

    recordResult(testName, result) {
        this.results.tests.push({ name: testName, ...result });
        if (result.success) {
            this.results.passed++;
            this.log(`${testName}: PASSED`, 'success');
        } else {
            this.results.failed++;
            this.log(`${testName}: FAILED - ${result.error}`, 'error');
            if (result.details && this.verbose) {
                this.log(`Details: ${JSON.stringify(result.details, null, 2)}`, 'debug');
            }
        }
    }

    async runTests() {
        this.log('🔒 Testing UI Tools Authorization Enforcement', 'info');
        console.log(chalk.gray('=' .repeat(55)));

        try {
            // Test 1: MCPAuth getRequiredScope method for UI tools
            const requiredScopeResult = await this.testGetRequiredScope();
            this.recordResult('UI Tools Required Scope Mapping', requiredScopeResult);

            // Test 2: hasRequiredScope validation for UI scopes
            const hasRequiredScopeResult = await this.testHasRequiredScope();
            this.recordResult('UI Scope Authorization Validation', hasRequiredScopeResult);

            // Test 3: Authorization scenarios for different role collections
            const authScenariosResult = await this.testAuthorizationScenarios();
            this.recordResult('Role Collection Authorization Scenarios', authScenariosResult);

            // Test 4: Cross-tool authorization (user with mixed permissions)
            const crossToolResult = await this.testCrossToolAuthorization();
            this.recordResult('Cross-Tool Authorization', crossToolResult);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    async testGetRequiredScope() {
        try {
            this.log('🔍 Testing getRequiredScope method for UI tools...', 'debug');

            const MockMCPAuth = await this.createMockMCPAuth();
            const auth = new MockMCPAuth();

            const testCases = [
                { toolName: 'ui-form-generator', expectedScope: 'ui.forms' },
                { toolName: 'ui-data-grid', expectedScope: 'ui.grids' },
                { toolName: 'ui-dashboard-composer', expectedScope: 'ui.dashboards' },
                { toolName: 'ui-workflow-builder', expectedScope: 'ui.workflows' },
                { toolName: 'ui-report-builder', expectedScope: 'ui.reports' },
                // Test non-UI tools still work
                { toolName: 'search-sap-services', expectedScope: null },
                { toolName: 'execute-entity-operation', expectedScope: null } // Depends on operation parameter
            ];

            for (const testCase of testCases) {
                const actualScope = auth.getRequiredScope(testCase.toolName);
                if (actualScope !== testCase.expectedScope) {
                    return {
                        success: false,
                        error: `Wrong scope for ${testCase.toolName}`,
                        details: {
                            tool: testCase.toolName,
                            expected: testCase.expectedScope,
                            actual: actualScope
                        }
                    };
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testHasRequiredScope() {
        try {
            this.log('🔍 Testing hasRequiredScope for UI authorization...', 'debug');

            const MockMCPAuth = await this.createMockMCPAuth();
            const auth = new MockMCPAuth();

            const testCases = [
                {
                    name: 'Admin user accessing UI forms tool',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.admin'],
                    requiredScope: 'ui.forms',
                    expected: true
                },
                {
                    name: 'MCPUIUser accessing forms tool',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms'],
                    requiredScope: 'ui.forms',
                    expected: true
                },
                {
                    name: 'MCPUIUser accessing dashboards tool (denied)',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms'],
                    requiredScope: 'ui.dashboards',
                    expected: false
                },
                {
                    name: 'MCPUser accessing UI tool (denied)',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.read', 'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.write'],
                    requiredScope: 'ui.forms',
                    expected: false
                },
                {
                    name: 'MCPUIDesigner accessing all UI tools',
                    userScopes: [
                        'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms',
                        'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.grids',
                        'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.dashboards',
                        'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.workflows',
                        'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.reports'
                    ],
                    requiredScope: 'ui.workflows',
                    expected: true
                }
            ];

            for (const testCase of testCases) {
                const result = auth.hasRequiredScope(testCase.userScopes, testCase.requiredScope);
                if (result !== testCase.expected) {
                    return {
                        success: false,
                        error: `Authorization failed for: ${testCase.name}`,
                        details: {
                            testCase: testCase,
                            actualResult: result
                        }
                    };
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testAuthorizationScenarios() {
        try {
            this.log('🔍 Testing real-world authorization scenarios...', 'debug');

            const MockMCPAuth = await this.createMockMCPAuth();
            const auth = new MockMCPAuth();

            // Scenario 1: Data analyst with dashboard and report access
            const analystScopes = [
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.read',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.discover',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.dashboards',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.reports'
            ];

            const analystTests = [
                { tool: 'ui-dashboard-composer', scope: 'ui.dashboards', expected: true },
                { tool: 'ui-report-builder', scope: 'ui.reports', expected: true },
                { tool: 'ui-form-generator', scope: 'ui.forms', expected: false },
                { tool: 'ui-workflow-builder', scope: 'ui.workflows', expected: false }
            ];

            for (const test of analystTests) {
                const hasAccess = auth.hasRequiredScope(analystScopes, test.scope);
                if (hasAccess !== test.expected) {
                    return {
                        success: false,
                        error: `Analyst authorization failed for ${test.tool}`,
                        details: { test, actualResult: hasAccess }
                    };
                }
            }

            // Scenario 2: Form designer with form and grid access only
            const designerScopes = [
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.read',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.discover',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.grids'
            ];

            const designerTests = [
                { tool: 'ui-form-generator', scope: 'ui.forms', expected: true },
                { tool: 'ui-data-grid', scope: 'ui.grids', expected: true },
                { tool: 'ui-dashboard-composer', scope: 'ui.dashboards', expected: false },
                { tool: 'ui-report-builder', scope: 'ui.reports', expected: false }
            ];

            for (const test of designerTests) {
                const hasAccess = auth.hasRequiredScope(designerScopes, test.scope);
                if (hasAccess !== test.expected) {
                    return {
                        success: false,
                        error: `Designer authorization failed for ${test.tool}`,
                        details: { test, actualResult: hasAccess }
                    };
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testCrossToolAuthorization() {
        try {
            this.log('🔍 Testing cross-tool authorization scenarios...', 'debug');

            const MockMCPAuth = await this.createMockMCPAuth();
            const auth = new MockMCPAuth();

            // User with mixed permissions: read/write for data + some UI tools
            const mixedScopes = [
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.read',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.write',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.discover',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms',
                'btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.dashboards'
            ];

            const crossToolTests = [
                // Should work: data operations
                { operation: 'read', scope: 'read', expected: true },
                { operation: 'write', scope: 'write', expected: true },
                { operation: 'discover', scope: 'discover', expected: true },

                // Should work: allowed UI tools
                { operation: 'ui-form-generator', scope: 'ui.forms', expected: true },
                { operation: 'ui-dashboard-composer', scope: 'ui.dashboards', expected: true },

                // Should not work: unauthorized UI tools
                { operation: 'ui-data-grid', scope: 'ui.grids', expected: false },
                { operation: 'ui-workflow-builder', scope: 'ui.workflows', expected: false },
                { operation: 'ui-report-builder', scope: 'ui.reports', expected: false },

                // Should not work: admin/delete operations
                { operation: 'delete', scope: 'delete', expected: false }
            ];

            for (const test of crossToolTests) {
                const hasAccess = auth.hasRequiredScope(mixedScopes, test.scope);
                if (hasAccess !== test.expected) {
                    return {
                        success: false,
                        error: `Cross-tool authorization failed for ${test.operation}`,
                        details: { test, actualResult: hasAccess }
                    };
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async createMockMCPAuth() {
        // Create a minimal mock of MCPAuthManager for testing
        class MockMCPAuth {
            getRequiredScope(toolName, args) {
                // Special handling for execute-entity-operation - check operation parameter
                if (toolName === 'execute-entity-operation' && args?.operation) {
                    const operation = args.operation;
                    switch (operation) {
                        case 'read':
                        case 'read-single':
                            return 'read';
                        case 'create':
                        case 'update':
                        case 'patch':
                            return 'write';
                        case 'delete':
                            return 'delete';
                        default:
                            return 'read';
                    }
                }

                const scopeMapping = {
                    // Read operations
                    'sap_odata_read_entity': 'read',
                    'sap_odata_query_entities': 'read',
                    'sap_odata_get_metadata': 'read',

                    // Write operations
                    'sap_odata_create_entity': 'write',
                    'sap_odata_update_entity': 'write',
                    'sap_odata_patch_entity': 'write',

                    // Delete operations
                    'sap_odata_delete_entity': 'delete',

                    // Admin operations
                    'sap_admin_*': 'admin',
                    'system_admin_*': 'admin',

                    // UI Tools - require specific UI scopes
                    'ui-form-generator': 'ui.forms',
                    'ui-data-grid': 'ui.grids',
                    'ui-dashboard-composer': 'ui.dashboards',
                    'ui-workflow-builder': 'ui.workflows',
                    'ui-report-builder': 'ui.reports'
                };

                // Check for exact match first
                if (scopeMapping[toolName]) {
                    return scopeMapping[toolName];
                }

                // Check for wildcard matches
                for (const [pattern, scope] of Object.entries(scopeMapping)) {
                    if (pattern.endsWith('*') && toolName.startsWith(pattern.slice(0, -1))) {
                        return scope;
                    }
                }

                // Default to read for most operations
                if (toolName.startsWith('sap_')) {
                    return 'read';
                }

                return null;
            }

            hasRequiredScope(userScopes, requiredScope) {
                // Admin scope has all permissions
                if (userScopes.includes('admin')) {
                    return true;
                }

                // Check for exact scope match (including full scope names with prefix)
                if (userScopes.includes(requiredScope)) {
                    return true;
                }

                // For UI scopes, also check with full scope prefix
                if (requiredScope.startsWith('ui.')) {
                    const xsappname = process.env.XSUAA_XSAPPNAME || 'btp-sap-odata-to-mcp-server';
                    const fullScopeName = `${xsappname}.${requiredScope}`;
                    if (userScopes.includes(fullScopeName)) {
                        return true;
                    }
                }

                // Check scope hierarchy (write includes read, delete includes write and read)
                const scopeHierarchy = {
                    'read': ['read'],
                    'write': ['read', 'write'],
                    'delete': ['read', 'write', 'delete'],
                    'admin': ['read', 'write', 'delete', 'admin', 'discover', 'ui.forms', 'ui.grids', 'ui.dashboards', 'ui.workflows', 'ui.reports']
                };

                for (const userScope of userScopes) {
                    // Handle full scope names with prefix (including complex BTP formats)
                    let scopeToCheck = userScope;

                    // Handle BTP scope format: app-name-space!tenant.scope or app-name.scope
                    // Extract the scope part after the last occurrence of app name
                    const lastDotIndex = userScope.lastIndexOf('.');
                    if (lastDotIndex !== -1) {
                        const afterLastDot = userScope.substring(lastDotIndex + 1);

                        // Check if this looks like a UI scope (contains ui prefix in the remaining part)
                        if (userScope.includes('.ui.')) {
                            // For UI scopes like "app.ui.forms", extract "ui.forms"
                            const uiIndex = userScope.indexOf('.ui.');
                            scopeToCheck = userScope.substring(uiIndex + 1); // +1 to skip the first dot
                        } else {
                            // For simple scopes like "app.read", extract "read"
                            scopeToCheck = afterLastDot;
                        }
                    }

                    const allowedScopes = scopeHierarchy[scopeToCheck] || [scopeToCheck];
                    if (allowedScopes.includes(requiredScope)) {
                        return true;
                    }
                }

                return false;
            }
        }

        return MockMCPAuth;
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new UIAuthorizationTest({ verbose: true });

    test.runTests().then(results => {
        console.log('\n' + chalk.bold('UI Authorization Test Results:'));
        console.log(chalk.green(`✅ Passed: ${results.passed}`));
        console.log(chalk.red(`❌ Failed: ${results.failed}`));
        console.log(chalk.blue(`📊 Total: ${results.tests.length}`));

        if (results.failed > 0) {
            console.log('\n' + chalk.red('Failed Tests:'));
            results.tests.filter(test => !test.success).forEach(test => {
                console.log(chalk.red(`  • ${test.name}: ${test.error}`));
            });
            process.exit(1);
        } else {
            console.log('\n' + chalk.green('🎉 All UI authorization tests passed!'));
            process.exit(0);
        }
    }).catch(error => {
        console.error(chalk.red('Test execution failed:'), error);
        process.exit(1);
    });
}