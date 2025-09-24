/**
 * Authentication factory for modular authentication management
 * Allows switching between different authentication mechanisms via environment variables
 */

import { IAuthProvider, IOAuth2Provider } from './interfaces/auth-provider.interface.js';
import { ISessionManager } from './interfaces/session-manager.interface.js';
import { IAuthorizationService } from './interfaces/authorization.interface.js';
import { IASAuthProvider } from './providers/ias-auth-provider.js';
import { MemorySessionManager } from './services/memory-session-manager.js';
import { ScopeAuthorizationService } from './services/scope-authorization-service.js';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
// Removed unused Messages import

export enum AuthMechanism {
  IAS = 'ias',
  OAUTH2 = 'oauth2',
  JWT = 'jwt',
  BASIC = 'basic',
  API_KEY = 'apikey',
  CUSTOM = 'custom',
}

export enum SessionMechanism {
  MEMORY = 'memory',
  REDIS = 'redis',
  DATABASE = 'database',
  JWT = 'jwt',
}

export interface AuthConfig {
  authMechanism: AuthMechanism;
  sessionMechanism: SessionMechanism;
  customProviders?: Map<string, () => IAuthProvider>;
  customSessionManagers?: Map<string, () => ISessionManager>;
}

/**
 * Factory class for creating authentication components
 */
export class AuthFactory {
  private logger: Logger;
  private config: Config;
  private authConfig: AuthConfig;

  // Cache for singleton instances
  private authProviderCache: IAuthProvider | null = null;
  private sessionManagerCache: ISessionManager | null = null;
  private authorizationServiceCache: IAuthorizationService | null = null;

  constructor(logger?: Logger, config?: Config) {
    this.logger = logger || new Logger('AuthFactory');
    this.config = config || new Config();
    this.authConfig = this.loadAuthConfig();
  }

  /**
   * Create authentication provider based on configuration
   */
  createAuthProvider(): IAuthProvider {
    if (this.authProviderCache) {
      return this.authProviderCache;
    }

    const mechanism = this.authConfig.authMechanism;
    this.logger.info(`Creating auth provider: ${mechanism}`);

    let provider: IAuthProvider;

    switch (mechanism) {
      case AuthMechanism.IAS:
        provider = new IASAuthProvider(this.logger, this.config);
        break;

      case AuthMechanism.OAUTH2:
        // Future: Generic OAuth2 provider
        throw new Error('Generic OAuth2 provider not yet implemented');

      case AuthMechanism.JWT:
        // Future: JWT-only provider
        throw new Error('JWT provider not yet implemented');

      case AuthMechanism.BASIC:
        // Future: Basic auth provider
        throw new Error('Basic auth provider not yet implemented');

      case AuthMechanism.API_KEY:
        // Future: API key provider
        throw new Error('API key provider not yet implemented');

      case AuthMechanism.CUSTOM:
        provider = this.createCustomAuthProvider();
        break;

      default:
        this.logger.warn(`Unknown auth mechanism: ${mechanism}, falling back to IAS`);
        provider = new IASAuthProvider(this.logger, this.config);
    }

    // Cache the provider
    this.authProviderCache = provider;
    return provider;
  }

  /**
   * Create session manager based on configuration
   */
  createSessionManager(): ISessionManager {
    if (this.sessionManagerCache) {
      return this.sessionManagerCache;
    }

    const mechanism = this.authConfig.sessionMechanism;
    this.logger.info(`Creating session manager: ${mechanism}`);

    let sessionManager: ISessionManager;

    switch (mechanism) {
      case SessionMechanism.MEMORY:
        sessionManager = new MemorySessionManager(this.logger);
        break;

      case SessionMechanism.REDIS:
        // Future: Redis session manager
        throw new Error('Redis session manager not yet implemented');

      case SessionMechanism.DATABASE:
        // Future: Database session manager
        throw new Error('Database session manager not yet implemented');

      case SessionMechanism.JWT:
        // Future: JWT-based stateless sessions
        throw new Error('JWT session manager not yet implemented');

      default:
        this.logger.warn(`Unknown session mechanism: ${mechanism}, falling back to memory`);
        sessionManager = new MemorySessionManager(this.logger);
    }

    // Cache the session manager
    this.sessionManagerCache = sessionManager;
    return sessionManager;
  }

  /**
   * Create authorization service
   */
  createAuthorizationService(): IAuthorizationService {
    if (this.authorizationServiceCache) {
      return this.authorizationServiceCache;
    }

    this.logger.info('Creating authorization service: scope-based');

    const authzService = new ScopeAuthorizationService(this.logger);

    // Cache the authorization service
    this.authorizationServiceCache = authzService;
    return authzService;
  }

  /**
   * Get current authentication mechanism
   */
  getAuthMechanism(): AuthMechanism {
    return this.authConfig.authMechanism;
  }

  /**
   * Get current session mechanism
   */
  getSessionMechanism(): SessionMechanism {
    return this.authConfig.sessionMechanism;
  }

  /**
   * Check if current auth provider supports OAuth2
   */
  isOAuth2Provider(): boolean {
    const provider = this.createAuthProvider();
    return 'generateAuthorizationUrl' in provider && 'exchangeCodeForTokens' in provider;
  }

