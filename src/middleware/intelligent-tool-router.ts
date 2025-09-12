import { WorkflowConfigLoader } from "../utils/workflow-config-loader.js";
import { Logger } from "../utils/logger.js";

export interface RoutingResult {
    selectedTool: string;
    confidence: number;
    reason: string;
    suggestedSequence?: string[];
}

/**
 * Intelligent Tool Router - Analyzes user requests and selects optimal tools
 * 
 * Uses configuration from tool-routing-rules.json to:
 * 1. Match natural language patterns
 * 2. Detect direct OData queries
 * 3. Identify performance or process analysis needs
 * 4. Suggest optimal workflow sequences
 */
export class IntelligentToolRouter {
    private workflowConfig: WorkflowConfigLoader;
    private logger: Logger;

    constructor() {
        this.workflowConfig = WorkflowConfigLoader.getInstance();
        this.logger = new Logger('IntelligentToolRouter');
    }

    /**
     * Analyze user request and recommend the best tool to use
     */
    public analyzeRequest(userRequest: string, context?: any): RoutingResult {
        const request = userRequest.toLowerCase().trim();
        this.logger.debug(`Analyzing user request: "${userRequest}"`);

        // Load routing configuration
        const config = this.workflowConfig.loadConfig();

        // 1. Check for direct OData query patterns
        const directQueryMatch = this.checkDirectQueryPatterns(request, config.toolSelectionRules.directQueryPatterns);
        if (directQueryMatch.matched) {
            return {
                selectedTool: 'execute-entity-operation',
                confidence: 0.95,
                reason: `Direct OData query detected: ${directQueryMatch.pattern}`,
                suggestedSequence: config.workflowSequences.directExecution?.map((step: any) => step.tool) || ['execute-entity-operation']
            };
        }

        // 2. Check for performance optimization patterns
        const performanceMatch = this.checkPatterns(request, config.toolSelectionRules.performancePatterns);
        if (performanceMatch.matched) {
            return {
                selectedTool: 'query-performance-optimizer',
                confidence: 0.9,
                reason: `Performance optimization request detected: ${performanceMatch.pattern}`,
                suggestedSequence: ['query-performance-optimizer', 'execute-entity-operation']
            };
        }

        // 3. Check for business process analysis patterns
        const processMatch = this.checkPatterns(request, config.toolSelectionRules.processPatterns);
        if (processMatch.matched) {
            return {
                selectedTool: 'business-process-insights',
                confidence: 0.9,
                reason: `Business process analysis request detected: ${processMatch.pattern}`,
                suggestedSequence: config.workflowSequences.businessProcessAnalysis?.map((step: any) => step.tool) || [
                    'execute-entity-operation', 
                    'business-process-insights'
                ]
            };
        }

        // 4. Check for natural language patterns (Italian/English)
        const italianMatch = this.checkPatterns(request, config.toolSelectionRules.naturalLanguagePatterns.italian);
        const englishMatch = this.checkPatterns(request, config.toolSelectionRules.naturalLanguagePatterns.english);
        
        if (italianMatch.matched || englishMatch.matched) {
            const matchedPattern = italianMatch.matched ? italianMatch.pattern : englishMatch.pattern;
            const language = italianMatch.matched ? 'Italian' : 'English';
            
            return {
                selectedTool: 'natural-query-builder',
                confidence: 0.85,
                reason: `Natural language query detected (${language}): ${matchedPattern}`,
                suggestedSequence: config.workflowSequences.naturalLanguageAnalytics?.map((step: any) => step.tool) || [
                    'natural-query-builder', 
                    'execute-entity-operation', 
                    'smart-data-analysis'
                ]
            };
        }

        // 5. Default fallback - assume natural language
        return {
            selectedTool: 'natural-query-builder',
            confidence: 0.6,
            reason: 'No specific patterns matched - defaulting to natural language processing',
            suggestedSequence: ['natural-query-builder', 'execute-entity-operation']
        };
    }

    /**
     * Get suggested workflow sequence based on detected intent
     */
    public getSuggestedWorkflow(routingResult: RoutingResult, includeDiscovery: boolean = true): string[] {
        const config = this.workflowConfig.loadConfig();
        
        // Add discovery phase if needed
        const discoveryPhase = includeDiscovery ? [
            'search-sap-services',
            'discover-service-entities', 
            'get-entity-schema'
        ] : [];

        // Return discovery + suggested sequence
        return [...discoveryPhase, ...(routingResult.suggestedSequence || [routingResult.selectedTool])];
    }

    /**
     * Check if request matches direct OData query patterns
     */
    private checkDirectQueryPatterns(request: string, patterns: string[]): { matched: boolean; pattern?: string } {
        for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(request)) {
                return { matched: true, pattern };
            }
        }
        return { matched: false };
    }

    /**
     * Check if request matches any pattern in the given list
     */
    private checkPatterns(request: string, patterns: string[]): { matched: boolean; pattern?: string } {
        for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(request)) {
                return { matched: true, pattern };
            }
        }
        return { matched: false };
    }

    /**
     * Validate if the current workflow sequence is optimal
     */
    public validateWorkflowSequence(currentTool: string, previousTools: string[], userRequest: string): {
        isOptimal: boolean;
        recommendation?: string;
        nextSuggestedTool?: string;
    } {
        const routingResult = this.analyzeRequest(userRequest);
        const suggestedSequence = routingResult.suggestedSequence || [];
        
        const currentIndex = previousTools.length;
        const expectedTool = suggestedSequence[currentIndex];
        
        if (expectedTool && currentTool !== expectedTool) {
            return {
                isOptimal: false,
                recommendation: `Consider using '${expectedTool}' instead of '${currentTool}' for better results`,
                nextSuggestedTool: expectedTool
            };
        }

        // Suggest next tool in sequence
        const nextTool = suggestedSequence[currentIndex + 1];
        return {
            isOptimal: true,
            nextSuggestedTool: nextTool
        };
    }

    /**
     * Get routing statistics for monitoring and optimization
     */
    public getRoutingStats(): any {
        const config = this.workflowConfig.loadConfig();
        return {
            totalPatterns: {
                italian: config.toolSelectionRules.naturalLanguagePatterns.italian.length,
                english: config.toolSelectionRules.naturalLanguagePatterns.english.length,
                directQuery: config.toolSelectionRules.directQueryPatterns.length,
                performance: config.toolSelectionRules.performancePatterns.length,
                process: config.toolSelectionRules.processPatterns.length
            },
            availableSequences: Object.keys(config.workflowSequences || {}),
            lastConfigUpdate: config.lastUpdated
        };
    }
}