import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';

import { MCPServer, createMCPServer } from './mcp-server.js';
import { Logger } from './utils/logger.js';
import { Config } from './utils/config.js';
import { DestinationService } from './services/destination-service.js';
import { SAPClient } from './services/sap-client.js';
import { SAPDiscoveryService } from './services/sap-discovery.js';
import { ODataService } from './types/sap-types.js';
import { ServiceDiscoveryConfigService } from './services/service-discovery-config.js';

/**
 * Modern Express server hosting SAP MCP Server with session management
 * 
 * This server provides HTTP transport for the SAP MCP server using the
 * latest streamable HTTP transport with proper session management.
 */

const logger = new Logger('btp-sap-odata-to-mcp-server');
const config = new Config();
const destinationService = new DestinationService(logger, config);
const sapClient = new SAPClient(destinationService, logger);
const sapDiscoveryService = new SAPDiscoveryService(sapClient, logger, config);
const serviceConfigService = new ServiceDiscoveryConfigService(config, logger);
let discoveredServices: ODataService[] = [];

// Session storage for HTTP transport
const sessions: Map<string, {
    server: MCPServer;
    transport: StreamableHTTPServerTransport;
    createdAt: Date;
}> = new Map();

/**
 * Clean up expired sessions (older than 24 hours)
 */
function cleanupExpiredSessions(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    for (const [sessionId, session] of sessions.entries()) {
        if (now.getTime() - session.createdAt.getTime() > maxAge) {
            logger.info(`🧹 Cleaning up expired session: ${sessionId}`);
            session.transport.close();
            sessions.delete(sessionId);
        }
    }
}

/**
 * Get or create a session for the given session ID
 */
async function getOrCreateSession(sessionId?: string): Promise<{
    sessionId: string;
    server: MCPServer;
    transport: StreamableHTTPServerTransport;
}> {
    // Check for existing session
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        logger.debug(`♻️  Reusing existing session: ${sessionId}`);
        return {
            sessionId,
            server: session.server,
            transport: session.transport
        };
    }

    // Create new session
    const newSessionId = sessionId || randomUUID();
    logger.info(`🆕 Creating new MCP session: ${newSessionId}`);

    try {
        // Create and initialize MCP server
        const mcpServer = await createMCPServer(discoveredServices);

        // Create HTTP transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: (id) => {
                logger.debug(`✅ Session initialized: ${id}`);
            },
            enableDnsRebindingProtection: false,  // Disable for MCP inspector compatibility
            allowedHosts: ['127.0.0.1', 'localhost']
        });

        // Connect server to transport
        await mcpServer.getServer().connect(transport);

        // Store session
        sessions.set(newSessionId, {
            server: mcpServer,
            transport,
            createdAt: new Date()
        });

        // Clean up session when transport closes
        transport.onclose = () => {
            logger.info(`🔌 Transport closed for session: ${newSessionId}`);
            sessions.delete(newSessionId);
        };

        logger.info(`🎉 Session created successfully: ${newSessionId}`);
        return {
            sessionId: newSessionId,
            server: mcpServer,
            transport
        };

    } catch (error) {
        logger.error(`❌ Failed to create session: ${error}`);
        throw error;
    }
}

/**
 * Create Express application
 */
