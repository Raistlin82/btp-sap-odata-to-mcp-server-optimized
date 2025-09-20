/**
 * IAS (Identity Authentication Service) authentication provider
 * Modular implementation of SAP IAS authentication
 */

import {
  IOAuth2Provider,
  TokenData,
  ValidationResult,
  UserInfo,
  AuthCredentials
} from '../interfaces/auth-provider.interface.js';
import { Logger } from '../../utils/logger.js';
import { Config } from '../../utils/config.js';
import { Messages } from '../../i18n/messages.js';

export class IASAuthProvider implements IOAuth2Provider {
  readonly name = 'SAP-IAS';
  private logger: Logger;
  private config: Config;
  private iasUrl: string;
  private clientId: string;
  private clientSecret: string;
  private isConfiguredFlag: boolean = true;

  constructor(logger?: Logger, config?: Config) {
    this.logger = logger || new Logger('IASAuthProvider');
    this.config = config || new Config();

    // Load configuration from environment or config
    this.iasUrl = this.config.get('ias.url', process.env.SAP_IAS_URL || '');
    this.clientId = this.config.get('ias.clientId', process.env.SAP_IAS_CLIENT_ID || '');
    this.clientSecret = this.config.get('ias.clientSecret', process.env.SAP_IAS_CLIENT_SECRET || '');

    // Check configuration validity
    if (!this.iasUrl || !this.clientId || !this.clientSecret) {
      this.logger.warn(Messages.auth.warnings.missingConfiguration);
      this.isConfiguredFlag = false;
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return this.isConfiguredFlag;
  }

  /**
   * Generate OAuth2 authorization URL
   */
  generateAuthorizationUrl(redirectUri: string, state?: string): string {
    if (!this.isConfigured()) {
      throw new Error(Messages.auth.errors.notConfigured);
    }

    const authUrl = `${this.iasUrl}/oauth2/authorize`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email groups',
      redirect_uri: redirectUri,
      ...(state && { state })
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData> {
    if (!this.isConfigured()) {
      throw new Error(Messages.auth.errors.notConfigured);
    }

    try {
      this.logger.debug(Messages.auth.debug.exchangingCode);

      const tokenUrl = `${this.iasUrl}/oauth2/token`;
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`${Messages.auth.errors.tokenExchangeFailed}: ${response.status} - ${errorText}`);
        throw new Error(Messages.auth.errors.tokenExchangeFailed);
      }

      const tokenResponse = await response.json();
      const userInfo = await this.getUserInfoFromToken(tokenResponse.access_token);

      return this.createTokenData(tokenResponse, userInfo);
    } catch (error) {
      this.logger.error(Messages.auth.errors.tokenExchangeFailed, error);
      throw error;
    }
  }

  /**
   * Authenticate user (for backward compatibility)
   */
  async authenticate(credentials: AuthCredentials): Promise<TokenData> {
    if (credentials.code && credentials.redirectUri) {
      // OAuth2 flow
      return this.exchangeCodeForTokens(credentials.code, credentials.redirectUri);
    } else if (credentials.username && credentials.password) {
      // Password flow (deprecated)
      return this.authenticateWithPassword(credentials.username, credentials.password);
    } else {
      throw new Error(Messages.auth.errors.invalidCredentials);
    }
  }

  /**
   * Validate token using introspection
   */
  async validate(token: string): Promise<ValidationResult> {
    if (!this.isConfigured()) {
      return { valid: false, error: Messages.auth.errors.notConfigured };
    }

    try {
      // Remove Bearer prefix
      const jwtToken = token.replace(/^Bearer\s+/i, '');

      // Use introspection endpoint for secure validation
      const introspectUrl = `${this.iasUrl}/oauth2/introspect`;
      const params = new URLSearchParams({
        token: jwtToken,
        token_type_hint: 'access_token'
      });

      const response = await fetch(introspectUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        return {
          valid: false,
          error: `${Messages.auth.errors.introspectionFailed}: ${response.status}`
        };
      }

      const result = await response.json();

      if (result.active === true) {
        const userInfo = await this.getUserInfo(jwtToken);
        return { valid: true, userInfo };
      } else {
        return { valid: false, error: Messages.auth.warnings.tokenNotActive };
      }
    } catch (error) {
      this.logger.error(Messages.auth.errors.tokenValidationFailed, error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : Messages.auth.errors.tokenValidationFailed
      };
    }
  }

