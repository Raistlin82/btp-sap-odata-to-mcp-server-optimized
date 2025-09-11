import { Logger } from './logger.js';

/**
 * Utility functions for consistent JWT token handling
 * Eliminates code duplication and provides secure token processing
 */
export class JWTUtils {
  private static logger = new Logger('JWTUtils');

  /**
   * Clean JWT token by removing Bearer prefix if present
   * This is the canonical implementation used across the application
   */
  static cleanBearerToken(token: string | undefined): string | undefined {
    if (!token) {
      return undefined;
    }

    // Remove Bearer prefix (case-insensitive) if present
    return token.replace(/^Bearer\s+/i, '');
  }

  /**
   * Validate JWT token structure without exposing sensitive content
   * Returns validation result and safe metadata for logging
   */
  static validateTokenStructure(token: string | undefined): {
    isValid: boolean;
    metadata: {
      length: number;
      hasValidStructure: boolean;
      algorithm?: string;
      expiresAt?: string;
      hadBearerPrefix: boolean;
    };
    errors: string[];
  } {
    const result = {
      isValid: false,
      metadata: {
        length: 0,
        hasValidStructure: false,
        hadBearerPrefix: false,
        algorithm: undefined as string | undefined,
        expiresAt: undefined as string | undefined
      },
      errors: [] as string[]
    };

    if (!token) {
      result.errors.push('Token is empty or undefined');
      return result;
    }

    const originalToken = token;
    const cleanToken = this.cleanBearerToken(token);
    
    if (!cleanToken) {
      result.errors.push('Token is empty after cleaning');
      return result;
    }

    result.metadata.length = cleanToken.length;
    result.metadata.hadBearerPrefix = originalToken !== cleanToken;

    // Validate JWT structure
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      result.errors.push(`Invalid JWT structure: ${parts.length} parts (expected 3)`);
      return result;
    }

    result.metadata.hasValidStructure = true;

    try {
      // Validate header
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
      result.metadata.algorithm = header.alg;

      // Validate payload structure (without exposing sensitive content)
      const paddingNeeded = (4 - (parts[1].length % 4)) % 4;
      const paddedPayload = parts[1] + '='.repeat(paddingNeeded);
      const payload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8'));

      // Extract safe metadata
      if (payload.exp) {
        result.metadata.expiresAt = new Date(payload.exp * 1000).toISOString();
      }

      result.isValid = true;
    } catch (error) {
      result.errors.push(`JWT parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Safely log JWT information without exposing sensitive data
   */
  static logTokenInfo(
    token: string | undefined,
    context: string,
    logger?: Logger
  ): void {
    const log = logger || this.logger;
    
    if (!token) {
      log.debug(`${context}: No JWT token provided`);
      return;
    }

    const validation = this.validateTokenStructure(token);
    
    if (validation.isValid) {
      log.debug(`${context}: JWT valid - length=${validation.metadata.length}, ` +
        `algorithm=${validation.metadata.algorithm || 'unknown'}, ` +
        `expires=${validation.metadata.expiresAt || 'unknown'}, ` +
        `hadBearer=${validation.metadata.hadBearerPrefix}`);
    } else {
      log.warn(`${context}: JWT validation failed - ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Prepare JWT for SAP Cloud SDK usage
   * Returns clean token and logs validation info safely
   */
  static prepareForSAPSDK(
    token: string | undefined,
    context: string,
    logger?: Logger
  ): {
    cleanToken: string | undefined;
    isValid: boolean;
    shouldUseToken: boolean;
  } {
    const log = logger || this.logger;

    if (!token) {
      log.debug(`${context}: No JWT token to prepare for SAP SDK`);
      return {
        cleanToken: undefined,
        isValid: false,
        shouldUseToken: false
      };
    }

    const cleanToken = this.cleanBearerToken(token);
    const validation = this.validateTokenStructure(token);

    // Log token info safely
    this.logTokenInfo(token, context, log);

    return {
      cleanToken,
      isValid: validation.isValid,
      shouldUseToken: validation.isValid && !!cleanToken
    };
  }

  /**
   * Create destination options with JWT token
   * Standardized way to include JWT in destination options
   */
  static createDestinationOptions(
    destinationName: string,
    jwt?: string
  ): { destinationName: string; jwt?: string } {
    const options = { destinationName };
    
    if (jwt) {
      const prepared = this.prepareForSAPSDK(jwt, `destination-${destinationName}`);
      if (prepared.shouldUseToken && prepared.cleanToken) {
        return { ...options, jwt: prepared.cleanToken };
      }
    }

    return options;
  }

  /**
   * Extract user identifier from JWT token safely
   * Returns only safe, non-sensitive user information
   */
  static extractSafeUserInfo(token: string | undefined): {
    userId?: string;
    hasValidStructure: boolean;
    isExpired: boolean;
  } {
    const result: {
      userId?: string;
      hasValidStructure: boolean;
      isExpired: boolean;
    } = {
      hasValidStructure: false,
      isExpired: false
    };

    if (!token) {
      return result;
    }

    const cleanToken = this.cleanBearerToken(token);
    if (!cleanToken) {
      return result;
    }

    try {
      const parts = cleanToken.split('.');
      if (parts.length !== 3) {
        return result;
      }

      result.hasValidStructure = true;

      const paddingNeeded = (4 - (parts[1].length % 4)) % 4;
      const paddedPayload = parts[1] + '='.repeat(paddingNeeded);
      const payload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8'));

      // Check expiration
      if (payload.exp) {
        result.isExpired = payload.exp * 1000 < Date.now();
      }

      // Extract safe user identifier (hash it for privacy)
      if (payload.sub) {
        // Create a safe, consistent user identifier
        result.userId = this.hashUserIdentifier(payload.sub);
      }

      return result;
    } catch (error) {
      this.logger.debug('Failed to extract user info from JWT:', error);
      return result;
    }
  }

  /**
   * Create a safe, consistent hash of user identifier for logging
   */
  private static hashUserIdentifier(identifier: string): string {
    // Simple hash for user identification without exposing sensitive data
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(36)}`;
  }
}