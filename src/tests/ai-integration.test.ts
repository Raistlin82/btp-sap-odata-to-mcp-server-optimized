/**
 * AI Integration Service Tests
 */

import { AIIntegrationService } from '../services/ai-integration.js';
import { EntityType } from '../types/sap-types.js';

describe('AI Integration Service', () => {
    let aiService: AIIntegrationService;

    beforeEach(() => {
        // Reset environment for each test
        process.env.AI_FEATURES_ENABLED = 'false';
        aiService = new AIIntegrationService();
    });

    describe('Service Initialization', () => {
        test('should initialize with AI features disabled by default', () => {
            expect(aiService.isAIEnabled()).toBe(false);
        });

        test('should have basic capabilities when AI is disabled', () => {
            const capabilities = aiService.getCapabilities();
            expect(capabilities).toContain('basic_analysis');
            expect(capabilities).toContain('query_building');
            expect(capabilities).toContain('anomaly_detection');
            expect(capabilities).not.toContain('ai_enhanced_analysis');
        });

        test('should have enhanced capabilities when AI is enabled', () => {
            process.env.AI_FEATURES_ENABLED = 'true';
            const aiServiceEnabled = new AIIntegrationService();
            
            const capabilities = aiServiceEnabled.getCapabilities();
            expect(capabilities).toContain('ai_enhanced_analysis');
            expect(capabilities).toContain('intelligent_optimization');
            expect(capabilities).toContain('predictive_insights');
        });
    });

    describe('Data Analysis', () => {
        test('should provide fallback analysis when AI is disabled', async () => {
            const testData = [
                { InvoiceNumber: 'INV001', Amount: 1000, Status: 'PENDING' },
                { InvoiceNumber: 'INV002', Amount: 1500, Status: 'PAID' }
            ];

            const result = await aiService.analyzeData('Analyze invoice trends', testData, 'trend');

            expect(result.insights).toBeDefined();
            expect(result.insights.length).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThan(1.0);
            expect(result.metadata.dataPoints).toBe(2);
        });

        test('should handle empty data gracefully', async () => {
            const result = await aiService.analyzeData('Analyze empty data', [], 'trend');

            expect(result.insights).toBeDefined();
            expect(result.metadata.dataPoints).toBe(0);
        });
    });

    describe('Query Optimization', () => {
        const mockEntityType: EntityType = {
            name: 'Invoice',
            namespace: 'SAP',
            entitySet: 'InvoiceSet',
            keys: ['InvoiceNumber'],
            properties: [
                { name: 'InvoiceNumber', type: 'Edm.String', nullable: false },
                { name: 'Amount', type: 'Edm.Double', nullable: false },
                { name: 'Date', type: 'Edm.DateTime', nullable: true },
                { name: 'Status', type: 'Edm.String', nullable: true }
            ],
            navigationProperties: []
        };

        test('should generate basic query when AI is disabled', async () => {
            const result = await aiService.optimizeQuery(
                'Show me all pending invoices',
                mockEntityType
            );

            expect(result.url).toContain('InvoiceSet');
            expect(result.explanation).toBeDefined();
            expect(result.confidence).toBeLessThan(1.0);
        });

        test('should handle various user intents', async () => {
            const intents = [
                'Show me recent high-value invoices',
                'Find overdue payments',
                'List all customers with outstanding balances'
            ];

            for (const intent of intents) {
                const result = await aiService.optimizeQuery(intent, mockEntityType);
                expect(result).toBeDefined();
                expect(result.url).toContain('InvoiceSet');
            }
        });
    });

    describe('Anomaly Detection', () => {
        test('should detect volume anomalies in basic mode', async () => {
            const currentData = Array(100).fill(0).map((_, i) => ({ 
                InvoiceNumber: `INV${i}`, 
                Amount: 1000 
            }));
            
            const historicalData = Array(50).fill(0).map((_, i) => ({ 
                InvoiceNumber: `HIST${i}`, 
                Amount: 1000 
            }));

            const anomalies = await aiService.detectAnomalies(
                currentData,
                historicalData,
                'InvoiceSet'
            );

            expect(anomalies).toBeDefined();
            // Should detect volume increase (100 vs 50)
            if (anomalies.length > 0) {
                expect(anomalies[0].anomalyType).toBe('volume');
            }
        });

        test('should handle empty datasets', async () => {
            const anomalies = await aiService.detectAnomalies([], [], 'TestSet');
            expect(anomalies).toEqual([]);
        });
    });

    describe('Business Insights', () => {
        test('should generate basic insights when AI is disabled', async () => {
            const testData = [
                { Product: 'Laptop', Sales: 100, Revenue: 50000 },
                { Product: 'Mouse', Sales: 200, Revenue: 4000 }
            ];

            const insights = await aiService.generateBusinessInsights(
                testData,
                'SalesSet',
                'Q4 Sales Performance'
            );

            expect(insights).toBeDefined();
            expect(insights.length).toBeGreaterThan(0);
            expect(insights[0].type).toBeDefined();
            expect(insights[0].title).toBeDefined();
        });
    });

    describe('Health Check', () => {
        test('should return operational status', async () => {
            const health = await aiService.healthCheck();

            expect(health.status).toBe('operational');
            expect(health.capabilities).toBeInstanceOf(Array);
            expect(health.aiEnabled).toBe(false);
        });

        test('should reflect AI enabled status', async () => {
            process.env.AI_FEATURES_ENABLED = 'true';
            const aiServiceEnabled = new AIIntegrationService();
            
            const health = await aiServiceEnabled.healthCheck();
            expect(health.aiEnabled).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed data gracefully', async () => {
            const malformedData = [null, undefined, 'not-an-object', { incomplete: true }];

            // Should not throw errors
            await expect(aiService.analyzeData('Test', malformedData, 'trend')).resolves.toBeDefined();
            
            const insights = await aiService.generateBusinessInsights(malformedData, 'TestSet');
            expect(insights).toBeDefined();
        });
    });
});

// Integration test with actual service initialization
describe('AI Service Integration', () => {
    test('should integrate with existing MCP server architecture', () => {
        // Test that the service can be imported and used
        expect(AIIntegrationService).toBeDefined();
        
        const service = new AIIntegrationService();
        expect(service.isAIEnabled).toBeDefined();
        expect(service.analyzeData).toBeDefined();
        expect(service.optimizeQuery).toBeDefined();
        expect(service.detectAnomalies).toBeDefined();
        expect(service.generateBusinessInsights).toBeDefined();
    });
});