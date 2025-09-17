#!/usr/bin/env node

/**
 * Comprehensive Tool Routing Test - Verifica che tutti i tool passino attraverso sap-smart-query
 */

const { IntelligentToolRouter } = require('../dist/middleware/intelligent-tool-router.js');

console.log('🧪 Testing ALL Tools Routing Through sap-smart-query...\n');

// Test cases per tutti i tipi di richieste
const testCases = [
    // UI Tools (dovrebbero andare a sap-smart-query)
    {
        category: "UI Tools",
        tests: [
            {
                input: "Crea un form per i clienti",
                expectedTool: "sap-smart-query",
                expectedUiIntent: "ui-form-generator",
                description: "Form creation (IT)"
            },
            {
                input: "Create a dashboard for sales data",
                expectedTool: "sap-smart-query",
                expectedUiIntent: "ui-dashboard-composer",
                description: "Dashboard creation (EN)"
            },
            {
                input: "Genera un report per analisi vendite",
                expectedTool: "sap-smart-query",
                expectedUiIntent: "ui-report-builder",
                description: "Report creation (IT)"
            },
            {
                input: "Build a workflow for approval process",
                expectedTool: "sap-smart-query",
                expectedUiIntent: "ui-workflow-builder",
                description: "Workflow creation (EN)"
            }
        ]
    },

    // Data Operations (dovrebbero andare a execute-entity-operation o natural-query-builder)
    {
        category: "Data Operations",
        tests: [
            {
                input: "Mostra tutti i prodotti con prezzo > 100",
                expectedTool: "natural-query-builder",
                expectedUiIntent: undefined,
                description: "Natural language query (IT)"
            },
            {
                input: "Get customers from Germany",
                expectedTool: "natural-query-builder",
                expectedUiIntent: undefined,
                description: "Natural language query (EN)"
            },
            {
                input: "$filter=Price gt 100",
                expectedTool: "execute-entity-operation",
                expectedUiIntent: undefined,
                description: "Direct OData query"
            },
            {
                input: "$select=Name,Price&$orderby=Price desc",
                expectedTool: "execute-entity-operation",
                expectedUiIntent: undefined,
                description: "OData with select and orderby"
            }
        ]
    },

    // Service Discovery (dovrebbero andare ai tool appropriati)
    {
        category: "Service Discovery",
        tests: [
            {
                input: "Quali servizi SAP sono disponibili?",
                expectedTool: "search-sap-services",
                expectedUiIntent: undefined,
                description: "Service catalog request (IT)"
            },
            {
                input: "Show me the available SAP services",
                expectedTool: "search-sap-services",
                expectedUiIntent: undefined,
                description: "Service catalog request (EN)"
            },
            {
                input: "Mostrami le entità del servizio vendite",
                expectedTool: "discover-service-entities",
                expectedUiIntent: undefined,
                description: "Entity discovery (IT)"
            },
            {
                input: "What fields does the Product entity have?",
                expectedTool: "discover-service-entities",
                expectedUiIntent: undefined,
                description: "Schema request (EN)"
            }
        ]
    },

    // Performance & Analytics (dovrebbero andare ai tool specifici)
    {
        category: "Performance & Analytics",
        tests: [
            {
                input: "La query è molto lenta, come posso ottimizzarla?",
                expectedTool: "query-performance-optimizer",
                expectedUiIntent: undefined,
                description: "Performance optimization (IT)"
            },
            {
                input: "Dashboard KPI vendite mensili",
                expectedTool: "sap-smart-query",
                expectedUiIntent: "ui-dashboard-composer",
                description: "KPI dashboard (IT)"
            },
            {
                input: "Real-time streaming of order updates",
                expectedTool: "realtime-data-stream",
                expectedUiIntent: undefined,
                description: "Real-time data (EN)"
            },
            {
                input: "Forecast sales for next quarter",
                expectedTool: "predictive-analytics-engine",
                expectedUiIntent: undefined,
                description: "Predictive analytics (EN)"
            }
        ]
    }
];

// Initialize router
const router = new IntelligentToolRouter();

// Test Results
const results = [];
let totalTests = 0;
let passedTests = 0;

console.log('🎯 Running Comprehensive Routing Tests:\n');

