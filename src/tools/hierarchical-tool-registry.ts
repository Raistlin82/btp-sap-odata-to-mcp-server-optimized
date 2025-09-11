import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SAPClient } from "../services/sap-client.js";
import { Logger } from "../utils/logger.js";
import { ODataService, EntityType } from "../types/sap-types.js";
import { MCPAuthManager } from "../middleware/mcp-auth.js";
import { TokenStore } from "../services/token-store.js";
import { SecureErrorHandler } from "../utils/secure-error-handler.js";
import { DestinationContext, OperationType } from "../types/destination-types.js";
import { z } from "zod";

/**
 * Hierarchical Tool Registry - Solves the "tool explosion" problem
 * 
 * Instead of registering hundreds of CRUD tools upfront (5 ops × 40+ entities × services),
 * this registry uses a hierarchical discovery approach with just 4 smart tools:
 * 1. search-sap-services - Find relevant services by category/keyword
 * 2. discover-service-entities - Show entities within a specific service
 * 3. get-entity-schema - Get detailed schema for an entity
 * 4. execute-entity-operation - Perform CRUD operations on any entity
 * 
 * This reduces Claude's context from 200+ tools to just 4, solving token overflow.
 */
export class HierarchicalSAPToolRegistry {
    private serviceCategories = new Map<string, string[]>();
    private authManager?: MCPAuthManager;
    private errorHandler: SecureErrorHandler;

    constructor(
        private mcpServer: McpServer,
        private sapClient: SAPClient,
        private logger: Logger,
        private discoveredServices: ODataService[],
        tokenStore?: TokenStore,
        authServerUrl?: string
    ) {
        this.categorizeServices();
        
        // Initialize security middlewares
        this.errorHandler = new SecureErrorHandler(this.logger);
        
        // Initialize authentication manager if token store is provided
        if (tokenStore && authServerUrl) {
            this.authManager = new MCPAuthManager(tokenStore, authServerUrl, this.logger);
            this.logger.info(`✅ MCPAuthManager initialized with authServerUrl: ${authServerUrl}`);
        } else {
            this.logger.warn(`⚠️  MCPAuthManager NOT initialized - tokenStore: ${!!tokenStore}, authServerUrl: ${authServerUrl}`);
        }
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
                description: "Search and filter available SAP OData services by name, category, or keyword. Use this first to find relevant services before accessing entities.",
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
                description: "Perform CRUD operations on SAP entities. Use discover-service-entities first to understand available entities and their schemas.",
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
    }

    /**
     * Categorize services for better discovery using intelligent pattern matching
     */
    private categorizeServices(): void {
        for (const service of this.discoveredServices) {
            const categories: string[] = [];
            const id = service.id.toLowerCase();
            const title = service.title.toLowerCase();
            const desc = service.description.toLowerCase();

            // Business Partner related
            if (id.includes('business_partner') || id.includes('bp_') || id.includes('customer') || id.includes('supplier') ||
                title.includes('business partner') || title.includes('customer') || title.includes('supplier')) {
                categories.push('business-partner');
            }

            // Sales related
            if (id.includes('sales') || id.includes('order') || id.includes('quotation') || id.includes('opportunity') ||
                title.includes('sales') || title.includes('order') || desc.includes('sales')) {
                categories.push('sales');
            }

            // Finance related
            if (id.includes('finance') || id.includes('accounting') || id.includes('payment') || id.includes('invoice') ||
                id.includes('gl_') || id.includes('ar_') || id.includes('ap_') || title.includes('finance') ||
                title.includes('accounting') || title.includes('payment')) {
                categories.push('finance');
            }

            // Procurement related
            if (id.includes('purchase') || id.includes('procurement') || id.includes('vendor') || id.includes('po_') ||
                title.includes('procurement') || title.includes('purchase') || title.includes('vendor')) {
                categories.push('procurement');
            }

            // HR related
            if (id.includes('employee') || id.includes('hr_') || id.includes('personnel') || id.includes('payroll') ||
                title.includes('employee') || title.includes('human') || title.includes('personnel')) {
                categories.push('hr');
            }

            // Logistics related
            if (id.includes('logistics') || id.includes('warehouse') || id.includes('inventory') || id.includes('material') ||
                id.includes('wm_') || id.includes('mm_') || title.includes('logistics') || title.includes('material')) {
                categories.push('logistics');
            }

            // Default category if none matched
            if (categories.length === 0) {
                categories.push('all');
            }

            this.serviceCategories.set(service.id, categories);
        }

        this.logger.debug(`Categorized ${this.discoveredServices.length} services into categories`);
    }

    /**
     * Search services implementation with intelligent filtering
     */
    private async searchServices(args: Record<string, unknown>) {
        try {
            const query = (args.query as string)?.toLowerCase() || "";
            const category = args.category as string || "all";
            const limit = (args.limit as number) || 10;

            let filteredServices = this.discoveredServices;

            // Filter by category first
            if (category && category !== "all") {
                filteredServices = filteredServices.filter(service => 
                    this.serviceCategories.get(service.id)?.includes(category)
                );
            }

            // Filter by search query
            if (query) {
                filteredServices = filteredServices.filter(service =>
                    service.id.toLowerCase().includes(query) ||
                    service.title.toLowerCase().includes(query) ||
                    service.description.toLowerCase().includes(query)
                );
            }

            // Apply limit
            const totalFound = filteredServices.length;
            filteredServices = filteredServices.slice(0, limit);

            const result = {
                query: query || "all",
                category: category,
                totalFound: totalFound,
                showing: filteredServices.length,
                services: filteredServices.map(service => ({
                    id: service.id,
                    title: service.title,
                    description: service.description,
                    entityCount: service.metadata?.entityTypes?.length || 0,
                    categories: this.serviceCategories.get(service.id) || [],
                    version: service.version,
                    odataVersion: service.odataVersion
                }))
            };

            let responseText = `Found ${totalFound} SAP services`;
            if (query) responseText += ` matching "${query}"`;
            if (category !== "all") responseText += ` in category "${category}"`;
            responseText += `:\n\n${JSON.stringify(result, null, 2)}`;
            
            if (result.services.length > 0) {
                responseText += `\n\n📋 Next step: Use 'discover-service-entities' with a serviceId to see what entities are available in a specific service.`;
            } else {
                responseText += `\n\n💡 Try different search terms or categories: business-partner, sales, finance, procurement, hr, logistics`;
            }

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
                    text: `Error searching services: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
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
     * Register service metadata resources (unchanged from original)
     */
    public registerServiceMetadataResources(): void {
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
    }
}