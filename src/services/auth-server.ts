import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { Logger } from '../utils/logger.js';
import { IASAuthService, TokenData } from './ias-auth-service.js';
import { TokenStore, StoredTokenData } from './token-store.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AuthServerOptions {
  port?: number;
  corsOrigins?: string[];
  enableHelmet?: boolean;
}

export class AuthServer {
  private app: express.Application;
  private logger: Logger;
  private iasAuthService: IASAuthService;
  private tokenStore: TokenStore;
  private server: any;

  constructor(options: AuthServerOptions = {}) {
    this.app = express();
    this.logger = new Logger('AuthServer');
    this.iasAuthService = new IASAuthService(this.logger);
    this.tokenStore = new TokenStore(this.logger);

    this.setupMiddleware(options);
    this.setupRoutes();
  }

  private setupMiddleware(options: AuthServerOptions): void {
    // Security middleware
    if (options.enableHelmet !== false) {
      this.app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"], // Allow inline scripts and event handlers
            scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"], // Allow HTTPS connections
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
          }
        },
        crossOriginResourcePolicy: false
      }));
    }

    // CORS configuration
    this.app.use(cors({
      origin: options.corsOrigins || ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-mcp-session-id']
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Static files for the login page
    this.app.use('/static', express.static(path.join(__dirname, '../public')));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: req.headers['x-mcp-session-id']
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    });

    // Serve login page (note: this will be mounted at /login by main app)
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../public/login.html'));
    });

    // Also handle explicit /login route for cases where it's mounted at root
    this.app.get('/login', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../public/login.html'));
    });

    // Global authentication endpoint - no client configuration required
    this.app.post('/login', async (req: Request, res: Response) => {
      try {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({
            success: false,
            error: 'Missing credentials',
            message: 'Username and password are required'
          });
        }

        // Authenticate with SAP IAS using password grant
        const tokenData = await this.iasAuthService.authenticateUser(username, password);

        // Store as global authentication (not session-specific)
        const globalAuthKey = 'global_user_auth';
        const clientInfo = {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          clientId: 'global-auth',
          authenticatedAt: Date.now()
        };

        await this.tokenStore.set(tokenData, clientInfo, globalAuthKey);

        this.logger.info(`Global authentication successful: ${tokenData.user}`);

        res.json({
          success: true,
          message: 'Authentication successful - server will remember your credentials',
          user: tokenData.user,
          authenticatedAt: new Date().toISOString(),
          note: 'No client configuration required - MCP tools will work automatically'
        });

      } catch (error) {
        this.logger.error('Global authentication failed:', error);
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          message: error instanceof Error ? error.message : 'Invalid username or password'
        });
      }
    });

    // OAuth 2.0 Authorization endpoint
    this.app.get('/authorize', (req: Request, res: Response) => {
      try {
        const { response_type, client_id, redirect_uri, scope, state } = req.query;
        
        // Validate required parameters
        if (!response_type || !client_id || !redirect_uri) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing required parameters: response_type, client_id, redirect_uri'
          });
        }

        if (response_type !== 'code') {
          return res.status(400).json({
            error: 'unsupported_response_type',
            error_description: 'Only authorization code flow is supported'
          });
        }

        // Generate authorization URL and redirect to IAS
        const iasAuthUrl = this.iasAuthService.generateAuthorizationUrl(
          redirect_uri as string,
          state as string
        );
        
        this.logger.info(`Redirecting to IAS authorization: ${iasAuthUrl}`);
        res.redirect(iasAuthUrl);

      } catch (error) {
        this.logger.error('Authorization endpoint error:', error);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error during authorization'
        });
      }
    });

    // OAuth 2.0 callback endpoint
    this.app.get('/callback', async (req: Request, res: Response) => {
      try {
        const { code, state, error, error_description } = req.query;
        
        if (error) {
          this.logger.error(`OAuth callback error: ${error} - ${error_description}`);
          return res.status(400).json({
            error: error as string,
            error_description: error_description as string || 'Authorization failed'
          });
        }

        if (!code) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing authorization code'
          });
        }

        // Exchange code for tokens - force HTTPS for Cloud Foundry deployments
        const protocol = req.get('host')?.includes('.cfapps.') || req.get('host')?.includes('.ondemand.com') ? 'https' : req.protocol;
        const redirectUri = `${protocol}://${req.get('host')}/auth/callback`;
        this.logger.debug(`Constructed redirect URI for token exchange: ${redirectUri}`);
        this.logger.debug(`Request protocol: ${req.protocol}, forced protocol: ${protocol}, host: ${req.get('host')}`);
        const tokenData = await this.iasAuthService.exchangeCodeForTokens(
          code as string,
          redirectUri
        );

        // Store token with client info
        const clientInfo = {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          clientId: `oauth2-${Date.now()}`
        };

        const sessionId = await this.tokenStore.set(tokenData, clientInfo);

        this.logger.info(`OAuth user authenticated successfully: ${tokenData.user}, session: ${sessionId}`);

        // Redirect to success page with session ID
        res.redirect(`/login?session=${sessionId}&success=true`);

      } catch (error) {
        this.logger.error('OAuth callback failed:', error);
        res.redirect(`/login?error=${encodeURIComponent('Authentication failed')}`);
      }
    });

    // Authentication status endpoint
    this.app.get('/status', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['x-mcp-session-id'] as string;
        
        if (!sessionId) {
          return res.json({ authenticated: false, message: 'No session ID provided' });
        }

        const tokenData = await this.tokenStore.get(sessionId);
        
        if (!tokenData) {
          return res.json({ authenticated: false, message: 'Session not found or expired' });
        }

        res.json({
          authenticated: true,
          sessionId: tokenData.sessionId,
          user: tokenData.user,
          expiresAt: tokenData.expiresAt,
          scopes: tokenData.scopes
        });

      } catch (error) {
        this.logger.error('Error checking auth status:', error);
        res.status(500).json({
          authenticated: false,
          error: 'Internal server error'
        });
      }
    });

    // Direct token authentication endpoint (for CLI/curl users)
    this.app.post('/cli-auth', async (req: Request, res: Response) => {
      try {
        const { access_token, method = 'cli' } = req.body;
        
        if (!access_token) {
          return res.status(400).json({
            success: false,
            error: 'Missing access_token',
            message: 'Please provide the access_token obtained from the curl command'
          });
        }

        // Validate the token with IAS - try user info first, fallback to validation for client credentials
        let tokenData;
        let user = 'unknown';
        let scopes = ['read', 'write'];
        
        try {
          // Try to get user info (works for user tokens)
          const userInfo = await this.iasAuthService.getUserInfo(access_token);
          user = userInfo.preferred_username || userInfo.email || userInfo.sub;
          scopes = userInfo.scope || ['read', 'write'];
        } catch (error) {
          this.logger.debug('User info failed, trying token validation (likely client credentials token)');
          
          // For client credentials tokens, we can't get user info, but we can validate the token
          const isValid = await this.iasAuthService.validateToken(access_token);
          if (!isValid) {
            throw new Error('Invalid or expired access token');
          }
          
          // For client credentials, use the client ID as user and assign appropriate scopes
          user = 'client-credentials-user';
          scopes = ['read', 'write', 'delete', 'admin']; // Client credentials get broader access
        }

        tokenData = {
          token: access_token.startsWith('Bearer ') ? access_token : `Bearer ${access_token}`,
          user: user,
          scopes: scopes,
          expiresAt: Date.now() + (3600 * 1000), // Assume 1 hour expiration
          refreshToken: undefined
        };

        // Store token with client info
        const clientInfo = {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          clientId: `${method}-${Date.now()}`
        };

        const sessionId = await this.tokenStore.set(tokenData, clientInfo);

        this.logger.info(`CLI authentication successful: ${tokenData.user}, session: ${sessionId}`);

        res.json({
          success: true,
          sessionId: sessionId,
          user: tokenData.user,
          expiresAt: tokenData.expiresAt,
          scopes: tokenData.scopes,
          message: 'Authentication successful',
          instructions: {
            mcp_header: `Add this header to your MCP requests: x-mcp-session-id: ${sessionId}`,
            environment: `export SAP_MCP_SESSION_ID="${sessionId}"`
          }
        });

      } catch (error) {
        this.logger.error('CLI authentication failed:', error);
        res.status(401).json({
          success: false,
          error: 'CLI authentication failed',
          message: error instanceof Error ? error.message : 'Invalid or expired token'
        });
      }
    });

    // Token generation endpoint (supports multiple methods)
    this.app.post('/token', async (req: Request, res: Response) => {
      try {
        const { grant_type, username, password, code, redirect_uri, refresh_token } = req.body;
        let tokenData: TokenData;
        let sessionId: string;

        if (grant_type === 'authorization_code') {
          // OAuth 2.0 Authorization Code flow
          if (!code || !redirect_uri) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing required parameters: code, redirect_uri'
            });
          }

          tokenData = await this.iasAuthService.exchangeCodeForTokens(code, redirect_uri);
          
        } else if (grant_type === 'refresh_token') {
          // Token refresh
          if (!refresh_token) {
            return res.status(400).json({
              error: 'invalid_request',
              error_description: 'Missing refresh_token parameter'
            });
          }

          tokenData = await this.iasAuthService.refreshToken(refresh_token);
          
        } else if (grant_type === 'client_credentials') {
          // Client credentials flow
          tokenData = await this.iasAuthService.getClientCredentialsToken();
          
        } else {
          // Fallback to password flow (deprecated)
          if (!username || !password) {
            return res.status(400).json({
              success: false,
              error: 'Missing credentials',
              message: 'Username and password are required'
            });
          }

          tokenData = await this.iasAuthService.authenticateUser(username, password);
        }

        // Store token with client info
        const clientInfo = {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          clientId: req.get('x-client-id') || `${grant_type || 'password'}-${Date.now()}`
        };

        sessionId = await this.tokenStore.set(tokenData, clientInfo);

        this.logger.info(`User authenticated successfully: ${tokenData.user}, session: ${sessionId}`);

        if (grant_type === 'authorization_code' || grant_type === 'refresh_token' || grant_type === 'client_credentials') {
          // OAuth 2.0 standard response
          res.json({
            access_token: tokenData.token.replace('Bearer ', ''),
            token_type: 'Bearer',
            expires_in: Math.floor((tokenData.expiresAt - Date.now()) / 1000),
            scope: tokenData.scopes.join(' '),
            refresh_token: tokenData.refreshToken,
            session_id: sessionId
          });
        } else {
          // Legacy response format
          res.json({
            success: true,
            sessionId: sessionId,
            user: tokenData.user,
            expiresAt: tokenData.expiresAt,
            scopes: tokenData.scopes,
            message: 'Authentication successful'
          });
        }

      } catch (error) {
        this.logger.error('Authentication failed:', error);
        
        let statusCode = 401;
        let errorCode = 'invalid_client';
        let message = 'Authentication failed';
        
        if (error instanceof Error) {
          if (error.message.includes('credentials')) {
            message = 'Invalid username or password';
            errorCode = 'invalid_grant';
          } else if (error.message.includes('configuration')) {
            statusCode = 500;
            message = 'Server configuration error';
            errorCode = 'server_error';
          } else if (error.message.includes('code')) {
            errorCode = 'invalid_grant';
            message = 'Invalid authorization code';
          }
        }

        res.status(statusCode).json({
          error: errorCode,
          error_description: message,
          // Legacy format for backward compatibility
          success: false,
          message: message
        });
      }
    });

    // Token refresh endpoint
    this.app.post('/refresh', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['x-mcp-session-id'] as string;
        
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'Missing session ID',
            message: 'Session ID is required in headers'
          });
        }

        const existingToken = await this.tokenStore.get(sessionId);
        
        if (!existingToken || !existingToken.refreshToken) {
          return res.status(404).json({
            success: false,
            error: 'Invalid session',
            message: 'Session not found or no refresh token available'
          });
        }

        // Refresh token with IAS
        const newTokenData = await this.iasAuthService.refreshToken(existingToken.refreshToken);

        // Update stored token
        await this.tokenStore.update(sessionId, newTokenData);

        res.json({
          success: true,
          sessionId: sessionId,
          user: newTokenData.user,
          expiresAt: newTokenData.expiresAt,
          scopes: newTokenData.scopes,
          message: 'Token refreshed successfully'
        });

      } catch (error) {
        this.logger.error('Token refresh failed:', error);
        res.status(401).json({
          success: false,
          error: 'Token refresh failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // OAuth 2.0 Authorization URL generation endpoint
    this.app.get('/auth-url', (req: Request, res: Response) => {
      try {
        const { redirect_uri, state } = req.query;
        
        if (!redirect_uri) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing redirect_uri parameter'
          });
        }

        const authUrl = this.iasAuthService.generateAuthorizationUrl(
          redirect_uri as string,
          state as string
        );

        res.json({
          authorization_url: authUrl,
          state: state || null
        });

      } catch (error) {
        this.logger.error('Auth URL generation failed:', error);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to generate authorization URL'
        });
      }
    });

    // Configuration download endpoint
    this.app.get('/config/:sessionId', async (req: Request, res: Response) => {
      try {
        const { sessionId } = req.params;
        
        const tokenData = await this.tokenStore.get(sessionId);
        
        if (!tokenData) {
          return res.status(404).json({
            error: 'Session not found',
            message: 'The requested session does not exist or has expired'
          });
        }

        // Generate configuration for download
        const config = {
          sap_mcp_session_id: sessionId,
          mcp_server_url: req.get('host') || 'localhost:3000',
          user: tokenData.user,
          expires_at: tokenData.expiresAt,
          created_at: tokenData.createdAt,
          scopes: tokenData.scopes,
          oauth2_config: this.iasAuthService.getConfiguration(),
          instructions: {
            desktop: 'Place this file at ~/.sap/mcp-config.json',
            environment: `export SAP_MCP_SESSION_ID="${sessionId}"`,
            oauth2: 'Use the authorization_url to authenticate via browser'
          }
        };

        res.setHeader('Content-Disposition', 'attachment; filename="mcp-sap-config.json"');
        res.setHeader('Content-Type', 'application/json');
        res.json(config);

      } catch (error) {
        this.logger.error('Config download failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to generate configuration'
        });
      }
    });

    // Logout endpoint
    this.app.post('/logout', async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers['x-mcp-session-id'] as string;
        
        if (sessionId) {
          const removed = await this.tokenStore.remove(sessionId);
          if (removed) {
            this.logger.info(`User logged out, session removed: ${sessionId}`);
          }
        }

        res.json({
          success: true,
          message: 'Logged out successfully'
        });

      } catch (error) {
        this.logger.error('Logout failed:', error);
        res.status(500).json({
          success: false,
          error: 'Logout failed',
          message: 'Internal server error'
        });
      }
    });

    // Admin endpoint to view sessions (protected)
    this.app.get('/admin/sessions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
      try {
        // Check admin scope
        if (!req.authInfo?.scopes.includes('admin')) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'Admin scope required'
          });
        }

        const stats = await this.tokenStore.getStats();
        const sessions = await this.tokenStore.getAllSessions();

        res.json({
          stats,
          sessions: sessions.map(session => ({
            sessionId: session.sessionId,
            user: session.user,
            createdAt: session.createdAt,
            lastUsedAt: session.lastUsedAt,
            expiresAt: session.expiresAt,
            scopes: session.scopes,
            clientInfo: session.clientInfo
          }))
        });

      } catch (error) {
        this.logger.error('Admin sessions endpoint failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve sessions'
        });
      }
    });

    // Get token by session ID (for MCP server internal use)
    this.app.get('/internal/token/:sessionId', async (req: Request, res: Response) => {
      try {
        // This endpoint should be protected in production (internal network only)
        const { sessionId } = req.params;
        
        const tokenData = await this.tokenStore.get(sessionId);
        
        if (!tokenData) {
          return res.status(404).json({
            error: 'Session not found',
            authenticated: false
          });
        }

        res.json({
          authenticated: true,
          token: tokenData.token,
          user: tokenData.user,
          scopes: tokenData.scopes,
          expiresAt: tokenData.expiresAt
        });

      } catch (error) {
        this.logger.error('Internal token lookup failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          authenticated: false
        });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });

    // CLI authentication instructions endpoint
    this.app.get('/cli-instructions', (req: Request, res: Response) => {
      try {
        const serverUrl = req.get('host') || 'localhost:3000';
        const config = this.iasAuthService.getConfiguration();
        
        const curlCommand = `curl -X POST "${config.tokenEndpoint}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=${config.clientId}&client_secret=${process.env.SAP_IAS_CLIENT_SECRET || 'YOUR_CLIENT_SECRET'}"`;

        const instructions = {
          title: "CLI Authentication Instructions",
          steps: [
            {
              step: 1,
              description: "Get an access token using curl",
              command: curlCommand,
              note: "This will return a JSON response with an 'access_token' field"
            },
            {
              step: 2,
              description: "Extract the access token from the response",
              example: `# The response will look like:
# {"access_token":"eyJ...","token_type":"Bearer","expires_in":3600}
# Copy the access_token value (without quotes)`
            },
            {
              step: 3,
              description: "Authenticate with the MCP server",
              command: `curl -X POST "https://${serverUrl}/auth/cli-auth" \\
  -H "Content-Type: application/json" \\
  -d '{"access_token":"YOUR_ACCESS_TOKEN_HERE"}'`,
              note: "Replace YOUR_ACCESS_TOKEN_HERE with the token from step 1"
            },
            {
              step: 4,
              description: "Use the session ID in MCP requests",
              example: `# The response will contain a sessionId
# Add this header to your MCP requests:
# x-mcp-session-id: YOUR_SESSION_ID`
            }
          ],
          alternatives: {
            web_login: `https://${serverUrl}/login`,
            oauth_direct: `${config.authorizationEndpoint}?client_id=${config.clientId}&response_type=code&redirect_uri=https://${serverUrl}/auth/callback&scope=openid profile email`
          }
        };

        res.json(instructions);
      } catch (error) {
        this.logger.error('Failed to generate CLI instructions:', error);
        res.status(500).json({ 
          error: 'Failed to generate instructions', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Configuration endpoint for debugging
    this.app.get('/debug/config', (req: Request, res: Response) => {
      try {
        const config = this.iasAuthService.getConfiguration();
        // Show more configuration details for debugging
        const debugConfig = {
          ...config,
          clientId: config.clientId,
          clientSecret: config.clientId ? (config.clientId.includes('dummy') ? 'DUMMY/NOT_CONFIGURED' : 'PROVIDED') : 'MISSING',
          isConfigured: this.iasAuthService.isProperlyConfigured(),
          supportedGrantTypes: config.supportedGrantTypes,
          supportedScopes: config.supportedScopes,
          endpoints: {
            authorization: config.authorizationEndpoint,
            token: config.tokenEndpoint,
            userInfo: config.userInfoEndpoint,
            introspection: config.introspectionEndpoint
          }
        };
        res.json(debugConfig);
      } catch (error) {
        this.logger.error('Failed to get configuration:', error);
        res.status(500).json({ error: 'Configuration not available', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Admin dashboard page
    this.app.get('/admin', async (req: Request, res: Response) => {
      try {
        // Simple admin authentication - check if global admin is authenticated
        const globalAuth = await this.tokenStore.get('global_user_auth');
        if (!globalAuth || globalAuth.user !== 'gabriele.rendina@lutech.it') {
          // Redirect to login instead of showing error
          return res.redirect('/auth/?redirect=/auth/admin');
        }
        
        // Serve the admin dashboard
        res.sendFile(path.join(__dirname, '../public/admin.html'));
      } catch (error) {
        this.logger.error('Admin dashboard access failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to load admin dashboard'
        });
      }
    });

    // Admin endpoint to view all authenticated users and their roles/scopes
    this.app.get('/admin/users', async (req: Request, res: Response) => {
      try {
        // Simple admin authentication - check if global admin is authenticated
        const globalAuth = await this.tokenStore.get('global_user_auth');
        if (!globalAuth || globalAuth.user !== 'gabriele.rendina@lutech.it') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin privileges required. Please authenticate first with: curl -X POST "https://[server]/auth/login" -H "Content-Type: application/json" -d \'{"username":"gabriele.rendina@lutech.it","password":"YOUR_PASSWORD"}\''
          });
        }

        // Get all active sessions
        const allSessions = await this.tokenStore.getAllSessions();
        
        // Enhanced user information with role mapping
        const users = allSessions.map(tokenData => {
          // Determine user role based on scopes and user email
          let role = 'user';
          if (tokenData.scopes?.includes('admin')) {
            role = 'admin';
          } else if (tokenData.scopes?.includes('write')) {
            role = 'editor';
          } else if (tokenData.scopes?.includes('read')) {
            role = 'viewer';
          }

          // Special role assignment for specific users
          if (tokenData.user === 'gabriele.rendina@lutech.it') {
            role = 'admin';
            if (!tokenData.scopes?.includes('admin')) {
              tokenData.scopes = [...(tokenData.scopes || []), 'admin'];
            }
          }

          return {
            sessionId: tokenData.sessionId,
            user: tokenData.user,
            role: role,
            scopes: tokenData.scopes || [],
            authenticatedAt: new Date(tokenData.createdAt).toISOString(),
            lastActivity: new Date(tokenData.lastUsedAt).toISOString(),
            expiresAt: new Date(tokenData.expiresAt).toISOString(),
            clientInfo: {
              userAgent: tokenData.clientInfo?.userAgent || 'Unknown',
              ipAddress: tokenData.clientInfo?.ipAddress || 'Unknown',
              clientId: tokenData.clientInfo?.clientId || 'Unknown'
            },
            isActive: tokenData.expiresAt > Date.now(),
            sessionType: tokenData.sessionId === 'global_user_auth' ? 'Global Authentication' : 'Session-based'
          };
        });

        // Sort by authentication time (most recent first)
        users.sort((a, b) => new Date(b.authenticatedAt).getTime() - new Date(a.authenticatedAt).getTime());

        // Get statistics
        const stats = await this.tokenStore.getStats();

        res.json({
          success: true,
          requestedBy: globalAuth.user,
          requestedAt: new Date().toISOString(),
          summary: {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.isActive).length,
            expiredUsers: users.filter(u => !u.isActive).length,
            adminUsers: users.filter(u => u.role === 'admin').length,
            editorUsers: users.filter(u => u.role === 'editor').length,
            viewerUsers: users.filter(u => u.role === 'viewer').length,
            globalSessions: users.filter(u => u.sessionType === 'Global Authentication').length
          },
          users: users,
          systemStats: stats
        });

      } catch (error) {
        this.logger.error('Admin users endpoint failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve user information'
        });
      }
    });

    // Admin endpoint to update user roles/scopes
    this.app.put('/admin/users/:sessionId/role', async (req: Request, res: Response) => {
      try {
        // Simple admin authentication - check if global admin is authenticated
        const globalAuth = await this.tokenStore.get('global_user_auth');
        if (!globalAuth || globalAuth.user !== 'gabriele.rendina@lutech.it') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin privileges required to modify user roles'
          });
        }

        const { sessionId } = req.params;
        const { role, scopes } = req.body;

        const tokenData = await this.tokenStore.get(sessionId);
        if (!tokenData) {
          return res.status(404).json({
            error: 'Session not found',
            message: 'The specified session does not exist or has expired'
          });
        }

        // Map role to scopes if role is provided
        let newScopes = scopes;
        if (role && !scopes) {
          switch (role) {
            case 'admin':
              newScopes = ['read', 'write', 'delete', 'admin'];
              break;
            case 'editor':
              newScopes = ['read', 'write'];
              break;
            case 'viewer':
              newScopes = ['read'];
              break;
            default:
              return res.status(400).json({
                error: 'Invalid role',
                message: 'Valid roles are: admin, editor, viewer'
              });
          }
        }

        // Update the token with new scopes
        const updatedTokenData = {
          ...tokenData,
          scopes: newScopes
        };

        const success = await this.tokenStore.update(sessionId, updatedTokenData);
        
        if (success) {
          this.logger.info(`Admin ${globalAuth.user} updated user ${tokenData.user} role to ${role} with scopes: ${newScopes?.join(', ')}`);
          
          res.json({
            success: true,
            message: 'User role updated successfully',
            user: tokenData.user,
            sessionId: sessionId,
            oldScopes: tokenData.scopes,
            newScopes: newScopes,
            updatedBy: globalAuth.user,
            updatedAt: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            error: 'Update failed',
            message: 'Failed to update user role'
          });
        }

      } catch (error) {
        this.logger.error('Admin role update failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update user role'
        });
      }
    });

    // Admin endpoint to delete user sessions
    this.app.post('/admin/users/delete', async (req: Request, res: Response) => {
      try {
        // Simple admin authentication - check if global admin is authenticated
        const globalAuth = await this.tokenStore.get('global_user_auth');
        if (!globalAuth || globalAuth.user !== 'gabriele.rendina@lutech.it') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Admin privileges required to delete user sessions'
          });
        }

        const { sessionId } = req.body;

        const tokenData = await this.tokenStore.get(sessionId);
        if (!tokenData) {
          return res.status(404).json({
            error: 'Session not found',
            message: 'The specified session does not exist or has expired'
          });
        }

        const success = await this.tokenStore.remove(sessionId);
        
        if (success) {
          this.logger.info(`Admin ${globalAuth.user} deleted session for user ${tokenData.user}`);
          
          res.json({
            success: true,
            message: 'User session deleted successfully',
            user: tokenData.user,
            sessionId: sessionId,
            deletedBy: globalAuth.user,
            deletedAt: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            error: 'Deletion failed',
            message: 'Failed to delete user session'
          });
        }

      } catch (error) {
        this.logger.error('Admin session deletion failed:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to delete user session'
        });
      }
    });

    // Note: 404 handler removed - let the main application handle unknown routes
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, '0.0.0.0', () => {
          this.logger.info(`🔐 Auth server started on port ${port}`);
          this.logger.info(`📱 Login page: http://localhost:${port}/login`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('Server error:', error);
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start auth server:', error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Auth server stopped');
          this.tokenStore.shutdown();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getTokenStore(): TokenStore {
    return this.tokenStore;
  }

  getApp(): express.Application {
    return this.app;
  }
}