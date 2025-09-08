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

export class MCPServer {
    private mcpServer: McpServer;
    private sapClient: SAPClient;
    private logger: Logger;
    private discoveredServices: ODataService[] = [];
    private toolRegistry: HierarchicalSAPToolRegistry;

    constructor(
        discoveredServices: ODataService[], 
        tokenStore?: TokenStore, 
        authServerUrl?: string
    ) {
        this.logger = new Logger('mcp-server');
        const config = new Config();
        const destinationService = new DestinationService(this.logger, config);
        this.sapClient = new SAPClient(destinationService, this.logger);
        this.discoveredServices = discoveredServices;
        this.mcpServer = new McpServer({
            name: "btp-sap-odata-to-mcp-server",
            version: "2.0.0"
        });
        this.mcpServer.server.onerror = (error) => {
            this.logger.error('MCP Server Error:', error);
            ErrorHandler.handle(error);
        };
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

export async function runStdioServer(discoveredServices: ODataService[]): Promise<void> {
    const logger = new Logger('sap-mcp-server');
    try {
        const server = await createMCPServer(discoveredServices);
        await server.connectStdio();
        logger.info('SAP MCP Server running on stdio...');
    } catch (error) {
        logger.error('Failed to start SAP MCP Server:', error);
        process.exit(1);
    }
}
