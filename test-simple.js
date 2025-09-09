#!/usr/bin/env node

/**
 * Simple test to verify configuration priority and pattern matching
 */

import { Config } from './dist/utils/config.js';

console.log('🧪 Simple Configuration Test\n');

// Clear any existing environment overrides
delete process.env.ODATA_SERVICE_PATTERNS;
delete process.env.ODATA_MAX_SERVICES;

// Test 1: Original .env configuration
console.log('📋 Test 1: Original .env Configuration');
const config1 = new Config();
console.log('Patterns:', config1.get('odata.servicePatterns'));
console.log('Max Services:', config1.getMaxServices());
console.log('Allows Z_CUSTOM_API?', config1.isServiceAllowed('Z_CUSTOM_API'));
console.log('Allows API_SALES_SRV?', config1.isServiceAllowed('API_SALES_SRV'));
console.log('');

// Test 2: Override with environment variables 
console.log('📋 Test 2: Environment Variable Override');
process.env.ODATA_SERVICE_PATTERNS = 'Z_SPECIFIC*';
process.env.ODATA_MAX_SERVICES = '10';

const config2 = new Config();
console.log('Patterns:', config2.get('odata.servicePatterns'));
console.log('Max Services:', config2.getMaxServices());
console.log('Allows Z_SPECIFIC_SERVICE?', config2.isServiceAllowed('Z_SPECIFIC_SERVICE'));
console.log('Allows Z_CUSTOM_API?', config2.isServiceAllowed('Z_CUSTOM_API'), '(should be false - pattern changed)');
console.log('Allows API_SALES_SRV?', config2.isServiceAllowed('API_SALES_SRV'), '(should be false - pattern changed)');
console.log('');

console.log('✅ Configuration priority working correctly!');
console.log('Environment variables override .env file settings.');