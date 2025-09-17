import { WorkflowConfigLoader } from "../utils/workflow-config-loader.js";
import { Logger } from "../utils/logger.js";

export interface RoutingResult {
    selectedTool: string;
    confidence: number;
    reason: string;
    suggestedSequence?: string[];
    requiredScope?: string;
    requiresAuth?: boolean;
    uiIntent?: string;
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

        // 1. Check for UI patterns first (highest priority)
        const uiItalianMatch = this.checkUIPatterns(request, config.toolSelectionRules.uiPatterns?.italian || []);
        const uiEnglishMatch = this.checkUIPatterns(request, config.toolSelectionRules.uiPatterns?.english || []);

        if (uiItalianMatch.matched || uiEnglishMatch.matched) {
            const matchedUIPattern = uiItalianMatch.matched ? uiItalianMatch : uiEnglishMatch;
            const language = uiItalianMatch.matched ? 'Italian' : 'English';

            return {
                selectedTool: matchedUIPattern.tool!,
                confidence: matchedUIPattern.confidence!,
                reason: `UI pattern detected (${language}): ${matchedUIPattern.pattern} -> will route to ${matchedUIPattern.uiIntent}`,
                requiredScope: matchedUIPattern.requiredScope,
                requiresAuth: true,
                uiIntent: matchedUIPattern.uiIntent,
                suggestedSequence: this.getUIWorkflowSequence(matchedUIPattern.uiIntent!)
            };
        }

        // 2. Check for direct OData query patterns
        const directQueryMatch = this.checkDirectQueryPatterns(request, config.toolSelectionRules.directQueryPatterns);
        if (directQueryMatch.matched) {
            return {
                selectedTool: 'execute-entity-operation',
                confidence: 0.95,
                reason: `Direct OData query detected: ${directQueryMatch.pattern}`,
                suggestedSequence: config.workflowSequences.directExecution?.map((step: any) => step.tool) || ['execute-entity-operation']
            };
        }

        // 3. Check for performance optimization patterns
        const performanceMatch = this.checkPatterns(request, config.toolSelectionRules.performancePatterns);
        if (performanceMatch.matched) {
            return {
                selectedTool: 'monitor-query-performance',
                confidence: 0.9,
                reason: `Performance optimization request detected: ${performanceMatch.pattern}`,
                suggestedSequence: ['monitor-query-performance', 'execute-entity-operation']
            };
        }

        // 4. Check for business process analysis patterns
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

        // 5. Check for natural language patterns (Italian/English)
        const italianMatch = this.checkPatternsWithTool(request, config.toolSelectionRules.naturalLanguagePatterns.italian);
        const englishMatch = this.checkPatternsWithTool(request, config.toolSelectionRules.naturalLanguagePatterns.english);

        if (italianMatch.matched || englishMatch.matched) {
            const matchedPattern = italianMatch.matched ? italianMatch : englishMatch;
            const language = italianMatch.matched ? 'Italian' : 'English';

            return {
                selectedTool: matchedPattern.tool!,
                confidence: matchedPattern.confidence!,
                reason: `Natural language query detected (${language}): ${matchedPattern.pattern}`,
                suggestedSequence: this.getSequenceForTool(matchedPattern.tool!)
            };
        }

        // 6. Default fallback - assume natural language
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
     * Check if request matches any pattern with tool information
     */
    private checkPatternsWithTool(request: string, patterns: any[]): {
        matched: boolean;
        pattern?: string;
        tool?: string;
        confidence?: number;
    } {
        for (const patternConfig of patterns) {
            const regex = new RegExp(patternConfig.pattern, 'i');
            if (regex.test(request)) {
                return {
                    matched: true,
                    pattern: patternConfig.pattern,
                    tool: patternConfig.tool,
                    confidence: patternConfig.confidence
                };
            }
        }
        return { matched: false };
    }

    /**
     * Get appropriate sequence for a specific tool
     */
    private getSequenceForTool(tool: string): string[] {
        const config = this.workflowConfig.loadConfig();

        const sequenceMap: { [key: string]: string } = {
            'natural-query-builder': 'naturalLanguageAnalytics',
            'search-sap-services': 'dataExploration',
            'discover-service-entities': 'dataExploration',
            'execute-entity-operation': 'directExecution',
            'monitor-query-performance': 'performanceAnalysis',
            'realtime-data-stream': 'realtimeData',
            'predictive-analytics-engine': 'predictiveAnalytics'
        };

        const sequenceName = sequenceMap[tool];
        if (sequenceName && config.workflowSequences[sequenceName]) {
            return config.workflowSequences[sequenceName].map((step: any) => step.tool);
        }

        // Default fallback
        return [tool];
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

        // Check if we should suggest UI tools based on current workflow context
        const uiSuggestion = this.suggestUIToolForWorkflow(currentTool, previousTools, userRequest);

        return {
            isOptimal: true,
            nextSuggestedTool: nextTool || uiSuggestion
        };
    }