  /**
   * Get OAuth2 provider (throws if not OAuth2 compatible)
   */
  getOAuth2Provider(): IOAuth2Provider {
    const provider = this.createAuthProvider();

    if (!this.isOAuth2Provider()) {
      throw new Error(`Current auth provider (${this.getAuthMechanism()}) does not support OAuth2`);
    }

    return provider as IOAuth2Provider;
  }

  /**
   * Update authentication mechanism at runtime
   */
  updateAuthMechanism(mechanism: AuthMechanism): void {
    this.logger.info(
      `Switching auth mechanism from ${this.authConfig.authMechanism} to ${mechanism}`
    );

    // Clear cached provider
    this.authProviderCache = null;

    // Update config
    this.authConfig.authMechanism = mechanism;

    // Test the new provider
    try {
      const _newProvider = this.createAuthProvider();
      this.logger.info(`Successfully switched to auth mechanism: ${mechanism}`);
    } catch (error) {
      this.logger.error(`Failed to switch to auth mechanism ${mechanism}:`, error);
      throw error;
    }
  }

  /**
   * Update session mechanism at runtime
   */
  updateSessionMechanism(mechanism: SessionMechanism): void {
    this.logger.info(
      `Switching session mechanism from ${this.authConfig.sessionMechanism} to ${mechanism}`
    );

    // Cleanup old session manager
    if (this.sessionManagerCache) {
      if ('stopAutoCleanup' in this.sessionManagerCache) {
        (this.sessionManagerCache as any).stopAutoCleanup();
      }
    }

    // Clear cached session manager
    this.sessionManagerCache = null;

    // Update config
    this.authConfig.sessionMechanism = mechanism;

    // Test the new session manager
    try {
      const _newSessionManager = this.createSessionManager();
      this.logger.info(`Successfully switched to session mechanism: ${mechanism}`);
    } catch (error) {
      this.logger.error(`Failed to switch to session mechanism ${mechanism}:`, error);
      throw error;
    }
  }

  /**
   * Register custom auth provider
   */
  registerCustomAuthProvider(name: string, factory: () => IAuthProvider): void {
    if (!this.authConfig.customProviders) {
      this.authConfig.customProviders = new Map();
    }

    this.authConfig.customProviders.set(name, factory);
    this.logger.info(`Registered custom auth provider: ${name}`);
  }

  /**
   * Register custom session manager
   */
  registerCustomSessionManager(name: string, factory: () => ISessionManager): void {
    if (!this.authConfig.customSessionManagers) {
      this.authConfig.customSessionManagers = new Map();
    }

    this.authConfig.customSessionManagers.set(name, factory);
    this.logger.info(`Registered custom session manager: ${name}`);
  }

  /**
   * Load authentication configuration from environment/config
   */
  private loadAuthConfig(): AuthConfig {
    // Load auth mechanism from environment
    const authMechanism = this.config
      .get('auth.mechanism', process.env.AUTH_MECHANISM || 'ias')
      .toLowerCase() as AuthMechanism;

    // Load session mechanism from environment
    const sessionMechanism = this.config
      .get('session.mechanism', process.env.SESSION_MECHANISM || 'memory')
      .toLowerCase() as SessionMechanism;

    // Validate mechanisms
    if (!Object.values(AuthMechanism).includes(authMechanism)) {
      this.logger.warn(`Invalid auth mechanism: ${authMechanism}, using IAS`);
    }

    if (!Object.values(SessionMechanism).includes(sessionMechanism)) {
      this.logger.warn(`Invalid session mechanism: ${sessionMechanism}, using memory`);
    }

    return {
      authMechanism: Object.values(AuthMechanism).includes(authMechanism)
        ? authMechanism
        : AuthMechanism.IAS,
      sessionMechanism: Object.values(SessionMechanism).includes(sessionMechanism)
        ? sessionMechanism
        : SessionMechanism.MEMORY,
    };
  }

  /**
   * Create custom auth provider
   */
  private createCustomAuthProvider(): IAuthProvider {
    const customName = this.config.get(
      'auth.customProvider',
      process.env.AUTH_CUSTOM_PROVIDER || ''
    );

    if (!customName) {
      throw new Error('Custom auth mechanism selected but no custom provider name specified');
    }

    if (!this.authConfig.customProviders?.has(customName)) {
      throw new Error(`Custom auth provider '${customName}' not registered`);
    }

    const factory = this.authConfig.customProviders.get(customName)!;
    return factory();
  }

  /**
   * Get authentication configuration info
   */
  getConfig(): {
    authMechanism: string;
    sessionMechanism: string;
    isOAuth2Compatible: boolean;
    providerName: string;
  } {
    const provider = this.createAuthProvider();

    return {
      authMechanism: this.authConfig.authMechanism,
      sessionMechanism: this.authConfig.sessionMechanism,
      isOAuth2Compatible: this.isOAuth2Provider(),
      providerName: provider.name,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.sessionManagerCache && 'stopAutoCleanup' in this.sessionManagerCache) {
      (this.sessionManagerCache as any).stopAutoCleanup();
    }

    this.authProviderCache = null;
    this.sessionManagerCache = null;
    this.authorizationServiceCache = null;
  }
}
