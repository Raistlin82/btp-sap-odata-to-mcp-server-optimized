#!/usr/bin/env node

/**
 * Migration tool for OData Discovery Configuration
 * Converts legacy complex configuration to simplified system
 */

import fs from 'fs';
import path from 'path';

interface LegacyConfig {
  allow_all?: boolean;
  whitelist_mode?: boolean;
  blacklist_patterns?: string[];
  whitelist_services?: string[];
  environment_overrides?: {
    [env: string]: {
      allow_all?: boolean;
      strict_whitelist?: boolean;
      max_services?: number;
    };
  };
}

interface SimpleConfig {
  mode: 'pattern' | 'business' | 'environment' | 'intelligent';
  patterns?: {
    include: string[];
    exclude: string[];
  };
  business?: {
    domains: string[];
  };
  maxServices?: number;
  envVars: Record<string, string>;
}

/**
 * Migration tool for discovery configuration
 */
class DiscoveryConfigMigrator {

  /**
   * Analyze legacy configuration and suggest simple alternative
   */
  analyzeLegacyConfig(legacyConfig: LegacyConfig): {
    recommendation: SimpleConfig;
    explanation: string[];
    confidence: 'high' | 'medium' | 'low';
  } {
    const explanation: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'high';

    // Analyze the legacy configuration
    if (legacyConfig.allow_all) {
      // Allow all -> Environment mode (development)
      explanation.push('✅ allow_all=true detected → Recommend ENVIRONMENT mode');
      return {
        recommendation: {
          mode: 'environment',
          maxServices: 100,
          envVars: {
            'ODATA_DISCOVERY_MODE': 'environment',
            'NODE_ENV': 'development'
          }
        },
        explanation: [
          ...explanation,
          '📋 Environment mode automatically includes all services in development',
          '🔧 Set NODE_ENV=development for current behavior',
          '⚡ Automatic limits prevent performance issues'
        ],
        confidence: 'high'
      };
    }

    if (legacyConfig.whitelist_mode && legacyConfig.whitelist_services) {
      // Whitelist mode -> Pattern mode
      explanation.push('✅ whitelist_mode detected → Recommend PATTERN mode');

      const includePatterns = legacyConfig.whitelist_services;
      const excludePatterns = legacyConfig.blacklist_patterns || ['*Test*', '*Debug*', '*Internal*'];

      return {
        recommendation: {
          mode: 'pattern',
          patterns: {
            include: includePatterns,
            exclude: excludePatterns
          },
          maxServices: 50,
          envVars: {
            'ODATA_DISCOVERY_MODE': 'pattern',
            'ODATA_INCLUDE_PATTERNS': includePatterns.join(','),
            'ODATA_EXCLUDE_PATTERNS': excludePatterns.join(','),
            'ODATA_MAX_SERVICES': '50'
          }
        },
        explanation: [
          ...explanation,
          '📋 Whitelist converted to include patterns',
          '🔧 Blacklist converted to exclude patterns',
          '⚡ Added reasonable max_services limit'
        ],
        confidence: 'high'
      };
    }

    // Check for business-oriented services
    const businessServices = this.detectBusinessServices(legacyConfig);
    if (businessServices.length > 0) {
      explanation.push('✅ Business services detected → Recommend BUSINESS mode');

      return {
        recommendation: {
          mode: 'business',
          business: {
            domains: businessServices
          },
          maxServices: 40,
          envVars: {
            'ODATA_DISCOVERY_MODE': 'business',
            'ODATA_BUSINESS_DOMAINS': businessServices.join(','),
            'ODATA_MAX_SERVICES': '40'
          }
        },
        explanation: [
          ...explanation,
          `📋 Detected business domains: ${businessServices.join(', ')}`,
          '🔧 Business mode will auto-discover relevant services',
          '⚡ More maintainable than manual whitelist'
        ],
        confidence: 'medium'
      };
    }

    // Default fallback -> Intelligent mode
    explanation.push('ℹ️ Complex configuration detected → Recommend INTELLIGENT mode');
    confidence = 'low';

    return {
      recommendation: {
        mode: 'intelligent',
        maxServices: 25,
        envVars: {
          'ODATA_DISCOVERY_MODE': 'intelligent',
          'ODATA_INTELLIGENT_STRATEGY': 'usage_based',
          'ODATA_CHECK_PERMISSIONS': 'true',
          'ODATA_CHECK_HEALTH': 'true',
          'ODATA_MAX_SERVICES': '25'
        }
      },
      explanation: [
        ...explanation,
        '📋 Intelligent mode will auto-select best services',
        '🔧 Based on usage, permissions, and health',
        '⚡ Requires less manual configuration'
      ],
      confidence
    };
  }

