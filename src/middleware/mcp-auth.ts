import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { TokenStore } from '../services/token-store.js';
import { createAutoAssociation, getCurrentUserSessionId } from '../index.js';

export interface MCPAuthContext {
  sessionId?: string;
  token?: string;
  user?: string;
  scopes?: string[];
  isAuthenticated: boolean;
  clientInfo?: {
    userAgent?: string;
    clientId?: string;
  };
  source?: string; // Track authentication source (session_id, mcp_session_association, global, etc.)
}

export interface MCPAuthResult {
  authenticated: boolean;
  context?: MCPAuthContext;
  error?: {
    code: string;
    message: string;
    authUrl?: string;
    instructions?: {
      step1?: string;
      step2?: string;
      step3?: string;
      web_method?: {
        step1: string;
        step2: string;
        step3?: string;
      };
      cli_method?: {
        description: string;
        step1: string;
        step2: string;
        step3: string;
        note: string;
      };
      server_managed?: {
        description: string;
        benefits: string[];
      };
      quick_start?:
        | string
        | {
            browser: string;
            curl: string;
          };
    };
  };
}

export class MCPAuthManager {
  private logger: Logger;
  private tokenStore: TokenStore;
  private authServerUrl: string;

  constructor(tokenStore: TokenStore, authServerUrl: string, logger?: Logger) {
    this.logger = logger || new Logger('MCPAuthManager');
    this.tokenStore = tokenStore;
    this.authServerUrl = authServerUrl;
  }

  /**
   * Get the authentication server URL
   */
  public getAuthServerUrl(): string {
    return this.authServerUrl.replace('/auth', '');
  }

