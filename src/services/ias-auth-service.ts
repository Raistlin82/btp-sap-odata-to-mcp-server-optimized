import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';

export interface IASTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  jti?: string;
  refresh_token?: string;
  id_token?: string;
}

export interface IASUserInfo {
  sub: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  groups?: string[];
  scope?: string[];
}

export interface TokenData {
  token: string;
  user: string;
  scopes: string[];
  expiresAt: number;
  refreshToken?: string;
}

export class IASAuthService {
  private logger: Logger;
  private config: Config;
  private iasUrl: string;
  private clientId: string;
  private clientSecret: string;

  private isConfigured: boolean = true;

  constructor(logger?: Logger, config?: Config) {
    this.logger = logger || new Logger('IASAuthService');
    this.config = config || new Config();
    
    const originalIasUrl = this.config.get('ias.url', process.env.SAP_IAS_URL || '');
    const originalClientId = this.config.get('ias.clientId', process.env.SAP_IAS_CLIENT_ID || '');
    const originalClientSecret = this.config.get('ias.clientSecret', process.env.SAP_IAS_CLIENT_SECRET || '');

    if (!originalIasUrl || !originalClientId || !originalClientSecret) {
      this.logger.warn('IAS configuration missing. Authentication will be disabled. Please set SAP_IAS_URL, SAP_IAS_CLIENT_ID, and SAP_IAS_CLIENT_SECRET environment variables to enable authentication.');
      // Set dummy values to prevent crashes - authentication will be disabled
      this.iasUrl = 'https://dummy.accounts.ondemand.com';
      this.clientId = 'dummy-client-id';
      this.clientSecret = 'dummy-client-secret';
      this.isConfigured = false;
    } else {
      this.iasUrl = originalIasUrl;
      this.clientId = originalClientId;
      this.clientSecret = originalClientSecret;
      this.isConfigured = true;
    }
  }

  /**
   * Check if IAS is properly configured
   */
  isProperlyConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate authorization URL for OAuth 2.0 Authorization Code flow
   */
  generateAuthorizationUrl(redirectUri: string, state?: string): string {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
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
   * Exchange authorization code for tokens (Authorization Code flow)
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
    }

    try {
      this.logger.debug('Exchanging authorization code for tokens');
      this.logger.debug(`IAS URL: ${this.iasUrl}`);
      this.logger.debug(`Client ID: ${this.clientId}`);
      this.logger.debug(`Client Secret: ${this.clientSecret ? '***PROVIDED***' : 'MISSING'}`);
      this.logger.debug(`Redirect URI: ${redirectUri}`);
      this.logger.debug(`Authorization Code: ${code ? 'PROVIDED' : 'MISSING'}`);

      const tokenUrl = `${this.iasUrl}/oauth2/token`;
      
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      this.logger.debug(`Token URL: ${tokenUrl}`);
      this.logger.debug(`Request body: ${params.toString()}`);

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
        this.logger.error(`Token exchange failed: ${response.status} - ${errorText}`);
        this.logger.error(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = await response.json();
      
      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);
      
      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: userInfo.preferred_username || userInfo.email || userInfo.sub,
        scopes: tokenResponse.scope?.split(' ') || userInfo.scope || [],
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshToken: tokenResponse.refresh_token
      };

