#!/usr/bin/env node

// Core MCP server implementation for SAP BTP integration
// Provides MCP (Model Context Protocol) server with SAP OData service discovery and tool registry

import { HierarchicalSAPToolRegistry } from './tools/hierarchical-tool-registry.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import 'dotenv/config';
import { DestinationService } from './services/destination-service.js';
import { SAPClient } from './services/sap-client.js';
import { Logger } from './utils/logger.js';
import { Config } from './utils/config.js';
import { ErrorHandler } from './utils/error-handler.js';
import { ODataService } from './types/sap-types.js';
import { TokenStore } from './services/token-store.js';

/**
 * Main MCP server class that orchestrates SAP BTP integration
 * Handles service discovery, tool registration, and protocol communication
 */
export class MCPServer {
    private mcpServer: McpServer; // Core MCP protocol server
    private sapClient: SAPClient; // SAP system communication client
    private logger: Logger; // Centralized logging service
    private discoveredServices: ODataService[] = []; // Cache of discovered SAP services
    private toolRegistry: HierarchicalSAPToolRegistry; // Dynamic tool registry for SAP operations

    /**
     * Initialize MCP server with SAP service discovery and authentication
     * @param discoveredServices - Pre-discovered SAP OData services
     * @param tokenStore - Optional token storage for authentication
     * @param authServerUrl - Optional authentication server URL
     */
    constructor(
        discoveredServices: ODataService[],
        tokenStore?: TokenStore,
        authServerUrl?: string
    ) {
        this.logger = new Logger('mcp-server');
        const config = new Config();

        // Initialize SAP connectivity components
        const destinationService = new DestinationService(this.logger, config);
        this.sapClient = new SAPClient(destinationService, this.logger);

        // Store discovered services for tool generation
        this.discoveredServices = discoveredServices;

        // Create core MCP server instance
        this.mcpServer = new McpServer({
            name: "btp-sap-odata-to-mcp-server",
            version: "2.0.0"
        });

        // Configure global error handling
        this.mcpServer.server.onerror = (error) => {
            this.logger.error('MCP Server Error:', error);
            ErrorHandler.handle(error);
        };

        // Initialize hierarchical tool registry for dynamic SAP tool creation
        this.toolRegistry = new HierarchicalSAPToolRegistry(
            this.mcpServer,
            this.sapClient,
            this.logger,
            this.discoveredServices,
            tokenStore,
            authServerUrl
        );
    }

    async initialize(): Promise<void> {
        try {
            this.toolRegistry.registerServiceMetadataResources();
            await this.toolRegistry.registerDiscoveryTools();
            this.logger.info('🔧 Registered MCP tools for SAP operations');
        } catch (error) {
            this.logger.error('❌ Failed to initialize server:', error);
            throw error;
        }
    }

    async connectStdio(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.mcpServer.connect(transport);
        this.logger.info('📡 Connected to stdio transport');
    }

    createHTTPTransport(options?: {
        enableDnsRebindingProtection?: boolean;
        allowedHosts?: string[];
    }): StreamableHTTPServerTransport {
        return new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            enableDnsRebindingProtection: options?.enableDnsRebindingProtection || true,
            allowedHosts: options?.allowedHosts || ['127.0.0.1', 'localhost']
        });
    }

    getServer(): McpServer {
        return this.mcpServer;
    }

    getToolRegistry(): HierarchicalSAPToolRegistry {
        return this.toolRegistry;
    }
}

export async function createMCPServer(
    discoveredServices: ODataService[], 
    tokenStore?: TokenStore, 
    authServerUrl?: string
): Promise<MCPServer> {
    const server = new MCPServer(discoveredServices, tokenStore, authServerUrl);
    await server.initialize();
    return server;
}

export async function runStdioServer(
    discoveredServices: ODataService[],
    tokenStore?: TokenStore, 
    authServerUrl?: string
): Promise<void> {
    const logger = new Logger('sap-mcp-server');
    try {
        const server = await createMCPServer(discoveredServices, tokenStore, authServerUrl);
        await server.connectStdio();
        logger.info('SAP MCP Server running on stdio...');
    } catch (error) {
        logger.error('Failed to start SAP MCP Server:', error);
        process.exit(1);
    }
}

// Entry point when file is executed directly  
if (import.meta.url === `file://${process.argv[1]}`) {
    const logger = new Logger('sap-mcp-server');
    
    logger.info('🚀 Starting SAP MCP Server in stdio mode with PRODUCTION authentication...');
    
    // Import necessary services for authentication
    import('./services/destination-service.js').then(({ DestinationService }) => {
        return import('./services/sap-client.js');
    }).then(({ SAPClient }) => {
        return import('./utils/config.js');
    }).then(({ Config }) => {
        return import('./services/token-store.js');
    }).then(({ TokenStore }) => {
        
        const config = new Config();
        
        // Initialize TokenStore for SAP authentication
        const tokenStore = new TokenStore();
        
        // Get AuthServer URL from environment variables
        const authServerUrl = process.env.AUTH_SERVER_URL || `http://localhost:${process.env.AUTH_PORT || 3001}`;
        
        logger.info(`🔐 Initializing SAP Authentication:`);
        logger.info(`   - TokenStore: ${!!tokenStore}`);
        logger.info(`   - AuthServerUrl: ${authServerUrl}`);
        logger.info(`   - SAP_IAS_URL: ${process.env.SAP_IAS_URL || 'NOT SET'}`);
        logger.info(`   - SAP_IAS_CLIENT_ID: ${process.env.SAP_IAS_CLIENT_ID ? 'SET' : 'NOT SET'}`);
        
        // Discover SAP services using authenticated client
        const destinationService = new DestinationService(logger, config);
        const sapClient = new SAPClient(destinationService, logger);
        
        // Initialize service discovery
        return sapClient.discoverServices().then((discoveredServices) => {
            logger.info(`🔍 Discovered ${discoveredServices.length} SAP services for authenticated access`);
            
            // Start MCP server with full authentication
            return runStdioServer(discoveredServices, tokenStore, authServerUrl);
        });
        
    }).catch((error) => {
        logger.error('❌ Failed to initialize SAP Authentication:', error);
        logger.info('🔄 Falling back to basic mode without authentication...');
        
        // Fallback: start without authentication for development
        const discoveredServices: ODataService[] = [];
        runStdioServer(discoveredServices).catch((fallbackError) => {
            logger.error('Failed to start MCP server even in fallback mode:', fallbackError);
            process.exit(1);
        });
    });
}
