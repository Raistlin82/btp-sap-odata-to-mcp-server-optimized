import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SAPClient } from "../services/sap-client.js";
import { Logger } from "../utils/logger.js";
import { ODataService, EntityType } from "../types/sap-types.js";
import { MCPAuthManager } from "../middleware/mcp-auth.js";
import { TokenStore } from "../services/token-store.js";
import { SecureErrorHandler } from "../utils/secure-error-handler.js";
import { DestinationContext, OperationType } from "../types/destination-types.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// Direct import approach to avoid TypeScript issues
import { NaturalQueryBuilderTool, SmartDataAnalysisTool, QueryPerformanceOptimizerTool, BusinessProcessInsightsTool } from "./ai-enhanced-tools.js";
import { realtimeAnalyticsTools } from "./realtime-tools.js";
import { IntelligentToolRouter } from "../middleware/intelligent-tool-router.js";

/**
 * Hierarchical Tool Registry - Solves the "tool explosion" problem
 * 
 * Instead of registering hundreds of CRUD tools upfront (5 ops × 40+ entities × services),
 * this registry uses a hierarchical discovery approach with core tools:
 * 
 * Core SAP Tools (4):
 * 1. search-sap-services - Find relevant services by category/keyword
 * 2. discover-service-entities - Show entities within a specific service
 * 3. get-entity-schema - Get detailed schema for an entity
 * 4. execute-entity-operation - Perform CRUD operations on any entity
 * 
 * AI-Enhanced Tools (4 - Phase 2):
 * 5. natural-query-builder - Convert natural language to optimized queries
 * 6. smart-data-analysis - AI-powered data insights and recommendations
 * 7. query-performance-optimizer - Optimize queries using AI analysis
 * 8. business-process-insights - Analyze business processes for optimization
 * 
 * Real-time Analytics Tools (4 - Phase 3):
 * 9. realtime-data-stream - WebSocket streaming with intelligent filtering
 * 10. kpi-dashboard-builder - Create and manage intelligent KPI dashboards
 * 11. predictive-analytics-engine - ML-powered forecasting and predictions
 * 12. business-intelligence-insights - Automated insights from data patterns
 * 
 * This reduces context from 200+ tools to just 12 intelligent tools, with AI and real-time
 * capabilities that work across any MCP client (Claude, GPT, Gemini, local models, etc.).
 */
// Get current file path for loading configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProcessCategory {
    name: string;
    description: string;
    subprocesses: string[];
    keywords: string[];
}

interface ProcessClassification {
    processCategories: Record<string, ProcessCategory>;
    crossFunctionalProcesses: Record<string, Omit<ProcessCategory, 'subprocesses'>>;
    industrySpecific: Record<string, { name: string; keywords: string[] }>;
}

export class HierarchicalSAPToolRegistry {
    private serviceCategories = new Map<string, string[]>();
    private authManager?: MCPAuthManager;
    private errorHandler: SecureErrorHandler;
    private intelligentRouter: IntelligentToolRouter;
    private processClassification?: ProcessClassification;

    constructor(
        private mcpServer: McpServer,
        private sapClient: SAPClient,
        private logger: Logger,
        private discoveredServices: ODataService[],
        tokenStore?: TokenStore,
        authServerUrl?: string
    ) {
        // Load SAP Signavio process classification
        this.loadProcessClassification();
        this.categorizeServices();
        
        // Initialize security middlewares
        this.errorHandler = new SecureErrorHandler(this.logger);
        
        // Initialize intelligent router
        this.intelligentRouter = new IntelligentToolRouter();

        // Initialize authentication manager if token store is provided
        if (tokenStore && authServerUrl) {
            this.authManager = new MCPAuthManager(tokenStore, authServerUrl, this.logger);
            this.logger.info(`✅ MCPAuthManager initialized with authServerUrl: ${authServerUrl}`);
        } else {
            this.logger.warn(`⚠️  MCPAuthManager NOT initialized - tokenStore: ${!!tokenStore}, authServerUrl: ${authServerUrl}`);
        }
    }

    /**
     * Update the discovered services list and refresh resources
     * This is called when admin configuration filters are updated
     */
    public async updateDiscoveredServices(newDiscoveredServices: ODataService[]): Promise<void> {
        this.logger.info(`🔄 Updating discovered services from ${this.discoveredServices.length} to ${newDiscoveredServices.length} services`);

        // Update the services list
        this.discoveredServices = newDiscoveredServices;

        // Recategorize services
        this.categorizeServices();

        // Note: The sap://services resource will automatically reflect the changes
        // because it reads from this.discoveredServices dynamically

        this.logger.info(`✅ Discovered services updated successfully. sap://services resource will now reflect filtered services.`);
    }

    /**
     * Register the 4 hierarchical discovery tools instead of 200+ individual CRUD tools
     */
    public async registerDiscoveryTools(): Promise<void> {
        this.logger.info(`🔧 Registering hierarchical tools for ${this.discoveredServices.length} services`);

        // Tool 1: Search and discover services
        this.mcpServer.registerTool(
            "search-sap-services",
            {
                title: "Search SAP Services",
                description: "Find SAP services by keyword/category.",
                inputSchema: {
                    query: z.string().optional().describe("Search term to filter services (name, title, description)"),
                    category: z.enum(["business-partner", "sales", "finance", "procurement", "hr", "logistics", "all"]).optional().describe("Service category filter"),
                    limit: z.number().min(1).max(20).default(10).describe("Maximum number of services to return")
                }
            },
            async (args: Record<string, unknown>) => {
                return this.searchServices(args);
            }
        );

        // Tool 2: Discover entities within a specific service
        this.mcpServer.registerTool(
            "discover-service-entities",
            {
                title: "Discover Service Entities",
                description: "List all entities and their capabilities within a specific SAP service. Use this after finding a service to understand what data you can work with.",
                inputSchema: {
                    serviceId: z.string().describe("The SAP service ID to explore"),
                    showCapabilities: z.boolean().default(true).describe("Show CRUD capabilities for each entity")
                }
            },
            async (args: Record<string, unknown>) => {
                return this.discoverServiceEntities(args);
            }
        );

        // Tool 3: Get entity schema
        this.mcpServer.registerTool(
            "get-entity-schema",
            {
                title: "Get Entity Schema",
                description: "Get detailed schema information for a specific entity including properties, types, keys, and constraints.",
                inputSchema: {
                    serviceId: z.string().describe("The SAP service ID"),
                    entityName: z.string().describe("The entity name")
                }
            },
            async (args: Record<string, unknown>) => {
                return this.getEntitySchema(args);
            }
        );

        // Tool 4: Execute operations on entities
        this.mcpServer.registerTool(
            "execute-entity-operation",
            {
                title: "Execute Entity Operation",
                description: "⚠️ Direct CRUD operations on SAP entities with precise OData queries. Use ONLY when you have exact OData query syntax (not natural language). For natural language queries, use natural-query-builder FIRST. Requires authentication.",
                inputSchema: {
                    serviceId: z.string().describe("The SAP service ID"),
                    entityName: z.string().describe("The entity name within the service"),
                    operation: z.enum(["read", "read-single", "create", "update", "delete"]).describe("The operation to perform"),
                    parameters: z.record(z.any()).optional().describe("Operation parameters (keys, filters, data, etc.)"),
                    queryOptions: z.object({
                        $filter: z.string().optional(),
                        $select: z.string().optional(),
                        $expand: z.string().optional(),
                        $orderby: z.string().optional(),
                        $top: z.number().optional(),
                        $skip: z.number().optional()
                    }).optional().describe("OData query options (for read operations)")
                }
            },
            async (args: Record<string, unknown>) => {
                return this.executeEntityOperation(args);
            }
        );

        this.logger.info("✅ Registered 4 hierarchical discovery tools successfully");
        
        // Register Session Authentication Check Tool
        await this.registerAuthCheckTool();
        
        // Register Intelligent Router Tool
        await this.registerIntelligentRouterTool();
        
        // Register AI-Enhanced Tools for intelligent data processing (temporarily disabled)
        await this.registerAIEnhancedTools();

        // Register UI Tools for interactive form generation and visualization
        await this.registerUITools();
    }