  /**
   * Detect business services from configuration
   */
  private detectBusinessServices(config: LegacyConfig): string[] {
    const businessServices: string[] = [];
    const allServices = [
      ...(config.whitelist_services || []),
      // Could add more service detection logic here
    ];

    const businessPatterns = {
      sales: ['customer', 'sales', 'order', 'opportunity', 'quote'],
      finance: ['gl', 'invoice', 'payment', 'budget', 'accounting'],
      procurement: ['vendor', 'supplier', 'purchase', 'contract'],
      hr: ['employee', 'payroll', 'time', 'organization'],
      inventory: ['material', 'stock', 'warehouse', 'inventory']
    };

    for (const [domain, patterns] of Object.entries(businessPatterns)) {
      const hasBusinessServices = allServices.some(service =>
        patterns.some(pattern => service.toLowerCase().includes(pattern))
      );

      if (hasBusinessServices) {
        businessServices.push(domain);
      }
    }

    return businessServices;
  }

  /**
   * Generate migration script
   */
  generateMigrationScript(analysis: ReturnType<typeof this.analyzeLegacyConfig>): string {
    const { recommendation, explanation, confidence } = analysis;

    let script = `#!/bin/bash
# =================================================================
# OData Discovery Configuration Migration Script
# =================================================================
# Confidence Level: ${confidence.toUpperCase()}
# Generated on: ${new Date().toISOString()}
#
# EXPLANATION:
`;

    explanation.forEach(line => {
      script += `# ${line}\n`;
    });

    script += `#
# =================================================================

echo "🔄 Migrating OData Discovery Configuration..."
echo "📋 New mode: ${recommendation.mode.toUpperCase()}"
echo ""

# Set new environment variables
`;

    Object.entries(recommendation.envVars).forEach(([key, value]) => {
      script += `export ${key}="${value}"\n`;
    });

    script += `
echo "✅ Environment variables set!"
echo ""
echo "📝 Add these to your .env file:"
echo "# OData Discovery Configuration (Migrated)"
`;

    Object.entries(recommendation.envVars).forEach(([key, value]) => {
      script += `echo "${key}=${value}"\n`;
    });

    script += `
echo ""
echo "🧪 Test the new configuration:"
echo "npm run test:discovery"
echo ""
echo "📚 Documentation: docs/ODATA_DISCOVERY_STRATEGY.md"
echo "🎯 Examples: config/odata-discovery-examples.env"
`;

    return script;
  }