    /**
     * Check if request matches UI patterns and return tool details
     */
    private checkUIPatterns(request: string, patterns: any[]): {
        matched: boolean;
        pattern?: string;
        tool?: string;
        confidence?: number;
        requiredScope?: string;
        uiIntent?: string;
    } {
        for (const patternConfig of patterns) {
            const regex = new RegExp(patternConfig.pattern, 'i');
            if (regex.test(request)) {
                return {
                    matched: true,
                    pattern: patternConfig.pattern,
                    tool: patternConfig.tool,
                    confidence: patternConfig.confidence,
                    requiredScope: patternConfig.requiredScope,
                    uiIntent: patternConfig.uiIntent
                };
            }
        }
        return { matched: false };
    }

    /**
     * Get workflow sequence for UI tools
     */
    private getUIWorkflowSequence(uiTool: string): string[] {
        const config = this.workflowConfig.loadConfig();

        const uiSequenceMap: { [key: string]: string } = {
            'ui-form-generator': 'uiFormCreation',
            'ui-data-grid': 'uiDataGrid',
            'ui-dashboard-composer': 'uiDashboard',
            'ui-workflow-builder': 'uiWorkflow',
            'ui-report-builder': 'uiReport'
        };

        const sequenceName = uiSequenceMap[uiTool];
        if (sequenceName && config.workflowSequences[sequenceName]) {
            return config.workflowSequences[sequenceName].map((step: any) => step.tool);
        }

        // Fallback sequence
        return [uiTool];
    }

    /**
     * Validate user authentication and scope for UI tools
     */
    public validateUIToolAccess(tool: string, userScopes: string[], requiredScope?: string): {
        hasAccess: boolean;
        missingScope?: string;
        reason?: string;
    } {
        if (!requiredScope) {
            return { hasAccess: true };
        }

        const fullScopeName = `btp-sap-odata-to-mcp-server.${requiredScope}`;

        if (!userScopes.includes(fullScopeName)) {
            return {
                hasAccess: false,
                missingScope: fullScopeName,
                reason: `Access denied: missing required scope '${fullScopeName}' for UI tool '${tool}'`
            };
        }

        return { hasAccess: true };
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
                process: config.toolSelectionRules.processPatterns.length,
                uiItalian: config.toolSelectionRules.uiPatterns?.italian?.length || 0,
                uiEnglish: config.toolSelectionRules.uiPatterns?.english?.length || 0
            },
            availableSequences: Object.keys(config.workflowSequences || {}),
            lastConfigUpdate: config.lastUpdated
        };
    }

    /**
     * Suggest UI tools based on current workflow context
     */
    private suggestUIToolForWorkflow(currentTool: string, previousTools: string[], userRequest: string): string | undefined {
        try {
            // Map current tool to appropriate UI suggestion
            const uiSuggestionMap: { [key: string]: string[] } = {
                'execute-entity-operation': [
                    'ui-data-grid',     // For read operations with multiple results
                    'ui-form-generator', // For create/update operations
                    'ui-dashboard-composer' // For analytical views
                ],
                'discover-service-entities': [
                    'ui-form-generator', // To create forms for discovered entities
                    'ui-data-grid'       // To visualize entity data
                ],
                'get-entity-schema': [
                    'ui-form-generator', // Generate forms based on schema
                    'ui-data-grid'       // Create grids based on schema
                ],
                'search-sap-services': [
                    'ui-dashboard-composer' // Create dashboards for service overview
                ]
            };

            // Check if we're in a context that suggests UI tools
            const possibleUITools = uiSuggestionMap[currentTool];
            if (!possibleUITools) return undefined;

            // Analyze user request to determine best UI tool
            const request = userRequest.toLowerCase();

            // Check for specific UI patterns in the request
            if (request.includes('form') || request.includes('create') || request.includes('edit') || request.includes('modifica')) {
                return 'ui-form-generator';
            }

            if (request.includes('table') || request.includes('grid') || request.includes('list') || request.includes('tabella') || request.includes('elenco')) {
                return 'ui-data-grid';
            }

            if (request.includes('dashboard') || request.includes('kpi') || request.includes('metric') || request.includes('analytic')) {
                return 'ui-dashboard-composer';
            }

            if (request.includes('report') || request.includes('drill') || request.includes('analysis') || request.includes('rapporto')) {
                return 'ui-report-builder';
            }

            if (request.includes('workflow') || request.includes('process') || request.includes('approval') || request.includes('approvazione')) {
                return 'ui-workflow-builder';
            }

            // Default suggestion based on operation type
            if (currentTool === 'execute-entity-operation') {
                // If previous operations suggest data retrieval, suggest data grid
                if (previousTools.includes('discover-service-entities') || request.includes('read') || request.includes('search')) {
                    return 'ui-data-grid';
                }

                // If creating/updating, suggest form generator
                if (request.includes('create') || request.includes('update') || request.includes('insert')) {
                    return 'ui-form-generator';
                }
            }

            // Return first available UI tool as fallback
            return possibleUITools[0];

        } catch (error) {
            console.warn('Error suggesting UI tool for workflow:', error);
            return undefined;
        }
    }
}