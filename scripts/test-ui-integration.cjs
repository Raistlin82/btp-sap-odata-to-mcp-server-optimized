#!/usr/bin/env node

/**
 * Practical UI Integration Test Script
 * Tests the actual implementation without mocking
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Starting UI Integration Test Suite...\n');

// Test Results Tracker
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

function logTest(name, status, details = '') {
    testResults.total++;
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ ${name}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${name} - ${details}`);
    }
    testResults.details.push({ name, status, details });
}

// 1. File Structure Tests
console.log('📁 Testing File Structure...');

const requiredFiles = [
    'src/tools/ui/ui-form-generator-tool.ts',
    'src/tools/ui/ui-data-grid-tool.ts',
    'src/tools/ui/ui-dashboard-composer-tool.ts',
    'src/tools/ui/ui-workflow-builder-tool.ts',
    'src/tools/ui/ui-report-builder-tool.ts',
    'src/ui/types/ui-types.ts',
    'src/ui/engines/ui-rendering-engine.ts',
    'src/ui/components/ui-component-library.ts',
    'src/core/sap-entity-manager.ts',
    'src/middleware/authentication-validator.ts'
];

requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        logTest(`File exists: ${file}`, 'PASS');
    } else {
        logTest(`File exists: ${file}`, 'FAIL', 'File not found');
    }
});

// 2. TypeScript Compilation Test
console.log('\n🔧 Testing TypeScript Compilation...');

try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    logTest('TypeScript compilation', 'PASS');
} catch (error) {
    logTest('TypeScript compilation', 'FAIL', 'Compilation errors found');
    console.log('   Compilation output:', error.stdout?.toString() || error.message);
}

// 3. UI Tool Registration Test
console.log('\n📋 Testing UI Tool Registration...');

try {
    // Check if UI tools are properly registered in hierarchical registry
    const registryPath = path.join(process.cwd(), 'src/tools/hierarchical-tool-registry.ts');
    const registryContent = fs.readFileSync(registryPath, 'utf8');

    const uiTools = [
        'ui-form-generator',
        'ui-data-grid',
        'ui-dashboard-composer',
        'ui-workflow-builder',
        'ui-report-builder'
    ];

    uiTools.forEach(tool => {
        if (registryContent.includes(`"${tool}"`)) {
            logTest(`UI Tool registered: ${tool}`, 'PASS');
        } else {
            logTest(`UI Tool registered: ${tool}`, 'FAIL', 'Not found in registry');
        }
    });

} catch (error) {
    logTest('UI Tool Registration Check', 'FAIL', error.message);
}

// 4. UI Types Validation
console.log('\n🎨 Testing UI Types...');

try {
    const typesPath = path.join(process.cwd(), 'src/ui/types/ui-types.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf8');

    const requiredTypes = [
        'ReportConfig',
        'DrillDownLevel',
        'ReportFilter',
        'ReportChart',
        'WorkflowAction',
        'FormConfig',
        'GridConfig',
        'DashboardConfig'
    ];

    requiredTypes.forEach(type => {
        if (typesContent.includes(`export interface ${type}`)) {
            logTest(`Type definition: ${type}`, 'PASS');
        } else {
            logTest(`Type definition: ${type}`, 'FAIL', 'Interface not found');
        }
    });

} catch (error) {
    logTest('UI Types Validation', 'FAIL', error.message);
}

// 5. Authentication & Authorization Test
console.log('\n🔐 Testing Authentication Setup...');

try {
    // Check xs-security.json for UI scopes
    const xsSecurityPath = path.join(process.cwd(), 'xs-security.json');
    if (fs.existsSync(xsSecurityPath)) {
        const xsSecurity = JSON.parse(fs.readFileSync(xsSecurityPath, 'utf8'));

        const requiredScopes = ['ui.forms', 'ui.grids', 'ui.dashboards', 'ui.workflows', 'ui.reports'];
        const definedScopes = xsSecurity.scopes?.map(s => s.name) || [];

        requiredScopes.forEach(scope => {
            // Check for scope with $XSAPPNAME prefix (standard in SAP BTP)
            const scopeExists = definedScopes.some(definedScope =>
                definedScope === scope || definedScope === `$XSAPPNAME.${scope}`
            );

            if (scopeExists) {
                logTest(`Security scope: ${scope}`, 'PASS');
            } else {
                logTest(`Security scope: ${scope}`, 'FAIL', 'Scope not defined');
            }
        });

        // Check role templates
        const requiredRoles = ['MCPUIUser', 'MCPUIAnalyst', 'MCPUIDesigner'];
        const definedRoles = xsSecurity['role-templates']?.map(r => r.name) || [];

        requiredRoles.forEach(role => {
            if (definedRoles.includes(role)) {
                logTest(`Role template: ${role}`, 'PASS');
            } else {
                logTest(`Role template: ${role}`, 'FAIL', 'Role not defined');
            }
        });

    } else {
        logTest('xs-security.json exists', 'FAIL', 'File not found');
    }

} catch (error) {
    logTest('Authentication Setup', 'FAIL', error.message);
}

// 6. UI Tool Routing Configuration Test
console.log('\n🧠 Testing UI Tool Routing...');

try {
    const routingPath = path.join(process.cwd(), 'config/tool-routing-rules.json');
    if (fs.existsSync(routingPath)) {
        const routing = JSON.parse(fs.readFileSync(routingPath, 'utf8'));

        // Check for UI patterns
        if (routing.toolSelectionRules?.uiPatterns) {
            logTest('UI patterns configured', 'PASS');

            if (routing.toolSelectionRules.uiPatterns.italian?.length > 0) {
                logTest('Italian UI patterns', 'PASS');
            } else {
                logTest('Italian UI patterns', 'FAIL', 'No Italian patterns found');
            }

            if (routing.toolSelectionRules.uiPatterns.english?.length > 0) {
                logTest('English UI patterns', 'PASS');
            } else {
                logTest('English UI patterns', 'FAIL', 'No English patterns found');
            }
        } else {
            logTest('UI patterns configured', 'FAIL', 'uiPatterns not found in routing rules');
        }

    } else {
        logTest('Routing config exists', 'FAIL', 'tool-routing-rules.json not found');
    }

} catch (error) {
    logTest('UI Tool Routing Configuration', 'FAIL', error.message);
}

// 7. Integration Points Test
console.log('\n🔗 Testing Integration Points...');

try {
    const registryPath = path.join(process.cwd(), 'src/tools/hierarchical-tool-registry.ts');
    const registryContent = fs.readFileSync(registryPath, 'utf8');

    // Check for UI suggestion integration
    if (registryContent.includes('generateUIToolSuggestions')) {
        logTest('UI suggestions in execute-entity-operation', 'PASS');
    } else {
        logTest('UI suggestions in execute-entity-operation', 'FAIL', 'Function not found');
    }

    if (registryContent.includes('generateEntityDiscoveryUIToolSuggestions')) {
        logTest('UI suggestions in entity discovery', 'PASS');
    } else {
        logTest('UI suggestions in entity discovery', 'FAIL', 'Function not found');
    }

    // Check intelligent router integration
    const routerPath = path.join(process.cwd(), 'src/middleware/intelligent-tool-router.ts');
    const routerContent = fs.readFileSync(routerPath, 'utf8');

    if (routerContent.includes('suggestUIToolForWorkflow')) {
        logTest('UI suggestions in intelligent router', 'PASS');
    } else {
        logTest('UI suggestions in intelligent router', 'FAIL', 'Function not found');
    }

} catch (error) {
    logTest('Integration Points Test', 'FAIL', error.message);
}

// 8. HTML Generation Test
console.log('\n🎨 Testing HTML Generation...');

try {
    const registryPath = path.join(process.cwd(), 'src/tools/hierarchical-tool-registry.ts');
    const registryContent = fs.readFileSync(registryPath, 'utf8');

    const htmlGenerators = [
        'generateFormHTML',
        'generateDataGridHTML',
        'generateDashboardHTML',
        'generateWorkflowHTML',
        'generateReportHTML'
    ];

    htmlGenerators.forEach(generator => {
        if (registryContent.includes(generator)) {
            logTest(`HTML generator: ${generator}`, 'PASS');
        } else {
            logTest(`HTML generator: ${generator}`, 'FAIL', 'Function not found');
        }
    });

    // Check for SAP Fiori styling
    if (registryContent.includes('sap_horizon')) {
        logTest('SAP Fiori styling integration', 'PASS');
    } else {
        logTest('SAP Fiori styling integration', 'FAIL', 'SAP Horizon theme not found');
    }

    // Check for Chart.js integration
    if (registryContent.includes('Chart.js')) {
        logTest('Chart.js integration', 'PASS');
    } else {
        logTest('Chart.js integration', 'FAIL', 'Chart.js not found');
    }

} catch (error) {
    logTest('HTML Generation Test', 'FAIL', error.message);
}

// 9. Documentation Test
console.log('\n📚 Testing Documentation...');

const docFiles = [
    'README.md',
    'examples/ui-integration-examples.md'
];

docFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('ui-form-generator') &&
            content.includes('ui-data-grid') &&
            content.includes('ui-dashboard-composer')) {
            logTest(`Documentation: ${file} contains UI tools`, 'PASS');
        } else {
            logTest(`Documentation: ${file} contains UI tools`, 'FAIL', 'UI tools not mentioned');
        }
    } else {
        logTest(`Documentation file exists: ${file}`, 'FAIL', 'File not found');
    }
});

// 10. Final Build Test
console.log('\n🏗️ Testing Final Build...');

try {
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'pipe' });
    logTest('Final build successful', 'PASS');

    // Check if build outputs exist
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
        logTest('Build output directory exists', 'PASS');

        const distFiles = fs.readdirSync(distPath);
        if (distFiles.length > 0) {
            logTest('Build output contains files', 'PASS');
        } else {
            logTest('Build output contains files', 'FAIL', 'Dist directory is empty');
        }
    } else {
        logTest('Build output directory exists', 'FAIL', 'Dist directory not found');
    }

} catch (error) {
    logTest('Final build successful', 'FAIL', error.message);
}

// Test Results Summary
console.log('\n' + '='.repeat(60));
console.log('🧪 UI INTEGRATION TEST RESULTS SUMMARY');
console.log('='.repeat(60));

console.log(`\n📊 Overall Results:`);
console.log(`   ✅ Passed: ${testResults.passed}`);
console.log(`   ❌ Failed: ${testResults.failed}`);
console.log(`   📈 Total:  ${testResults.total}`);
console.log(`   💯 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

if (testResults.failed > 0) {
    console.log(`\n❌ Failed Tests:`);
    testResults.details
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
            console.log(`   • ${test.name}: ${test.details}`);
        });
}

// Determine overall status
const successRate = (testResults.passed / testResults.total) * 100;

if (successRate >= 95) {
    console.log(`\n🎉 EXCELLENT! UI Integration is fully functional and ready for production.`);
} else if (successRate >= 85) {
    console.log(`\n✅ GOOD! UI Integration is mostly functional with minor issues.`);
} else if (successRate >= 70) {
    console.log(`\n⚠️  WARNING! UI Integration has significant issues that need attention.`);
} else {
    console.log(`\n🚨 CRITICAL! UI Integration has major problems and requires immediate fixes.`);
}

console.log(`\n🔗 For detailed integration examples, see: ./examples/ui-integration-examples.md`);
console.log(`📚 For full documentation, see: ./docs/README.md`);

// Exit with appropriate code
process.exit(testResults.failed === 0 ? 0 : 1);