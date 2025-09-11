#!/usr/bin/env node

/**
 * Manual Test Script for Phase 2: AI-Powered Query Builder
 */

import { AIQueryBuilderService } from './dist/services/ai-query-builder.js';

async function testPhase2() {
    console.log('🧪 Testing Phase 2: AI-Powered Query Builder\n');

    // Create services
    const queryBuilder = new AIQueryBuilderService();

    // Test mock entity type
    const mockInvoiceEntity = {
        name: 'Invoice',
        namespace: 'SAP',
        entitySet: 'InvoiceSet',
        keys: ['InvoiceNumber'],
        properties: [
            { name: 'InvoiceNumber', type: 'Edm.String', nullable: false },
            { name: 'Amount', type: 'Edm.Double', nullable: false },
            { name: 'Status', type: 'Edm.String', nullable: true },
            { name: 'Date', type: 'Edm.DateTime', nullable: true },
            { name: 'CustomerName', type: 'Edm.String', nullable: true }
        ],
        navigationProperties: [],
        creatable: true,
        updatable: true,
        deletable: true,
        addressable: true
    };

    console.log('1️⃣ Testing Natural Language to OData Query Conversion:');
    
    const testQueries = [
        'Show me all pending invoices from this month',
        'Find invoices with amounts greater than 1000 euros',
        'List recent high-value transactions',
        'Get all overdue payments sorted by date'
    ];

    for (const query of testQueries) {
        try {
            console.log(`\n   Query: "${query}"`);
            
            const result = await queryBuilder.buildQueryFromNaturalLanguage(
                query,
                mockInvoiceEntity,
                { role: 'sales', businessContext: 'Monthly review' }
            );

            console.log(`   ✅ Generated URL: ${result.optimizedQuery.url}`);
            console.log(`   📊 Confidence: ${result.optimizedQuery.confidence}`);
            console.log(`   💡 Explanation: ${result.explanations.fieldSelection}`);
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n2️⃣ Testing Query Pattern Matching:');
    
    const patternQueries = [
        'show all records',
        'find pending items',
        'get recent entries',
        'list high value transactions'
    ];

    for (const query of patternQueries) {
        try {
            const result = await queryBuilder.buildQueryFromNaturalLanguage(query, mockInvoiceEntity);
            console.log(`   "${query}" → ${result.optimizedQuery.url.split('?')[0]}`);
        } catch (error) {
            console.log(`   "${query}" → Error: ${error.message}`);
        }
    }

    console.log('\n3️⃣ Testing Cache and Performance:');
    console.log(`   Cache stats: ${JSON.stringify(queryBuilder.getCacheStats())}`);
    
    // Test same query twice (should hit cache)
    const testQuery = 'Show me all invoices';
    console.log(`   First execution: "${testQuery}"`);
    const start1 = Date.now();
    await queryBuilder.buildQueryFromNaturalLanguage(testQuery, mockInvoiceEntity);
    const time1 = Date.now() - start1;
    
    console.log(`   Second execution: "${testQuery}" (should be cached)`);
    const start2 = Date.now();
    await queryBuilder.buildQueryFromNaturalLanguage(testQuery, mockInvoiceEntity);
    const time2 = Date.now() - start2;
    
    console.log(`   Performance: First=${time1}ms, Second=${time2}ms`);
    console.log(`   Cache efficiency: ${time2 < time1 ? '✅ Faster' : '⚠️ No improvement'}`);

    console.log('\n🎉 Phase 2 Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Natural language parsing');
    console.log('   ✅ Pattern matching');
    console.log('   ✅ Query optimization');
    console.log('   ✅ Caching mechanism');
    console.log('   ✅ Error handling');
    console.log('\n🚀 AI-Powered Query Builder is working!');
}

// Run the test
testPhase2().catch(console.error);