export function createApp(): express.Application {
    const app = express();

    // Security and parsing middleware
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"]
            }
        }
    }));

    app.use(cors({
        origin: process.env.NODE_ENV === 'production'
            ? ['https://your-domain.com'] // Configure for production
            : true, // Allow all origins in development
        credentials: true,
        exposedHeaders: ['Mcp-Session-Id'],
        allowedHeaders: ['Content-Type', 'mcp-session-id', 'MCP-Protocol-Version']
    }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    app.use((req, res, next) => {
        logger.debug(`📨 ${req.method} ${req.path}`, {
            sessionId: req.headers['mcp-session-id'],
            userAgent: req.headers['user-agent']
        });
        next();
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            activeSessions: sessions.size,
            version: process.env.npm_package_version || '1.0.0'
        });
    });

    // MCP server info endpoint
    app.get('/mcp', (req, res) => {
        res.json({
            name: 'btp-sap-odata-to-mcp-server',
            version: '2.0.0',
            description: 'Modern MCP server for SAP SAP OData services with dynamic CRUD operations',
            protocol: {
                version: '2025-06-18',
                transport: 'streamable-http'
            },
            capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true },
                logging: {}
            },
            features: [
                'Dynamic SAP OData service discovery',
                'CRUD operations for all discovered entities',
                'Natural language query support',
                'Session-based HTTP transport',
                'Real-time service metadata'
            ],
            endpoints: {
                health: '/health',
                mcp: '/mcp'
            },
            activeSessions: sessions.size
        });
    });

    // Main MCP endpoint - handles all MCP communication
    app.post('/mcp', async (req, res) => {
        try {
            // Get session ID from header
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let session;

            if (sessionId && sessions.has(sessionId)) {
                // Reuse existing session
                session = await getOrCreateSession(sessionId);
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request
                session = await getOrCreateSession();
            } else {
                // Invalid request
                logger.warn(`❌ Invalid MCP request - no session ID and not initialize request`);
                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Bad Request: No valid session ID provided or not an initialize request'
                    },
                    id: req.body?.id || null
                });
            }

            // Handle the request
            await session.transport.handleRequest(req, res, req.body);

        } catch (error) {
            logger.error('❌ Error handling MCP request:', error);

            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    },
                    id: req.body?.id || null
                });
            }
        }
    });

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', async (req, res) => {
        try {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;

            if (!sessionId || !sessions.has(sessionId)) {
                logger.warn(`❌ Invalid session ID for SSE: ${sessionId}`);
                return res.status(400).json({
                    error: 'Invalid or missing session ID'
                });
            }

            const session = sessions.get(sessionId)!;
            await session.transport.handleRequest(req, res);

        } catch (error) {
            logger.error('❌ Error handling SSE request:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    // Handle session termination
    app.delete('/mcp', async (req, res) => {
        try {
            const sessionId = req.headers['mcp-session-id'] as string | undefined;

            if (!sessionId || !sessions.has(sessionId)) {
                logger.warn(`❌ Cannot terminate - invalid session ID: ${sessionId}`);
                return res.status(400).json({
                    error: 'Invalid or missing session ID'
                });
            }

            const session = sessions.get(sessionId)!;

            // Handle the termination request
            await session.transport.handleRequest(req, res);

            // Clean up session
            sessions.delete(sessionId);
            logger.info(`🗑️  Session terminated: ${sessionId}`);

        } catch (error) {
            logger.error('❌ Error terminating session:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    });

    // Handle HEAD requests to /mcp (for health checks)
    app.head('/mcp', (req, res) => {
        res.status(200).end();
    });

    // OAuth endpoints (placeholder - not implemented)
    app.get('/oauth/authorize', (req, res) => {
        res.status(501).json({
            error: 'OAuth not implemented',
            message: 'This SAP MCP server uses BTP destination authentication'
        });
    });

    app.post('/oauth/token', (req, res) => {
        res.status(501).json({
            error: 'OAuth not implemented',
            message: 'This SAP MCP server uses BTP destination authentication'
        });
    });

    // API documentation endpoint
    app.get('/docs', (req, res) => {
        res.json({
            title: 'SAP MCP Server API',
            description: 'Modern Model Context Protocol server for SAP SAP OData services',
            version: '2.0.0',
            endpoints: {
                'GET /health': 'Health check endpoint',
                'GET /mcp': 'MCP server information and SSE endpoint',
                'POST /mcp': 'Main MCP communication endpoint',
                'DELETE /mcp': 'Session termination endpoint',
                'GET /docs': 'This API documentation'
            },
            mcpCapabilities: {
                tools: 'Dynamic CRUD operations for all discovered SAP entities',
                resources: 'Service metadata and entity information',
                logging: 'Comprehensive logging support'
            },
            usage: {
                exampleQueries: [
                    '"show me 10 banks"',
                    '"update bank with id 1 to have street number 5"',
                    '"create a new customer with name John Doe"',
                    '"delete the order with ID 12345"'
                ],
                sessionManagement: 'Automatic session creation and cleanup',
                authentication: 'Uses SAP BTP destination service for SAP authentication'
            }
        });
    });

    // Service discovery configuration endpoints
    app.get('/config/services', (req, res) => {
        try {
            const configSummary = serviceConfigService.getConfigurationSummary();
            res.json(configSummary);
        } catch (error) {
            logger.error('Failed to get service configuration:', error);
            res.status(500).json({ error: 'Failed to get service configuration' });
        }
    });

    // Test service patterns endpoint
    app.post('/config/services/test', (req, res) => {
        try {
            const { serviceNames } = req.body;

            if (!Array.isArray(serviceNames)) {
                return res.status(400).json({ error: 'serviceNames must be an array of strings' });
            }

            const testResult = serviceConfigService.testPatterns(serviceNames);
            res.json(testResult);
        } catch (error) {
            logger.error('Failed to test service patterns:', error);
            res.status(500).json({ error: 'Failed to test service patterns' });
        }
    });

    // Update service configuration endpoint
    app.post('/config/services/update', (req, res) => {
        try {
            const newConfig = req.body;
            serviceConfigService.updateConfiguration(newConfig);

            const updatedConfig = serviceConfigService.getConfigurationSummary();
            res.json({
                message: 'Configuration updated successfully',
                configuration: updatedConfig
            });
        } catch (error) {
            logger.error('Failed to update service configuration:', error);
            res.status(500).json({ error: 'Failed to update service configuration' });
        }
    });
    // Handle 404s
    app.use((req, res) => {
        logger.warn(`❌ 404 - Not found: ${req.method} ${req.path}`);
        res.status(404).json({
            error: 'Not Found',
            message: `The requested endpoint ${req.method} ${req.path} was not found`,
            availableEndpoints: ['/health', '/mcp', '/docs']
        });
    });

    // Global error handler
    app.use((error: Error, req: express.Request, res: express.Response) => {
        logger.error('❌ Unhandled error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    });

    // Clean up expired sessions every hour
    setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

    return app;
}

/**
 * Start the server
 */
export async function startServer(port: number = 3000): Promise<void> {
    const app = createApp();

    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(port, async () => {
                logger.info(`🚀 SAP MCP Server running at http://localhost:${port}`);
                logger.info(`📊 Health check: http://localhost:${port}/health`);
                logger.info(`📚 API docs: http://localhost:${port}/docs`);
                logger.info(`🔧 MCP endpoint: http://localhost:${port}/mcp`);

                logger.info('🚀 Initializing Modern SAP MCP Server...');

                // Initialize destination service
                await destinationService.initialize();

                // Discover SAP OData services
                logger.info('🔍 Discovering SAP OData services...');
                discoveredServices = await sapDiscoveryService.discoverAllServices();

                logger.info(`✅ Discovered ${discoveredServices.length} OData services`);
                resolve();
            });

            server.on('error', (error) => {
                logger.error(`❌ Server error:`, error);
                reject(error);
            });

            // Graceful shutdown
            process.on('SIGTERM', () => {
                logger.info('🛑 SIGTERM received, shutting down gracefully...');

                // Close all sessions
                for (const [sessionId, session] of sessions.entries()) {
                    logger.info(`🔌 Closing session: ${sessionId}`);
                    session.transport.close();
                }
                sessions.clear();

                server.close(() => {
                    logger.info('✅ Server shut down successfully');
                    process.exit(0);
                });
            });

        } catch (error) {
            logger.error(`❌ Failed to start server:`, error);
            reject(error);
        }
    });
}

// Start server if this file is run directly
const port = parseInt(process.env.PORT || '3000');
startServer(port).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
