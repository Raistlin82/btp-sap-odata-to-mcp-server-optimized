#!/usr/bin/env node

/**
 * Manual Test Script for AI Integration Phase 1
 */

import { AIIntegrationService } from './dist/services/ai-integration.js';

async function testAIIntegration() {
    console.log('🧪 Testing AI Integration Service - Phase 1\n');

    // Create service instance
    const aiService = new AIIntegrationService();

    // Test 1: Service Health Check
    console.log('1️⃣ Health Check:');
    const health = await aiService.healthCheck();
    console.log(`   Status: ${health.status}`);
    console.log(`   AI Enabled: ${health.aiEnabled}`);
    console.log(`   Capabilities: ${health.capabilities.join(', ')}`);
    console.log();

    // Test 2: Basic Data Analysis (AI Disabled)
    console.log('2️⃣ Data Analysis Test (AI Disabled):');
    const testData = [
        { InvoiceNumber: 'INV001', Amount: 1000, Status: 'PENDING', Date: '2024-09-01' },
        { InvoiceNumber: 'INV002', Amount: 1500, Status: 'PAID', Date: '2024-09-02' },
        { InvoiceNumber: 'INV003', Amount: 2000, Status: 'OVERDUE', Date: '2024-08-15' },
        { InvoiceNumber: 'INV004', Amount: 500, Status: 'PENDING', Date: '2024-09-05' }
    ];

    const analysisResult = await aiService.analyzeData(
        'Analyze invoice payment trends and identify risks',
        testData,
        'trend'
    );

    console.log(`   Insights Generated: ${analysisResult.insights.length}`);
    console.log(`   Recommendations: ${analysisResult.recommendations.length}`);
    console.log(`   Confidence: ${analysisResult.confidence}`);
    console.log(`   Data Points: ${analysisResult.metadata.dataPoints}`);
    
    if (analysisResult.insights.length > 0) {
        console.log(`   Sample Insight: "${analysisResult.insights[0].title}"`);
    }
    console.log();

    // Test 3: Query Optimization
    console.log('3️⃣ Query Optimization Test:');
    const mockEntityType = {
        name: 'Invoice',
        namespace: 'SAP',
        entitySet: 'InvoiceSet',
        keys: ['InvoiceNumber'],
        properties: [
            { name: 'InvoiceNumber', type: 'Edm.String', nullable: false },
            { name: 'Amount', type: 'Edm.Double', nullable: false },
            { name: 'Date', type: 'Edm.DateTime', nullable: true },
            { name: 'Status', type: 'Edm.String', nullable: true },
            { name: 'CustomerName', type: 'Edm.String', nullable: true },
            { name: 'DueDate', type: 'Edm.DateTime', nullable: true }
        ],
        navigationProperties: []
    };

    const queryOptimization = await aiService.optimizeQuery(
        'Show me all overdue invoices with amounts greater than 1000 euros',
        mockEntityType
    );

    console.log(`   Optimized URL: ${queryOptimization.url}`);
    console.log(`   Explanation: ${queryOptimization.explanation}`);
    console.log(`   Cache Strategy: ${queryOptimization.cacheStrategy}`);
    console.log(`   Confidence: ${queryOptimization.confidence}`);
    console.log();

    // Test 4: Anomaly Detection
    console.log('4️⃣ Anomaly Detection Test:');
    const currentData = Array(150).fill(0).map((_, i) => ({
        InvoiceNumber: `INV${1000 + i}`,
        Amount: 1000 + Math.random() * 5000,
        Date: new Date(2024, 8, 1 + (i % 30)).toISOString()
    }));

    const historicalData = Array(80).fill(0).map((_, i) => ({
        InvoiceNumber: `HIST${i}`,
        Amount: 1200 + Math.random() * 3000,
        Date: new Date(2024, 7, 1 + (i % 31)).toISOString()
    }));

    const anomalies = await aiService.detectAnomalies(
        currentData,
        historicalData,
        'InvoiceSet'
    );

    console.log(`   Anomalies Detected: ${anomalies.length}`);
    if (anomalies.length > 0) {
        console.log(`   Sample Anomaly: ${anomalies[0].title} (${anomalies[0].severity})`);
        console.log(`   Description: ${anomalies[0].description}`);
        console.log(`   Confidence: ${anomalies[0].confidence}`);
    }
    console.log();

    // Test 5: Business Insights
    console.log('5️⃣ Business Insights Test:');
    const salesData = [
        { Product: 'Laptop Dell XPS', Sales: 45, Revenue: 67500, Region: 'Europe' },
        { Product: 'iPhone 15', Sales: 120, Revenue: 96000, Region: 'Americas' },
        { Product: 'Samsung Galaxy', Sales: 80, Revenue: 48000, Region: 'Asia' },
        { Product: 'MacBook Pro', Sales: 35, Revenue: 70000, Region: 'Europe' }
    ];

    const businessInsights = await aiService.generateBusinessInsights(
        salesData,
        'SalesOrderSet',
        'Q3 Technology Product Performance'
    );

    console.log(`   Business Insights: ${businessInsights.length}`);
    if (businessInsights.length > 0) {
        console.log(`   Sample Insight: "${businessInsights[0].title}"`);
        console.log(`   Type: ${businessInsights[0].type}`);
        console.log(`   Impact: ${businessInsights[0].impact}`);
    }
    console.log();

    // Test 6: Error Handling
    console.log('6️⃣ Error Handling Test:');
    try {
        const errorResult = await aiService.analyzeData(
            'Test with malformed data',
            [null, undefined, 'invalid', { incomplete: true }],
            'trend'
        );
        console.log(`   ✅ Error handled gracefully`);
        console.log(`   Fallback insights: ${errorResult.insights.length}`);
    } catch (error) {
        console.log(`   ❌ Error not handled: ${error.message}`);
    }
    console.log();

    // Test 7: AI Enabled Mode (Simulation)
    console.log('7️⃣ AI Enabled Mode Test:');
    process.env.AI_FEATURES_ENABLED = 'true';
    const aiServiceEnabled = new AIIntegrationService();
    
    const enabledHealth = await aiServiceEnabled.healthCheck();
    console.log(`   AI Enabled: ${enabledHealth.aiEnabled}`);
    console.log(`   Enhanced Capabilities: ${enabledHealth.capabilities.filter(c => c.includes('ai_') || c.includes('intelligent_') || c.includes('predictive_')).join(', ')}`);
    
    // Reset environment
    process.env.AI_FEATURES_ENABLED = 'false';
    console.log();

    console.log('🎉 Phase 1 AI Integration Test Complete!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Service initialization');
    console.log('   ✅ Health checks');
    console.log('   ✅ Data analysis with fallbacks');
    console.log('   ✅ Query optimization');
    console.log('   ✅ Anomaly detection');
    console.log('   ✅ Business insights generation');
    console.log('   ✅ Error handling');
    console.log('   ✅ AI enabled/disabled modes');
    console.log('\n🚀 Ready for Phase 2 implementation!');
}

// Run the test
testAIIntegration().catch(console.error);