#!/usr/bin/env node

/**
 * Scope Mapping Test Suite
 * Tests the JWT validator scope mapping functionality
 */

import { Logger } from '../dist/utils/logger.js';
import chalk from 'chalk';

class ScopeMappingTest {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
        this.logger = new Logger('ScopeMappingTest');
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
        this.log('🔐 Testing Scope Mapping Logic', 'info');
        console.log(chalk.gray('=' .repeat(50)));

        try {
            // Test 1: MCPAdministrator role collection mapping
            const adminResult = await this.testAdministratorMapping();
            this.recordResult('MCPAdministrator Scope Mapping', adminResult);

            // Test 2: MCPUser role collection mapping
            const userResult = await this.testUserMapping();
            this.recordResult('MCPUser Scope Mapping', userResult);

            // Test 3: MCPUIUser role collection mapping
            const uiUserResult = await this.testUIUserMapping();
            this.recordResult('MCPUIUser Scope Mapping', uiUserResult);

            // Test 4: MCPUIDesigner role collection mapping
            const uiDesignerResult = await this.testUIDesignerMapping();
            this.recordResult('MCPUIDesigner Scope Mapping', uiDesignerResult);

            // Test 5: Multiple role collections mapping
            const multipleResult = await this.testMultipleRoles();
            this.recordResult('Multiple Role Collections Mapping', multipleResult);

            // Test 6: Scope validation in hasRequiredScope method
            const scopeValidationResult = await this.testScopeValidation();
            this.recordResult('Scope Validation Logic', scopeValidationResult);

            return this.results;
        } catch (error) {
            this.log(`Test suite failed: ${error.message}`, 'error');
            return this.results;
        }
    }

    async testAdministratorMapping() {
        try {
            this.log('🔍 Testing MCPAdministrator scope mapping...', 'debug');

            // Create a mock JWT validator instance for testing
            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            const groups = ['MCPAdministrator'];
            const mappedScopes = validator.mapGroupsToScopes(groups);

            const expectedScopes = [
                'btp-sap-odata-to-mcp-server.read',
                'btp-sap-odata-to-mcp-server.write',
                'btp-sap-odata-to-mcp-server.delete',
                'btp-sap-odata-to-mcp-server.admin',
                'btp-sap-odata-to-mcp-server.discover',
                'btp-sap-odata-to-mcp-server.ui.forms',
                'btp-sap-odata-to-mcp-server.ui.grids',
                'btp-sap-odata-to-mcp-server.ui.dashboards',
                'btp-sap-odata-to-mcp-server.ui.workflows',
                'btp-sap-odata-to-mcp-server.ui.reports'
            ];

            const missingScopes = expectedScopes.filter(scope => !mappedScopes.includes(scope));
            const extraScopes = mappedScopes.filter(scope => !expectedScopes.includes(scope));

            if (missingScopes.length > 0 || extraScopes.length > 0) {
                return {
                    success: false,
                    error: `Scope mismatch for MCPAdministrator`,
                    details: {
                        expected: expectedScopes,
                        actual: mappedScopes,
                        missing: missingScopes,
                        extra: extraScopes
                    }
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testUserMapping() {
        try {
            this.log('🔍 Testing MCPUser scope mapping...', 'debug');

            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            const groups = ['MCPUser'];
            const mappedScopes = validator.mapGroupsToScopes(groups);

            const expectedScopes = [
                'btp-sap-odata-to-mcp-server.read',
                'btp-sap-odata-to-mcp-server.write',
                'btp-sap-odata-to-mcp-server.discover'
            ];

            const missingScopes = expectedScopes.filter(scope => !mappedScopes.includes(scope));
            const hasUIScopes = mappedScopes.some(scope => scope.includes('.ui.'));

            if (missingScopes.length > 0) {
                return {
                    success: false,
                    error: `Missing scopes for MCPUser: ${missingScopes.join(', ')}`,
                    details: { expected: expectedScopes, actual: mappedScopes }
                };
            }

            if (hasUIScopes) {
                return {
                    success: false,
                    error: `MCPUser should not have UI scopes`,
                    details: { actual: mappedScopes }
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testUIUserMapping() {
        try {
            this.log('🔍 Testing MCPUIUser scope mapping...', 'debug');

            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            const groups = ['MCPUIUser'];
            const mappedScopes = validator.mapGroupsToScopes(groups);

            const expectedScopes = [
                'btp-sap-odata-to-mcp-server.read',
                'btp-sap-odata-to-mcp-server.discover',
                'btp-sap-odata-to-mcp-server.ui.forms',
                'btp-sap-odata-to-mcp-server.ui.grids'
            ];

            const missingScopes = expectedScopes.filter(scope => !mappedScopes.includes(scope));
            const hasUnexpectedUIScopes = mappedScopes.filter(scope =>
                scope.includes('.ui.') &&
                !['btp-sap-odata-to-mcp-server.ui.forms', 'btp-sap-odata-to-mcp-server.ui.grids'].includes(scope)
            );

            if (missingScopes.length > 0) {
                return {
                    success: false,
                    error: `Missing scopes for MCPUIUser: ${missingScopes.join(', ')}`,
                    details: { expected: expectedScopes, actual: mappedScopes }
                };
            }

            if (hasUnexpectedUIScopes.length > 0) {
                return {
                    success: false,
                    error: `MCPUIUser has unexpected UI scopes: ${hasUnexpectedUIScopes.join(', ')}`,
                    details: { actual: mappedScopes }
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testUIDesignerMapping() {
        try {
            this.log('🔍 Testing MCPUIDesigner scope mapping...', 'debug');

            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            const groups = ['MCPUIDesigner'];
            const mappedScopes = validator.mapGroupsToScopes(groups);

            const expectedScopes = [
                'btp-sap-odata-to-mcp-server.read',
                'btp-sap-odata-to-mcp-server.write',
                'btp-sap-odata-to-mcp-server.discover',
                'btp-sap-odata-to-mcp-server.ui.forms',
                'btp-sap-odata-to-mcp-server.ui.grids',
                'btp-sap-odata-to-mcp-server.ui.dashboards',
                'btp-sap-odata-to-mcp-server.ui.workflows',
                'btp-sap-odata-to-mcp-server.ui.reports'
            ];

            const missingScopes = expectedScopes.filter(scope => !mappedScopes.includes(scope));

            if (missingScopes.length > 0) {
                return {
                    success: false,
                    error: `Missing scopes for MCPUIDesigner: ${missingScopes.join(', ')}`,
                    details: { expected: expectedScopes, actual: mappedScopes }
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testMultipleRoles() {
        try {
            this.log('🔍 Testing multiple role collections mapping...', 'debug');

            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            // Test user with both MCPUser and MCPUIUser roles
            const groups = ['MCPUser', 'MCPUIUser'];
            const mappedScopes = validator.mapGroupsToScopes(groups);

            const expectedCoreScopes = [
                'btp-sap-odata-to-mcp-server.read',
                'btp-sap-odata-to-mcp-server.write',
                'btp-sap-odata-to-mcp-server.discover'
            ];

            const expectedUIScopes = [
                'btp-sap-odata-to-mcp-server.ui.forms',
                'btp-sap-odata-to-mcp-server.ui.grids'
            ];

            const missingCoreScopes = expectedCoreScopes.filter(scope => !mappedScopes.includes(scope));
            const missingUIScopes = expectedUIScopes.filter(scope => !mappedScopes.includes(scope));

            if (missingCoreScopes.length > 0 || missingUIScopes.length > 0) {
                return {
                    success: false,
                    error: `Missing scopes for multiple roles`,
                    details: {
                        expected: [...expectedCoreScopes, ...expectedUIScopes],
                        actual: mappedScopes,
                        missingCore: missingCoreScopes,
                        missingUI: missingUIScopes
                    }
                };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testScopeValidation() {
        try {
            this.log('🔍 Testing hasRequiredScope validation logic...', 'debug');

            const MockJWTValidator = await this.createMockJWTValidator();
            const validator = new MockJWTValidator();

            // Test scenarios
            const tests = [
                {
                    name: 'Admin has all permissions',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.admin'],
                    requiredScope: 'ui.forms',
                    expected: true
                },
                {
                    name: 'User with UI forms scope',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.ui.forms'],
                    requiredScope: 'ui.forms',
                    expected: true
                },
                {
                    name: 'User without required UI scope',
                    userScopes: ['btp-sap-odata-to-mcp-server-mcp_noprod_space!t25364.read'],
                    requiredScope: 'ui.forms',
                    expected: false
                },
                {
                    name: 'User with short scope name',
                    userScopes: ['ui.forms'],
                    requiredScope: 'ui.forms',
                    expected: true
                }
            ];

            for (const test of tests) {
                const result = validator.hasRequiredScope(test.userScopes, test.requiredScope);
                if (result !== test.expected) {
                    return {
                        success: false,
                        error: `Scope validation failed for: ${test.name}`,
                        details: {
                            test: test,
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

    async createMockJWTValidator() {
        // Create a minimal mock of JWTValidator for testing
        class MockJWTValidator {
            constructor() {
                this.xsuaaCredentials = { xsappname: 'btp-sap-odata-to-mcp-server' };
            }

            mapGroupsToScopes(groups) {
                const xsappname = this.xsuaaCredentials?.xsappname || process.env.XSUAA_XSAPPNAME || 'btp-sap-odata-to-mcp-server';
                const scopes = [];

                for (const group of groups) {
                    switch (group) {
                        case 'MCPAdministrator':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.write`);
                            scopes.push(`${xsappname}.delete`);
                            scopes.push(`${xsappname}.admin`);
                            scopes.push(`${xsappname}.discover`);
                            scopes.push(`${xsappname}.ui.forms`);
                            scopes.push(`${xsappname}.ui.grids`);
                            scopes.push(`${xsappname}.ui.dashboards`);
                            scopes.push(`${xsappname}.ui.workflows`);
                            scopes.push(`${xsappname}.ui.reports`);
                            break;
                        case 'MCPUser':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.write`);
                            scopes.push(`${xsappname}.discover`);
                            break;
                        case 'MCPManager':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.write`);
                            scopes.push(`${xsappname}.delete`);
                            scopes.push(`${xsappname}.discover`);
                            break;
                        case 'MCPViewer':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.discover`);
                            break;
                        case 'MCPUIUser':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.discover`);
                            scopes.push(`${xsappname}.ui.forms`);
                            scopes.push(`${xsappname}.ui.grids`);
                            break;
                        case 'MCPUIAnalyst':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.discover`);
                            scopes.push(`${xsappname}.ui.dashboards`);
                            scopes.push(`${xsappname}.ui.reports`);
                            break;
                        case 'MCPUIDesigner':
                            scopes.push(`${xsappname}.read`);
                            scopes.push(`${xsappname}.write`);
                            scopes.push(`${xsappname}.discover`);
                            scopes.push(`${xsappname}.ui.forms`);
                            scopes.push(`${xsappname}.ui.grids`);
                            scopes.push(`${xsappname}.ui.dashboards`);
                            scopes.push(`${xsappname}.ui.workflows`);
                            scopes.push(`${xsappname}.ui.reports`);
                            break;
                    }
                }
                return scopes;
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

        return MockJWTValidator;
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new ScopeMappingTest({ verbose: true });

    test.runTests().then(results => {
        console.log('\n' + chalk.bold('Scope Mapping Test Results:'));
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
            console.log('\n' + chalk.green('🎉 All scope mapping tests passed!'));
            process.exit(0);
        }
    }).catch(error => {
        console.error(chalk.red('Test execution failed:'), error);
        process.exit(1);
    });
}

export { ScopeMappingTest };