      this.logger.info(`User authenticated successfully: ${tokenData.user}`);
      return tokenData;

    } catch (error) {
      this.logger.error('Failed to exchange code for tokens:', error);
      throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate user with IAS using username/password (fallback for development only)
   * @deprecated Use Authorization Code flow instead
   */
  async authenticateUser(username: string, password: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
    }

    this.logger.warn('Using deprecated password flow. Consider using Authorization Code flow instead.');

    try {
      this.logger.debug(`Authenticating user with IAS: ${username}`);

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
        const errorText = await response.text();
        this.logger.error(`IAS authentication failed: ${response.status} - ${errorText}`);
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = await response.json();
      
      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);
      
      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: userInfo.preferred_username || userInfo.email || username,
        scopes: tokenResponse.scope?.split(' ') || userInfo.scope || [],
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshToken: tokenResponse.refresh_token
      };

      this.logger.info(`User authenticated successfully: ${tokenData.user}`);
      return tokenData;

    } catch (error) {
      this.logger.error('Failed to authenticate user with IAS:', error);
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get client credentials token (for app-to-app authentication)
   */
  async getClientCredentialsToken(): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
    }

    try {
      this.logger.debug('Getting client credentials token from IAS');

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
        const errorText = await response.text();
        this.logger.error(`IAS client credentials failed: ${response.status} - ${errorText}`);
        throw new Error(`Client credentials authentication failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = await response.json();
      
      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: 'system',
        scopes: tokenResponse.scope?.split(' ') || ['read', 'write', 'delete', 'admin', 'discover'],
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
      };

      this.logger.info('Client credentials token obtained successfully');
      return tokenData;

    } catch (error) {
      this.logger.error('Failed to get client credentials token:', error);
      throw new Error(`Client credentials authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh an expired token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
    }

    try {
      this.logger.debug('Refreshing token with IAS');

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
        const errorText = await response.text();
        this.logger.error(`Token refresh failed: ${response.status} - ${errorText}`);
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = await response.json();
      
      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);
      
      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: userInfo.preferred_username || userInfo.email || userInfo.sub,
        scopes: tokenResponse.scope?.split(' ') || userInfo.scope || [],
        expiresAt: Date.now() + (tokenResponse.expires_in * 1000),
        refreshToken: tokenResponse.refresh_token || refreshToken
      };

      this.logger.info(`Token refreshed successfully for user: ${tokenData.user}`);
      return tokenData;

    } catch (error) {
      this.logger.error('Failed to refresh token:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user information from IAS using access token
   */
  async getUserInfo(accessToken: string): Promise<IASUserInfo> {
    if (!this.isConfigured) {
      throw new Error('IAS authentication not configured. Please configure IAS environment variables.');
    }

    try {
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
        const errorText = await response.text();
        this.logger.error(`User info request failed: ${response.status} - ${errorText}`);
        throw new Error(`User info request failed: ${response.status} ${response.statusText}`);
      }

      const userInfo: IASUserInfo = await response.json();
      this.logger.debug(`Retrieved user info for: ${userInfo.preferred_username || userInfo.email || userInfo.sub}`);
      
      return userInfo;

    } catch (error) {
      this.logger.error('Failed to get user info:', error);
      throw new Error(`User info request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate a JWT token with IAS using introspection endpoint
   */
  async validateToken(token: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      // Remove 'Bearer ' prefix if present
      const jwtToken = token.startsWith('Bearer ') ? token.substring(7) : token;
      
      // First do basic JWT validation
      const decoded = this.decodeJWT(jwtToken);
      
      // Check if token is expired
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        this.logger.warn('Token validation failed: Token expired');
        return false;
      }

      // Check if token has required issuer
      if (!decoded.iss || !decoded.iss.includes('accounts.ondemand.com')) {
        this.logger.warn('Token validation failed: Invalid issuer');
        return false;
      }

      // Validate with IAS introspection endpoint
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
        this.logger.warn(`Token introspection failed: ${response.status}`);
        return false;
      }

      const introspectResult = await response.json();
      
      return introspectResult.active === true;

    } catch (error) {
      this.logger.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Decode JWT token (without verification - for development)
   * In production, use a proper JWT library with signature verification
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      return JSON.parse(decoded);
      
    } catch (error) {
      this.logger.error('Failed to decode JWT:', error);
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Get IAS configuration for client setup
   */
  getConfiguration() {
    return {
      iasUrl: this.iasUrl,
      clientId: this.clientId,
      authorizationEndpoint: `${this.iasUrl}/oauth2/authorize`,
      tokenEndpoint: `${this.iasUrl}/oauth2/token`,
      userInfoEndpoint: `${this.iasUrl}/oauth2/userinfo`,
      introspectionEndpoint: `${this.iasUrl}/oauth2/introspect`,
      supportedGrantTypes: ['authorization_code', 'client_credentials', 'refresh_token', 'password'],
      supportedScopes: ['openid', 'profile', 'email', 'groups', 'read', 'write', 'delete', 'admin', 'discover']
    };
  }
}