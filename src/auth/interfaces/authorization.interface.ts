/**
 * Authorization service interface for permission management
 */

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  description?: string;
}

/**
 * Authorization service for managing user permissions
 */
export interface IAuthorizationService {
  /**
   * Check if user has permission
   */
  hasPermission(userInfo: UserInfo, resource: string, action: string): Promise<boolean>;

  /**
   * Get all permissions for user
   */
  getPermissions(userInfo: UserInfo): Promise<Permission[]>;

  /**
   * Get user roles
   */
  getRoles(userInfo: UserInfo): Promise<Role[]>;

  /**
   * Check if user has role
   */
  hasRole(userInfo: UserInfo, roleName: string): Promise<boolean>;

  /**
   * Check if user has any of the specified scopes
   */
  hasScope(userInfo: UserInfo, scope: string | string[]): Promise<boolean>;

  /**
   * Evaluate permission with conditions
   */
  evaluatePermission(
    userInfo: UserInfo,
    permission: Permission,
    context?: Record<string, any>
  ): Promise<boolean>;
}

import { UserInfo } from './auth-provider.interface.js';