import { MCPAuthManager } from './mcp-auth.js';
import { Logger } from '../utils/logger.js';

/**
 * Authentication result interface
 */
export interface AuthValidationResult {
  isValid: boolean;
  user?: string;
  scopes?: string[];
  error?: string;
}

/**
 * Authentication Validator - Handles UI tool authentication
 */
export class AuthenticationValidator {
  constructor(
    private authManager?: MCPAuthManager,
    private logger?: Logger
  ) {}

  /**
   * Validate authentication token for UI tools
   */
  async validateToken(token?: string): Promise<AuthValidationResult> {
    try {
      if (!this.authManager) {
        this.logger?.debug('No auth manager available - allowing access');
        return {
          isValid: true,
          user: 'anonymous',
          scopes: ['ui.forms', 'ui.grids', 'ui.dashboards', 'ui.workflows', 'ui.reports'],
        };
      }

      if (!token) {
        return {
          isValid: false,
          error: 'No authentication token provided',
        };
      }

      // Use the auth manager to validate the token
      const authResult = await this.authManager.authenticateToolCall('ui-validation', { token });

      if (authResult.authenticated) {
        return {
          isValid: true,
          user: authResult.context?.user || 'authenticated_user',
          scopes: this.extractScopes(authResult.context),
        };
      } else {
        return {
          isValid: false,
          error: authResult.error?.message || 'Authentication failed',
        };
      }
    } catch (error) {
      this.logger?.error('Error validating authentication:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Authentication validation error',
      };
    }
  }

  /**
   * Check if user has required scope
   */
  hasScope(userScopes: string[] | undefined, requiredScope: string): boolean {
    if (!userScopes) {
      return false;
    }
    return userScopes.includes(requiredScope);
  }

  /**
   * Extract scopes from authentication context
   */
  private extractScopes(context: any): string[] {
    // Default scopes for authenticated users
    const defaultScopes = ['ui.forms', 'ui.grids', 'ui.dashboards', 'ui.workflows', 'ui.reports'];

    if (!context) {
      return defaultScopes;
    }

    // Extract scopes from JWT token or context
    if (context.scopes && Array.isArray(context.scopes)) {
      return context.scopes;
    }

    if (context.token) {
      try {
        // Decode JWT token to extract scopes (simplified)
        const tokenParts = context.token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          if (payload.scope) {
            return typeof payload.scope === 'string' ? payload.scope.split(' ') : payload.scope;
          }
        }
      } catch (error) {
        this.logger?.warn('Error decoding JWT token for scopes:', error);
      }
    }

    return defaultScopes;
  }

  /**
   * Validate specific UI tool access
   */
  async validateUIToolAccess(toolName: string, token?: string): Promise<AuthValidationResult> {
    const validationResult = await this.validateToken(token);

    if (!validationResult.isValid) {
      return validationResult;
    }

    // Map tool names to required scopes
    const scopeMapping: Record<string, string> = {
      'ui-form-generator': 'ui.forms',
      'ui-data-grid': 'ui.grids',
      'ui-dashboard-composer': 'ui.dashboards',
      'ui-workflow-builder': 'ui.workflows',
      'ui-report-builder': 'ui.reports',
    };

    const requiredScope = scopeMapping[toolName];
    if (!requiredScope) {
      return validationResult; // No specific scope required
    }

    if (!this.hasScope(validationResult.scopes, requiredScope)) {
      return {
        isValid: false,
        error: `Insufficient permissions. Required scope: ${requiredScope}`,
      };
    }

    return validationResult;
  }
}
