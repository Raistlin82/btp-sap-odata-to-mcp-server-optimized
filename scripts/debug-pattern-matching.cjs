#!/usr/bin/env node

/**
 * Debug Pattern Matching - Identifica quale pattern fa match con le richieste
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Debug Pattern Matching...\n');

// Carica configurazione
const configPath = path.join(process.cwd(), 'config/tool-routing-rules.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Test input problematici
const testInputs = [
    "Mostra tutti i prodotti con prezzo > 100",
    "Get customers from Germany",
    "Quali servizi SAP sono disponibili?",
    "Show me the available SAP services",
    "La query è molto lenta, come posso ottimizzarla?"
];

function testPatternCategory(input, patterns, categoryName) {
    console.log(`\n📂 ${categoryName} Patterns:`);
    patterns.forEach((patternObj, index) => {
        const pattern = typeof patternObj === 'string' ? patternObj : patternObj.pattern;
        const regex = new RegExp(pattern, 'i');
        const matches = regex.test(input);
        console.log(`   ${matches ? '✅' : '❌'} Pattern ${index + 1}: "${pattern}" ${matches ? '(MATCH!)' : ''}`);
    });
}

testInputs.forEach(input => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing: "${input}"`);
    console.log(`${'='.repeat(80)}`);

    // Test direct query patterns
    testPatternCategory(input, config.toolSelectionRules.directQueryPatterns, 'Direct Query');

    // Test performance patterns
    testPatternCategory(input, config.toolSelectionRules.performancePatterns, 'Performance');

    // Test process patterns
    testPatternCategory(input, config.toolSelectionRules.processPatterns, 'Process');

    // Test UI patterns Italian
    if (config.toolSelectionRules.uiPatterns?.italian) {
        testPatternCategory(input, config.toolSelectionRules.uiPatterns.italian, 'UI (Italian)');
    }

    // Test UI patterns English
    if (config.toolSelectionRules.uiPatterns?.english) {
        testPatternCategory(input, config.toolSelectionRules.uiPatterns.english, 'UI (English)');
    }

    // Test natural language patterns Italian
    testPatternCategory(input, config.toolSelectionRules.naturalLanguagePatterns.italian, 'Natural Language (Italian)');

    // Test natural language patterns English
    testPatternCategory(input, config.toolSelectionRules.naturalLanguagePatterns.english, 'Natural Language (English)');
});

console.log('\n' + '='.repeat(80));
console.log('🎯 Summary: Check which patterns are matching when they shouldn\'t');
console.log('🔧 Fix: Adjust patterns to be more specific');
console.log('='.repeat(80));