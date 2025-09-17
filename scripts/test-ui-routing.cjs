#!/usr/bin/env node

/**
 * UI Routing Test - Verifica il corretto routing delle richieste UI
 */

const { IntelligentToolRouter } = require('../dist/middleware/intelligent-tool-router.js');

console.log('🧪 Testing UI Routing Patterns...\n');

// Test cases specifici
const testCases = [
    {
        input: "Crea un form per visualizzare una lista di business partner da SAP",
        expectedTool: "sap-smart-query",
        expectedUiIntent: "ui-form-generator",
        description: "Form creation request (Italian)"
    },
    {
        input: "Create a form for customer data",
        expectedTool: "sap-smart-query",
        expectedUiIntent: "ui-form-generator",
        description: "Form creation request (English)"
    },
    {
        input: "Mostra una griglia con i dati dei prodotti",
        expectedTool: "sap-smart-query",
        expectedUiIntent: "ui-data-grid",
        description: "Data grid request (Italian)"
    },
    {
        input: "Display a table for sales orders",
        expectedTool: "sap-smart-query",
        expectedUiIntent: "ui-data-grid",
        description: "Data grid request (English)"
    },
    {
        input: "Mostrami solo i clienti tedeschi",
        expectedTool: "natural-query-builder",
        expectedUiIntent: undefined,
        description: "Regular data query (no UI intent)"
    }
];

// Initialize router
const router = new IntelligentToolRouter();

// Test Results
const results = [];

console.log('🎯 Running Test Cases:\n');

testCases.forEach((testCase, index) => {
    console.log(`📋 Test ${index + 1}: ${testCase.description}`);
    console.log(`   Input: "${testCase.input}"`);

    try {
        const result = router.analyzeRequest(testCase.input);

        const success = {
            tool: result.selectedTool === testCase.expectedTool,
            uiIntent: result.uiIntent === testCase.expectedUiIntent
        };

        const overallSuccess = success.tool && (testCase.expectedUiIntent ? success.uiIntent : true);

        console.log(`   ✅ Tool: ${result.selectedTool} ${success.tool ? '✓' : '✗'}`);
        if (testCase.expectedUiIntent) {
            console.log(`   ✅ UI Intent: ${result.uiIntent || 'none'} ${success.uiIntent ? '✓' : '✗'}`);
        }
        console.log(`   📊 Confidence: ${result.confidence}`);
        console.log(`   💭 Reason: ${result.reason}`);
        console.log(`   🎯 Overall: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}\n`);

        results.push({
            testCase: testCase.description,
            passed: overallSuccess,
            details: {
                expectedTool: testCase.expectedTool,
                actualTool: result.selectedTool,
                expectedUiIntent: testCase.expectedUiIntent,
                actualUiIntent: result.uiIntent,
                confidence: result.confidence,
                reason: result.reason
            }
        });

    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}\n`);
        results.push({
            testCase: testCase.description,
            passed: false,
            details: { error: error.message }
        });
    }
});

// Summary
console.log('='.repeat(60));
console.log('🧪 UI ROUTING TEST RESULTS SUMMARY');
console.log('='.repeat(60));

const passed = results.filter(r => r.passed).length;
const total = results.length;
const successRate = (passed / total) * 100;

console.log(`\n📊 Overall Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${total - passed}`);
console.log(`   📈 Total:  ${total}`);
console.log(`   💯 Success Rate: ${successRate.toFixed(1)}%`);

if (total - passed > 0) {
    console.log(`\n❌ Failed Tests:`);
    results
        .filter(r => !r.passed)
        .forEach(result => {
            console.log(`   • ${result.testCase}`);
            if (result.details.error) {
                console.log(`     Error: ${result.details.error}`);
            } else {
                console.log(`     Expected: ${result.details.expectedTool}${result.details.expectedUiIntent ? ' → ' + result.details.expectedUiIntent : ''}`);
                console.log(`     Actual: ${result.details.actualTool}${result.details.actualUiIntent ? ' → ' + result.details.actualUiIntent : ''}`);
            }
        });
}

if (successRate >= 95) {
    console.log(`\n🎉 EXCELLENT! UI routing is working perfectly.`);
} else if (successRate >= 80) {
    console.log(`\n✅ GOOD! UI routing is mostly functional with minor issues.`);
} else {
    console.log(`\n⚠️ WARNING! UI routing has significant issues that need attention.`);
}

console.log(`\n🔗 Expected behavior: UI requests should route through sap-smart-query with uiIntent field.`);

// Exit with appropriate code
process.exit(total - passed === 0 ? 0 : 1);