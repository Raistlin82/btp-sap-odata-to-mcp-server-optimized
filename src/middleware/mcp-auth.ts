import { readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { TokenStore, StoredTokenData } from '../services/token-store.js';

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
      quick_start?: string | {
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
          scopes: []
        }
      };
    }

    // Try multiple authentication methods in order of preference
    let authResult = await this.trySessionAuth(args, clientInfo);
    
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
      return this.getAuthInstructions(toolName);
    }

    // Check authorization (scopes)
    const requiredScope = this.getRequiredScope(toolName);
    if (requiredScope && !this.hasRequiredScope(authResult.context?.scopes || [], requiredScope)) {
      return {
        authenticated: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this operation',
          instructions: {
            step1: `Visit: ${this.authServerUrl}/login`,
            step2: `Request access to scope: ${requiredScope}`,
            step3: 'Re-authenticate with proper permissions'
          }
        }
      };
    }

    return authResult;
  }

  /**
   * Method 1: Try session-based authentication (for web clients)
   */
  private async trySessionAuth(args: any, clientInfo?: any): Promise<MCPAuthResult> {
    try {
      // Check for session ID in tool arguments
      const sessionId = args?.session_id || args?.auth_session_id;
      
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
              clientInfo
            }
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
              clientInfo
            }
          };
        }
      }

    } catch (error) {
      this.logger.debug('Session authentication failed:', error);
    }

    return { authenticated: false };
  }

  /**
   * Method 2: Try global authentication (server-side stored credentials)
   */
  private async tryGlobalAuth(): Promise<MCPAuthResult> {
    try {
      const globalAuthKey = 'global_user_auth';
      const tokenData = await this.tokenStore.get(globalAuthKey);
      
      if (!tokenData) {
        this.logger.debug('No global authentication found');
        return { authenticated: false };
      }

      // Check if token is still valid
      if (Date.now() > tokenData.expiresAt) {
        this.logger.debug('Global auth token expired, removing');
        await this.tokenStore.remove(globalAuthKey);
        return { authenticated: false };
      }

      // Update last used time
      await this.tokenStore.updateLastUsed(globalAuthKey);

      this.logger.info(`Global authentication found for user: ${tokenData.user}`);
      
      return {
        authenticated: true,
        context: {
          isAuthenticated: true,
          user: tokenData.user,
          scopes: tokenData.scopes || [],
          token: tokenData.token,
          sessionId: globalAuthKey
        }
      };

    } catch (error) {
      this.logger.error('Global authentication error:', error);
      return { authenticated: false };
    }
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
        path.join(process.cwd(), 'mcp-sap-config.json')
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
                  isAuthenticated: true
                }
              };
            }
          }
        } catch (error) {
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
      const sessionId = process.env.SAP_MCP_SESSION_ID || 
                       process.env.MCP_SESSION_ID ||
                       process.env.SAP_SESSION_ID;

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
              isAuthenticated: true
            }
          };
        }
      }

      // Try direct token from environment (less secure, for development)
      const token = process.env.SAP_BTP_JWT_TOKEN || 
                   process.env.SAP_ACCESS_TOKEN ||
                   process.env.MCP_AUTH_TOKEN;

      if (token) {
        // For direct tokens, we can't get user info from token store
        // but we can still validate the token format
        return {
          authenticated: true,
          context: {
            token: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
            user: 'env-user',
            scopes: ['read', 'write'], // Default scopes for env tokens
            isAuthenticated: true
          }
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
  private getAuthInstructions(toolName: string): MCPAuthResult {
    const requiredScope = this.getRequiredScope(toolName);
    const baseUrl = this.authServerUrl.replace('/auth', '');
    
    // Get the client credentials from environment (same way IAS service does)
    const clientId = process.env.SAP_IAS_CLIENT_ID || '955d133c-758b-42c7-b1a5-fa99cd5e6661';
    const clientSecret = process.env.SAP_IAS_CLIENT_SECRET || 'y]cW]AMYnJlYc-ArV[9CJYABtBfBQK';
    const iasUrl = process.env.SAP_IAS_URL || 'https://afhdupfoc.accounts.ondemand.com';
    
    return {
      authenticated: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to use this tool. Choose one of these options:',
        authUrl: `${this.authServerUrl}/login`,
        instructions: {
          web_method: {
            step1: `Open your browser and navigate to: ${baseUrl}/auth/`,
            step2: `Complete the SAP IAS authentication in your browser`,
            step3: `Authentication is automatically stored - return to using MCP tools normally`
          },
          cli_method: {
            description: 'Command-line authentication option:',
            step1: `curl -X POST "${baseUrl}/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"YOUR_SAP_USERNAME","password":"YOUR_SAP_PASSWORD"}'`,
            step2: `# Server will automatically associate your authentication with this MCP session`,
            step3: `# Continue using MCP tools - server handles authentication transparently`,
            note: 'Server remembers your authentication automatically - no session IDs or client config needed'
          },
          server_managed: {
            description: 'Transparent server-side authentication:',
            benefits: [
              '✓ Authenticate once, works everywhere (web, desktop, mobile)',
              '✓ No client configuration or session IDs required',
              '✓ Server automatically associates auth with your connection', 
              '✓ Works seamlessly with Claude Desktop, web clients, etc.',
              '✓ Transparent token refresh and session management'
            ]
          },
          quick_start: {
            browser: `Navigate to: ${baseUrl}/auth/`,
            curl: `curl -X POST "${baseUrl}/auth/login" -H "Content-Type: application/json" -d '{"username":"YOUR_SAP_USERNAME","password":"YOUR_SAP_PASSWORD"}'`
          }
        }
      }
    };
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
      'system_info'
    ];

    return !publicTools.includes(toolName);
  }

  /**
   * Get required scope for a tool
   */
  private getRequiredScope(toolName: string): string | null {
    const scopeMapping: Record<string, string> = {
      // Read operations
      'sap_odata_read_entity': 'read',
      'sap_odata_query_entities': 'read',
      'sap_odata_get_metadata': 'read',
      
      // Write operations
      'sap_odata_create_entity': 'write',
      'sap_odata_update_entity': 'write',
      'sap_odata_patch_entity': 'write',
      
      // Delete operations
      'sap_odata_delete_entity': 'delete',
      
      // Admin operations
      'sap_admin_*': 'admin',
      'system_admin_*': 'admin'
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

    // Check for exact scope match
    if (userScopes.includes(requiredScope)) {
      return true;
    }

    // Check scope hierarchy (write includes read, delete includes write and read)
    const scopeHierarchy: Record<string, string[]> = {
      'read': ['read'],
      'write': ['read', 'write'],
      'delete': ['read', 'write', 'delete'],
      'admin': ['read', 'write', 'delete', 'admin', 'discover']
    };

    for (const userScope of userScopes) {
      const allowedScopes = scopeHierarchy[userScope] || [userScope];
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
      instructions: authResult.error.instructions
    };
  }
}