#!/usr/bin/env node

/**
 * Console Statement Migration Script
 * Converts console.log/error/warn statements to structured logger calls
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { glob } from 'glob';

class ConsoleMigrator {
    constructor() {
        this.changes = [];
        this.statistics = {
            filesProcessed: 0,
            consolesToLogger: 0,
            consoleErrorsToLogger: 0,
            consoleWarnsToLogger: 0,
            cliFilesSkipped: 0
        };
    }

    async migrate() {
        console.log('🔄 Starting Console Statement Migration...\n');

        // Get all TypeScript files except CLI tools
        const tsFiles = await glob('src/**/*.ts', {
            ignore: ['**/node_modules/**', '**/dist/**']
        });

        for (const file of tsFiles) {
            await this.processFile(file);
        }

        this.printSummary();
    }

    async processFile(filePath) {
        if (!existsSync(filePath)) return;

        const content = readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Skip if file doesn't contain console statements
        if (!/console\.(log|error|warn|info|debug)/.test(content)) {
            return;
        }

        console.log(`📝 Processing: ${filePath}`);
        this.statistics.filesProcessed++;

        let newContent = content;
        let hasChanges = false;

        // Check if Logger is already imported
        const hasLoggerImport = /import.*Logger.*from.*['"].*logger/.test(content);

        // Get the component name for logger instantiation
        const componentName = this.getComponentName(filePath);

        // Pattern for console.log statements (non-template strings)
        const consoleLogPattern = /console\.log\(\s*(['"`])(.*?)\1\s*\);?/g;
        const consoleLogWithDataPattern = /console\.log\(\s*(['"`])(.*?)\1\s*,\s*([^)]+)\);?/g;

        // Pattern for console.error statements
        const consoleErrorPattern = /console\.error\(\s*(['"`])(.*?)\1\s*,?\s*([^)]*)\);?/g;

        // Pattern for console.warn statements
        const consoleWarnPattern = /console\.warn\(\s*(['"`])(.*?)\1\s*,?\s*([^)]*)\);?/g;

        // Replace console.log with logger.debug
        newContent = newContent.replace(consoleLogWithDataPattern, (match, quote, message, data) => {
            this.statistics.consolesToLogger++;
            hasChanges = true;
            this.changes.push({
                file: filePath,
                from: match.trim(),
                to: `this.logger.debug('${message}', ${data.trim()});`
            });
            return `this.logger.debug('${message}', ${data.trim()});`;
        });

        newContent = newContent.replace(consoleLogPattern, (match, quote, message) => {
            this.statistics.consolesToLogger++;
            hasChanges = true;
            this.changes.push({
                file: filePath,
                from: match.trim(),
                to: `this.logger.debug('${message}');`
            });
            return `this.logger.debug('${message}');`;
        });

        // Replace console.error with logger.error
        newContent = newContent.replace(consoleErrorPattern, (match, quote, message, data) => {
            this.statistics.consoleErrorsToLogger++;
            hasChanges = true;
            const loggerCall = data.trim() ?
                `this.logger.error('${message}', { error: ${data.trim()} });` :
                `this.logger.error('${message}');`;
            this.changes.push({
                file: filePath,
                from: match.trim(),
                to: loggerCall
            });
            return loggerCall;
        });

        // Replace console.warn with logger.warn
        newContent = newContent.replace(consoleWarnPattern, (match, quote, message, data) => {
            this.statistics.consoleWarnsToLogger++;
            hasChanges = true;
            const loggerCall = data.trim() ?
                `this.logger.warn('${message}', ${data.trim()});` :
                `this.logger.warn('${message}');`;
            this.changes.push({
                file: filePath,
                from: match.trim(),
                to: loggerCall
            });
            return loggerCall;
        });

        // Add Logger import and instance if needed
        if (hasChanges && !hasLoggerImport) {
            newContent = this.addLoggerImportAndInstance(newContent, componentName);
        }

        // Write the file if there were changes
        if (hasChanges) {
            writeFileSync(filePath, newContent);
            console.log(`  ✅ Updated: ${this.changes.filter(c => c.file === filePath).length} console statements`);
        }
    }

    getComponentName(filePath) {
        const fileName = filePath.split('/').pop().replace('.ts', '');
        return fileName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    addLoggerImportAndInstance(content, componentName) {
        // Add import at the top
        const importStatement = "import { Logger } from '../utils/logger.js';\n";

        // Find the first import or the beginning of the file
        const firstImportMatch = content.match(/^import.*$/m);
        if (firstImportMatch) {
            content = content.replace(firstImportMatch[0], `${importStatement}${firstImportMatch[0]}`);
        } else {
            content = importStatement + content;
        }

        // Add logger instance to class
        const classMatch = content.match(/(export\s+)?class\s+\w+.*?\{/);
        if (classMatch) {
            const classDeclaration = classMatch[0];
            const loggerInstance = `\n    private logger = new Logger('${componentName}');\n`;
            content = content.replace(classDeclaration, classDeclaration + loggerInstance);
        }

        return content;
    }

    printSummary() {
        console.log('\n📊 MIGRATION SUMMARY');
        console.log('===================');
        console.log(`Files processed: ${this.statistics.filesProcessed}`);
        console.log(`console.log → logger.debug: ${this.statistics.consolesToLogger}`);
        console.log(`console.error → logger.error: ${this.statistics.consoleErrorsToLogger}`);
        console.log(`console.warn → logger.warn: ${this.statistics.consoleWarnsToLogger}`);
        console.log(`CLI files skipped: ${this.statistics.cliFilesSkipped}`);

        if (this.changes.length > 0) {
            console.log('\n📝 DETAILED CHANGES:');
            console.log('==================');

            const changesByFile = this.changes.reduce((acc, change) => {
                if (!acc[change.file]) acc[change.file] = [];
                acc[change.file].push(change);
                return acc;
            }, {});

            Object.entries(changesByFile).forEach(([file, fileChanges]) => {
                console.log(`\n${file}:`);
                fileChanges.forEach(change => {
                    console.log(`  - ${change.from}`);
                    console.log(`  + ${change.to}`);
                });
            });
        }

        console.log('\n🎯 NEXT STEPS:');
        console.log('=============');
        console.log('1. Review the changes above');
        console.log('2. Run: npm run build');
        console.log('3. Run: npm run test:all');
        console.log('4. Verify logging works in development mode');

        const totalMigrated = this.statistics.consolesToLogger +
                            this.statistics.consoleErrorsToLogger +
                            this.statistics.consoleWarnsToLogger;

        if (totalMigrated > 0) {
            console.log(`\n✅ Successfully migrated ${totalMigrated} console statements to structured logging!`);
        } else {
            console.log('\n✅ No console statements found that needed migration.');
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const migrator = new ConsoleMigrator();
    migrator.migrate().catch(error => {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    });
}

export { ConsoleMigrator };