  /**
   * Refresh token
   */
  async refresh(refreshToken: string): Promise<TokenData> {
    if (!this.isConfigured()) {
      throw new Error(Messages.auth.errors.notConfigured);
    }

    try {
      this.logger.debug(Messages.auth.debug.refreshingToken);

      const tokenUrl = `${this.iasUrl}/oauth2/token`;
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`${Messages.auth.errors.tokenRefreshFailed}: ${response.status}`);
      }

      const tokenResponse = await response.json();
      const userInfo = await this.getUserInfoFromToken(tokenResponse.access_token);

      return this.createTokenData(tokenResponse, userInfo);
    } catch (error) {
      this.logger.error(Messages.auth.errors.tokenRefreshFailed, error);
      throw error;
    }
  }

  /**
   * Get user info from token
   */
  async getUserInfo(token: string): Promise<UserInfo> {
    const jwtToken = token.replace(/^Bearer\s+/i, '');
    const iasUserInfo = await this.getUserInfoFromToken(jwtToken);

    return {
      id: iasUserInfo.sub,
      email: iasUserInfo.email,
      name: iasUserInfo.name || iasUserInfo.preferred_username,
      groups: iasUserInfo.groups,
      scopes: iasUserInfo.scope,
      metadata: {
        given_name: iasUserInfo.given_name,
        family_name: iasUserInfo.family_name
      }
    };
  }

  /**
   * Get client credentials token
   */
  async getClientCredentialsToken(): Promise<TokenData> {
    if (!this.isConfigured()) {
      throw new Error(Messages.auth.errors.notConfigured);
    }

    try {
      this.logger.debug(Messages.auth.debug.gettingClientToken);

      const tokenUrl = `${this.iasUrl}/oauth2/token`;
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'read write delete admin discover'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`${Messages.auth.errors.authenticationFailed}: ${response.status}`);
      }

      const tokenResponse = await response.json();

      return {
        token: `Bearer ${tokenResponse.access_token}`,
        user: 'system',
        scopes: tokenResponse.scope?.split(' ') || ['read', 'write', 'delete', 'admin', 'discover'],
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshToken: tokenResponse.refresh_token
      };
    } catch (error) {
      this.logger.error(Messages.auth.errors.authenticationFailed, error);
      throw error;
    }
  }

  /**
   * Get provider configuration
   */
  getConfiguration(): Record<string, any> {
    return {
      name: this.name,
      iasUrl: this.iasUrl,
      clientId: this.clientId,
      authorizationEndpoint: `${this.iasUrl}/oauth2/authorize`,
      tokenEndpoint: `${this.iasUrl}/oauth2/token`,
      userInfoEndpoint: `${this.iasUrl}/oauth2/userinfo`,
      introspectionEndpoint: `${this.iasUrl}/oauth2/introspect`,
      supportedGrantTypes: ['authorization_code', 'client_credentials', 'refresh_token'],
      supportedScopes: ['openid', 'profile', 'email', 'groups']
    };
  }

  /**
   * Private helper to get user info from IAS
   */
  private async getUserInfoFromToken(accessToken: string): Promise<any> {
    const userInfoUrl = `${this.iasUrl}/oauth2/userinfo`;
    const token = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;

    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`${Messages.auth.errors.userInfoRequestFailed}: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Private helper to authenticate with password (deprecated)
   */
  private async authenticateWithPassword(username: string, password: string): Promise<TokenData> {
    this.logger.warn(Messages.auth.warnings.deprecatedPasswordFlow);

    const tokenUrl = `${this.iasUrl}/oauth2/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      username: username,
      password: password,
      scope: 'openid profile email groups'
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`${Messages.auth.errors.authenticationFailed}: ${response.status}`);
    }

    const tokenResponse = await response.json();
    const userInfo = await this.getUserInfoFromToken(tokenResponse.access_token);

    return this.createTokenData(tokenResponse, userInfo);
  }

  /**
   * Private helper to create token data
   */
  private createTokenData(tokenResponse: any, userInfo: any): TokenData {
    const userName = userInfo.preferred_username || userInfo.email || userInfo.sub;
    const scopes = tokenResponse.scope?.split(' ') || userInfo.scope || [];

    return {
      token: `Bearer ${tokenResponse.access_token}`,
      user: userName,
      scopes: scopes,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
      refreshToken: tokenResponse.refresh_token
    };
  }
}