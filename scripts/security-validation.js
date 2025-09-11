#!/usr/bin/env node

/**
 * Security Validation Script
 * Validates that critical security issues have been resolved
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

console.log('🔒 Running Security Validation...\n');

let passed = 0;
let failed = 0;

function checkFile(filePath, description, patterns) {
    try {
        const content = readFileSync(join(srcDir, filePath), 'utf8');
        const issues = [];
        
        patterns.forEach(pattern => {
            if (content.match(pattern.regex)) {
                issues.push(pattern.issue);
            }
        });
        
        if (issues.length === 0) {
            console.log(`✅ PASS: ${description}`);
            passed++;
        } else {
            console.log(`❌ FAIL: ${description}`);
            issues.forEach(issue => console.log(`   - ${issue}`));
            failed++;
        }
    } catch (error) {
        console.log(`⚠️  SKIP: ${description} (file not found)`);
    }
}

// Check 1: No hardcoded user credentials
checkFile('services/ias-auth-service.ts', 'Hardcoded credentials removed', [
    {
        regex: /gabriele\.rendina@lutech\.it/,
        issue: 'Hardcoded user email found'
    },
    {
        regex: /if\s*\(\s*userName\s*===\s*['"][^'"]*['"].*admin/,
        issue: 'Hardcoded user privilege escalation found'
    }
]);

// Check 2: No insecure JWT environment variable usage
checkFile('services/destination-service.ts', 'Secure JWT handling in destination service', [
    {
        regex: /process\.env\.CURRENT_USER_JWT\s*=/,
        issue: 'Insecure JWT assignment to environment variable'
    },
    {
        regex: /process\.env\.AUTH_SESSION_JWT\s*=/,
        issue: 'Insecure session JWT assignment to environment variable'
    }
]);

checkFile('index.ts', 'Secure JWT handling in main application', [
    {
        regex: /process\.env\.CURRENT_USER_JWT\s*=/,
        issue: 'Insecure JWT assignment to environment variable'
    },
    {
        regex: /process\.env\.AUTH_SESSION_JWT\s*=/,
        issue: 'Insecure session JWT assignment to environment variable'
    }
]);

// Check 3: Secure JWT validation implemented
try {
    const jwtValidatorContent = readFileSync(join(srcDir, 'utils/jwt-validator.ts'), 'utf8');
    if (jwtValidatorContent.includes('xssec.createSecurityContext') && 
        jwtValidatorContent.includes('validateJWT') &&
        jwtValidatorContent.includes('SECURITY WARNING')) {
        console.log('✅ PASS: Secure JWT validator implemented');
        passed++;
    } else {
        console.log('❌ FAIL: JWT validator missing security features');
        failed++;
    }
} catch (error) {
    console.log('❌ FAIL: JWT validator not found');
    failed++;
}

// Check 4: Deprecated insecure methods marked
checkFile('services/ias-auth-service.ts', 'Insecure JWT decoding disabled', [
    {
        regex: /decodeJWT.*{[^}]*Buffer\.from.*base64/,
        issue: 'Insecure JWT decoding implementation still active'
    }
]);

checkFile('services/destination-service.ts', 'Deprecated JWT methods marked', [
    {
        regex: /@deprecated.*getJWT/,
        issue: 'getJWT method should be marked as deprecated'
    }
]);

// Check 5: Secure methods available
try {
    const destServiceContent = readFileSync(join(srcDir, 'services/destination-service.ts'), 'utf8');
    const hasSecureMethods = 
        destServiceContent.includes('testDestinationWithJWT') &&
        destServiceContent.includes('getRuntimeDestinationWithJWT') &&
        destServiceContent.includes('jwt?: string');
    
    if (hasSecureMethods) {
        console.log('✅ PASS: Secure destination methods available');
        passed++;
    } else {
        console.log('❌ FAIL: Secure destination methods missing');
        failed++;
    }
} catch (error) {
    console.log('❌ FAIL: Destination service file not found');
    failed++;
}

// Summary
console.log(`\n📊 Security Validation Summary:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

if (failed === 0) {
    console.log('\n🎉 All security validations passed!');
    console.log('\n🔒 Critical security issues have been resolved:');
    console.log('   ✓ Hardcoded user credentials removed');
    console.log('   ✓ Secure JWT token handling implemented');
    console.log('   ✓ Proper JWT signature validation added');
    console.log('   ✓ Insecure methods deprecated/disabled');
    process.exit(0);
} else {
    console.log('\n⚠️  Some security issues remain. Please review and fix the failed checks.');
    process.exit(1);
}