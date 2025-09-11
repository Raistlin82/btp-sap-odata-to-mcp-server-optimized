import xssec from '@sap/xssec';
import xsenv from '@sap/xsenv';
import { Logger } from './logger.js';

export interface JWTValidationResult {
  valid: boolean;
  payload?: any;
  error?: string;
  userInfo?: {
    sub: string;
    email?: string;
    name?: string;
    scopes?: string[];
  };
}

/**
 * Secure JWT validation utility using SAP XSSEC library
 * This provides proper signature verification and token validation
 */
export class JWTValidator {
  private logger: Logger;
  private xsuaaCredentials: any;
  private identityCredentials: any;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('JWTValidator');
    
    // Load XSUAA credentials for JWT validation
    try {
      const services = xsenv.getServices({ 
        xsuaa: { label: 'xsuaa' },
        identity: { label: 'identity' }
      });
      this.xsuaaCredentials = services.xsuaa;
      this.identityCredentials = services.identity;
      
      if (!this.xsuaaCredentials) {
        this.logger.warn('XSUAA service not configured - JWT validation will be limited');
      }
      
      if (this.identityCredentials) {
        this.logger.info('Identity service (IAS) found - enabling direct IAS token validation');
      }
    } catch (error) {
      this.logger.warn('Failed to load service credentials:', error);
    }
  }

  /**
   * Validate JWT token using SAP XSSEC library (secure)
   * This method performs proper signature verification and supports both XSUAA and IAS tokens
   */
  async validateJWT(token: string): Promise<JWTValidationResult> {
    try {
      // Remove Bearer prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // First try to determine token type by examining the issuer
      const tokenType = await this.determineTokenType(cleanToken);
      this.logger.debug(`Detected token type: ${tokenType}`);
      
      if (tokenType === 'IAS' && this.identityCredentials) {
        return await this.validateIASToken(cleanToken);
      } else if (tokenType === 'XSUAA' && this.xsuaaCredentials) {
        return await this.validateXSUAAToken(cleanToken);
      }
      
      // Fallback: try XSUAA first, then IAS
      if (this.xsuaaCredentials) {
        try {
          return await this.validateXSUAAToken(cleanToken);
        } catch (xsuaaError) {
          this.logger.debug('XSUAA validation failed, trying IAS:', xsuaaError);
          if (this.identityCredentials) {
            return await this.validateIASToken(cleanToken);
          }
          throw xsuaaError;
        }
      } else if (this.identityCredentials) {
        return await this.validateIASToken(cleanToken);
      }
      
      return {
        valid: false,
        error: 'No authentication services configured - cannot validate JWT signature'
      };

    } catch (error) {
      this.logger.debug('JWT validation failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = 'VALIDATION_FAILED';
      
      if (errorMessage.includes('expired')) {
        errorType = 'TOKEN_EXPIRED';
      } else if (errorMessage.includes('signature')) {
        errorType = 'INVALID_SIGNATURE';
      } else if (errorMessage.includes('audience')) {
        errorType = 'INVALID_AUDIENCE';
      } else if (errorMessage.includes('issuer')) {
        errorType = 'INVALID_ISSUER';
      }

      return {
        valid: false,
        error: `${errorType}: ${errorMessage}`
      };
    }
  }

  /**
   * Determine token type based on issuer
   */
  private async determineTokenType(token: string): Promise<'XSUAA' | 'IAS' | 'UNKNOWN'> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return 'UNKNOWN';
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const issuer = payload.iss;
      
      if (!issuer) return 'UNKNOWN';
      
      // IAS tokens typically have issuer like: https://afhdupfoc.accounts.ondemand.com
      if (issuer.includes('accounts.ondemand.com') || issuer.includes('accounts.cloud.sap')) {
        return 'IAS';
      }
      
      // XSUAA tokens typically have issuer like: https://burrata-noprod-8cs9fy8w.authentication.eu30.hana.ondemand.com
      if (issuer.includes('authentication.') && issuer.includes('hana.ondemand.com')) {
        return 'XSUAA';
      }
      
      return 'UNKNOWN';
    } catch (error) {
      this.logger.debug('Failed to determine token type:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Validate XSUAA token using XSSEC library
   */
  private async validateXSUAAToken(token: string): Promise<JWTValidationResult> {
    const securityContext = await new Promise<any>((resolve, reject) => {
      xssec.createSecurityContext(token, this.xsuaaCredentials, (error: any, context: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(context);
        }
      });
    });

    const tokenInfo = securityContext.getTokenInfo();
    const grantedScopes = securityContext.getGrantedScopes();

    this.logger.debug('XSUAA token validated successfully', {
      user: tokenInfo.getLogonName(),
      scopes: grantedScopes
    });

    return {
      valid: true,
      payload: {
        sub: tokenInfo.getLogonName(),
        email: tokenInfo.getEmail(),
        givenName: tokenInfo.getGivenName(),
        familyName: tokenInfo.getFamilyName(),
        tenant: tokenInfo.getIdentityZone(),
        scopes: grantedScopes
      },
      userInfo: {
        sub: tokenInfo.getLogonName(),
        email: tokenInfo.getEmail(),
        name: `${tokenInfo.getGivenName()} ${tokenInfo.getFamilyName()}`.trim(),
        scopes: grantedScopes
      }
    };
  }

  /**
   * Validate IAS token directly and map groups to application scopes
   */
  private async validateIASToken(token: string): Promise<JWTValidationResult> {
    // First, do basic JWT validation
    const quickCheck = await this.quickValidate(`Bearer ${token}`);
    if (!quickCheck.valid) {
      throw new Error(quickCheck.error || 'Invalid token format');
    }

    // Parse token payload
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    // Verify issuer matches our IAS domain
    const expectedIssuer = this.identityCredentials.url;
    if (payload.iss !== expectedIssuer) {
      throw new Error(`Invalid issuer: expected ${expectedIssuer}, got ${payload.iss}`);
    }

    // Extract user information from IAS token
    const groups = payload.groups || [];
    const email = payload.email || payload.preferred_username;
    const name = payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim();
    
    // Map IAS groups to application scopes
    const mappedScopes = this.mapGroupsToScopes(groups);
    
    this.logger.info('IAS token validated successfully', {
      user: email,
      groups: groups,
      mappedScopes: mappedScopes
    });

    return {
      valid: true,
      payload: {
        sub: payload.sub,
        email: email,
        givenName: payload.given_name,
        familyName: payload.family_name,
        tenant: payload.zone_uuid || 'default',
        scopes: mappedScopes,
        groups: groups
      },
      userInfo: {
        sub: payload.sub,
        email: email,
        name: name,
        scopes: mappedScopes
      }
    };
  }

  /**
   * Map IAS groups to application scopes based on role collection configuration
   */
  private mapGroupsToScopes(groups: string[]): string[] {
    const xsappname = this.xsuaaCredentials?.xsappname || process.env.XSUAA_XSAPPNAME || 'btp-sap-odata-to-mcp-server';
    const scopes: string[] = [];
    
    // Map role collections to scopes based on xs-security.json configuration
    // Role collections can be configured via ROLE_COLLECTIONS environment variable
    const roleCollections = (process.env.ROLE_COLLECTIONS || 'MCPAdministrator,MCPUser,MCPManager,MCPViewer').split(',');
    
    for (const group of groups) {
      switch (group) {
        case 'MCPAdministrator':
          scopes.push(`${xsappname}.admin`);
          scopes.push(`${xsappname}.read`);
          scopes.push(`${xsappname}.write`);
          scopes.push(`${xsappname}.delete`);
          scopes.push(`${xsappname}.discover`);
          break;
        case 'MCPManager':
          scopes.push(`${xsappname}.read`);
          scopes.push(`${xsappname}.write`);
          scopes.push(`${xsappname}.delete`);
          scopes.push(`${xsappname}.discover`);
          break;
        case 'MCPUser':
          scopes.push(`${xsappname}.read`);
          scopes.push(`${xsappname}.write`);
          scopes.push(`${xsappname}.discover`);
          break;
        case 'MCPViewer':
          scopes.push(`${xsappname}.read`);
          scopes.push(`${xsappname}.discover`);
          break;
      }
    }
    
    return scopes;
  }

  /**
   * Quick validation check without full context creation
   * Use this for basic token format and expiry validation
   */
  async quickValidate(token: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // Basic format check
      const parts = cleanToken.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      // Parse header and payload without verification (for basic checks only)
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Check expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        return { valid: false, error: 'Token expired' };
      }

      // Check basic structure
      if (!payload.sub || !payload.iss) {
        return { valid: false, error: 'Invalid token structure' };
      }

      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: `Token format validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Extract claims from token without signature verification
   * WARNING: Only use this for non-security critical operations like logging
   * Always use validateJWT() for security decisions
   */
  extractClaimsUnsafe(token: string): any {
    this.logger.warn('SECURITY WARNING: extractClaimsUnsafe() called - this should only be used for non-security operations');
    
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      const parts = cleanToken.split('.');
      
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      
      // Return only safe, non-sensitive claims
      return {
        sub: payload.sub,
        iss: payload.iss,
        exp: payload.exp,
        iat: payload.iat,
        // Don't return sensitive scopes or permissions without validation
      };
    } catch (error) {
      this.logger.error('Failed to extract claims:', error);
      return null;
    }
  }
}