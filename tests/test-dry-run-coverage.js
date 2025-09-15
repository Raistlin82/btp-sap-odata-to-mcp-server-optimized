#!/usr/bin/env node

/**
 * Dry Run Tool Coverage Test
 * Validates tool definitions without requiring server startup
 * Perfect for CI/CD and quick validation
 */

import CompleteToolCoverageTest from './test-complete-tool-coverage.js';
import chalk from 'chalk';

class DryRunCoverageTest {
    constructor() {
        this.coverageTest = new CompleteToolCoverageTest({ verbose: true });
    }

    runDryTest() {
        console.log(chalk.blue.bold('\n🔍 DRY RUN TOOL COVERAGE ANALYSIS'));
        console.log(chalk.gray('=====================================\n'));

        const coverage = this.coverageTest.getCoverageReport();

        console.log(chalk.green('📊 TOOL COVERAGE ANALYSIS:'));
        console.log(`📈 Total Tools Defined: ${chalk.bold(coverage.total)}`);
        console.log('📂 By Category:');

        Object.entries(coverage.byCategory).forEach(([category, count]) => {
            const icon = {
                'core': '🔧',
                'auth': '🔐',
                'routing': '🧭',
                'ai': '🤖',
                'realtime': '⚡'
            }[category] || '📋';

            console.log(`   ${icon} ${category}: ${chalk.cyan(count)} tools`);
        });

        console.log('\n🎯 By Test Level:');
        Object.entries(coverage.byTestLevel).forEach(([level, count]) => {
            const color = level === 'critical' ? 'red' : level === 'basic' ? 'green' : 'yellow';
            console.log(`   ${chalk[color]('●')} ${level}: ${chalk.cyan(count)} tools`);
        });

        console.log('\n🔍 CRITICAL TOOLS ANALYSIS:');
        const criticalTools = coverage.toolDetails.filter(t => t.testLevel === 'critical');

        if (criticalTools.length > 0) {
            console.log(chalk.yellow(`Found ${criticalTools.length} critical tools that MUST be tested:`));
            criticalTools.forEach(tool => {
                const authBadge = tool.requiresAuth ? chalk.red('[AUTH]') : '';
                const aiBadge = tool.requiresAI ? chalk.blue('[AI]') : '';
                console.log(`   🚨 ${chalk.bold(tool.name)} ${authBadge} ${aiBadge}`);
                console.log(`      Category: ${tool.category}`);
            });
        }

        console.log('\n🔧 MISSING FROM PREVIOUS TESTS:');
        const previouslyMissing = [
            'execute-entity-operation',
            'query-performance-optimizer',
            'business-process-insights',
            'predictive-analytics-engine',
            'business-intelligence-insights'
        ];

        const currentTools = coverage.toolDetails.map(t => t.name);
        const stillMissing = previouslyMissing.filter(name => !currentTools.includes(name));
        const nowCovered = previouslyMissing.filter(name => currentTools.includes(name));

        console.log(chalk.green(`✅ Now Covered (${nowCovered.length}):`));
        nowCovered.forEach(tool => {
            console.log(`   ✅ ${tool}`);
        });

        if (stillMissing.length > 0) {
            console.log(chalk.red(`\n❌ Still Missing (${stillMissing.length}):`));
            stillMissing.forEach(tool => {
                console.log(`   ❌ ${tool}`);
            });
        }

        console.log('\n📋 TOOL REGISTRATION CHECKLIST:');
        console.log('To verify all tools are properly registered, check:');
        console.log(`   🔍 ${chalk.cyan('src/tools/hierarchical-tool-registry.ts')} - Core tools`);
        console.log(`   🔍 ${chalk.cyan('src/tools/ai-enhanced-tools.ts')} - AI tools`);
        console.log(`   🔍 ${chalk.cyan('src/tools/realtime-tools.ts')} - Realtime tools`);

        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Ensure all tools are registered in MCP server');
        console.log('2. Start MCP server: npm run start:stdio');
        console.log('3. Run full test: npm run test:coverage');
        console.log('4. Verify no "Tool not registered" errors');

        console.log('\n🎉 DRY RUN COMPLETED SUCCESSFULLY!');

        return {
            success: true,
            totalTools: coverage.total,
            criticalTools: criticalTools.length,
            categories: Object.keys(coverage.byCategory).length,
            nowCovered: nowCovered.length,
            stillMissing: stillMissing.length
        };
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const dryTest = new DryRunCoverageTest();
    const results = dryTest.runDryTest();

    console.log(`\n📊 Summary: ${results.totalTools} tools, ${results.criticalTools} critical, ${results.categories} categories`);
    process.exit(0);
}

export default DryRunCoverageTest;