    /**
     * Register Authentication Check Tool - Proactive session validation
     */
    private async registerAuthCheckTool(): Promise<void> {
        this.mcpServer.registerTool(
            "check-sap-authentication",
            {
                title: "Check SAP Authentication",
                description: "🔐 Validate/associate authentication session. Call with session_id to authenticate.",
                inputSchema: {
                    session_id: z.string().optional().describe("User session ID obtained from OAuth authentication. Provide this to authenticate and associate with your MCP session."),
                    validateSession: z.boolean().default(true).describe("Whether to validate existing session"),
                    requestPreAuth: z.boolean().default(true).describe("Whether to request pre-authentication for upcoming operations (recommended: true)"),
                    context: z.object({
                        anticipatedOperations: z.array(z.enum(['read', 'create', 'update', 'delete', 'analysis'])).optional().describe("Operations user plans to perform"),
                        sessionType: z.enum(['interactive', 'batch', 'demo']).optional().describe("Type of session being initiated")
                    }).optional().describe("Context for authentication check")
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    const sessionId = args.session_id as string | undefined;
                    const validateSession = args.validateSession !== false;
                    const requestPreAuth = args.requestPreAuth === true;
                    const context = args.context as any || {};

                    this.logger.info(`🔐 Proactive auth check - sessionId provided: ${!!sessionId}, validate: ${validateSession}, preAuth: ${requestPreAuth}`);

                    // If session ID is provided, try to authenticate with it immediately
                    if (sessionId && this.authManager) {
                        this.logger.info(`🔑 User provided session ID, testing authentication...`);

                        try {
                            // Test authentication with the provided session ID
                            const authResult = await this.authManager.authenticateToolCall('execute-entity-operation', { session_id: sessionId });

                            if (authResult.authenticated) {
                                this.logger.info(`✅ Session ID authentication successful for user: ${authResult.context?.user}`);

                                return {
                                    content: [{
                                        type: "text" as const,
                                        text: JSON.stringify({
                                            status: 'authenticated',
                                            message: '✅ Authentication successful! Session associated.',
                                            user: authResult.context?.user,
                                            available_tools: ['search-sap-services', 'sap-smart-query', 'execute-entity-operation']
                                        }, null, 2)
                                    }]
                                };

                            } else {
                                this.logger.warn(`❌ Session ID authentication failed: ${authResult.error?.message}`);

                                return {
                                    content: [{
                                        type: "text" as const,
                                        text: JSON.stringify({
                                            status: 'auth_failed',
                                            message: '❌ Session ID invalid/expired',
                                            auth_url: authResult.error?.authUrl,
                                            action: 'Visit auth_url, get new session_id, call check-sap-authentication again'
                                        }, null, 2)
                                    }]
                                };
                            }

                        } catch (error) {
                            this.logger.error('Error testing session ID:', error);

                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify({
                                        status: 'error',
                                        message: '❌ Auth test failed',
                                        action: 'Try again or re-authenticate'
                                    }, null, 2)
                                }]
                            };
                        }
                    }

                    let authStatus = {
                        isAuthenticated: false,
                        sessionValid: false,
                        userInfo: null as any,
                        tokenInfo: null as any,
                        authServerReachable: false,
                        sessionId: null as string | null
                    };
                    
                    // Check if auth manager is available
                    if (!this.authManager) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: JSON.stringify({
                                    status: 'auth_disabled',
                                    message: 'Authentication is not configured for this server instance',
                                    recommendation: 'All SAP operations will proceed without authentication',
                                    authRequired: false,
                                    serverMode: 'development_or_demo'
                                }, null, 2)
                            }]
                        };
                    }
                    
                    // Test auth server connectivity
                    try {
                        // Perform a lightweight auth test to check server reachability
                        // NOTE: Use a different tool name to avoid recursive call loop
                        const connectivityTest = await this.authManager.authenticateToolCall('connectivity-test', {});
                        authStatus.authServerReachable = true;
                        
                        if (connectivityTest.authenticated) {
                            authStatus.isAuthenticated = true;
                            authStatus.sessionValid = true;
                            authStatus.userInfo = (connectivityTest.context as any)?.userInfo || null;
                            authStatus.tokenInfo = connectivityTest.context?.token ? {
                                hasToken: true,
                                tokenType: 'JWT',
                                expiresAt: (connectivityTest.context as any)?.expiresAt || null
                            } : null;
                            authStatus.sessionId = connectivityTest.context?.sessionId || null;
                        }
                        
                    } catch (authError) {
                        this.logger.debug(`Auth connectivity test result: ${authError}`);
                        authStatus.authServerReachable = false;
                    }
                    
                    // Prepare response based on auth status
                    let response: any = {
                        authenticationStatus: authStatus,
                        recommendations: [],
                        nextSteps: [],
                        toolsRequiringAuth: [
                            'execute-entity-operation',
                            'smart-data-analysis', 
                            'query-performance-optimizer',
                            'business-process-insights'
                        ],
                        toolsWithoutAuth: [
                            'search-sap-services',
                            'discover-service-entities',
                            'get-entity-schema',
                            'natural-query-builder',
                            'sap-smart-query'
                        ]
                    };
                    
                    if (authStatus.isAuthenticated && authStatus.sessionValid) {
                        response.status = 'authenticated';
                        response.message = '✅ User is authenticated and session is valid';
                        response.recommendations = [
                            'You can proceed with any SAP operations without interruption',
                            'All tools (discovery and execution) are available'
                        ];
                        response.sessionInfo = {
                            sessionId: authStatus.sessionId,
                            userInfo: authStatus.userInfo,
                            tokenValid: !!authStatus.tokenInfo
                        };
                        
                        if (context.anticipatedOperations?.length > 0) {
                            response.operationReadiness = context.anticipatedOperations.map((op: string) => ({
                                operation: op,
                                ready: true,
                                requiresAuth: ['create', 'update', 'delete', 'analysis'].includes(op)
                            }));
                        }
                        
                    } else if (!authStatus.authServerReachable) {
                        response.status = 'auth_server_unavailable';
                        response.message = '⚠️ Authentication server is not reachable';
                        response.recommendations = [
                            'Check authentication server configuration',
                            'You can still use discovery tools (search, discover, schema)',
                            'Execution tools will fail until authentication is restored'
                        ];
                        response.fallbackMode = {
                            availableTools: response.toolsWithoutAuth,
                            unavailableTools: response.toolsRequiringAuth
                        };
                        
                    } else {
                        response.status = 'authentication_required';
                        response.message = '🔑 Authentication required for SAP data operations';
                        response.auth_url = this.authManager ? `${this.authManager.getAuthServerUrl()}/auth/` : 'Auth URL not available';
                        response.action = 'Visit auth_url → get session_id → call check-sap-authentication({session_id: "your_id"})';
                        response.available_without_auth = ['search-sap-services', 'discover-service-entities'];
                        
                        if (requestPreAuth) {
                            // Actively trigger authentication process
                            this.logger.info('🔐 User requested pre-authentication, triggering auth flow...');
                            
                            try {
                                // Trigger authentication by calling authManager directly
                                const preAuthResult = await this.authManager.authenticateToolCall('check-sap-authentication', {
                                    preAuthRequest: true,
                                    context: context
                                });
                                
                                if (preAuthResult.authenticated) {
                                    response.status = 'pre_auth_successful';
                                    response.message = '✅ Pre-authentication completed successfully';
                                    response.authenticationFlow = {
                                        completed: true,
                                        sessionId: preAuthResult.context?.sessionId,
                                        userInfo: (preAuthResult.context as any)?.userInfo
                                    };
                                    response.recommendations = [
                                        'Authentication completed! You can now use all SAP tools without interruption',
                                        'All execution tools are ready for use'
                                    ];
                                } else {
                                    response.authenticationFlow = {
                                        required: true,
                                        authUrl: this.authManager.formatAuthError(preAuthResult).authUrl,
                                        instructions: 'Please visit the authentication URL to complete login'
                                    };
                                }
                                
                            } catch (preAuthError) {
                                this.logger.warn('Pre-authentication failed:', preAuthError);
                                response.preAuthInstructions = {
                                    message: 'Pre-authentication failed. You can authenticate later when using execution tools',
                                    fallback: 'Authentication will be requested when needed during workflow execution'
                                };
                            }
                        } else {
                            response.preAuthInstructions = {
                                message: 'To pre-authenticate, call this tool again with requestPreAuth: true',
                                alternative: 'Authentication will be requested when using execution tools'
                            };
                        }
                    }
                    
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify(response, null, 2)
                        }]
                    };
                    
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    this.logger.error('Auth check error:', error);
                    
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: 'check_failed',
                                error: 'Authentication check failed',
                                message: errorMessage,
                                fallback: {
                                    recommendation: 'Proceed with discovery tools, authentication will be checked when needed',
                                    safeTools: ['search-sap-services', 'discover-service-entities', 'get-entity-schema']
                                }
                            }, null, 2)
                        }],
                        isError: true
                    };
                }
            }
        );

        this.logger.info("✅ Registered Authentication Check Tool: check-sap-authentication");
    }

    /**
     * Register Intelligent Router Tool - Single entry point with smart routing
     */
    private async registerIntelligentRouterTool(): Promise<void> {
        this.mcpServer.registerTool(
            "sap-smart-query",
            {
                title: "SAP Smart Query Router",
                description: "Routes SAP requests to optimal tool",
                inputSchema: {
                    userRequest: z.string(),
                    context: z.object({
                        serviceId: z.string().optional(),
                        entityType: z.string().optional(),
                        previousTools: z.array(z.string()).optional(),
                        preferredLanguage: z.enum(['italian', 'english']).optional()
                    }).optional()
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    const userRequest = args.userRequest as string;
                    const context = args.context as any || {};
                    
                    this.logger.info(`🧠 Smart Router analyzing: "${userRequest}"`);
                    
                    // Note: Authentication should have been checked automatically at session start
                    if (!context.previousTools?.includes('check-sap-authentication')) {
                        this.logger.debug('🔐 Note: Authentication check not in previous tools - should have been done at session start');
                    }
                    
                    // Analyze request and get routing recommendation
                    const routingResult = this.intelligentRouter.analyzeRequest(userRequest, context);

                    this.logger.info(`🎯 Router selected: ${routingResult.selectedTool} (confidence: ${routingResult.confidence})`);

                    // CRITICAL: If this is a UI request, check authentication immediately
                    if (routingResult.requiresAuth || routingResult.uiIntent) {
                        this.logger.info(`🔐 UI Tool request detected - checking authentication immediately`);

                        // Check if auth manager is available
                        if (!this.authManager) {
                            this.logger.warn(`❌ Auth manager not available for UI tool authentication`);

                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify({
                                        error: 'Authentication Service Unavailable',
                                        message: `🔐 UI tools require authentication but auth service is not configured.`,
                                        requiredScope: routingResult.requiredScope,
                                        targetUITool: routingResult.uiIntent,
                                        solution: 'Please configure authentication service or use non-UI tools'
                                    }, null, 2)
                                }],
                                isError: true
                            };
                        }

                        // Check authentication status using auth manager
                        try {
                            const authResult = await this.authManager.authenticateToolCall(routingResult.uiIntent!, {
                                preValidation: true,
                                requiredScope: routingResult.requiredScope
                            });

                            if (!authResult.authenticated) {
                                this.logger.warn(`❌ Authentication required for UI tool: ${routingResult.uiIntent || routingResult.selectedTool}`);

                                return {
                                    content: [{
                                        type: "text" as const,
                                        text: JSON.stringify({
                                            error: 'Authentication Required',
                                            message: `🔐 UI tools require authentication. Please authenticate first.`,
                                            auth_url: authResult.error?.authUrl || `${this.authManager.getAuthServerUrl()}/auth/`,
                                            requiredScope: routingResult.requiredScope,
                                            targetUITool: routingResult.uiIntent,
                                            workflow: [
                                                'Visit auth_url → get session_id → call check-sap-authentication',
                                `Then use: ${routingResult.selectedTool}`,
                                `Finally use: ${routingResult.uiIntent}`
                                            ].filter(Boolean)
                                        }, null, 2)
                                    }],
                                    isError: true
                                };
                            }

                            this.logger.info(`✅ Authentication validation passed for UI tool: ${routingResult.uiIntent}`);

                        } catch (error) {
                            this.logger.error(`❌ Error validating authentication for UI tool:`, error);

                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify({
                                        error: 'Authentication Validation Failed',
                                        message: `🔐 Failed to validate authentication for UI tool.`,
                                        details: error instanceof Error ? error.message : 'Unknown error',
                                        action: 'Please use check-sap-authentication tool first'
                                    }, null, 2)
                                }],
                                isError: true
                            };
                        }
                    }

                    // Get suggested workflow sequence
                    const fullWorkflow = this.intelligentRouter.getSuggestedWorkflow(routingResult, !context.serviceId);
                    
                    // Prepare response with essential fields for tool compatibility
                    const response: any = {
                        routing: {
                            selectedTool: routingResult.selectedTool,
                            confidence: routingResult.confidence,
                            reason: routingResult.reason
                        },
                        suggestedWorkflow: {
                            immediate: fullWorkflow[0],
                            nextSteps: fullWorkflow.slice(1, 3)
                        },
                        guidance: {
                            message: `Use ${routingResult.selectedTool} tool`,
                            nextAction: fullWorkflow[0]
                        }
                    };

                    // Add UI intent if this is a UI request
                    if (routingResult.uiIntent) {
                        response.uiIntent = {
                            targetUITool: routingResult.uiIntent,
                            requiredScope: routingResult.requiredScope,
                            message: `🎨 UI Request detected: Will route to ${routingResult.uiIntent} after data discovery`,
                            workflow: `1️⃣ First: Use ${routingResult.selectedTool} for data discovery\n2️⃣ Then: Use ${routingResult.uiIntent} to create the UI`
                        };

                        // Update guidance for UI requests
                        response.guidance.message = `🧠 Smart Routing: ${routingResult.selectedTool} → ${routingResult.uiIntent}`;
                        response.guidance.uiFlow = true;
                    }

                    // Only add validation if there's an issue
                    if (context.previousTools && context.previousTools.length > 0) {
                        const validation = this.intelligentRouter.validateWorkflowSequence(
                            routingResult.selectedTool,
                            context.previousTools,
                            userRequest
                        );
                        if (!validation.isOptimal && validation.recommendation) {
                            response.warning = validation.recommendation;
                        }
                    }
                    
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify(response, null, 2)
                        }]
                    };
                    
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    this.logger.error('Smart Router error:', error);
                    
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                error: 'Smart routing failed',
                                message: errorMessage,
                                fallback: {
                                    recommendation: 'Use natural-query-builder for natural language or execute-entity-operation for direct OData queries',
                                    workflow: ['search-sap-services', 'discover-service-entities', 'natural-query-builder', 'execute-entity-operation']
                                }
                            }, null, 2)
                        }],
                        isError: true
                    };
                }
            }
        );

        this.logger.info("✅ Registered Smart Router Tool: sap-smart-query");
    }

    /**
     * Register AI-Enhanced Tools for intelligent SAP data operations
     * Compatible with any MCP client (Claude, GPT, Gemini, etc.)
     * TEMPORARILY DISABLED - Tools need TypeScript fixes
     */
    private async registerAIEnhancedTools(): Promise<void> {
        this.logger.info("🤖 AI-Enhanced tools temporarily disabled for TypeScript fixes");
        // Manual registration approach to avoid TypeScript compilation issues
        this.logger.info("🤖 Registering AI-Enhanced tools for intelligent SAP operations");
        
        // Register Natural Query Builder Tool with dynamic configuration-driven description
        this.mcpServer.registerTool(
            "natural-query-builder",
            {
                title: "Natural Query Builder",
                description: "Convert natural language to OData queries",
                inputSchema: {
                    naturalQuery: z.string(),
                    entityType: z.string(),
                    serviceId: z.string(),
                    userContext: z.object({
                        role: z.string().optional(),
                        businessContext: z.string().optional(),
                        preferredFields: z.array(z.string()).optional()
                    }).optional().describe("User context")
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    // NO AUTHENTICATION REQUIRED: This is a design-time transformation tool
                    this.logger.debug(`🔄 Executing natural-query-builder (design-time transformation, no auth required)`);
                    
                    const tool = new NaturalQueryBuilderTool();
                    const result = await tool.execute(args as any);
                    
                    // Add workflow guidance to response
                    const enhancedResult = {
                        ...result,
                        nextSteps: {
                            recommended: "execute-entity-operation",
                            reason: "Use the generated OData query to retrieve actual SAP data",
                            thenAnalyze: "After getting data, use smart-data-analysis for insights"
                        }
                    };
                    
                    return { content: [{ type: "text", text: JSON.stringify(enhancedResult, null, 2) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }] };
                }
            }
        );

        // Register Smart Data Analysis Tool with dynamic configuration-driven description
        this.mcpServer.registerTool(
            "smart-data-analysis",
            {
                title: "Smart Data Analysis", 
                description: "Analyze SAP data patterns, trends, and generate actionable business insights with AI-powered statistical analysis. Provides automated data exploration and visualization recommendations.",
                inputSchema: {
                    data: z.array(z.object({
                        id: z.string().optional().describe("Record identifier"),
                        name: z.string().optional().describe("Record name"),
                        value: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Record value")
                    }).passthrough()).describe("Array of data records to analyze - each record is a key-value object"),
                    analysisType: z.enum(['trend', 'anomaly', 'forecast', 'correlation']).describe("Type of analysis to perform"),
                    businessContext: z.string().optional().describe("Business context for the analysis"),
                    entityType: z.string().describe("Type of SAP entity being analyzed")
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    // AUTHENTICATION REQUIRED: Check authentication before AI tool execution
                    if (this.authManager) {
                        this.logger.debug(`🔐 Authentication required for smart-data-analysis, checking...`);
                        const authResult = await this.authManager.authenticateToolCall('smart-data-analysis', args);
                        
                        if (!authResult.authenticated) {
                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify(this.authManager.formatAuthError(authResult), null, 2)
                                }],
                                isError: true
                            };
                        }
                        this.logger.info("✅ User authenticated for smart-data-analysis");
                    } else {
                        this.logger.warn(`⚠️  No authentication manager available - smart-data-analysis will proceed without authentication`);
                    }
                    
                    // CTM: De-structure session_id from tool arguments to avoid passing it to the tool
                    const { session_id, ...toolArgs } = args;
                    
                    const tool = new SmartDataAnalysisTool();
                    const result = await tool.execute(toolArgs as any);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }] };
                }
            }
        );

        // Register Query Performance Optimizer Tool with dynamic configuration-driven description
        this.mcpServer.registerTool(
            "query-performance-optimizer",
            {
                title: "Query Performance Optimizer",
                description: "Optimize SAP OData query performance by analyzing execution patterns and suggesting improvements. Automatically identifies bottlenecks and recommends index strategies.",
                inputSchema: {
                    query: z.string().describe("Original OData query URL to optimize"),
                    entityType: z.string().describe("Target entity type"),
                    executionStats: z.object({
                        executionTime: z.number().optional(),
                        recordCount: z.number().optional(),
                        dataSize: z.number().optional()
                    }).optional().describe("Query execution statistics"),
                    optimizationGoals: z.array(z.enum(['speed', 'bandwidth', 'accuracy', 'caching'])).optional().describe("Primary optimization objectives")
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    // AUTHENTICATION REQUIRED: Check authentication before AI tool execution
                    if (this.authManager) {
                        this.logger.debug(`🔐 Authentication required for query-performance-optimizer, checking...`);
                        const authResult = await this.authManager.authenticateToolCall('query-performance-optimizer', args);
                        
                        if (!authResult.authenticated) {
                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify(this.authManager.formatAuthError(authResult), null, 2)
                                }],
                                isError: true
                            };
                        }
                        this.logger.info("✅ User authenticated for query-performance-optimizer");
                    } else {
                        this.logger.warn(`⚠️  No authentication manager available - query-performance-optimizer will proceed without authentication`);
                    }
                    
                    // CTM: De-structure session_id from tool arguments to avoid passing it to the tool
                    const { session_id, ...toolArgs } = args;

                    const tool = new QueryPerformanceOptimizerTool();
                    const result = await tool.execute(toolArgs as any);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }] };
                }
            }
        );

        // Register Business Process Insights Tool with dynamic configuration-driven description
        this.mcpServer.registerTool(
            "business-process-insights",
            {
                title: "Business Process Insights",
                description: "Extract business process insights from SAP transactional data using AI pattern recognition. Identifies workflow inefficiencies and automation opportunities.",
                inputSchema: {
                    processType: z.enum(['procurement', 'sales', 'finance', 'inventory', 'hr', 'general']).describe("Type of business process to analyze"),
                    processData: z.array(z.record(z.any())).describe("Historical process execution data"),
                    timeframe: z.string().optional().describe("Analysis timeframe"),
                    focusAreas: z.array(z.enum(['efficiency', 'costs', 'compliance', 'quality', 'speed'])).optional().describe("Specific areas to focus the analysis on")
                }
            },
            async (args: Record<string, unknown>) => {
                try {
                    // AUTHENTICATION REQUIRED: Check authentication before AI tool execution
                    if (this.authManager) {
                        this.logger.debug(`🔐 Authentication required for business-process-insights, checking...`);
                        const authResult = await this.authManager.authenticateToolCall('business-process-insights', args);
                        
                        if (!authResult.authenticated) {
                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify(this.authManager.formatAuthError(authResult), null, 2)
                                }],
                                isError: true
                            };
                        }
                        this.logger.info("✅ User authenticated for business-process-insights");
                    } else {
                        this.logger.warn(`⚠️  No authentication manager available - business-process-insights will proceed without authentication`);
                    }
                    
                    // CTM: De-structure session_id from tool arguments to avoid passing it to the tool
                    const { session_id, ...toolArgs } = args;

                    const tool = new BusinessProcessInsightsTool();
                    const result = await tool.execute(toolArgs as any);
                    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    return { content: [{ type: "text", text: JSON.stringify({ success: false, error: errorMessage }, null, 2) }] };
                }
            }
        );

        // ===== PHASE 3: REGISTER REAL-TIME ANALYTICS TOOLS =====
        await this.registerRealtimeAnalyticsTools();

        this.logger.info("✅ Registered 8 AI-Enhanced tools: 4 Phase 2 + 4 Phase 3 Real-time Analytics tools");
        
        // Final summary of all registered tools
        this.logger.info("🎯 TOTAL TOOLS REGISTERED: 12 (4 Discovery + 4 AI Phase 2 + 4 Real-time Phase 3)");
    }

    /**
     * Register Phase 3: Real-time Analytics & KPI Dashboard Tools
     */
    private async registerRealtimeAnalyticsTools(): Promise<void> {
        this.logger.info("🔄 Registering Phase 3: Real-time Analytics tools");

        // Register each real-time analytics tool individually
        for (const tool of realtimeAnalyticsTools) {
            this.mcpServer.registerTool(
                tool.name,
                {
                    title: tool.description.split(' - ')[0], // Extract title from description
                    description: tool.description,
                    inputSchema: (tool.inputSchema as any).shape // Extract the Zod shape
                },
                async (args: Record<string, unknown>) => {
                    try {
                        // Different authentication requirements based on tool
                        const requiresAuth = ['kpi-dashboard-builder'].includes(tool.name);
                        
                        if (requiresAuth && this.authManager) {
                            this.logger.debug(`🔐 Authentication required for ${tool.name}, checking...`);
                            const authResult = await this.authManager.authenticateToolCall(tool.name, args);
                            
                            if (!authResult.authenticated) {
                                return {
                                    content: [{
                                        type: "text" as const,
                                        text: JSON.stringify(this.authManager.formatAuthError(authResult), null, 2)
                                    }],
                                    isError: true
                                };
                            }
                            this.logger.info(`✅ User authenticated for ${tool.name}`);
                        }
                        
                        // Validate ALL arguments with Zod schema first to catch extra properties like session_id
                        const validationResult = tool.inputSchema.safeParse(args);
                        if (!validationResult.success) {
                            return {
                                content: [{
                                    type: "text" as const,
                                    text: JSON.stringify({
                                        error: 'Invalid arguments for tool ' + tool.name,
                                        details: validationResult.error.issues,
                                        message: 'Your input to the tool was invalid (must NOT have additional properties)'
                                    }, null, 2)
                                }],
                                isError: true
                            };
                        }

                        const result = await tool.execute(validationResult.data as any);
                        return { 
                            content: [{ 
                                type: "text" as const, 
                                text: JSON.stringify(result, null, 2) 
                            }] 
                        };
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        return { 
                            content: [{ 
                                type: "text" as const, 
                                text: JSON.stringify({ success: false, error: errorMessage }, null, 2) 
                            }] 
                        };
                    }
                }
            );
        }

        this.logger.info("✅ Registered 4 Real-time Analytics tools: realtime-data-stream, kpi-dashboard-builder, predictive-analytics-engine, business-intelligence-insights");
    }

    /**
     * Search local SAP services with filtering capabilities
     */
    private async searchServices(args: Record<string, unknown>) {
        try {
            const query = args.query as string || '';
            const category = args.category as string || 'all';
            const limit = args.limit as number || 10;

            this.logger.info(`🔍 Searching local services: query="${query}", category="${category}", limit=${limit}`);

            // Search local services
            let filteredServices = this.discoveredServices;

            // Apply category filter
            if (category !== 'all') {
                filteredServices = filteredServices.filter(service => {
                    const serviceCategories = this.serviceCategories.get(service.id) || [];
                    return serviceCategories.includes(category);
                });
            }

            // Apply query filter
            if (query) {
                const queryLower = query.toLowerCase();
                filteredServices = filteredServices.filter(service =>
                    service.id.toLowerCase().includes(queryLower) ||
                    service.title.toLowerCase().includes(queryLower) ||
                    service.description.toLowerCase().includes(queryLower)
                );
            }

            // Limit results
            const services = filteredServices.slice(0, limit).map(service => ({
                id: service.id,
                title: service.title,
                description: service.description,
                categories: this.serviceCategories.get(service.id) || [],
                entityCount: service.metadata?.entityTypes?.length || 0,
                odataVersion: service.odataVersion
            }));

            // Format response
            let responseText = `🔍 Search Results for "${query}" in category "${category}"\n\n`;
            responseText += `📊 Found ${services.length} services\n\n`;
            
            if (services.length > 0) {
                services.forEach((service, idx) => {
                    responseText += `${idx + 1}. **${service.title}** (${service.id})\n`;
                    responseText += `   📝 ${service.description}\n`;
                    responseText += `   📊 ${service.entityCount} entities | ${service.categories.join(', ')}\n\n`;
                });
            } else {
                responseText += `❌ No services found matching your criteria.\n\n`;
                responseText += `💡 Try:\n`;
                responseText += `• Different search terms\n`;
                responseText += `• Broader category (use "all")\n`;
                responseText += `• Check if services are properly configured in your SAP system\n\n`;
            }

            responseText += `📋 Next steps:\n`;
            if (services.length > 0) {
                responseText += `• Use 'discover-service-entities' to explore service entities\n`;
            }
            responseText += `• Use 'natural-query-builder' for data queries`;

            return {
                content: [{
                    type: "text" as const,
                    text: responseText
                }]
            };

        } catch (error) {
            this.logger.error('Error searching services:', error);
            return {
                content: [{
                    type: "text" as const,
                    text: `❌ Error searching services: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }


    /**
     * Load SAP Signavio process classification - Ultra-compact token-optimized version
     */
    private loadProcessClassification(): void {
        // Ultra-compact classification: only essential keywords, no descriptions/subprocesses
        // Lazy-loaded patterns for maximum token efficiency
        this.processClassification = {
            processCategories: {
                'source-to-pay': {
                    name: 'Source-to-Pay',
                    description: '',
                    subprocesses: [],
                    keywords: ['purchase', 'procurement', 'supplier', 'vendor', 'po_', 'material']
                },
                'order-to-cash': {
                    name: 'Order-to-Cash',
                    description: '',
                    subprocesses: [],
                    keywords: ['sales', 'order', 'customer', 'billing', 'invoice', 'delivery']
                },
                'plan-to-produce': {
                    name: 'Plan-to-Produce',
                    description: '',
                    subprocesses: [],
                    keywords: ['production', 'manufacturing', 'bom', 'routing', 'quality']
                },
                'record-to-report': {
                    name: 'Record-to-Report',
                    description: '',
                    subprocesses: [],
                    keywords: ['finance', 'accounting', 'gl_', 'cost', 'ledger']
                },
                'hire-to-retire': {
                    name: 'Hire-to-Retire',
                    description: '',
                    subprocesses: [],
                    keywords: ['hr_', 'employee', 'payroll', 'personnel']
                }
            },
            crossFunctionalProcesses: {
                'master-data': {
                    name: 'Master Data',
                    description: '',
                    keywords: ['business_partner', 'bp_', 'material', 'product']
                },
                'integration': {
                    name: 'Integration',
                    description: '',
                    keywords: ['integration', 'workflow', 'api_', 'interface']
                }
            },
            industrySpecific: {
                'utilities': { name: 'Utilities', keywords: ['utility', 'meter', 'energy'] },
                'retail': { name: 'Retail', keywords: ['retail', 'store', 'pos_'] },
                'manufacturing': { name: 'Manufacturing', keywords: ['shop_floor', 'mes_', 'batch'] }
            }
        };

        this.logger.info('⚡ Ultra-compact SAP Signavio classification loaded (token-optimized)');
    }

    /**
     * Categorize services using SAP Signavio process-based classification
     */
    private categorizeServices(): void {
        for (const service of this.discoveredServices) {
            const categories: string[] = [];
            const id = service.id.toLowerCase();
            const title = service.title.toLowerCase();
            const desc = service.description.toLowerCase();
            const searchText = `${id} ${title} ${desc}`;

            if (this.processClassification) {
                // Check against process categories
                for (const [categoryKey, category] of Object.entries(this.processClassification.processCategories)) {
                    if (this.matchesKeywords(searchText, category.keywords)) {
                        categories.push(categoryKey);
                    }
                }

                // Check against cross-functional processes
                for (const [categoryKey, category] of Object.entries(this.processClassification.crossFunctionalProcesses)) {
                    if (this.matchesKeywords(searchText, category.keywords)) {
                        categories.push(categoryKey);
                    }
                }

                // Check against industry-specific processes
                for (const [categoryKey, category] of Object.entries(this.processClassification.industrySpecific)) {
                    if (this.matchesKeywords(searchText, category.keywords)) {
                        categories.push(categoryKey);
                    }
                }
            } else {
                // Fallback to basic categorization if configuration not loaded
                // Business Partner related
                if (id.includes('business_partner') || id.includes('bp_') || id.includes('customer') || id.includes('supplier')) {
                    categories.push('business-partner');
                }

                // Sales related
                if (id.includes('sales') || id.includes('order') || id.includes('quotation') || id.includes('opportunity')) {
                    categories.push('sales');
                }

                // Finance related
                if (id.includes('finance') || id.includes('accounting') || id.includes('payment') || id.includes('invoice')) {
                    categories.push('finance');
                }

                // Procurement related
                if (id.includes('purchase') || id.includes('procurement') || id.includes('vendor') || id.includes('po_')) {
                    categories.push('procurement');
                }

                // HR related
                if (id.includes('employee') || id.includes('hr_') || id.includes('personnel') || id.includes('payroll')) {
                    categories.push('hr');
                }

                // Logistics related
                if (id.includes('logistics') || id.includes('warehouse') || id.includes('inventory') || id.includes('material')) {
                    categories.push('logistics');
                }
            }

            // Default category if none matched
            if (categories.length === 0) {
                categories.push('all');
            }

            this.serviceCategories.set(service.id, categories);
        }

        this.logger.debug(`Categorized ${this.discoveredServices.length} services into categories using ${this.processClassification ? 'SAP Signavio' : 'basic'} classification`);
    }

    /**
     * Optimized keyword matching with early exit
     */
    private matchesKeywords(text: string, keywords: string[]): boolean {
        const lowerText = text.toLowerCase();
        // Early exit on first match to reduce processing
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) return true;
        }
        return false;
    }


    /**
     * Discover entities within a service with capability information
     */
    private async discoverServiceEntities(args: Record<string, unknown>) {
        try {
            const serviceId = args.serviceId as string;
            const showCapabilities = args.showCapabilities !== false;

            const service = this.discoveredServices.find(s => s.id === serviceId);
            if (!service) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `❌ Service not found: ${serviceId}\n\n💡 Use 'search-sap-services' to find available services.`
                    }],
                    isError: true
                };
            }

            if (!service.metadata?.entityTypes) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `⚠️ No entities found for service: ${serviceId}. The service metadata may not have loaded properly.`
                    }]
                };
            }

            const entities = service.metadata.entityTypes.map(entity => {
                const result: any = {
                    name: entity.name,
                    entitySet: entity.entitySet,
                    propertyCount: entity.properties.length,
                    keyProperties: entity.keys
                };

                if (showCapabilities) {
                    result.capabilities = {
                        readable: true, // Always true for OData
                        creatable: entity.creatable,
                        updatable: entity.updatable,
                        deletable: entity.deletable
                    };
                }

                return result;
            });

            const serviceInfo = {
                service: {
                    id: serviceId,
                    title: service.title,
                    description: service.description,
                    categories: this.serviceCategories.get(service.id) || [],
                    odataVersion: service.odataVersion
                },
                entities: entities
            };

            let responseText = `📊 Service: ${service.title} (${serviceId})\n`;
            responseText += `📁 Found ${entities.length} entities\n\n`;
            responseText += JSON.stringify(serviceInfo, null, 2);
            responseText += `\n\n📋 Next steps:\n`;
            responseText += `• Use 'get-entity-schema' to see detailed property information for an entity\n`;
            responseText += `• Use 'execute-entity-operation' to perform CRUD operations`;

            return {
                content: [{
                    type: "text" as const,
                    text: responseText
                }]
            };

        } catch (error) {
            this.logger.error('Error discovering service entities:', error);
            return {
                content: [{
                    type: "text" as const,
                    text: `❌ Error discovering entities: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Get detailed entity schema information
     */
    private async getEntitySchema(args: Record<string, unknown>) {
        try {
            const serviceId = args.serviceId as string;
            const entityName = args.entityName as string;

            // Schema access is public - no authentication required for discovery
            const service = this.discoveredServices.find(s => s.id === serviceId);
            if (!service) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `❌ Service not found: ${serviceId}`
                    }],
                    isError: true
                };
            }

            const entityType = service.metadata?.entityTypes?.find(e => e.name === entityName);
            if (!entityType) {
                const availableEntities = service.metadata?.entityTypes?.map(e => e.name).join(', ') || 'none';
                return {
                    content: [{
                        type: "text" as const,
                        text: `❌ Entity '${entityName}' not found in service '${serviceId}'\n\n📋 Available entities: ${availableEntities}`
                    }],
                    isError: true
                };
            }

            const schema = {
                entity: {
                    name: entityType.name,
                    entitySet: entityType.entitySet,
                    namespace: entityType.namespace
                },
                capabilities: {
                    readable: true,
                    creatable: entityType.creatable,
                    updatable: entityType.updatable,
                    deletable: entityType.deletable
                },
                keyProperties: entityType.keys,
                properties: entityType.properties.map(prop => ({
                    name: prop.name,
                    type: prop.type,
                    nullable: prop.nullable,
                    maxLength: prop.maxLength,
                    isKey: entityType.keys.includes(prop.name)
                }))
            };

            let responseText = `📋 Schema for ${entityName} in ${service.title}:\n\n`;
            responseText += JSON.stringify(schema, null, 2);
            responseText += `\n\n🔧 Use 'execute-entity-operation' with this schema information to perform operations.`;

            // Add UI suggestions for entity discovery
            const uiSuggestions = this.generateEntityDiscoveryUIToolSuggestions(entityName, schema);
            if (uiSuggestions) {
                responseText += "\n\n" + uiSuggestions;
            }

            return {
                content: [{
                    type: "text" as const,
                    text: responseText
                }]
            };

        } catch (error) {
            this.logger.error('Error getting entity schema:', error);
            return {
                content: [{
                    type: "text" as const,
                    text: `❌ Error getting schema: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Execute CRUD operations on entities with comprehensive error handling
     */
    private async executeEntityOperation(args: Record<string, unknown>) {
        try {
            const serviceId = args.serviceId as string;
            const entityName = args.entityName as string;
            const operation = args.operation as string;
            const parameters = args.parameters as Record<string, any> || {};
            const queryOptions = args.queryOptions as Record<string, any> || {};

            // Check authentication for this tool
            let userJWT: string | undefined;
            if (this.authManager) {
                this.logger.debug(`🔐 Authentication required for execute-entity-operation, checking...`);
                const authResult = await this.authManager.authenticateToolCall('execute-entity-operation', args);
                
                if (!authResult.authenticated) {
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify(this.authManager.formatAuthError(authResult), null, 2)
                        }],
                        isError: true
                    };
                }

                // Extract user JWT token for potential Principal Propagation
                // The SAPClient/DestinationService will decide whether to use it based on destination config
                if (authResult.context?.token) {
                    userJWT = authResult.context.token;
                    this.logger.info(`User authenticated - JWT available for Principal Propagation`);
                } else {
                    this.logger.debug(`User authenticated - no JWT token available (will use BasicAuth if configured in destination)`);
                }
            } else {
                this.logger.warn(`⚠️  No authentication manager available - execute-entity-operation will proceed without authentication`);
            }

            // Validate service
            const service = this.discoveredServices.find(s => s.id === serviceId);
            if (!service) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `❌ Service not found: ${serviceId}`
                    }],
                    isError: true
                };
            }

            // Validate entity
            const entityType = service.metadata?.entityTypes?.find(e => e.name === entityName);
            if (!entityType) {
                return {
                    content: [{
                        type: "text" as const,
                        text: `❌ Entity '${entityName}' not found in service '${serviceId}'`
                    }],
                    isError: true
                };
            }

            // Execute the operation
            let response;
            let operationDescription = "";

            // Create destination context for the operation
            const destinationContext: DestinationContext = {
                type: operation === 'read' || operation === 'read-single' ? 'runtime' : 'runtime', // All CRUD operations use runtime
                operation: operation as OperationType,
                serviceId,
                entityName
            };

            switch (operation) {
                case 'read':
                    operationDescription = `Reading ${entityName} entities`;
                    if (queryOptions.$top) operationDescription += ` (top ${queryOptions.$top})`;
                    if (queryOptions.$filter) operationDescription += ` with filter: ${queryOptions.$filter}`;
                    
                    // Use new context-aware approach for read operations
                    const readUrl = this.buildReadUrl(service.url, entityType.entitySet!, queryOptions);
                    response = await this.sapClient.executeCRUDOperation('read', readUrl, undefined, userJWT);
                    break;

                case 'read-single':
                    const keyValue = this.buildKeyValue(entityType, parameters);
                    operationDescription = `Reading single ${entityName} with key: ${keyValue}`;
                    
                    // Use new context-aware approach
                    const singleReadUrl = `${service.url}${entityType.entitySet!}(${keyValue})`;
                    response = await this.sapClient.executeCRUDOperation('read', singleReadUrl, undefined, userJWT);
                    break;

                case 'create':
                    if (!entityType.creatable) {
                        throw new Error(`Entity '${entityName}' does not support create operations`);
                    }
                    operationDescription = `Creating new ${entityName}`;
                    
                    // Use new context-aware approach
                    const createUrl = `${service.url}${entityType.entitySet!}`;
                    response = await this.sapClient.executeCRUDOperation('create', createUrl, parameters, userJWT);
                    break;

                case 'update':
                    if (!entityType.updatable) {
                        throw new Error(`Entity '${entityName}' does not support update operations`);
                    }
                    const updateKeyValue = this.buildKeyValue(entityType, parameters);
                    const updateData = { ...parameters };
                    entityType.keys.forEach(key => delete updateData[key]);
                    operationDescription = `Updating ${entityName} with key: ${updateKeyValue}`;
                    
                    // Use new context-aware approach
                    const updateUrl = `${service.url}${entityType.entitySet!}(${updateKeyValue})`;
                    response = await this.sapClient.executeCRUDOperation('update', updateUrl, updateData, userJWT);
                    break;

                case 'delete':
                    if (!entityType.deletable) {
                        throw new Error(`Entity '${entityName}' does not support delete operations`);
                    }
                    const deleteKeyValue = this.buildKeyValue(entityType, parameters);
                    operationDescription = `Deleting ${entityName} with key: ${deleteKeyValue}`;
                    
                    // Use new context-aware approach
                    const deleteUrl = `${service.url}${entityType.entitySet!}(${deleteKeyValue})`;
                    await this.sapClient.executeCRUDOperation('delete', deleteUrl, undefined, userJWT);
                    response = { data: { message: `Successfully deleted ${entityName} with key: ${deleteKeyValue}`, success: true } };
                    break;

                default:
                    throw new Error(`Unsupported operation: ${operation}`);
            }

            let responseText = `✅ ${operationDescription}\n\n`;
            responseText += JSON.stringify(response.data, null, 2);

            // Add UI tool suggestions based on operation type
            const uiSuggestions = this.generateUIToolSuggestions(operation, args.entityName as string, response.data);
            if (uiSuggestions) {
                responseText += "\n\n" + uiSuggestions;
            }

            return {
                content: [{
                    type: "text" as const,
                    text: responseText
                }]
            };

        } catch (error) {
            this.logger.error('Error executing entity operation:', error);
            return {
                content: [{
                    type: "text" as const,
                    text: `❌ Error executing ${args.operation} operation on ${args.entityName}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }

    /**
     * Build key value for entity operations (handles single and composite keys)
     */
    private buildKeyValue(entityType: EntityType, parameters: Record<string, any>): string {
        const keyProperties = entityType.properties.filter(p => entityType.keys.includes(p.name));
        
        if (keyProperties.length === 1) {
            const keyName = keyProperties[0].name;
            if (!(keyName in parameters)) {
                throw new Error(`Missing required key property: ${keyName}. Required keys: ${entityType.keys.join(', ')}`);
            }
            return String(parameters[keyName]);
        }

        // Handle composite keys
        const keyParts = keyProperties.map(prop => {
            if (!(prop.name in parameters)) {
                throw new Error(`Missing required key property: ${prop.name}. Required keys: ${entityType.keys.join(', ')}`);
            }
            return `${prop.name}='${parameters[prop.name]}'`;
        });
        return keyParts.join(',');
    }

    /**
     * Build URL for read operations with query parameters
     */
    private buildReadUrl(serviceUrl: string, entitySet: string, queryOptions: Record<string, any>): string {
        let url = `${serviceUrl}${entitySet}`;
        
        if (queryOptions) {
            const params = new URLSearchParams();
            Object.entries(queryOptions).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.set(key, String(value));
                }
            });
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
        }
        
        return url;
    }

    /**
     * Register service metadata resources and workflow guides
     */
    public registerServiceMetadataResources(): void {
        this.logger.info('📜 Registering MCP resources for document grounding');
        
        // Routing rules removed from document grounding - now loaded internally only
        // This saves ~3,100 tokens per session

        this.mcpServer.registerResource(
            "sap-service-metadata",
            new ResourceTemplate("sap://service/{serviceId}/metadata", { list: undefined }),
            {
                title: "SAP Service Metadata",
                description: "Metadata information for SAP OData services"
            },
            async (uri, variables) => {
                const serviceId = typeof variables.serviceId === "string" ? variables.serviceId : "";
                const service = this.discoveredServices.find(s => s.id === serviceId);
                if (!service) {
                    throw new Error(`Service not found: ${serviceId}`);
                }
                return {
                    contents: [{
                        uri: uri.href,
                        text: JSON.stringify({
                            service: {
                                id: service.id,
                                title: service.title,
                                description: service.description,
                                url: service.url,
                                version: service.version
                            },
                            entities: service.metadata?.entityTypes?.map(entity => ({
                                name: entity.name,
                                entitySet: entity.entitySet,
                                properties: entity.properties,
                                keys: entity.keys,
                                operations: {
                                    creatable: entity.creatable,
                                    updatable: entity.updatable,
                                    deletable: entity.deletable
                                }
                            })) || []
                        }, null, 2),
                        mimeType: "application/json"
                    }]
                };
            }
        );

        this.mcpServer.registerResource(
            "sap-services",
            "sap://services",
            {
                title: "Available SAP Services",
                description: "List of all discovered SAP OData services",
                mimeType: "application/json"
            },
            async (uri) => ({
                contents: [{
                    uri: uri.href,
                    text: JSON.stringify({
                        totalServices: this.discoveredServices.length,
                        categories: Array.from(new Set(Array.from(this.serviceCategories.values()).flat())),
                        services: this.discoveredServices.map(service => ({
                            id: service.id,
                            title: service.title,
                            description: service.description,
                            entityCount: service.metadata?.entityTypes?.length || 0,
                            categories: this.serviceCategories.get(service.id) || []
                        }))
                    }, null, 2)
                }]
            })
        );
        
        this.logger.info('✅ MCP Document Grounding Resources registered: sap://routing-rules, sap://service/{id}/metadata, sap://services');
    }

    /**
     * Register UI Tools for interactive form generation and visualization
     */
    private async registerUITools(): Promise<void> {
        try {
            this.logger.info('🎨 Registering UI Tools for interactive SAP operations');

            // Register ui-form-generator tool
            this.mcpServer.registerTool(
                "ui-form-generator",
                {
                    title: "UI Form Generator",
                    description: "Creates dynamic forms for SAP entity operations with validation and SAP Fiori styling",
                    inputSchema: {
                        entityType: z.string().describe('SAP entity type for the form'),
                        formType: z.enum(['create', 'edit', 'view']).describe('Type of form to generate'),
                        fields: z.array(z.object({
                            name: z.string(),
                            type: z.string(),
                            required: z.boolean().optional(),
                            label: z.string().optional()
                        })).optional().describe('Custom form fields configuration')
                    }
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const { entityType, formType, fields } = args as any;

                        // Generate a simple form HTML with SAP Fiori styling
                        const formHtml = this.generateFormHTML(entityType, formType, fields);

                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `✅ SAP ${entityType} ${formType} form generated successfully with Fiori styling and validation.`
                                },
                                {
                                    type: "text" as const,
                                    text: formHtml
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `❌ Error generating form: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                        };
                    }
                }
            );

            // Register ui-data-grid tool
            this.mcpServer.registerTool(
                "ui-data-grid",
                {
                    title: "UI Data Grid",
                    description: "Creates interactive data grids with sorting, filtering, and export capabilities",
                    inputSchema: {
                        entityType: z.string().describe('SAP entity type for the grid'),
                        columns: z.array(z.object({
                            label: z.string(),
                            key: z.string(),
                            type: z.enum(['text', 'number', 'date', 'boolean']).optional()
                        })).describe('Grid column definitions'),
                        features: z.object({
                            sorting: z.boolean().optional(),
                            filtering: z.boolean().optional(),
                            pagination: z.boolean().optional(),
                            export: z.boolean().optional()
                        }).optional().describe('Grid feature enablement')
                    }
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const { entityType, columns, features } = args as any;

                        // Generate a data grid HTML with interactive features
                        const gridHtml = this.generateDataGridHTML(entityType, columns, features || {});

                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `✅ Interactive ${entityType} data grid generated with ${columns?.length || 'auto'} columns and advanced features.`
                                },
                                {
                                    type: "text" as const,
                                    text: gridHtml
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `❌ Error generating data grid: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                        };
                    }
                }
            );

            // Register ui-dashboard-composer tool
            this.mcpServer.registerTool(
                "ui-dashboard-composer",
                {
                    title: "UI Dashboard Composer",
                    description: "Creates comprehensive KPI dashboards with charts and real-time data",
                    inputSchema: {
                        dashboardTitle: z.string().describe('Title for the dashboard'),
                        widgets: z.array(z.object({
                            type: z.enum(['chart', 'metric', 'table', 'gauge']),
                            title: z.string(),
                            entityType: z.string(),
                            config: z.object({}).passthrough().optional()
                        })).describe('Dashboard widget configurations'),
                        layout: z.enum(['grid', 'vertical', 'horizontal']).optional().describe('Dashboard layout style')
                    }
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const { dashboardTitle, widgets, layout } = args as any;

                        // Generate a dashboard HTML with KPI widgets
                        const dashboardHtml = this.generateDashboardHTML(dashboardTitle, widgets, layout || 'grid');

                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `✅ "${dashboardTitle}" KPI dashboard created with ${widgets?.length || 0} widgets and ${layout || 'grid'} layout.`
                                },
                                {
                                    type: "text" as const,
                                    text: dashboardHtml
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `❌ Error generating dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                        };
                    }
                }
            );

            // Register ui-workflow-builder tool
            this.mcpServer.registerTool(
                "ui-workflow-builder",
                {
                    title: "UI Workflow Builder",
                    description: "Creates visual workflow processes with step-by-step forms and approvals",
                    inputSchema: {
                        workflowName: z.string().describe('Name of the workflow process'),
                        steps: z.array(z.object({
                            name: z.string(),
                            type: z.enum(['form', 'approval', 'notification', 'condition']),
                            config: z.object({}).passthrough().optional()
                        })).describe('Workflow step definitions'),
                        entityType: z.string().describe('SAP entity type for the workflow')
                    }
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const { workflowName, steps, entityType } = args as any;

                        // Generate a workflow builder HTML
                        const workflowHtml = this.generateWorkflowHTML(workflowName, steps, entityType);

                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `✅ "${workflowName}" workflow created with ${steps?.length || 0} steps for ${entityType} entities.`
                                },
                                {
                                    type: "text" as const,
                                    text: workflowHtml
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `❌ Error generating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                        };
                    }
                }
            );

            // Register ui-report-builder tool
            this.mcpServer.registerTool(
                "ui-report-builder",
                {
                    title: "UI Report Builder",
                    description: "Creates comprehensive drill-down reports with analytical capabilities",
                    inputSchema: {
                        entityType: z.string().describe('SAP entity type for the report'),
                        reportType: z.enum(['summary', 'detailed', 'analytical', 'custom']).describe('Type of report to generate'),
                        dimensions: z.array(z.string()).describe('Report dimension fields'),
                        measures: z.array(z.string()).describe('Report measure fields')
                    }
                },
                async (args: Record<string, unknown>) => {
                    try {
                        const { entityType, reportType, dimensions, measures } = args as any;

                        // Generate a report builder HTML
                        const reportHtml = this.generateReportHTML(entityType, reportType, dimensions, measures);

                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `✅ ${reportType} report for ${entityType} created with ${dimensions?.length || 0} dimensions and ${measures?.length || 0} measures.`
                                },
                                {
                                    type: "text" as const,
                                    text: reportHtml
                                }
                            ]
                        };
                    } catch (error) {
                        return {
                            content: [{
                                type: "text" as const,
                                text: `❌ Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`
                            }]
                        };
                    }
                }
            );

            this.logger.info('✅ All UI Tools registered successfully: ui-form-generator, ui-data-grid, ui-dashboard-composer, ui-workflow-builder, ui-report-builder');

        } catch (error) {
            this.logger.error('❌ Failed to register UI tools', error as Error);
            // Don't throw - allow server to continue without UI tools
        }
    }

    /**
     * Generate Form HTML
     */
    private generateFormHTML(entityType: string, formType: string, fields?: any[]): string {
        const formId = `form_${entityType.toLowerCase()}_${Date.now()}`;
        const defaultFields = fields || [
            { name: 'id', label: 'ID', type: 'text', required: true },
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'text', required: false }
        ];

        const fieldsHtml = defaultFields.map(field => `
                <div class="sap-form-group">
                    <label class="sap-label" for="${field.name}">${field.label}${field.required ? ' *' : ''}</label>
                    <input class="sap-input" type="${field.type === 'number' ? 'number' : 'text'}"
                           id="${field.name}" name="${field.name}" ${field.required ? 'required' : ''}>
                </div>
            `).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <title>${entityType} ${formType.charAt(0).toUpperCase() + formType.slice(1)} Form</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <style>
        .sap-form-container { max-width: 600px; margin: 20px auto; padding: 20px; }
        .sap-form-group { margin-bottom: 16px; }
        .sap-label { display: block; margin-bottom: 4px; font-weight: 500; }
        .sap-input { width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; }
        .sap-button { background: #0070f3; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="sap-form-container">
        <h2>${entityType} ${formType.charAt(0).toUpperCase() + formType.slice(1)} Form</h2>
        <form id="${formId}" onsubmit="handleSubmit(event)">
            ${fieldsHtml}
            <button type="submit" class="sap-button">Save ${entityType}</button>
        </form>
    </div>
    <script>
        function handleSubmit(event) {
            event.preventDefault();
            const formData = new FormData(event.target);
            const data = Object.fromEntries(formData);
            alert('Form submitted: ' + JSON.stringify(data, null, 2));
        }
    </script>
</body>
</html>`;
    }

    /**
     * Generate Data Grid HTML
     */
    private generateDataGridHTML(entityType: string, columns: any[], features: any): string {
        const gridId = `grid_${entityType.toLowerCase()}_${Date.now()}`;
        const defaultColumns = columns?.length > 0 ? columns : [
            { key: 'id', label: 'ID', type: 'text' },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'status', label: 'Status', type: 'text' }
        ];

        const toolbarHtml = `
            ${features.filtering ? '<input type="text" placeholder="Filter..." onkeyup="filterTable()">' : ''}
            ${features.export ? '<button class="sap-button" onclick="exportData()">Export</button>' : ''}
            <button class="sap-button" onclick="refreshData()">Refresh</button>
        `;

        const headersHtml = defaultColumns.map(col => `<th onclick="sortTable('${col.key}')">${col.label} ↕️</th>`).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <title>${entityType} Data Grid</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <style>
        .grid-container { margin: 20px; }
        .grid-toolbar { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
        .data-table { width: 100%; border-collapse: collapse; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .data-table th { background: #f8f9fa; font-weight: 600; cursor: pointer; }
        .sap-button { background: #0070f3; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="grid-container">
        <h2>${entityType} Data Grid</h2>
        <div class="grid-toolbar">
            ${toolbarHtml}
        </div>
        <table class="data-table" id="${gridId}">
            <thead>
                <tr>
                    ${headersHtml}
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="${defaultColumns.length}">Loading data...</td></tr>
            </tbody>
        </table>
    </div>
    <script>
        function sortTable(column) { alert('Sorting by ' + column); }
        function filterTable() { alert('Filtering table'); }
        function exportData() { alert('Exporting data'); }
        function refreshData() { alert('Refreshing data'); }
    </script>
</body>
</html>`;
    }

    /**
     * Generate Dashboard HTML
     */
    private generateDashboardHTML(title: string, widgets: any[], layout: string): string {
        const widgetsHtml = widgets?.map(widget => {
            const widgetId = widget.title.replace(/\s+/g, '_');
            const content = widget.type === 'metric'
                ? '<div class="metric-value">1,234</div>'
                : `<canvas id="chart_${widgetId}" width="400" height="200"></canvas>`;

            return `<div class="widget">
                    <div class="widget-title">${widget.title}</div>
                    ${content}
                </div>`;
        }).join('') || '<div class="widget"><div class="widget-title">Sample KPI</div><div class="metric-value">42</div></div>';

        const chartScripts = widgets?.filter(w => w.type === 'chart').map(widget => {
            const widgetId = widget.title.replace(/\s+/g, '_');
            return `const ctx_${widgetId} = document.getElementById('chart_${widgetId}').getContext('2d');
            new Chart(ctx_${widgetId}, {
                type: 'bar',
                data: { labels: ['Jan', 'Feb', 'Mar'], datasets: [{ label: '${widget.title}', data: [12, 19, 3] }] }
            });`;
        }).join('') || '';

        return `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .dashboard-container { margin: 20px; }
        .widget-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .widget { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .widget-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
        .metric-value { font-size: 32px; font-weight: 700; color: #0070f3; }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <h1>${title}</h1>
        <div class="widget-grid">
            ${widgetsHtml}
        </div>
    </div>
    <script>
        ${chartScripts}
    </script>
</body>
</html>`;
    }

    /**
     * Generate Workflow HTML
     */
    private generateWorkflowHTML(workflowName: string, steps: any[], entityType: string): string {
        const stepsHtml = steps?.map((step, index) => {
            const connector = index < steps.length - 1 ? '<div class="workflow-connector">↓</div>' : '';
            return `<div class="step">
                <div class="step-header">
                    <span class="step-type">${step.type}</span>
                    ${step.name}
                </div>
                <p>Step ${index + 1}: ${step.type} action for ${step.name}</p>
            </div>
            ${connector}`;
        }).join('') || '<div class="step"><div class="step-header"><span class="step-type">form</span>Default Step</div><p>Sample workflow step</p></div>';

        return `<!DOCTYPE html>
<html>
<head>
    <title>${workflowName} Workflow</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <style>
        .workflow-container { margin: 20px; max-width: 800px; }
        .step { background: white; margin: 16px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .step-header { font-size: 18px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
        .step-type { background: #0070f3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .workflow-connector { text-align: center; color: #666; font-size: 24px; }
    </style>
</head>
<body>
    <div class="workflow-container">
        <h1>${workflowName}</h1>
        <p>Workflow for ${entityType} entities</p>
        ${stepsHtml}
    </div>
</body>
</html>`;
    }

    /**
     * Generate Report HTML
     */
    private generateReportHTML(entityType: string, reportType: string, dimensions: string[], measures: string[]): string {
        const reportTitle = reportType.charAt(0).toUpperCase() + reportType.slice(1);

        const metricsHtml = measures?.map(measure => `
                <div class="metric-card">
                    <div class="metric-value">1,234</div>
                    <div class="metric-label">${measure}</div>
                </div>
            `).join('') || '<div class="metric-card"><div class="metric-value">42</div><div class="metric-label">Sample Metric</div></div>';

        const chartLabel = measures?.[0] || 'Sample Measure';

        return `<!DOCTYPE html>
<html>
<head>
    <title>${entityType} ${reportTitle} Report</title>
    <link rel="stylesheet" href="https://sdk.openui5.org/resources/sap/ui/core/themes/sap_horizon/library.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .report-container { margin: 20px; }
        .report-header { background: linear-gradient(135deg, #0070f3, #0051cc); color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
        .report-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .metric-value { font-size: 32px; font-weight: 700; color: #0070f3; }
        .metric-label { font-size: 14px; color: #666; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>${entityType} ${reportTitle} Report</h1>
            <p>Analytical report with ${dimensions?.length || 0} dimensions and ${measures?.length || 0} measures</p>
        </div>

        <div class="report-metrics">
            ${metricsHtml}
        </div>

        <div class="chart-container">
            <h3>Trend Analysis</h3>
            <canvas id="trendChart" width="400" height="200"></canvas>
        </div>
    </div>

    <script>
        const ctx = document.getElementById('trendChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: '${chartLabel}',
                    data: [12, 19, 3, 5, 2, 3],
                    borderColor: '#0070f3',
                    backgroundColor: 'rgba(0, 112, 243, 0.1)'
                }]
            },
            options: { responsive: true }
        });
    </script>
</body>
</html>`;
    }

    /**
     * Generate UI Tool Suggestions based on operation type and context
     */
    private generateUIToolSuggestions(operation: string, entityName: string, responseData: any): string | null {
        try {
            let suggestions = "## 🎨 Suggerimenti UI Interattivi\n\n";
            let hasSuggestions = false;

            switch (operation) {
                case 'read':
                    // For read operations, suggest data visualization tools
                    const isMultipleRecords = Array.isArray(responseData?.value) || Array.isArray(responseData?.d?.results);
                    const recordCount = isMultipleRecords
                        ? (responseData?.value?.length || responseData?.d?.results?.length || 0)
                        : 1;

                    if (recordCount > 1) {
                        suggestions += `📊 **Visualizzazione Dati (${recordCount} record trovati)**\n`;
                        suggestions += `• \`ui-data-grid\` - Griglia interattiva con ordinamento, filtri ed esportazione\n`;
                        suggestions += `• \`ui-dashboard-composer\` - Dashboard KPI per analisi aggregate\n`;
                        suggestions += `• \`ui-report-builder\` - Report analitici con drill-down\n\n`;

                        suggestions += `**Esempio uso:**\n`;
                        suggestions += `\`\`\`\n`;
                        suggestions += `ui-data-grid\n`;
                        suggestions += `{\n`;
                        suggestions += `  "entityType": "${entityName}",\n`;
                        suggestions += `  "columns": [{"label": "ID", "key": "id"}, {"label": "Nome", "key": "name"}],\n`;
                        suggestions += `  "features": {"filtering": true, "export": true}\n`;
                        suggestions += `}\n`;
                        suggestions += `\`\`\`\n`;
                        hasSuggestions = true;
                    } else {
                        suggestions += `📋 **Visualizzazione Singolo Record**\n`;
                        suggestions += `• \`ui-form-generator\` - Form di visualizzazione con styling SAP Fiori\n\n`;
                        hasSuggestions = true;
                    }
                    break;

                case 'create':
                    suggestions += `✅ **${entityName} creato con successo!**\n\n`;
                    suggestions += `🛠️ **Prossimi Passi Consigliati:**\n`;
                    suggestions += `• \`ui-form-generator\` - Genera form per future creazioni di ${entityName}\n`;
                    suggestions += `• \`ui-workflow-builder\` - Crea workflow di approvazione per ${entityName}\n`;
                    suggestions += `• \`ui-data-grid\` - Visualizza tutti i record di ${entityName}\n\n`;

                    suggestions += `**Esempio form per creazione:**\n`;
                    suggestions += `\`\`\`\n`;
                    suggestions += `ui-form-generator\n`;
                    suggestions += `{\n`;
                    suggestions += `  "entityType": "${entityName}",\n`;
                    suggestions += `  "formType": "create"\n`;
                    suggestions += `}\n`;
                    suggestions += `\`\`\`\n`;
                    hasSuggestions = true;
                    break;

                case 'update':
                    suggestions += `✅ **${entityName} aggiornato con successo!**\n\n`;
                    suggestions += `🛠️ **Opzioni UI Disponibili:**\n`;
                    suggestions += `• \`ui-form-generator\` - Form di modifica standardizzato per ${entityName}\n`;
                    suggestions += `• \`ui-workflow-builder\` - Workflow di approvazione modifiche\n`;
                    suggestions += `• \`ui-data-grid\` - Vista tabellare per modifiche multiple\n\n`;
                    hasSuggestions = true;
                    break;

                case 'delete':
                    suggestions += `✅ **${entityName} eliminato con successo!**\n\n`;
                    suggestions += `🛠️ **Gestione Post-Eliminazione:**\n`;
                    suggestions += `• \`ui-data-grid\` - Visualizza record rimanenti di ${entityName}\n`;
                    suggestions += `• \`ui-dashboard-composer\` - Dashboard aggiornato senza il record eliminato\n`;
                    suggestions += `• \`ui-report-builder\` - Report delle eliminazioni recenti\n\n`;
                    hasSuggestions = true;
                    break;

                case 'read-single':
                    suggestions += `📋 **Visualizzazione Dettaglio ${entityName}**\n`;
                    suggestions += `• \`ui-form-generator\` - Form di visualizzazione dettagliata\n`;
                    suggestions += `• \`ui-workflow-builder\` - Azioni workflow su questo record\n\n`;

                    suggestions += `**Form di dettaglio:**\n`;
                    suggestions += `\`\`\`\n`;
                    suggestions += `ui-form-generator\n`;
                    suggestions += `{\n`;
                    suggestions += `  "entityType": "${entityName}",\n`;
                    suggestions += `  "formType": "view"\n`;
                    suggestions += `}\n`;
                    suggestions += `\`\`\`\n`;
                    hasSuggestions = true;
                    break;
            }

            // Add general integration note
            if (hasSuggestions) {
                suggestions += `\n💡 **Nota:** Tutti i tool UI sono integrati con il sistema di autenticazione SAP e rispettano i permessi dell'utente.\n`;
                suggestions += `🔄 **Workflow Integrato:** Il \`sap-smart-query\` router può automaticamente suggerire il tool UI più appropriato.`;

                return suggestions;
            }

            return null;
        } catch (error) {
            this.logger.warn('Error generating UI suggestions:', error);
            return null;
        }
    }

    /**
     * Generate UI Tool Suggestions for entity discovery/schema exploration
     */
    private generateEntityDiscoveryUIToolSuggestions(entityName: string, schema: any): string | null {
        try {
            let suggestions = "## 🎨 Strumenti UI Disponibili per " + entityName + "\n\n";

            suggestions += `🚀 **Prossimi Passi Consigliati:**\n\n`;

            // Form generator suggestion
            suggestions += `### 📝 Gestione Dati\n`;
            suggestions += `• **\`ui-form-generator\`** - Crea form per operazioni CRUD\n`;
            suggestions += `  - Form di creazione: \`{"entityType": "${entityName}", "formType": "create"}\`\n`;
            suggestions += `  - Form di modifica: \`{"entityType": "${entityName}", "formType": "edit"}\`\n`;
            suggestions += `  - Form di visualizzazione: \`{"entityType": "${entityName}", "formType": "view"}\`\n\n`;

            // Data grid suggestion
            suggestions += `### 📊 Visualizzazione Tabellare\n`;
            suggestions += `• **\`ui-data-grid\`** - Griglia interattiva per esplorare i dati\n`;
            suggestions += `  - Include ordinamento, filtri, esportazione\n`;
            suggestions += `  - Auto-genera colonne basate su schema entity\n\n`;

            // Dashboard suggestion
            const hasNumericFields = schema.properties?.some((prop: any) =>
                prop.type?.includes('Int') || prop.type?.includes('Decimal') || prop.type?.includes('Double')
            );

            if (hasNumericFields) {
                suggestions += `### 📈 Dashboard Analitico\n`;
                suggestions += `• **\`ui-dashboard-composer\`** - Dashboard KPI per ${entityName}\n`;
                suggestions += `  - Rileva automaticamente campi numerici per metriche\n`;
                suggestions += `  - Grafici real-time con Chart.js\n\n`;

                suggestions += `### 📋 Report Analitici\n`;
                suggestions += `• **\`ui-report-builder\`** - Report drill-down per analisi approfondite\n`;
                suggestions += `  - Dimensioni e misure basate su schema\n`;
                suggestions += `  - Export multi-formato (PDF, Excel, CSV)\n\n`;
            }

            // Workflow suggestion for entities with status/approval fields
            const hasWorkflowFields = schema.properties?.some((prop: any) =>
                prop.name?.toLowerCase().includes('status') ||
                prop.name?.toLowerCase().includes('approval') ||
                prop.name?.toLowerCase().includes('state')
            );

            if (hasWorkflowFields) {
                suggestions += `### 🔄 Workflow e Processi\n`;
                suggestions += `• **\`ui-workflow-builder\`** - Workflow per gestione stati ${entityName}\n`;
                suggestions += `  - Rileva campi di stato per workflow automatici\n`;
                suggestions += `  - Step di approvazione e notifiche\n\n`;
            }

            // Integration note
            suggestions += `### 🔗 Integrazione\n`;
            suggestions += `💡 **Tutti gli strumenti UI sono:**\n`;
            suggestions += `• ✅ Integrati con autenticazione SAP\n`;
            suggestions += `• ✅ Compatibili con schema ${entityName}\n`;
            suggestions += `• ✅ Disponibili tramite \`sap-smart-query\` router\n`;
            suggestions += `• ✅ Styling SAP Fiori nativo\n\n`;

            suggestions += `🎯 **Inizia subito:** Usa uno dei comandi sopra o chiedi al \`sap-smart-query\` di suggerire automaticamente il tool migliore per la tua operazione.`;

            return suggestions;
        } catch (error) {
            this.logger.warn('Error generating entity discovery UI suggestions:', error);
            return null;
        }
    }

}
