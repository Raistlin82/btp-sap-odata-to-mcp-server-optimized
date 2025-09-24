import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import xsenv from '@sap/xsenv';
import xssec from '@sap/xssec';

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
    const originalClientSecret = this.config.get(
      'ias.clientSecret',
      process.env.SAP_IAS_CLIENT_SECRET || ''
    );

    if (!originalIasUrl || !originalClientId || !originalClientSecret) {
      this.logger.warn(
        'IAS configuration missing. Authentication will be disabled. Please set SAP_IAS_URL, SAP_IAS_CLIENT_ID, and SAP_IAS_CLIENT_SECRET environment variables to enable authentication.'
      );
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
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
    }

    const authUrl = `${this.iasUrl}/oauth2/authorize`;
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'openid profile email groups',
      redirect_uri: redirectUri,
      ...(state && { state }),
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens (Authorization Code flow)
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
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
        client_secret: this.clientSecret,
      });

      this.logger.debug(`Token URL: ${tokenUrl}`);
      this.logger.debug(`Request body: ${params.toString()}`);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Token exchange failed: ${response.status} - ${errorText}`);
        this.logger.error(
          `Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`
        );
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = (await response.json()) as any;

      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      // Try to exchange IAS token for XSUAA token to get application scopes
      const finalToken = `Bearer ${tokenResponse.access_token}`;
      let finalScopes = tokenResponse.scope?.split(' ') || userInfo.scope || [];

      this.logger.info(`Initial IAS scopes: ${finalScopes.join(', ')}`);

      try {
        this.logger.info('Using enhanced JWT validator for IAS token validation...');

        // Import and use the enhanced JWT validator
        const { JWTValidator } = await import('../utils/jwt-validator.js');
        const jwtValidator = new JWTValidator(this.logger);

        const validationResult = await jwtValidator.validateJWT(tokenResponse.access_token);
        if (validationResult.valid && validationResult.userInfo?.scopes) {
          finalScopes = validationResult.userInfo.scopes;
          this.logger.info(
            `✅ IAS token validated with enhanced validator, mapped scopes: ${finalScopes.join(', ')}`
          );
        } else {
          this.logger.warn('❌ Enhanced JWT validator failed - using basic IAS scopes');
          this.logger.warn(`Validation error: ${validationResult.error}`);
        }
      } catch (error) {
        this.logger.error('❌ Enhanced JWT validator failed:', error);
        // Continue with IAS token - fallback to basic scopes
      }

      // Get user name for logging and token creation
      const userName = userInfo.preferred_username || userInfo.email || userInfo.sub;

      // Admin scopes should be configured through IAS role collections or XSUAA
      this.logger.debug(`User scopes from IAS/XSUAA: ${finalScopes.join(', ')}`);

      const tokenData: TokenData = {
        token: finalToken,
        user: userName,
        scopes: finalScopes,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        refreshToken: tokenResponse.refresh_token,
      };

      this.logger.info(
        `User authenticated successfully: ${tokenData.user}, scopes: ${finalScopes.join(', ')}`
      );
      return tokenData;
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens:', error);
      throw new Error(
        `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Authenticate user with IAS using username/password (fallback for development only)
   * @deprecated Use Authorization Code flow instead
   */
  async authenticateUser(username: string, password: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
    }

    this.logger.warn(
      'Using deprecated password flow. Consider using Authorization Code flow instead.'
    );

    try {
      this.logger.debug(`Authenticating user with IAS: ${username}`);

      const tokenUrl = `${this.iasUrl}/oauth2/token`;

      const params = new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password,
        scope: 'openid profile email groups',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`IAS authentication failed: ${response.status} - ${errorText}`);
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = (await response.json()) as any;

      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      const finalScopes = tokenResponse.scope?.split(' ') || userInfo.scope || [];
      const userName = userInfo.preferred_username || userInfo.email || username;

      // Admin scopes should be configured through IAS role collections or XSUAA
      this.logger.debug(`User scopes from IAS: ${finalScopes.join(', ')}`);

      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: userName,
        scopes: finalScopes,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        refreshToken: tokenResponse.refresh_token,
      };

      this.logger.info(
        `User authenticated successfully: ${tokenData.user}, scopes: ${finalScopes.join(', ')}`
      );
      return tokenData;
    } catch (error) {
      this.logger.error('Failed to authenticate user with IAS:', error);
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get client credentials token (for app-to-app authentication)
   */
  async getClientCredentialsToken(): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
    }

    try {
      this.logger.debug('Getting client credentials token from IAS');

      const tokenUrl = `${this.iasUrl}/oauth2/token`;

      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'read write delete admin discover',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`IAS client credentials failed: ${response.status} - ${errorText}`);
        throw new Error(
          `Client credentials authentication failed: ${response.status} ${response.statusText}`
        );
      }

      const tokenResponse: IASTokenResponse = (await response.json()) as any;

      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: 'system',
        scopes: tokenResponse.scope?.split(' ') || ['read', 'write', 'delete', 'admin', 'discover'],
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      };

      this.logger.info('Client credentials token obtained successfully');
      return tokenData;
    } catch (error) {
      this.logger.error('Failed to get client credentials token:', error);
      throw new Error(
        `Client credentials authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refresh an expired token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenData> {
    if (!this.isConfigured) {
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
    }

    try {
      this.logger.debug('Refreshing token with IAS');

      const tokenUrl = `${this.iasUrl}/oauth2/token`;

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Token refresh failed: ${response.status} - ${errorText}`);
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const tokenResponse: IASTokenResponse = (await response.json()) as any;

      // Get user info from IAS
      const userInfo = await this.getUserInfo(tokenResponse.access_token);

      const tokenData: TokenData = {
        token: `Bearer ${tokenResponse.access_token}`,
        user: userInfo.preferred_username || userInfo.email || userInfo.sub,
        scopes: tokenResponse.scope?.split(' ') || userInfo.scope || [],
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
        refreshToken: tokenResponse.refresh_token || refreshToken,
      };

      this.logger.info(`Token refreshed successfully for user: ${tokenData.user}`);
      return tokenData;
    } catch (error) {
      this.logger.error('Failed to refresh token:', error);
      throw new Error(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user information from IAS using access token
   */
  async getUserInfo(accessToken: string): Promise<IASUserInfo> {
    if (!this.isConfigured) {
      throw new Error(
        'IAS authentication not configured. Please configure IAS environment variables.'
      );
    }

    try {
      const userInfoUrl = `${this.iasUrl}/oauth2/userinfo`;
      const token = accessToken.startsWith('Bearer ') ? accessToken : `Bearer ${accessToken}`;

      const response = await fetch(userInfoUrl, {
        method: 'GET',
        headers: {
          Authorization: token,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`User info request failed: ${response.status} - ${errorText}`);
        throw new Error(`User info request failed: ${response.status} ${response.statusText}`);
      }

      const userInfo: IASUserInfo = (await response.json()) as any;
      this.logger.debug(
        `Retrieved user info for: ${userInfo.preferred_username || userInfo.email || userInfo.sub}`
      );

      // === ENHANCED DEBUG LOG: DECODED JWT CLAIMS FOR SCOPE ANALYSIS ===
      try {
        // Decode the JWT token to see all claims including scopes
        const tokenPart = accessToken.replace('Bearer ', '').split('.')[1];
        const decodedPayload = JSON.parse(Buffer.from(tokenPart, 'base64').toString());
        // JWT payload analysis - only in development mode
        if (process.env.NODE_ENV === 'development') {
          this.logger.debug('JWT payload decoded for scope analysis');

          // Check for scopes in different claim locations
          const scopeClaims = {
            scope: decodedPayload.scope,
            scopes: decodedPayload.scopes,
            scp: decodedPayload.scp,
            authorities: decodedPayload.authorities,
            'xs.user.attributes': decodedPayload['xs.user.attributes'],
            role_collections: decodedPayload.role_collections,
            groups: decodedPayload.groups,
          };

          // Log only relevant scope information in development
          Object.entries(scopeClaims).forEach(([key, value]) => {
            if (value !== undefined) {
              this.logger.debug(`Scope claim ${key} found`);
            }
          });
        }

        // If JWT contains application scopes directly, extract them
        const directScopes = decodedPayload.scope?.split?.(' ') || decodedPayload.scopes || [];
        if (
          directScopes.some(
            (scope: string) =>
              scope.includes('admin') || scope.includes('read') || scope.includes('write')
          )
        ) {
          this.logger.info('✅ Found application scopes directly in JWT token');
          userInfo.scope = directScopes;
        }
      } catch (debugError) {
        this.logger.warn('Failed to decode JWT for debugging:', debugError);
      }
      // === END ENHANCED DEBUG LOG ===

      return userInfo;
    } catch (error) {
      this.logger.error('Failed to get user info:', error);
      throw new Error(
        `User info request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate a JWT token with IAS using introspection endpoint (secure validation)
   */
  async validateToken(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    if (!this.isConfigured) {
      return { valid: false, error: 'IAS not configured' };
    }

    try {
      // Remove 'Bearer ' prefix if present
      const jwtToken = token.startsWith('Bearer ') ? token.substring(7) : token;

      // Security: Use introspection endpoint instead of local JWT decoding
      // This ensures the token is validated by the issuer
      const introspectUrl = `${this.iasUrl}/oauth2/introspect`;

      const params = new URLSearchParams({
        token: jwtToken,
        token_type_hint: 'access_token',
      });

      const response = await fetch(introspectUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        this.logger.warn(`Token introspection failed: ${response.status}`);
        return { valid: false, error: `Introspection failed: ${response.status}` };
      }

      const introspectResult = (await response.json()) as any;

      if (introspectResult.active === true) {
        // Token is valid, return payload from introspection
        return {
          valid: true,
          payload: {
            sub: introspectResult.sub,
            exp: introspectResult.exp,
            iss: introspectResult.iss,
            aud: introspectResult.aud,
            scope: introspectResult.scope,
            username: introspectResult.username,
          },
        };
      } else {
        return { valid: false, error: 'Token is not active' };
      }
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * @deprecated This method is insecure and should not be used.
   * Use validateToken() method instead which uses proper introspection.
   */
  private decodeJWT(_token: string): never {
    this.logger.error(
      'SECURITY WARNING: decodeJWT() called - this method is deprecated and insecure'
    );
    throw new Error(
      'decodeJWT() method is deprecated for security reasons. Use validateToken() instead.'
    );
  }

  /**
   * Exchange IAS token for XSUAA token to get application scopes
   */
  private async exchangeIASTokenForXSUAA(
    iasToken: string
  ): Promise<{ token: string; scopes: string[] } | null> {
    try {
      // Get XSUAA service credentials
      this.logger.info('🔍 Looking for XSUAA service binding...');
      const services = xsenv.getServices({ xsuaa: { label: 'xsuaa' } });
      const xsuaaCredentials = services.xsuaa;

      if (!xsuaaCredentials) {
        this.logger.warn('❌ No XSUAA service binding found, skipping token exchange');
        this.logger.info(
          '💡 To get application scopes, ensure XSUAA service is bound to your application'
        );
        return null;
      }

      this.logger.info(`✅ Found XSUAA service binding: ${(xsuaaCredentials as any).xsappname}`);
      this.logger.debug('XSUAA credentials:', {
        url: (xsuaaCredentials as any).url,
        clientid: (xsuaaCredentials as any).clientid,
        xsappname: (xsuaaCredentials as any).xsappname,
      });

      // Use the IAS token to create a security context with XSUAA
      // This will validate the token and potentially map to application scopes
      this.logger.info('🔄 Creating XSUAA security context...');
      const securityContext = await new Promise<any>((resolve, reject) => {
        xssec.createSecurityContext(
          `Bearer ${iasToken}`,
          xsuaaCredentials,
          (err: any, ctx: any) => {
            if (err) {
              this.logger.error('❌ XSUAA security context creation failed:', err);
              reject(err);
            } else {
              this.logger.info('✅ XSUAA security context created successfully');
              resolve(ctx);
            }
          }
        );
      });

      if (securityContext) {
        const userInfo = securityContext.getTokenInfo();
        const grantedScopes = securityContext.getGrantedScopes();

        this.logger.info(`👤 XSUAA user: ${userInfo.getLogonName()}`);
        this.logger.info(
          `🎫 XSUAA granted scopes (${grantedScopes.length}): ${grantedScopes.join(', ')}`
        );

        // Check for application scopes
        const hasAppScopes = grantedScopes.some(
          (scope: string) =>
            scope.includes('.admin') ||
            scope.includes('.read') ||
            scope.includes('.write') ||
            scope.includes('.delete') ||
            scope.includes('.discover')
        );

        this.logger.info(`🔐 Has application scopes: ${hasAppScopes}`);

        if (hasAppScopes) {
          this.logger.info('✅ Returning XSUAA token with application scopes');
          return {
            token: `Bearer ${iasToken}`, // Keep the same token but with validated scopes
            scopes: grantedScopes,
          };
        } else {
          this.logger.warn('❌ XSUAA context created but no application scopes found');
          this.logger.info(
            '💡 Check role collection assignment and role template mapping in BTP Cockpit'
          );
          return null;
        }
      }

      this.logger.warn('❌ XSUAA security context is null');
      return null;
    } catch (error) {
      this.logger.error('❌ IAS to XSUAA token exchange failed:', error);
      if (error instanceof Error) {
        this.logger.error('Error details:', error.message);
        this.logger.error('Error stack:', error.stack);
      }
      return null;
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
      supportedGrantTypes: [
        'authorization_code',
        'client_credentials',
        'refresh_token',
        'password',
      ],
      supportedScopes: [
        'openid',
        'profile',
        'email',
        'groups',
        'read',
        'write',
        'delete',
        'admin',
        'discover',
      ],
    };
  }
}
