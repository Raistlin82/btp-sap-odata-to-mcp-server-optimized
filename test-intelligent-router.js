#!/usr/bin/env node

// Test script per l'Intelligent Tool Router
import { IntelligentToolRouter } from './dist/middleware/intelligent-tool-router.js';

console.log('🧪 Testing Intelligent Tool Router...\n');

const router = new IntelligentToolRouter();

// Test cases
const testCases = [
    {
        name: "Natural Language Italian",
        request: "mostra clienti ultimi 3 mesi"
    },
    {
        name: "Natural Language English", 
        request: "show me business partners created recently"
    },
    {
        name: "Direct OData Query",
        request: "BusinessPartnerSet?$filter=CreationDate ge datetime'2024-11-01'&$top=10"
    },
    {
        name: "Performance Query",
        request: "optimize slow queries in the system"
    },
    {
        name: "Process Analysis",
        request: "analyze procurement workflow bottlenecks"
    },
    {
        name: "Generic Question",
        request: "what data is available?"
    },
    {
        name: "Italian Performance",
        request: "le query sono lente, ottimizza prestazioni"
    },
    {
        name: "Mixed Query",
        request: "trova fatture in sospeso process inefficiencies"
    }
];

console.log('📊 Testing routing decisions:\n');

testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Request: "${testCase.request}"`);
    
    try {
        const result = router.analyzeRequest(testCase.request);
        console.log(`   ✅ Tool: ${result.selectedTool}`);
        console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`   💡 Reason: ${result.reason}`);
        console.log(`   🔄 Workflow: ${result.suggestedSequence?.join(' → ') || 'Single step'}`);
        
        const fullWorkflow = router.getSuggestedWorkflow(result, true);
        console.log(`   🎯 Full Flow: ${fullWorkflow.join(' → ')}`);
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
});

console.log('🔧 Router Statistics:');
try {
    const stats = router.getRoutingStats();
    console.log(JSON.stringify(stats, null, 2));
} catch (error) {
    console.log(`❌ Stats Error: ${error.message}`);
}

console.log('\n✅ Test completed!');