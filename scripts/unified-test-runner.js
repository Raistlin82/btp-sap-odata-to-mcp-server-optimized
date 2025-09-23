#!/usr/bin/env node

/**
 * Unified Test Runner
 * Coordinates both Jest and custom test suites with unified reporting
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

class UnifiedTestRunner {
    constructor() {
        this.results = {
            jest: null,
            custom: null,
            total: { passed: 0, failed: 0 }
        };
    }

    async runAllTests() {
        console.log(chalk.bold.blue('🧪 Unified Test Suite Runner'));
        console.log(chalk.gray('=====================================\n'));

        try {
            // Run Jest tests
            await this.runJestTests();

            // Run custom test suite
            await this.runCustomTests();

            // Print unified summary
            this.printUnifiedSummary();

        } catch (error) {
            console.error(chalk.red(`\n❌ Test runner failed: ${error.message}`));
            process.exit(1);
        }
    }

    async runJestTests() {
        console.log(chalk.bold('🃏 Running Jest Tests'));
        console.log(chalk.gray('--------------------'));

        const jestResult = await this.executeCommand('npx', ['jest', '--verbose']);
        this.results.jest = jestResult;

        if (jestResult.success) {
            console.log(chalk.green('✅ Jest tests: PASSED\n'));
            this.results.total.passed += this.extractJestStats(jestResult.output).passed;
        } else {
            console.log(chalk.red('❌ Jest tests: FAILED\n'));
            this.results.total.failed += this.extractJestStats(jestResult.output).failed;
        }
    }

    async runCustomTests() {
        console.log(chalk.bold('🔧 Running Custom Test Suite'));
        console.log(chalk.gray('-----------------------------'));

        const customResult = await this.executeCommand('node', ['tests/run-tests.js']);
        this.results.custom = customResult;

        if (customResult.success) {
            console.log(chalk.green('✅ Custom tests: PASSED\n'));
            this.results.total.passed += this.extractCustomStats(customResult.output).passed;
        } else {
            console.log(chalk.red('❌ Custom tests: FAILED\n'));
            this.results.total.failed += this.extractCustomStats(customResult.output).failed;
        }
    }

    async executeCommand(command, args) {
        return new Promise((resolve) => {
            const child = spawn(command, args, {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                process.stdout.write(output);
            });

            child.stderr?.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                process.stderr.write(output);
            });

            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    code,
                    output: stdout,
                    error: stderr
                });
            });

            child.on('error', (error) => {
                resolve({
                    success: false,
                    code: -1,
                    output: '',
                    error: error.message
                });
            });
        });
    }

    extractJestStats(output) {
        // Extract Jest test statistics
        const passedMatch = output.match(/(\d+) passed/);
        const failedMatch = output.match(/(\d+) failed/);

        return {
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0
        };
    }

    extractCustomStats(output) {
        // Extract custom test statistics
        const passedMatch = output.match(/(\d+) passed/);
        const failedMatch = output.match(/(\d+) failed/);

        return {
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0
        };
    }

    printUnifiedSummary() {
        console.log(chalk.bold('📊 UNIFIED TEST SUMMARY'));
        console.log(chalk.gray('======================='));

        const totalTests = this.results.total.passed + this.results.total.failed;
        const overallSuccess = this.results.total.failed === 0;

        console.log(`${chalk.bold('Jest Tests:')} ${this.results.jest?.success ? chalk.green('✅') : chalk.red('❌')}`);
        console.log(`${chalk.bold('Custom Tests:')} ${this.results.custom?.success ? chalk.green('✅') : chalk.red('❌')}`);
        console.log('');

        console.log(`${chalk.bold('Total Tests:')} ${totalTests}`);
        console.log(`${chalk.green('Passed:')} ${this.results.total.passed}`);
        console.log(`${chalk.red('Failed:')} ${this.results.total.failed}`);
        console.log('');

        if (overallSuccess) {
            console.log(chalk.green.bold('🎉 ALL TESTS PASSED!'));
            console.log(chalk.green('✅ Both Jest and Custom test suites are working correctly'));
        } else {
            console.log(chalk.red.bold('❌ SOME TESTS FAILED'));
            console.log(chalk.yellow('⚠️  Please check the output above for details'));
        }

        // Exit with appropriate code
        process.exit(overallSuccess ? 0 : 1);
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new UnifiedTestRunner();
    runner.runAllTests().catch(error => {
        console.error(chalk.red(`\n💥 Runner crashed: ${error.message}`));
        process.exit(1);
    });
}

export { UnifiedTestRunner };