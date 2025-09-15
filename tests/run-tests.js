#!/usr/bin/env node

/**
 * SAP MCP Server Test Runner
 * Comprehensive test suite for validating MCP server functionality
 *
 * Usage:
 *   npm run test:all              - Run all tests
 *   npm run test:protocol         - Run only MCP protocol tests
 *   npm run test:auth             - Run only authentication tests
 *   npm run test:tools            - Run only tool execution tests
 *   node tests/run-tests.js --verbose --suite=all
 */

import { MCPProtocolTest } from './test-mcp-protocol.js';
import { AuthenticationTest } from './test-authentication.js';
import { ToolExecutionTest } from './test-tool-execution.js';
import { AdvancedFeaturesTest } from './test-advanced-features.js';
import chalk from 'chalk';

class TestRunner {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.suite = options.suite || 'all';
        this.totalResults = {
            passed: 0,
            failed: 0,
            suites: [],
            startTime: Date.now()
        };
    }

    async runTests() {
        console.log(chalk.bold.blue('🧪 SAP MCP Server Test Suite'));
        console.log(chalk.gray('========================================\n'));

        try {
            // Build project first
            await this.buildProject();

            // Run test suites based on selection
            if (this.suite === 'all' || this.suite === 'protocol') {
                await this.runProtocolTests();
            }

            if (this.suite === 'all' || this.suite === 'auth') {
                await this.runAuthTests();
            }

            if (this.suite === 'all' || this.suite === 'tools') {
                await this.runToolTests();
            }

            if (this.suite === 'all' || this.suite === 'advanced') {
                await this.runAdvancedTests();
            }

            // Print final results
            this.printFinalResults();

        } catch (error) {
            console.error(chalk.red(`\n❌ Test suite failed: ${error.message}`));
            process.exit(1);
        }
    }

    async buildProject() {
        console.log(chalk.blue('🔨 Building project...'));

        const { spawn } = await import('child_process');

        return new Promise((resolve, reject) => {
            const build = spawn('npm', ['run', 'build'], {
                stdio: this.verbose ? 'inherit' : 'pipe'
            });

            build.on('close', (code) => {
                if (code === 0) {
                    console.log(chalk.green('✅ Build completed successfully\n'));
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });

            build.on('error', (error) => {
                reject(new Error(`Build error: ${error.message}`));
            });
        });
    }

    async runProtocolTests() {
        console.log(chalk.bold('📡 Running MCP Protocol Tests'));
        console.log(chalk.gray('--------------------------------'));

        const protocolTest = new MCPProtocolTest({
            verbose: this.verbose,
            timeout: 10000
        });

        const results = await protocolTest.runTest();
        this.addSuiteResults('MCP Protocol', results);
        console.log('');
    }

    async runAuthTests() {
        console.log(chalk.bold('🔐 Running Authentication Tests'));
        console.log(chalk.gray('--------------------------------'));

        const authTest = new AuthenticationTest({
            verbose: this.verbose,
            timeout: 8000
        });

        const results = await authTest.runTest();
        this.addSuiteResults('Authentication', results);
        console.log('');
    }

    async runToolTests() {
        console.log(chalk.bold('🛠️  Running Tool Execution Tests'));
        console.log(chalk.gray('----------------------------------'));

        const toolTest = new ToolExecutionTest({
            verbose: this.verbose,
            timeout: 15000
        });

        const results = await toolTest.runTest();
        this.addSuiteResults('Tool Execution', results);
        console.log('');
    }

    async runAdvancedTests() {
        console.log(chalk.bold('🚀 Running Advanced Features Tests'));
        console.log(chalk.gray('------------------------------------'));

        const advancedTest = new AdvancedFeaturesTest({
            verbose: this.verbose,
            timeout: 30000
        });

        const results = await advancedTest.runTest();
        this.addSuiteResults('Advanced Features', results);
        console.log('');
    }

    addSuiteResults(suiteName, results) {
        this.totalResults.passed += results.passed;
        this.totalResults.failed += results.failed;
        this.totalResults.suites.push({
            name: suiteName,
            ...results
        });
    }

    printFinalResults() {
        const duration = Date.now() - this.totalResults.startTime;
        const durationSeconds = (duration / 1000).toFixed(2);

        console.log(chalk.bold('🎯 FINAL TEST RESULTS'));
        console.log(chalk.gray('====================='));
        console.log(`Duration: ${durationSeconds}s\n`);

        // Suite-by-suite results
        this.totalResults.suites.forEach(suite => {
            const status = suite.failed === 0 ? chalk.green('✅ PASSED') : chalk.red('❌ FAILED');
            console.log(`${status} ${suite.name}: ${suite.passed} passed, ${suite.failed} failed`);

            if (suite.failed > 0 && this.verbose) {
                suite.tests.forEach(test => {
                    if (!test.passed) {
                        console.log(chalk.red(`  - ${test.name}: ${test.error || 'Failed'}`));
                    }
                });
            }
        });

        console.log('');

        // Overall results
        const overallStatus = this.totalResults.failed === 0 ?
            chalk.green.bold('🎉 ALL TESTS PASSED!') :
            chalk.red.bold('❌ SOME TESTS FAILED');

        console.log(overallStatus);
        console.log(`Total: ${chalk.green(this.totalResults.passed)} passed, ${chalk.red(this.totalResults.failed)} failed`);

        // Recommendations
        if (this.totalResults.failed === 0) {
            console.log(chalk.green('\n✅ SAP MCP Server is ready for deployment!'));
            console.log(chalk.gray('- MCP protocol compliance: ✅'));
            console.log(chalk.gray('- Authentication system: ✅'));
            console.log(chalk.gray('- Tool execution: ✅'));
        } else {
            console.log(chalk.yellow('\n⚠️  Please fix failing tests before deployment.'));
            console.log(chalk.gray('Run with --verbose for detailed error information.'));
        }

        // Exit with appropriate code
        process.exit(this.totalResults.failed > 0 ? 1 : 0);
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        suite: 'all'
    };

    // Parse suite selection
    const suiteArg = args.find(arg => arg.startsWith('--suite='));
    if (suiteArg) {
        options.suite = suiteArg.split('=')[1];
    }

    // Validate suite option
    const validSuites = ['all', 'protocol', 'auth', 'tools', 'advanced'];
    if (!validSuites.includes(options.suite)) {
        console.error(chalk.red(`Invalid suite: ${options.suite}`));
        console.error(chalk.gray(`Valid options: ${validSuites.join(', ')}`));
        process.exit(1);
    }

    return options;
}

// Show help
function showHelp() {
    console.log(chalk.bold('SAP MCP Server Test Runner'));
    console.log(chalk.gray('Usage:'));
    console.log('  node tests/run-tests.js [options]');
    console.log('');
    console.log(chalk.gray('Options:'));
    console.log('  --verbose, -v     Show detailed output');
    console.log('  --suite=<name>    Run specific test suite (all, protocol, auth, tools, advanced)');
    console.log('  --help, -h        Show this help');
    console.log('');
    console.log(chalk.gray('Examples:'));
    console.log('  node tests/run-tests.js --verbose');
    console.log('  node tests/run-tests.js --suite=protocol');
    console.log('  npm run test:all');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    const options = parseArgs();
    const runner = new TestRunner(options);
    runner.runTests().catch(error => {
        console.error(chalk.red(`\n💥 Unexpected error: ${error.message}`));
        process.exit(1);
    });
}