testCases.forEach((category) => {
    console.log(`\n📂 ${category.category}\n${'='.repeat(50)}`);

    category.tests.forEach((testCase) => {
        totalTests++;
        console.log(`\n📋 Test: ${testCase.description}`);
        console.log(`   Input: "${testCase.input}"`);

        try {
            const result = router.analyzeRequest(testCase.input);

            const toolMatch = result.selectedTool === testCase.expectedTool;
            const uiIntentMatch = testCase.expectedUiIntent ?
                result.uiIntent === testCase.expectedUiIntent :
                result.uiIntent === undefined;

            const overallSuccess = toolMatch && uiIntentMatch;

            if (overallSuccess) passedTests++;

            console.log(`   Tool: ${result.selectedTool} ${toolMatch ? '✅' : `❌ (expected: ${testCase.expectedTool})`}`);

            if (testCase.expectedUiIntent) {
                console.log(`   UI Intent: ${result.uiIntent || 'none'} ${uiIntentMatch ? '✅' : `❌ (expected: ${testCase.expectedUiIntent})`}`);
            }

            console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
            console.log(`   Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}`);

            // Check if UI requests go through sap-smart-query
            if (testCase.expectedUiIntent && !toolMatch) {
                console.log(`   ⚠️  WARNING: UI request not routing through sap-smart-query!`);
            }

            results.push({
                category: category.category,
                test: testCase.description,
                passed: overallSuccess,
                expectedTool: testCase.expectedTool,
                actualTool: result.selectedTool,
                expectedUiIntent: testCase.expectedUiIntent,
                actualUiIntent: result.uiIntent
            });

        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            results.push({
                category: category.category,
                test: testCase.description,
                passed: false,
                error: error.message
            });
        }
    });
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('🧪 COMPREHENSIVE ROUTING TEST RESULTS');
console.log('='.repeat(60));

const successRate = (passedTests / totalTests) * 100;

console.log(`\n📊 Overall Results:`);
console.log(`   ✅ Passed: ${passedTests}/${totalTests}`);
console.log(`   ❌ Failed: ${totalTests - passedTests}/${totalTests}`);
console.log(`   💯 Success Rate: ${successRate.toFixed(1)}%`);

// Category breakdown
const categoryResults = {};
results.forEach(r => {
    if (!categoryResults[r.category]) {
        categoryResults[r.category] = { passed: 0, total: 0 };
    }
    categoryResults[r.category].total++;
    if (r.passed) categoryResults[r.category].passed++;
});

console.log(`\n📈 Results by Category:`);
Object.entries(categoryResults).forEach(([category, stats]) => {
    const catRate = (stats.passed / stats.total) * 100;
    console.log(`   ${category}: ${stats.passed}/${stats.total} (${catRate.toFixed(0)}%)`);
});

// Failed tests details
if (totalTests - passedTests > 0) {
    console.log(`\n❌ Failed Tests Details:`);
    results
        .filter(r => !r.passed)
        .forEach(result => {
            console.log(`\n   Category: ${result.category}`);
            console.log(`   Test: ${result.test}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else {
                console.log(`   Expected: ${result.expectedTool}${result.expectedUiIntent ? ' → ' + result.expectedUiIntent : ''}`);
                console.log(`   Actual: ${result.actualTool}${result.actualUiIntent ? ' → ' + result.actualUiIntent : ''}`);
            }
        });
}

// UI Tools routing check
const uiTests = results.filter(r => r.expectedUiIntent);
const uiPassedThroughSmartQuery = uiTests.filter(r => r.actualTool === 'sap-smart-query').length;

console.log(`\n🎨 UI Tools Routing Analysis:`);
console.log(`   Total UI requests: ${uiTests.length}`);
console.log(`   Routed through sap-smart-query: ${uiPassedThroughSmartQuery}`);
console.log(`   Direct routing (incorrect): ${uiTests.length - uiPassedThroughSmartQuery}`);

if (uiPassedThroughSmartQuery === uiTests.length) {
    console.log(`   ✅ All UI tools correctly route through sap-smart-query!`);
} else {
    console.log(`   ⚠️  ${uiTests.length - uiPassedThroughSmartQuery} UI tools are not routing through sap-smart-query`);
}

// Overall assessment
console.log('\n' + '='.repeat(60));
if (successRate >= 90) {
    console.log(`🎉 EXCELLENT! Routing system is working perfectly.`);
} else if (successRate >= 75) {
    console.log(`✅ GOOD! Most routing patterns are working correctly.`);
} else if (successRate >= 60) {
    console.log(`⚠️  FAIR! Some routing patterns need attention.`);
} else {
    console.log(`🚨 CRITICAL! Major routing issues detected.`);
}

console.log(`\n🔗 Key Requirement: All UI tools MUST route through sap-smart-query`);
console.log(`📝 Configuration: config/tool-routing-rules.json`);

// Exit with appropriate code
process.exit(totalTests - passedTests === 0 ? 0 : 1);