#!/usr/bin/env node

/**
 * Debug AI Tool Execution - Find the exact failure point
 */

import { NaturalQueryBuilderTool } from './dist/tools/ai-enhanced-tools.js';

async function debugAITool() {
    console.log('🔍 Debugging AI Tool Execution\n');

    try {
        console.log('1. Creating NaturalQueryBuilderTool instance...');
        const tool = new NaturalQueryBuilderTool();
        console.log('   ✅ Tool instance created successfully');
        
        console.log('\n2. Checking tool properties...');
        console.log(`   - name: ${tool.name}`);
        console.log(`   - description: ${tool.description}`);
        console.log(`   - inputSchema: ${JSON.stringify(tool.inputSchema, null, 2).slice(0, 200)}...`);
        
        console.log('\n3. Preparing test parameters...');
        const params = {
            naturalQuery: "Find all customers",
            entityType: "Customer", 
            serviceId: "CustomerService"
        };
        console.log(`   - Parameters: ${JSON.stringify(params, null, 2)}`);
        
        console.log('\n4. Executing tool...');
        const result = await tool.execute(params);
        
        console.log('\n✅ TOOL EXECUTION SUCCESS!');
        console.log('   Result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.log('\n❌ TOOL EXECUTION FAILED!');
        console.log('   Error type:', error.constructor.name);
        console.log('   Error message:', error.message);
        console.log('   Stack trace:', error.stack);
        
        // Check if it's a specific import error
        if (error.message.includes('import') || error.message.includes('module')) {
            console.log('\n🔍 This looks like a module import error');
            console.log('   Checking if ai-query-builder service is available...');
            
            try {
                const { AIQueryBuilderService } = await import('./dist/services/ai-query-builder.js');
                console.log('   ✅ AIQueryBuilderService import successful');
                
                const queryBuilder = new AIQueryBuilderService();
                console.log('   ✅ AIQueryBuilderService instance created');
                
            } catch (importError) {
                console.log('   ❌ AIQueryBuilderService import failed:', importError.message);
            }
        }
        
        // Check if it's an async/await issue
        if (error.message.includes('async') || error.message.includes('await')) {
            console.log('\n🔍 This looks like an async/await execution error');
        }
        
        // Check if it's a dependency issue
        if (error.message.includes('Cannot find')) {
            console.log('\n🔍 This looks like a missing dependency error');
        }
    }
}

// Run the debug
debugAITool().catch(console.error);