  /**
   * Generate .env file content
   */
  generateEnvFile(analysis: ReturnType<typeof this.analyzeLegacyConfig>): string {
    const { recommendation, explanation } = analysis;

    let content = `# =================================================================
# OData Discovery Configuration (Migrated)
# =================================================================
# Migration Date: ${new Date().toISOString()}
#
# MIGRATION NOTES:
`;

    explanation.forEach(line => {
      content += `# ${line}\n`;
    });

    content += `#
# =================================================================

`;

    Object.entries(recommendation.envVars).forEach(([key, value]) => {
      content += `${key}=${value}\n`;
    });

    content += `
# =================================================================
# Additional Configuration Options
# =================================================================

# Cache settings
ODATA_REFRESH_INTERVAL=1h

# Performance tuning
# ODATA_TIMEOUT=30000

# Debug settings
# ODATA_DEBUG_DISCOVERY=false
# LOG_LEVEL=info

# =================================================================
# Alternative Configurations
# =================================================================

# For development (include everything):
# ODATA_DISCOVERY_MODE=environment
# NODE_ENV=development

# For production (strict whitelist):
# ODATA_DISCOVERY_MODE=environment
# NODE_ENV=production
# ODATA_PRODUCTION_SERVICES=Service1,Service2,Service3

# For business users (domain-based):
# ODATA_DISCOVERY_MODE=business
# ODATA_BUSINESS_DOMAINS=sales,finance,procurement

# For intelligent discovery:
# ODATA_DISCOVERY_MODE=intelligent
# ODATA_INTELLIGENT_STRATEGY=usage_based
# ODATA_CHECK_PERMISSIONS=true
`;

    return content;
  }

  /**
   * Interactive migration wizard
   */
  async runInteractiveMigration(): Promise<void> {
    console.log('🧙‍♂️ OData Discovery Migration Wizard');
    console.log('=====================================\n');

    // Check for existing configuration
    const legacyConfigPath = 'config/legacy-discovery.json';
    let legacyConfig: LegacyConfig = {};

    if (fs.existsSync(legacyConfigPath)) {
      console.log('📁 Found legacy configuration file');
      legacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));
    } else {
      console.log('❓ No legacy configuration found, generating example migration...');
      // Create example legacy config for demonstration
      legacyConfig = {
        whitelist_mode: true,
        whitelist_services: ['CustomerService', 'SalesOrderService', 'MaterialService'],
        blacklist_patterns: ['*Test*', '*Debug*'],
        environment_overrides: {
          development: { allow_all: true },
          production: { strict_whitelist: true, max_services: 10 }
        }
      };
    }

    // Analyze configuration
    console.log('🔍 Analyzing current configuration...\n');
    const analysis = this.analyzeLegacyConfig(legacyConfig);

    // Show analysis results
    console.log('📊 ANALYSIS RESULTS:');
    console.log(`   Confidence: ${analysis.confidence.toUpperCase()}`);
    console.log(`   Recommended Mode: ${analysis.recommendation.mode.toUpperCase()}\n`);

    console.log('💡 EXPLANATION:');
    analysis.explanation.forEach(line => {
      console.log(`   ${line}`);
    });
    console.log('');

    // Show recommended configuration
    console.log('⚙️ RECOMMENDED CONFIGURATION:');
    Object.entries(analysis.recommendation.envVars).forEach(([key, value]) => {
      console.log(`   ${key}=${value}`);
    });
    console.log('');

    // Generate files
    const migrationScript = this.generateMigrationScript(analysis);
    const envContent = this.generateEnvFile(analysis);

    // Write files
    const outputDir = 'migration-output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'migrate.sh'), migrationScript);
    fs.writeFileSync(path.join(outputDir, '.env.migrated'), envContent);

    console.log('📁 FILES GENERATED:');
    console.log(`   ${outputDir}/migrate.sh - Migration script`);
    console.log(`   ${outputDir}/.env.migrated - New environment file`);
    console.log('');

    console.log('🚀 NEXT STEPS:');
    console.log('   1. Review the generated files');
    console.log('   2. Run: chmod +x migration-output/migrate.sh');
    console.log('   3. Run: ./migration-output/migrate.sh');
    console.log('   4. Test: npm run test:discovery');
    console.log('   5. Deploy with new configuration');
    console.log('');

    console.log('📚 DOCUMENTATION:');
    console.log('   Strategy: docs/ODATA_DISCOVERY_STRATEGY.md');
    console.log('   Examples: config/odata-discovery-examples.env');
  }
}

// Run the migration wizard if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new DiscoveryConfigMigrator();
  migrator.runInteractiveMigration().catch(console.error);
}

export { DiscoveryConfigMigrator };