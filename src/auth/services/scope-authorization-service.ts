/**
 * Scope-based authorization service
 * Handles permission checking based on user scopes and roles
 */

import {
  IAuthorizationService,
  Permission,
  Role
} from '../interfaces/authorization.interface.js';
import { UserInfo } from '../interfaces/auth-provider.interface.js';
import { Logger } from '../../utils/logger.js';
import { Messages } from '../../i18n/messages.js';

export class ScopeAuthorizationService implements IAuthorizationService {
  private logger: Logger;
  private roleMapping: Map<string, Role> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('ScopeAuthorizationService');
    this.initializeDefaultRoles();
  }

  /**
   * Check if user has permission for resource and action
   */
  async hasPermission(userInfo: UserInfo, resource: string, action: string): Promise<boolean> {
    try {
      const userScopes = userInfo.scopes || [];

      // Check direct scope permissions
      const requiredScope = this.buildScopeString(resource, action);
      if (userScopes.includes(requiredScope)) {
        return true;
      }

      // Check wildcard permissions
      const wildcardScope = this.buildScopeString(resource, '*');
      if (userScopes.includes(wildcardScope)) {
        return true;
      }

      // Check admin scope (full access)
      if (userScopes.includes('admin') || userScopes.includes('*.admin')) {
        return true;
      }

      // Check role-based permissions
      const roles = await this.getRoles(userInfo);
      for (const role of roles) {
        if (this.roleHasPermission(role, resource, action)) {
          return true;
        }
      }

      this.logger.debug(
        `Permission denied for user ${userInfo.id}: ${resource}.${action} ` +
        `(scopes: ${userScopes.join(', ')})`
      );

      return false;
    } catch (error) {
      this.logger.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for user
   */
  async getPermissions(userInfo: UserInfo): Promise<Permission[]> {
    const permissions: Permission[] = [];
    const userScopes = userInfo.scopes || [];

    // Convert scopes to permissions
    for (const scope of userScopes) {
      const permission = this.scopeToPermission(scope);
      if (permission) {
        permissions.push(permission);
      }
    }

    // Add role-based permissions
    const roles = await this.getRoles(userInfo);
    for (const role of roles) {
      permissions.push(...role.permissions);
    }

    // Remove duplicates
    return this.deduplicatePermissions(permissions);
  }

  /**
   * Get user roles from scopes and groups
   */
  async getRoles(userInfo: UserInfo): Promise<Role[]> {
    const roles: Role[] = [];
    const userScopes = userInfo.scopes || [];
    const userGroups = userInfo.groups || [];

    // Map scopes to roles
    for (const scope of userScopes) {
      const role = this.mapScopeToRole(scope);
      if (role) {
        roles.push(role);
      }
    }

    // Map groups to roles
    for (const group of userGroups) {
      const role = this.mapGroupToRole(group);
      if (role) {
        roles.push(role);
      }
    }

    return this.deduplicateRoles(roles);
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userInfo: UserInfo, roleName: string): Promise<boolean> {
    const roles = await this.getRoles(userInfo);
    return roles.some(role => role.name === roleName);
  }

  /**
   * Check if user has any of the specified scopes
   */
  async hasScope(userInfo: UserInfo, scope: string | string[]): Promise<boolean> {
    const userScopes = userInfo.scopes || [];
    const requiredScopes = Array.isArray(scope) ? scope : [scope];

    return requiredScopes.some(requiredScope => {
      // Exact match
      if (userScopes.includes(requiredScope)) {
        return true;
      }

      // Wildcard match (e.g., user has "odata.*" and required is "odata.read")
      return userScopes.some(userScope => {
        if (userScope.endsWith('.*')) {
          const prefix = userScope.slice(0, -2);
          return requiredScope.startsWith(prefix + '.');
        }
        return false;
      });
    });
  }

  /**
   * Evaluate permission with conditions
   */
  async evaluatePermission(
    userInfo: UserInfo,
    permission: Permission,
    context?: Record<string, any>
  ): Promise<boolean> {
    // First check basic permission
    const hasBasicPermission = await this.hasPermission(
      userInfo,
      permission.resource,
      permission.action
    );

    if (!hasBasicPermission) {
      return false;
    }

    // If no conditions, basic permission is enough
    if (!permission.conditions || Object.keys(permission.conditions).length === 0) {
      return true;
    }

    // Evaluate conditions
    if (context) {
      return this.evaluateConditions(permission.conditions, context, userInfo);
    }

    // No context provided but conditions exist - deny
    return false;
  }

  /**
   * Build scope string from resource and action
   */
  private buildScopeString(resource: string, action: string): string {
    return `${resource}.${action}`;
  }

  /**
   * Check if role has permission
   */
  private roleHasPermission(role: Role, resource: string, action: string): boolean {
    return role.permissions.some(
      permission =>
        permission.resource === resource &&
        (permission.action === action || permission.action === '*')
    );
  }

  /**
   * Convert scope to permission
   */
  private scopeToPermission(scope: string): Permission | null {
    const parts = scope.split('.');
    if (parts.length < 2) {
      return null;
    }

    const action = parts.pop()!;
    const resource = parts.join('.');

    return {
      resource,
      action
    };
  }

  /**
   * Map scope to role
   */
  private mapScopeToRole(scope: string): Role | null {
    // Admin scopes
    if (scope.includes('admin')) {
      return this.roleMapping.get('admin') || null;
    }

    // Service scopes
    if (scope.startsWith('odata.')) {
      return this.roleMapping.get('odata-user') || null;
    }

    if (scope.startsWith('mcp.')) {
      return this.roleMapping.get('mcp-user') || null;
    }

    return null;
  }

  /**
   * Map group to role
   */
  private mapGroupToRole(group: string): Role | null {
    // Group to role mapping
    const groupRoleMap: Record<string, string> = {
      'administrators': 'admin',
      'odata-users': 'odata-user',
      'mcp-users': 'mcp-user',
      'readonly-users': 'readonly'
    };

    const roleName = groupRoleMap[group.toLowerCase()];
    return roleName ? this.roleMapping.get(roleName) || null : null;
  }

  /**
   * Evaluate permission conditions
   */
  private evaluateConditions(
    conditions: Record<string, any>,
    context: Record<string, any>,
    userInfo: UserInfo
  ): boolean {
    // Owner condition
    if (conditions.owner && context.userId && userInfo.id !== context.userId) {
      return false;
    }

    // Time-based conditions
    if (conditions.timeRange) {
      const now = new Date();
      const start = new Date(conditions.timeRange.start);
      const end = new Date(conditions.timeRange.end);

      if (now < start || now > end) {
        return false;
      }
    }

    // IP address restrictions
    if (conditions.allowedIps && context.clientIp) {
      if (!conditions.allowedIps.includes(context.clientIp)) {
        return false;
      }
    }

    // Environment restrictions
    if (conditions.environment && context.environment) {
      if (conditions.environment !== context.environment) {
        return false;
      }
    }

    return true;
  }

  /**
   * Remove duplicate permissions
   */
  private deduplicatePermissions(permissions: Permission[]): Permission[] {
    const seen = new Set<string>();
    return permissions.filter(permission => {
      const key = `${permission.resource}.${permission.action}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Remove duplicate roles
   */
  private deduplicateRoles(roles: Role[]): Role[] {
    const seen = new Set<string>();
    return roles.filter(role => {
      if (seen.has(role.name)) {
        return false;
      }
      seen.add(role.name);
      return true;
    });
  }

  /**
   * Initialize default roles
   */
  private initializeDefaultRoles(): void {
    // Admin role - full access
    this.roleMapping.set('admin', {
      name: 'admin',
      description: 'Administrator with full system access',
      permissions: [
        { resource: '*', action: '*' }
      ]
    });

    // OData user role
    this.roleMapping.set('odata-user', {
      name: 'odata-user',
      description: 'User with access to OData services',
      permissions: [
        { resource: 'odata', action: 'read' },
        { resource: 'odata', action: 'discover' },
        { resource: 'service', action: 'discover' }
      ]
    });

    // MCP user role
    this.roleMapping.set('mcp-user', {
      name: 'mcp-user',
      description: 'User with access to MCP tools',
      permissions: [
        { resource: 'mcp', action: 'read' },
        { resource: 'mcp', action: 'write' },
        { resource: 'tools', action: 'execute' }
      ]
    });

    // Read-only role
    this.roleMapping.set('readonly', {
      name: 'readonly',
      description: 'Read-only access to resources',
      permissions: [
        { resource: '*', action: 'read' },
        { resource: '*', action: 'discover' }
      ]
    });
  }

  /**
   * Add custom role
   */
  public addRole(role: Role): void {
    this.roleMapping.set(role.name, role);
    this.logger.info(`Added custom role: ${role.name}`);
  }

  /**
   * Remove role
   */
  public removeRole(roleName: string): boolean {
    const removed = this.roleMapping.delete(roleName);
    if (removed) {
      this.logger.info(`Removed role: ${roleName}`);
    }
    return removed;
  }

  /**
   * Get all available roles
   */
  public getAllRoles(): Role[] {
    return Array.from(this.roleMapping.values());
  }
}