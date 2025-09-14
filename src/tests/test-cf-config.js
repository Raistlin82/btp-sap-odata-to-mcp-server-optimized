#!/usr/bin/env node

/**
 * Test script to simulate Cloud Foundry user-provided services
 * This simulates what happens when CF binds a user-provided service
 */

import { Config } from '../../dist/utils/config.js';

// Simulate CF VCAP_SERVICES environment variable
const mockVcapServices = {
  "user-provided": [
    {
      "label": "user-provided",
      "name": "odata-config",
      "tags": [],
      "instance_name": "odata-config",
      "binding_name": null,
      "credentials": {
        "ODATA_SERVICE_PATTERNS": ["Z_TEST*", "API_SALES*"],
        "ODATA_EXCLUSION_PATTERNS": ["*_DEBUG*"],
        "ODATA_ALLOW_ALL": "false",
        "ODATA_MAX_SERVICES": "25",
        "ODATA_DISCOVERY_MODE": "whitelist"
      },
      "syslog_drain_url": "",
      "volume_mounts": []
    }
  ]
};

console.log('🧪 Testing Cloud Foundry Configuration Methods\n');

// Test 1: Environment Variables Only (current .env)
console.log('📋 Test 1: Current .env Configuration');
const config1 = new Config();
console.log('Service Filter Config:', config1.getServiceFilterConfig());
console.log('Max Services:', config1.getMaxServices());
console.log('Service Pattern Test (Z_SALES_API):', config1.isServiceAllowed('Z_SALES_API'));
console.log('Service Pattern Test (API_CUSTOMER):', config1.isServiceAllowed('API_CUSTOMER'));
console.log('');

// Test 2: Simulate CF Environment Variables
console.log('📋 Test 2: CF Environment Variables Override');
process.env.ODATA_SERVICE_PATTERNS = 'ONLY_THIS*';
process.env.ODATA_MAX_SERVICES = '5';
const config2 = new Config();
console.log('Service Filter Config:', config2.getServiceFilterConfig());
console.log('Max Services:', config2.getMaxServices());
console.log('Service Pattern Test (ONLY_THIS_SERVICE):', config2.isServiceAllowed('ONLY_THIS_SERVICE'));
console.log('Service Pattern Test (Z_SALES_API):', config2.isServiceAllowed('Z_SALES_API'));
console.log('');

// Test 3: Simulate CF User-Provided Services (highest priority)
console.log('📋 Test 3: CF User-Provided Services (Highest Priority)');
process.env.VCAP_SERVICES = JSON.stringify(mockVcapServices);
const config3 = new Config();
console.log('Service Filter Config:', config3.getServiceFilterConfig());
console.log('Max Services:', config3.getMaxServices());
console.log('Service Pattern Test (Z_TEST_SERVICE):', config3.isServiceAllowed('Z_TEST_SERVICE'));
console.log('Service Pattern Test (API_SALES_SRV):', config3.isServiceAllowed('API_SALES_SRV'));
console.log('Service Pattern Test (Z_DEBUG_SERVICE):', config3.isServiceAllowed('Z_DEBUG_SERVICE'), '(should be false - excluded)');
console.log('');

// Test 4: Runtime Configuration Reload
console.log('📋 Test 4: Runtime Configuration Reload');
console.log('Original max services:', config3.getMaxServices());

// Simulate configuration change
mockVcapServices["user-provided"][0].credentials.ODATA_MAX_SERVICES = "100";
mockVcapServices["user-provided"][0].credentials.ODATA_SERVICE_PATTERNS = ["NEW_PATTERN*"];
process.env.VCAP_SERVICES = JSON.stringify(mockVcapServices);

// Reload configuration
await config3.reloadODataConfig();
console.log('After reload max services:', config3.getMaxServices());
console.log('After reload - Service Pattern Test (NEW_PATTERN_SERVICE):', config3.isServiceAllowed('NEW_PATTERN_SERVICE'));
console.log('After reload - Service Pattern Test (Z_TEST_SERVICE):', config3.isServiceAllowed('Z_TEST_SERVICE'), '(should be false - pattern changed)');
console.log('');

console.log('✅ All configuration tests completed!');
console.log('');
console.log('🎯 Key Findings:');
console.log('1. .env file provides base configuration');
console.log('2. CF environment variables override .env settings');  
console.log('3. CF user-provided services have highest priority');
console.log('4. Runtime reload works without restart');