  /**
   * Authenticate MCP tool call - checks multiple authentication sources
   */
  async authenticateToolCall(
    toolName: string,
    args: any,
    clientInfo?: any
  ): Promise<MCPAuthResult> {
    // Check if this tool requires authentication
    if (!this.requiresAuth(toolName)) {
      return {
        authenticated: true,
        context: {
          isAuthenticated: false,
          user: 'anonymous',
          scopes: [],
        },
      };
    }

    // For runtime operations (execute-entity-operation), try session ID first, then fallback to global auth
    if (this.isRuntimeOperation(toolName)) {
      // First try explicit session ID from arguments
      const sessionId =
        args.parameters?.session_id ||
        args.parameters?.auth_session_id ||
        args?.session_id ||
        args?.auth_session_id;

      let authResult: MCPAuthResult;

      if (sessionId) {
        // Try session-based authentication
        authResult = await this.trySessionAuth(args, clientInfo);
        if (authResult.authenticated) {
          return authResult;
        }
        this.logger.warn(
          `Runtime operation ${toolName} failed authentication with provided Session ID: ${sessionId}`
        );
      }

      // Fallback to MCP session-based authentication (check if MCP session is associated with user session)
      this.logger.debug(
        `Runtime operation ${toolName}: No explicit session ID provided, checking MCP session association`
      );
      authResult = await this.tryMCPSessionAuth(clientInfo);

      if (!authResult.authenticated) {
        // Final fallback to global authentication (set during OAuth flow)
        this.logger.debug(
          `Runtime operation ${toolName}: No MCP session association found, trying global authentication`
        );
        authResult = await this.tryGlobalAuth();
      }

      if (authResult.authenticated) {
        this.logger.debug(`Runtime operation ${toolName}: Global authentication successful`);
        return authResult;
      }

      // No authentication available - return instructions
      this.logger.warn(`Runtime operation ${toolName} attempted without valid authentication`);
      return {
        authenticated: false,
        error: {
          code: 'SESSION_ID_REQUIRED',
          message: 'Authentication required. Please provide your Session ID to use this tool.',
          authUrl: `${this.authServerUrl.replace('/auth', '')}/auth/`,
          instructions: {
            step1: `1. Authenticate at: ${this.authServerUrl.replace('/auth', '')}/auth/`,
            step2: `2. Copy your Session ID from the success page`,
            step3: `3. Include "session_id": "YOUR_SESSION_ID" in your MCP tool parameters`,
          },
        },
      };
    }

    // For non-runtime operations, use fallback methods including clientId lookup
    let authResult = await this.trySessionAuthWithFallbacks(args, clientInfo);

    if (!authResult.authenticated) {
      authResult = await this.tryGlobalAuth();
    }

    if (!authResult.authenticated) {
      authResult = await this.tryConfigFileAuth();
    }

    if (!authResult.authenticated) {
      authResult = await this.tryEnvironmentAuth();
    }

    // If still not authenticated, return authentication instructions
    if (!authResult.authenticated) {
      return this.getAuthInstructions();
    }

    // Check authorization (scopes)
    const requiredScope = this.getRequiredScope(toolName, args);
    if (requiredScope && !this.hasRequiredScope(authResult.context?.scopes || [], requiredScope)) {
      return {
        authenticated: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Insufficient permissions for ${requiredScope} operations`,
          instructions: {
            step1: `Visit: ${this.authServerUrl}/login`,
            step2: `Request access to scope: ${requiredScope}`,
            step3: 'Re-authenticate with proper permissions',
          },
        },
      };
    }

    return authResult;
  }

  /**
   * Method: Try MCP session-based authentication (check if MCP session is associated with user session)
   */
  private async tryMCPSessionAuth(clientInfo?: any): Promise<MCPAuthResult> {
    try {
      this.logger.debug('MCP session authentication: Checking for existing associations...');

      // Get the associated user session ID for the current request/session
      const associatedUserSessionId = getCurrentUserSessionId();

      if (associatedUserSessionId) {
        // We found an associated user session - authenticate using it
        this.logger.debug(`Found associated user session: ${associatedUserSessionId}`);

        const tokenData = await this.tokenStore.get(associatedUserSessionId);
        if (tokenData) {
          this.logger.debug(`✅ MCP session authentication successful for user: ${tokenData.user}`);

          return {
            authenticated: true,
            context: {
              sessionId: tokenData.sessionId,
              token: tokenData.token,
              user: tokenData.user,
              scopes: tokenData.scopes,
              isAuthenticated: true,
              clientInfo,
              source: 'mcp_session_association',
            },
          };
        } else {
          this.logger.warn(
            `Associated user session ${associatedUserSessionId} is invalid or expired`
          );
          return {
            authenticated: false,
            error: {
              code: 'ASSOCIATED_SESSION_EXPIRED',
              message: 'Associated user session is invalid or expired',
            },
          };
        }
      }

      // No association found
      this.logger.debug('No MCP session associations found');
      return {
        authenticated: false,
        error: {
          code: 'MCP_SESSION_NOT_ASSOCIATED',
          message: 'MCP session not associated with user session',
        },
      };
    } catch (error) {
      this.logger.error('Error during MCP session authentication:', error);
      return {
        authenticated: false,
        error: {
          code: 'MCP_SESSION_AUTH_ERROR',
          message: 'Error during MCP session authentication',
        },
      };
    }
  }

  /**
   * Method 1: Try session-based authentication with fallbacks (for non-runtime operations)
   */
  private async trySessionAuthWithFallbacks(args: any, clientInfo?: any): Promise<MCPAuthResult> {
    try {
      // Check for session ID in tool arguments first
      const sessionId =
        args.parameters?.session_id ||
        args.parameters?.auth_session_id ||
        args?.session_id ||
        args?.auth_session_id;

      if (sessionId) {
        const tokenData = await this.tokenStore.get(sessionId);
        if (tokenData) {
          return {
            authenticated: true,
            context: {
              sessionId: tokenData.sessionId,
              token: tokenData.token,
              user: tokenData.user,
              scopes: tokenData.scopes,
              isAuthenticated: true,
              clientInfo,
            },
          };
        }
      }

      // Check for client ID based lookup (for persistent web sessions)
      if (clientInfo?.clientId) {
        const tokenData = await this.tokenStore.getByClientId(clientInfo.clientId);
        if (tokenData) {
          return {
            authenticated: true,
            context: {
              sessionId: tokenData.sessionId,
              token: tokenData.token,
              user: tokenData.user,
              scopes: tokenData.scopes,
              isAuthenticated: true,
              clientInfo,
            },
          };
        }
      }
    } catch (error) {
      this.logger.debug('Session authentication with fallbacks failed:', error);
    }

    return { authenticated: false };
  }

  /**
   * Method 1b: Try session-based authentication (strict - for runtime operations)
   */
  private async trySessionAuth(args: any, clientInfo?: any): Promise<MCPAuthResult> {
    try {
      // Check for session ID in tool arguments
      const sessionId =
        args.parameters?.session_id ||
        args.parameters?.auth_session_id ||
        args?.session_id ||
        args?.auth_session_id;

      if (sessionId) {
        const tokenData = await this.tokenStore.get(sessionId);
        if (tokenData) {
          // SUCCESS: Create automatic association with MCP session
          this.logger.debug(`✅ Session ID authentication successful for user: ${tokenData.user}`);
          try {
            createAutoAssociation(sessionId);
          } catch (error) {
            this.logger.warn('Failed to create auto-association:', error);
            // Don't fail authentication if association fails
          }

          return {
            authenticated: true,
            context: {
              sessionId: tokenData.sessionId,
              token: tokenData.token,
              user: tokenData.user,
              scopes: tokenData.scopes,
              isAuthenticated: true,
              clientInfo,
            },
          };
        } else {
          // Session ID provided but invalid/expired
          this.logger.warn(`Invalid or expired Session ID provided: ${sessionId}`);
          return {
            authenticated: false,
            error: {
              code: 'SESSION_EXPIRED',
              message: 'Session ID is invalid or expired. Please re-authenticate.',
              authUrl: `${this.authServerUrl.replace('/auth', '')}/auth/`,
              instructions: {
                step1: `1. Your session has expired or is invalid`,
                step2: `2. Re-authenticate at: ${this.authServerUrl.replace('/auth', '')}/auth/`,
                step3: `3. Use the new Session ID provided after authentication`,
              },
            },
          };
        }
      }

      // For explicit Session ID requirement, don't use fallback methods
      // This ensures runtime operations always require explicit Session ID
      this.logger.debug('No Session ID provided in tool arguments');
      return { authenticated: false };
    } catch (error) {
      this.logger.debug('Session authentication failed:', error);
    }

    return { authenticated: false };
  }

  /**
   * Method 2: Try global authentication - DISABLED to force explicit Session ID usage
   */
  private async tryGlobalAuth(): Promise<MCPAuthResult> {
    // Global authentication is disabled to enforce explicit Session ID usage
    return { authenticated: false };
  }

  /**
   * Method 3: Try config file authentication (for desktop clients)
   */
  private async tryConfigFileAuth(): Promise<MCPAuthResult> {
    try {
      // Try multiple config file locations
      const configPaths = [
        path.join(homedir(), '.sap', 'mcp-config.json'),
        path.join(homedir(), '.config', 'sap-mcp', 'config.json'),
        path.join(process.cwd(), 'mcp-sap-config.json'),
      ];

      for (const configPath of configPaths) {
        try {
          const configContent = readFileSync(configPath, 'utf8');
          const config = JSON.parse(configContent);

          if (config.sap_mcp_session_id) {
            const tokenData = await this.tokenStore.get(config.sap_mcp_session_id);
            if (tokenData) {
              return {
                authenticated: true,
                context: {
                  sessionId: tokenData.sessionId,
                  token: tokenData.token,
                  user: tokenData.user,
                  scopes: tokenData.scopes,
                  isAuthenticated: true,
                },
              };
            }
          }
        } catch (_error) {
          // Try next config path
          continue;
        }
      }
    } catch (error) {
      this.logger.debug('Config file authentication failed:', error);
    }

    return { authenticated: false };
  }

  /**
   * Method 3: Try environment variable authentication
   */
  private async tryEnvironmentAuth(): Promise<MCPAuthResult> {
    try {
      // Try session ID from environment
      const sessionId =
        process.env.SAP_MCP_SESSION_ID || process.env.MCP_SESSION_ID || process.env.SAP_SESSION_ID;

      if (sessionId) {
        const tokenData = await this.tokenStore.get(sessionId);
        if (tokenData) {
          return {
            authenticated: true,
            context: {
              sessionId: tokenData.sessionId,
              token: tokenData.token,
              user: tokenData.user,
              scopes: tokenData.scopes,
              isAuthenticated: true,
            },
          };
        }
      }

      // Try direct token from environment (less secure, for development)
      const token =
        process.env.SAP_BTP_JWT_TOKEN || process.env.SAP_ACCESS_TOKEN || process.env.MCP_AUTH_TOKEN;

      if (token) {
        // For direct tokens, we can't get user info from token store
        // but we can still validate the token format
        return {
          authenticated: true,
          context: {
            token: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
            user: 'env-user',
            scopes: ['read', 'write'], // Default scopes for env tokens
            isAuthenticated: true,
          },
        };
      }
    } catch (error) {
      this.logger.debug('Environment authentication failed:', error);
    }

    return { authenticated: false };
  }

  /**
   * Get authentication instructions for unauthenticated requests
   */
  private getAuthInstructions(): MCPAuthResult {
    const baseUrl = this.authServerUrl.replace('/auth', '');

    // Get the client credentials from environment variables (required)
    const clientId = process.env.SAP_IAS_CLIENT_ID;
    const clientSecret = process.env.SAP_IAS_CLIENT_SECRET;
    const iasUrl = process.env.SAP_IAS_URL;

    if (!clientId || !clientSecret || !iasUrl) {
      return {
        authenticated: false,
        error: {
          code: 'configuration_error',
          message:
            'Missing required SAP IAS configuration: SAP_IAS_CLIENT_ID, SAP_IAS_CLIENT_SECRET, and SAP_IAS_URL must be set',
        },
      };
    }

    return {
      authenticated: false,
      error: {
        code: 'SESSION_ID_REQUIRED',
        message: 'Authentication required. Please provide your Session ID to use this tool.',
        authUrl: `${baseUrl}/auth/`,
        instructions: {
          step1: `1. Open your browser and navigate to: ${baseUrl}/auth/`,
          step2: `2. Complete the SAP IAS authentication process`,
          step3: `3. Copy the Session ID displayed on the success page`,
          web_method: {
            step1: `Open browser: ${baseUrl}/auth/`,
            step2: `Complete SAP IAS authentication`,
            step3: `Copy the Session ID from the success page and provide it in your next request`,
          },
          cli_method: {
            description: 'For programmatic access, use the session_id parameter:',
            step1: `1. First authenticate: curl -X POST "${baseUrl}/auth/login" -H "Content-Type: application/json" -d '{"username":"YOUR_USERNAME","password":"YOUR_PASSWORD"}'`,
            step2: `2. The response will contain your Session ID`,
            step3: `3. Use the Session ID in your MCP tool calls by adding "session_id": "YOUR_SESSION_ID" to the arguments`,
            note: 'Each user can have only one active session. New authentication will invalidate previous sessions.',
          },
          server_managed: {
            description: 'Session-based authentication with Session ID:',
            benefits: [
              '✓ Secure user-specific JWT token handling',
              '✓ Proper Principal Propagation to SAP systems',
              '✓ Single active session per user (automatic cleanup)',
              '✓ Session expiration and renewal handling',
              '✓ Works with Claude Desktop and all MCP clients',
            ],
          },
          quick_start: `To get your Session ID: Navigate to ${baseUrl}/auth/ → Authenticate → Copy Session ID → Use in MCP calls`,
        },
      },
    };
  }

  /**
   * Check if a tool is a runtime operation (requires explicit Session ID)
   */
  private isRuntimeOperation(toolName: string): boolean {
    const runtimeTools = ['execute-entity-operation'];
    return runtimeTools.includes(toolName);
  }

  /**
   * Check if a tool requires authentication
   */
  private requiresAuth(toolName: string): boolean {
    // Define public tools that don't require authentication (connection, discovery)
    const publicTools = [
      // MCP protocol tools
      'mcp_initialize',
      'mcp_list_tools',
      'mcp_list_resources',

      // SAP service discovery tools (always public)
      'search-sap-services',
      'discover-service-entities',
      'get-entity-schema',

      // System tools
      'sap_service_discovery',
      'sap_metadata',
      'sap_health_check',
      'system_info',
    ];

    return !publicTools.includes(toolName);
  }

  /**
   * Get required scope for a tool
   */
  private getRequiredScope(toolName: string, args?: any): string | null {
    // Special handling for execute-entity-operation - check operation parameter
    if (toolName === 'execute-entity-operation' && args?.operation) {
      const operation = args.operation as string;
      switch (operation) {
        case 'read':
        case 'read-single':
          return 'read';
        case 'create':
        case 'update':
        case 'patch':
          return 'write';
        case 'delete':
          return 'delete';
        default:
          return 'read'; // Default to read for unknown operations
      }
    }

    const scopeMapping: Record<string, string> = {
      // Read operations
      sap_odata_read_entity: 'read',
      sap_odata_query_entities: 'read',
      sap_odata_get_metadata: 'read',

      // Write operations
      sap_odata_create_entity: 'write',
      sap_odata_update_entity: 'write',
      sap_odata_patch_entity: 'write',

      // Delete operations
      sap_odata_delete_entity: 'delete',

      // Admin operations
      'sap_admin_*': 'admin',
      'system_admin_*': 'admin',

      // UI Tools - require specific UI scopes
      'ui-form-generator': 'ui.forms',
      'ui-data-grid': 'ui.grids',
      'ui-dashboard-composer': 'ui.dashboards',
      'ui-workflow-builder': 'ui.workflows',
      'ui-report-builder': 'ui.reports',
    };

    // Check for exact match first
    if (scopeMapping[toolName]) {
      return scopeMapping[toolName];
    }

    // Check for wildcard matches
    for (const [pattern, scope] of Object.entries(scopeMapping)) {
      if (pattern.endsWith('*') && toolName.startsWith(pattern.slice(0, -1))) {
        return scope;
      }
    }

    // Default to read for most operations
    if (toolName.startsWith('sap_')) {
      return 'read';
    }

    return null;
  }

  /**
   * Check if user has required scope
   */
  private hasRequiredScope(userScopes: string[], requiredScope: string): boolean {
    // Admin scope has all permissions
    if (userScopes.includes('admin')) {
      return true;
    }

    // Check for exact scope match (including full scope names with prefix)
    if (userScopes.includes(requiredScope)) {
      return true;
    }

    // For UI scopes, also check with full scope prefix
    if (requiredScope.startsWith('ui.')) {
      const xsappname = process.env.XSUAA_XSAPPNAME || 'btp-sap-odata-to-mcp-server';
      const fullScopeName = `${xsappname}.${requiredScope}`;
      if (userScopes.includes(fullScopeName)) {
        return true;
      }
    }

    // Check scope hierarchy (write includes read, delete includes write and read)
    const scopeHierarchy: Record<string, string[]> = {
      read: ['read'],
      write: ['read', 'write'],
      delete: ['read', 'write', 'delete'],
      admin: [
        'read',
        'write',
        'delete',
        'admin',
        'discover',
        'ui.forms',
        'ui.grids',
        'ui.dashboards',
        'ui.workflows',
        'ui.reports',
      ],
    };

    for (const userScope of userScopes) {
      // Handle full scope names with prefix (including complex BTP formats)
      let scopeToCheck = userScope;

      // Handle BTP scope format: app-name-space!tenant.scope or app-name.scope
      // Extract the scope part after the last occurrence of app name
      const lastDotIndex = userScope.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        const afterLastDot = userScope.substring(lastDotIndex + 1);

        // Check if this looks like a UI scope (contains ui prefix in the remaining part)
        if (userScope.includes('.ui.')) {
          // For UI scopes like "app.ui.forms", extract "ui.forms"
          const uiIndex = userScope.indexOf('.ui.');
          scopeToCheck = userScope.substring(uiIndex + 1); // +1 to skip the first dot
        } else {
          // For simple scopes like "app.read", extract "read"
          scopeToCheck = afterLastDot;
        }
      }

      const allowedScopes = scopeHierarchy[scopeToCheck] || [scopeToCheck];
      if (allowedScopes.includes(requiredScope)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract authentication context from successful authentication
   */
  extractAuthContext(authResult: MCPAuthResult): MCPAuthContext | null {
    if (!authResult.authenticated || !authResult.context) {
      return null;
    }

    return authResult.context;
  }

  /**
   * Format authentication error for tool response
   */
  formatAuthError(authResult: MCPAuthResult): any {
    if (!authResult.error) {
      return { error: 'Authentication failed', authenticated: false };
    }

    return {
      error: authResult.error.message,
      code: authResult.error.code,
      authenticated: false,
      authUrl: authResult.error.authUrl,
      instructions: authResult.error.instructions,
    };
  }
}
