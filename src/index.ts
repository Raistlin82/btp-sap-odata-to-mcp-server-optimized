import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import 'dotenv/config';
import { authMiddleware, requireRead, requireWrite, requireDelete, requireAdmin, optionalAuth, AuthenticatedRequest } from './middleware/auth.js';
import { ShutdownManager } from './utils/shutdown-manager.js';
import { SecureErrorHandler } from './utils/secure-error-handler.js';
import { JWTUtils } from './utils/jwt-utils.js';
import { CloudLoggingService } from './services/cloud-logging-service.js';
import { HealthService } from './services/health-service.js';

import { MCPServer, createMCPServer } from './mcp-server.js';
import { Logger } from './utils/logger.js';
import { Config } from './utils/config.js';
import { DestinationService } from './services/destination-service.js';
import { SAPClient } from './services/sap-client.js';
import { SAPDiscoveryService } from './services/sap-discovery.js';
import { ODataService } from './types/sap-types.js';
import { ServiceDiscoveryConfigService } from './services/service-discovery-config.js';
import { AuthServer } from './services/auth-server.js';
import { aiIntegration } from './services/ai-integration.js';

/**
 * Modern Express server hosting SAP MCP Server with session management
 * 
 * This server provides HTTP transport for the SAP MCP server using the
 * latest streamable HTTP transport with proper session management.
 */

const logger = new Logger('btp-sap-odata-to-mcp-server');

// Initialize shutdown manager for graceful cleanup
const shutdownManager = new ShutdownManager(logger);
const config = new Config();

// Initialize cloud logging service
const cloudLoggingService = new CloudLoggingService('btp-sap-odata-to-mcp-server', '1.0.0');

// Initialize services
const destinationService = new DestinationService(logger, config);
const sapClient = new SAPClient(destinationService, logger);
const sapDiscoveryService = new SAPDiscoveryService(sapClient, logger, config);
const serviceConfigService = new ServiceDiscoveryConfigService(config, logger);
let discoveredServices: ODataService[] = [];

// Initialize health service (will be initialized after auth components are ready)
let healthService: HealthService;

/**
 * Reload OData service configuration and rediscover services
 */
async function reloadODataServices(): Promise<{ success: boolean; servicesCount: number; message: string }> {
    const startTime = Date.now();
    
    try {
        logger.info('🔄 Reloading OData configuration and rediscovering services...');
        
        // Log service discovery start
        cloudLoggingService.logSAPIntegrationEvent('info', 'service_discovery', 
            'Starting OData service rediscovery', {
                operation: 'reload_configuration'
            });
        
        // Reload configuration from CF services and environment
        await config.reloadODataConfig();
        
        // Rediscover services with new configuration
        const newServices = await sapDiscoveryService.discoverAllServices();
        
        // Update the global services list
        discoveredServices = newServices;

        // Update all active MCP server sessions with the new services
        let updatedSessions = 0;
        for (const [sessionId, session] of sessions.entries()) {
            try {
                await session.server.getToolRegistry().updateDiscoveredServices(newServices);
                updatedSessions++;
                logger.debug(`✅ Updated session ${sessionId} with ${newServices.length} services`);
            } catch (error) {
                logger.error(`❌ Failed to update session ${sessionId}:`, error);
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`✅ Service rediscovery complete: ${newServices.length} services found, ${updatedSessions} sessions updated`);
        
        // Log successful discovery
        cloudLoggingService.logSAPIntegrationEvent('info', 'service_discovery', 
            'OData service rediscovery completed successfully', {
                servicesCount: newServices.length,
                duration,
                operation: 'rediscovery_complete'
            });
            
        cloudLoggingService.logPerformanceMetrics('odata_service_discovery', 'rediscover_all', {
            duration,
            servicesCount: newServices.length
        });
        
        return {
            success: true,
            servicesCount: newServices.length,
            message: `Successfully rediscovered ${newServices.length} OData services with updated configuration`
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('❌ Failed to reload OData services:', error);
        
        // Log discovery failure
        cloudLoggingService.logSAPIntegrationEvent('error', 'service_discovery', 
            'OData service rediscovery failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
                operation: 'rediscovery_failed'
            });
        
        return {
            success: false,
            servicesCount: 0,
            message: `Failed to reload services: ${error}`
        };
    }
}

async function getODataConfigStatus(): Promise<{ 
    config: Record<string, unknown>; 
    servicesCount: number; 
    discoveredServices: Array<{ id: string; name: string; url: string; entities: number }>;
}> {
    try {
        // Get current configuration
        const currentConfig = config.getServiceFilterConfig();
        
        // Get discovered services summary
        const servicesSummary = discoveredServices.map(service => ({
            id: service.id,
            name: service.title || service.id,
            url: service.url,
            entities: service.entitySets ? service.entitySets.length : 0
        }));

        return {
            config: {
                ...currentConfig,
                configurationSource: getConfigurationSource()
            },
            servicesCount: discoveredServices.length,
            discoveredServices: servicesSummary
        };
    } catch (error) {
        logger.error('❌ Failed to get OData config status:', error);
        return {
            config: { error: `Failed to get status: ${error}` },
            servicesCount: 0,
            discoveredServices: []
        };
    }
}

async function getDestinationStatus(userJWT?: string): Promise<{
    designTime: { name: string; available: boolean; error?: string; authType?: string };
    runtime: { name: string; available: boolean; error?: string; authType?: string; hybrid?: boolean };
    config: { useSingleDestination: boolean; };
}> {
    try {
        const destinationConfig = config.getDestinationConfig();
        
        // Test design-time destination
        const designTimeTest = await destinationService.testDestination('design-time');
        const designTimeResult = {
            name: destinationConfig.designTimeDestination,
            available: designTimeTest.available,
            error: designTimeTest.error,
            authType: 'BasicAuthentication' // Design-time typically uses basic auth
        };

        // Test runtime destination (may be same as design-time if single destination mode)
        // Use secure JWT utility for consistent token handling
        const cleanJWT = JWTUtils.cleanBearerToken(userJWT);
        
        // Log JWT info securely
        JWTUtils.logTokenInfo(userJWT, 'Runtime destination testing', logger);
        
        const runtimeTest = await destinationService.testDestinationWithJWT('runtime', cleanJWT);
        
        // Try to get more detailed info about runtime destination authentication
        let authType = 'BasicAuthentication';
        let hybrid = false;
        
        try {
            // Attempt to get destination details to check authentication type
            logger.debug('Fetching runtime destination for auth type detection...');
            
            // Use secure JWT passing for destination auth detection
            if (cleanJWT) {
                logger.debug(`Using user JWT for destination auth detection (length: ${cleanJWT.length})`);
            } else {
                logger.debug('No user JWT available for destination auth detection');
            }
            
            const runtimeDest = await destinationService.getRuntimeDestinationWithJWT(cleanJWT);
            
            logger.debug('Runtime destination details:', {
                name: destinationConfig.runtimeDestination,
                authentication: runtimeDest.authentication,
                hasUsername: !!runtimeDest.username,
                hasPassword: !!runtimeDest.password,
                url: runtimeDest.url ? '[REDACTED]' : 'undefined'
            });
            
            if (runtimeDest.authentication === 'PrincipalPropagation') {
                authType = 'PrincipalPropagation';
                // Check if it also has basic auth credentials for fallback
                hybrid = !!(runtimeDest.username && runtimeDest.password);
                logger.info(`Runtime destination uses Principal Propagation${hybrid ? ' with BasicAuth fallback' : ''}`);
            } else if (runtimeDest.authentication === 'BasicAuthentication') {
                authType = 'BasicAuthentication';
                logger.info('Runtime destination uses BasicAuthentication');
            } else {
                logger.warn(`Unknown authentication type: ${runtimeDest.authentication}`);
                authType = runtimeDest.authentication || 'Unknown';
            }
        } catch (error) {
            logger.error('Failed to determine runtime destination auth type:', error);
            
            // Check if it's a Principal Propagation JWT error
            const errorMessage = (error as any)?.message || String(error) || '';
            if (errorMessage.includes('user token') || errorMessage.includes('PrincipalPropagation')) {
                authType = 'PrincipalPropagation';
                logger.info('Detected Principal Propagation destination (JWT required)');
            } else {
                authType = 'Detection Failed';
            }
        } finally {
            // No cleanup needed - JWT was passed securely without environment variables
            logger.debug('Completed destination testing with secure JWT handling');
        }

        const runtimeResult = {
            name: destinationConfig.runtimeDestination,
            available: runtimeTest.available,
            error: runtimeTest.error,
            authType,
            hybrid
        };

        return {
            designTime: designTimeResult,
            runtime: runtimeResult,
            config: {
                useSingleDestination: destinationConfig.useSingleDestination
            }
        };
    } catch (error) {
        logger.error('❌ Failed to get destination status:', error);
        return {
            designTime: { name: 'Unknown', available: false, error: `Status check failed: ${error}` },
            runtime: { name: 'Unknown', available: false, error: `Status check failed: ${error}` },
            config: { useSingleDestination: false }
        };
    }
}

function getConfigurationSource(): string {
    // Check if configuration is coming from CF services, environment, or .env
    if (process.env.VCAP_SERVICES) {
        try {
            const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
            if (vcapServices['user-provided']) {
                const odataConfig = vcapServices['user-provided'].find((service: any) => 
                    service.name === 'odata-config' || service.name === 'mcp-odata-config'
                );
                if (odataConfig) {
                    return `CF User-Provided Service: ${odataConfig.name}`;
                }
            }
        } catch (error) {
            // Fall through to environment check
        }
    }
    
    if (process.env.ODATA_SERVICE_PATTERNS) {
        return 'CF Environment Variables';
    }
    
    return 'Local .env File';
}

// Initialize authentication server with error handling
let authServer: AuthServer;
let tokenStore: any;

try {
    authServer = new AuthServer({
        port: parseInt(process.env.AUTH_PORT || '3001'),
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://127.0.0.1:3000']
    });
    tokenStore = authServer.getTokenStore();
    
    // Register cleanup callbacks with shutdown manager
    shutdownManager.registerCleanupCallback(async () => {
        logger.info('Shutting down token store...');
        tokenStore?.shutdown();
    }, 'token-store-cleanup');
    
    shutdownManager.registerCleanupCallback(async () => {
        logger.info('Shutting down auth server...');
        // Auth server doesn't have explicit shutdown, but we'll close any resources
        if (authServer) {
            logger.info('Auth server cleanup completed');
        }
    }, 'auth-server-cleanup');
    
    shutdownManager.registerCleanupCallback(async () => {
        logger.info('Shutting down cloud logging...');
        await cloudLoggingService.flush();
    }, 'cloud-logging-cleanup');
    
    // Set up OData callbacks for admin endpoints
    authServer.setReloadCallback(reloadODataServices);
    authServer.setStatusCallback(getODataConfigStatus);
    authServer.setDestinationStatusCallback(getDestinationStatus);
    
    logger.info('✅ Auth server initialized successfully');
} catch (error) {
    logger.error('❌ Failed to initialize auth server:', error);
    // Create a stub so the rest of the app can continue
    authServer = null as any;
    tokenStore = null;
}

// Initialize health service now that other components are ready
try {
    const iasAuthService = authServer?.getIASAuthService();
    healthService = new HealthService(
        cloudLoggingService,
        destinationService,
        tokenStore,
        iasAuthService
    );
    logger.info('✅ Health monitoring service initialized');
} catch (error) {
    logger.warn('⚠️  Health service initialization failed:', error);
    // Create basic health service without optional dependencies
    healthService = new HealthService();
}

// Session storage for HTTP transport
const sessions: Map<string, {
    server: MCPServer;
    transport: StreamableHTTPServerTransport;
    createdAt: Date;
    userSessionId?: string;  // Associate MCP session with user authentication session
}> = new Map();

// Mapping: MCP Session ID → User Session ID
const mcpSessionToUserSession: Map<string, string> = new Map();

/**
 * Associate an MCP session with a user authentication session
 */
function associateMCPSessionWithUser(mcpSessionId: string, userSessionId: string): void {
    logger.info(`🔗 Associating MCP session ${mcpSessionId} with user session ${userSessionId}`);

    // Update the session object
    const session = sessions.get(mcpSessionId);
    if (session) {
        session.userSessionId = userSessionId;
        sessions.set(mcpSessionId, session);
    }

    // Update the mapping
    mcpSessionToUserSession.set(mcpSessionId, userSessionId);
}

/**
 * Get user session ID for an MCP session
 */
function getUserSessionForMCPSession(mcpSessionId: string): string | undefined {
    return mcpSessionToUserSession.get(mcpSessionId);
}

/**
 * Create automatic association when user provides session ID for the first time
 * This function will be used by the auth middleware
 */
export function createAutoAssociation(userSessionId: string): void {
    // When a user session ID is used successfully, we create an association
    // with the most recent MCP session that doesn't have an association yet

    // Find MCP sessions without user session associations
    for (const [mcpSessionId, session] of sessions.entries()) {
        if (!session.userSessionId && !mcpSessionToUserSession.has(mcpSessionId)) {
            // This is a candidate for association
            logger.info(`🔗 Auto-associating recent unassociated MCP session ${mcpSessionId} with user session ${userSessionId}`);
            associateMCPSessionWithUser(mcpSessionId, userSessionId);
            return; // Only associate with the first found session
        }
    }

    logger.debug(`No unassociated MCP sessions found for auto-association with user session ${userSessionId}`);
}

/**
 * Get user session ID for current request (used by auth middleware)
 * This will check all current MCP sessions for associations
 */
export function getCurrentUserSessionId(): string | undefined {
    // For now, return the user session from the most recently created MCP session that has an association
    let mostRecentSession: { mcpSessionId: string; userSessionId: string; createdAt: Date } | undefined;

    for (const [mcpSessionId, session] of sessions.entries()) {
        if (session.userSessionId) {
            if (!mostRecentSession || session.createdAt > mostRecentSession.createdAt) {
                mostRecentSession = {
                    mcpSessionId,
                    userSessionId: session.userSessionId,
                    createdAt: session.createdAt
                };
            }
        }
    }

    return mostRecentSession?.userSessionId;
}

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
            // Also remove from user session mapping
            mcpSessionToUserSession.delete(sessionId);
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
        // Create and initialize MCP server with authentication
        // Use the same URL as the main server when deployed (no separate auth port)
        const authServerUrl = process.env.VCAP_APPLICATION ? 
            `https://${JSON.parse(process.env.VCAP_APPLICATION).application_uris[0]}/auth` :  // When deployed to CF
            `http://localhost:${process.env.AUTH_PORT || '3001'}/auth`;  // Local development
        const mcpServer = await createMCPServer(discoveredServices, tokenStore, authServerUrl);

        // Create HTTP transport
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
            onsessioninitialized: (id) => {
                logger.debug(`✅ Session initialized: ${id}`);
            },
            enableDnsRebindingProtection: false,  // Disable for MCP inspector compatibility
            allowedHosts: ['127.0.0.1', 'localhost', '*']  // Allow all hosts for deployed version
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
                scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for login page
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https:"], // Allow HTTPS connections
                fontSrc: ["'self'", "https:", "data:"]
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
    
    // Add cloud logging middleware
    app.use(cloudLoggingService.createRequestLoggingMiddleware());
    
    // Make cloud logging service available to routes
    app.locals.cloudLogging = cloudLoggingService;

    // Enhanced request logging with cloud logging integration
    app.use((req: AuthenticatedRequest, res, next) => {
        const correlationId = req.headers['x-correlation-id'] as string;
        
        // Use cloud logging for structured application events
        cloudLoggingService.logApplicationEvent('info', 'http_request_start', 
            `${req.method} ${req.path}`, {
            correlationId,
            sessionId: req.headers['mcp-session-id'] as string,
            userAgent: req.headers['user-agent'],
            user: req.authInfo?.user || 'anonymous',
            authenticated: req.authInfo?.isAuthenticated || false,
            ipAddress: req.ip
        });
        
        // Also log to winston for local development
        logger.debug(`📨 ${req.method} ${req.path}`, {
            correlationId,
            sessionId: req.headers['mcp-session-id'],
            userAgent: req.headers['user-agent'],
            user: req.authInfo?.user || 'anonymous',
            authenticated: req.authInfo?.isAuthenticated || false
        });
        next();
    });

    // Apply authentication middleware to protected routes only
    // Health check, docs, and MCP endpoints are public
    app.use('/config', authMiddleware, requireAdmin);  // Config endpoints require admin

    // Mount authentication server routes with error handling
    if (!authServer) {
        logger.error('❌ Auth server not initialized! Authentication endpoints will not be available.');
    } else {
        try {
            const authApp = authServer.getApp();
            logger.info(`🔐 Mounting auth server app at /auth`);
            
            if (!authApp) {
                logger.error('❌ Auth server app is undefined! Authentication endpoints will not work.');
            } else {
                app.use('/auth', authApp);
                logger.info('✅ Auth server successfully mounted at /auth');
            }
        } catch (error) {
            logger.error('❌ Failed to mount auth server:', error);
            logger.error('❌ Authentication endpoints will not be available!');
        }
    }

    // Add explicit login route that serves the login page
    app.get('/login', (req, res) => {
        // Preserve query parameters in redirect
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        res.redirect('/auth/' + queryString);
    });

    // Simple test endpoint
    app.get('/', (req, res) => {
        res.json({
            message: 'SAP MCP Server is running',
            timestamp: new Date().toISOString(),
            endpoints: ['/health', '/mcp', '/docs', '/login', '/auth/status']
        });
    });

    // Enhanced health check endpoints
    app.get('/health', async (req, res) => {
        try {
            const health = await healthService.deepHealthCheck();
            const statusCode = health.overall === 'healthy' ? 200 : 
                              health.overall === 'degraded' ? 200 : 503;
            
            res.status(statusCode).json({
                ...health,
                activeSessions: sessions.size,
                authServer: {
                    status: authServer ? 'running' : 'disabled',
                    port: process.env.AUTH_PORT || '3001'
                }
            });
        } catch (error) {
            logger.error('Health check failed:', error);
            res.status(503).json({
                overall: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Health check system failure'
            });
        }
    });
    
    // Kubernetes liveness probe
    app.get('/health/live', async (req, res) => {
        try {
            const result = await healthService.livenessProbe();
            const statusCode = result.status === 'unhealthy' ? 503 : 200;
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Liveness probe failed'
            });
        }
    });
    
    // Kubernetes readiness probe
    app.get('/health/ready', async (req, res) => {
        try {
            const result = await healthService.readinessProbe();
            const statusCode = result.status === 'unhealthy' ? 503 : 200;
            res.status(statusCode).json(result);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Readiness probe failed'
            });
        }
    });
    
    // Legacy health endpoint for backward compatibility
    app.get('/health/legacy', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            activeSessions: sessions.size,
            version: process.env.npm_package_version || '1.0.0',
            authServer: {
                status: authServer ? 'running' : 'disabled',
                port: process.env.AUTH_PORT || '3001'
            }
        });
    });

    // AI Integration health endpoint
    app.get('/health/ai', async (req, res) => {
        try {
            const aiHealth = await aiIntegration.healthCheck();
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                ai: aiHealth,
                phase1Features: {
                    dataAnalysis: '✅ Available',
                    queryOptimization: '✅ Available', 
                    anomalyDetection: '✅ Available',
                    businessInsights: '✅ Available'
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: 'AI health check failed',
                ai: {
                    status: 'error',
                    capabilities: [],
                    aiEnabled: false
                }
            });
        }
    });

    // MCP server info endpoint
    app.get('/mcp', (req, res) => {
        res.json({
            name: 'btp-sap-odata-to-mcp-server',
            version: '2.0.0',
            description: 'Modern MCP server for SAP SAP OData services with dynamic CRUD operations',
            protocol: {
                version: '2025-06-18',
                transport: 'http'
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
                mcp: '/mcp',
                auth: '/auth',
                login: '/login'
            },
            activeSessions: sessions.size,
            authentication: {
                enabled: true,
                loginUrl: '/login',
                required: 'Only for data operations (discovery is public)',
                supportedMethods: ['IAS username/password', 'Session-based', 'Config file', 'Environment variables']
            }
        });
    });

    // Main MCP endpoint - handles all MCP communication
    app.post('/mcp', async (req, res) => {
        const startTime = Date.now();
        const correlationId = req.headers['x-correlation-id'] as string;
        
        try {
            // Get session ID from header
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let session;

            if (sessionId && sessions.has(sessionId)) {
                // Reuse existing session
                session = await getOrCreateSession(sessionId);
                cloudLoggingService.logApplicationEvent('debug', 'mcp_session_reuse', 
                    'Reusing existing MCP session', { sessionId, correlationId });
            } else if (!sessionId && isInitializeRequest(req.body)) {
                // New initialization request
                session = await getOrCreateSession();
                cloudLoggingService.logApplicationEvent('info', 'mcp_session_create', 
                    'Creating new MCP session', { 
                        sessionId: session.sessionId, 
                        correlationId,
                        method: req.body?.method
                    });
            } else {
                // Invalid request
                logger.warn(`❌ Invalid MCP request - no session ID and not initialize request`);
                cloudLoggingService.logApplicationEvent('warn', 'mcp_invalid_request', 
                    'Invalid MCP request received', { 
                        sessionId, 
                        correlationId,
                        hasBody: !!req.body,
                        method: req.body?.method
                    });
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
            
            // Log successful request completion
            const duration = Date.now() - startTime;
            cloudLoggingService.logPerformanceMetrics('mcp_request', req.body?.method || 'unknown', {
                duration,
                correlationId,
                sessionId: session.sessionId
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('❌ Error handling MCP request:', error);
            
            // Log error with structured data
            cloudLoggingService.logApplicationEvent('error', 'mcp_request_error', 
                'MCP request processing failed', {
                    correlationId,
                    duration,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    method: req.body?.method,
                    sessionId: req.headers['mcp-session-id'] as string
                });

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

    // Monitoring and observability endpoints
    app.get('/monitoring/metrics', (req, res) => {
        try {
            const metrics = {
                activeSessions: sessions.size,
                totalSessions: sessions.size, // Could be enhanced to track total count
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                timestamp: new Date().toISOString(),
                cloudLogging: cloudLoggingService.getStatus(),
                environment: {
                    nodeEnv: process.env.NODE_ENV || 'development',
                    region: process.env.CF_INSTANCE_INDEX ? 'cloud-foundry' : 'local'
                }
            };
            
            // Log metrics access
            cloudLoggingService.logApplicationEvent('info', 'metrics_access', 
                'Application metrics accessed', {
                requestId: req.headers['x-request-id'] as string,
                userAgent: req.headers['user-agent']
            });
            
            res.json(metrics);
        } catch (error) {
            logger.error('Failed to get metrics:', error);
            cloudLoggingService.logApplicationEvent('error', 'metrics_error', 
                'Failed to retrieve application metrics', { error: String(error) });
            res.status(500).json({ error: 'Failed to get metrics' });
        }
    });
    
    // Cloud logging status endpoint
    app.get('/monitoring/logging', (req, res) => {
        try {
            const status = cloudLoggingService.getStatus();
            res.json(status);
        } catch (error) {
            logger.error('Failed to get logging status:', error);
            res.status(500).json({ error: 'Failed to get logging status' });
        }
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

    // Associate MCP session with user session
    app.post('/api/associate-session', (req, res) => {
        try {
            const { mcpSessionId, userSessionId } = req.body;

            if (!mcpSessionId || !userSessionId) {
                return res.status(400).json({
                    error: 'Both mcpSessionId and userSessionId are required'
                });
            }

            // Check if MCP session exists
            if (!sessions.has(mcpSessionId)) {
                return res.status(404).json({
                    error: 'MCP session not found'
                });
            }

            // Verify that userSessionId exists in tokenStore
            tokenStore.get(userSessionId).then((tokenData: any) => {
                if (!tokenData) {
                    return res.status(404).json({
                        error: 'User session not found or expired'
                    });
                }

                // Associate the sessions
                associateMCPSessionWithUser(mcpSessionId, userSessionId);

                res.json({
                    success: true,
                    message: 'Sessions associated successfully',
                    mcpSessionId,
                    userSessionId,
                    user: tokenData.user
                });
            }).catch((error: any) => {
                logger.error('Error verifying user session:', error);
                res.status(500).json({
                    error: 'Failed to verify user session'
                });
            });

        } catch (error) {
            logger.error('Failed to associate sessions:', error);
            res.status(500).json({ error: 'Failed to associate sessions' });
        }
    });

    // Update service configuration endpoint
    app.post('/config/services/update', async (req, res) => {
        try {
            const newConfig = req.body;
            serviceConfigService.updateConfiguration(newConfig);

            logger.info('🔄 Configuration updated, triggering service rediscovery...');

            // Trigger service rediscovery to refresh the sap://services resource
            const reloadResult = await reloadODataServices();

            const updatedConfig = serviceConfigService.getConfigurationSummary();
            res.json({
                message: 'Configuration updated successfully',
                configuration: updatedConfig,
                serviceRediscovery: reloadResult
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

    // Global error handler with secure error sanitization
    app.use((error: Error, req: express.Request, res: express.Response) => {
        const errorHandler = new SecureErrorHandler(logger);
        const secureError = errorHandler.sanitizeError(error, {
            operation: 'request-processing',
            requestId: req.headers['x-request-id'] as string || 'unknown',
            userId: (req as AuthenticatedRequest).authInfo?.userId
        });

        if (!res.headersSent) {
            res.status(500).json(secureError);
        }
    });

    // Clean up expired sessions every hour - register with shutdown manager
    const cleanupInterval = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
    shutdownManager.registerInterval(cleanupInterval, 'session-cleanup');

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
                // Register server shutdown with shutdown manager
                shutdownManager.registerCleanupCallback(async () => {
                    logger.info('Shutting down HTTP server...');
                    return new Promise<void>((resolve) => {
                        server.close((error) => {
                            if (error) {
                                logger.error('Error shutting down server:', error);
                            } else {
                                logger.info('HTTP server shut down successfully');
                            }
                            resolve();
                        });
                    });
                }, 'http-server-shutdown');
                
                // Determine the base URL for this deployment
                const baseUrl = process.env.VCAP_APPLICATION ? 
                    `https://${JSON.parse(process.env.VCAP_APPLICATION).application_uris[0]}` :
                    `http://localhost:${port}`;
                
                logger.info(`🚀 SAP MCP Server running at ${baseUrl}`);
                logger.info(`📊 Health check: ${baseUrl}/health`);
                logger.info(`📚 API docs: ${baseUrl}/docs`);
                logger.info(`🔧 MCP endpoint: ${baseUrl}/mcp`);
                logger.info(`📈 Monitoring: ${baseUrl}/monitoring/metrics`);

                logger.info('🚀 Initializing Modern SAP MCP Server...');
                
                // Log application startup
                cloudLoggingService.logApplicationEvent('info', 'application_startup', 
                    'SAP MCP Server started successfully', {
                        baseUrl,
                        port,
                        nodeEnv: process.env.NODE_ENV || 'development',
                        version: process.env.npm_package_version || '1.0.0'
                    });

                // Start authentication server on separate port
                try {
                    const authPort = parseInt(process.env.AUTH_PORT || '3001');
                    // Note: AuthServer will be available through the main app due to mounting
                    logger.info(`🔐 Authentication server integrated at port ${port}`);
                    logger.info(`📱 Login page: ${baseUrl}/login`);
                } catch (error) {
                    logger.warn('⚠️  Authentication server failed to start:', error);
                    logger.info('🔄 Continuing with authentication disabled...');
                }

                // Initialize destination service
                await destinationService.initialize();

                // Discover SAP OData services
                logger.info('🔍 Discovering SAP OData services...');
                
                const discoveryStartTime = Date.now();
                cloudLoggingService.logSAPIntegrationEvent('info', 'service_discovery', 
                    'Starting initial OData service discovery');
                
                discoveredServices = await sapDiscoveryService.discoverAllServices();
                
                const discoveryDuration = Date.now() - discoveryStartTime;
                logger.info(`✅ Discovered ${discoveredServices.length} OData services`);
                logger.info(`🔧 Authentication: Discovery is public, data operations require authentication`);
                
                // Log successful discovery
                cloudLoggingService.logSAPIntegrationEvent('info', 'service_discovery', 
                    'Initial OData service discovery completed', {
                        servicesCount: discoveredServices.length,
                        duration: discoveryDuration
                    });
                    
                cloudLoggingService.logPerformanceMetrics('application_startup', 'service_discovery', {
                    duration: discoveryDuration,
                    servicesCount: discoveredServices.length
                });
                
                // Log system readiness
                cloudLoggingService.logApplicationEvent('info', 'system_ready', 
                    'SAP MCP Server is ready to serve requests', {
                        activeSessions: sessions.size,
                        discoveredServices: discoveredServices.length,
                        baseUrl
                    });
                
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
