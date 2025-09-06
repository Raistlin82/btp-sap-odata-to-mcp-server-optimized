import { Request, Response, NextFunction } from 'express';
import xssec from '@sap/xssec';
import xsenv from '@sap/xsenv';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AuthMiddleware');

export interface AuthenticatedRequest extends Request {
  authInfo?: {
    user: string;
    email?: string;
    scopes: string[];
    tenant: string;
    userId: string;
    isAuthenticated: boolean;
  };
  securityContext?: any;
}

/**
 * JWT Authentication Middleware for SAP BTP XSUAA
 * Validates JWT tokens and extracts user information and scopes
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // For development/testing, allow requests without auth to /health and /docs
      const publicEndpoints = ['/health', '/docs', '/mcp'];
      if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
        logger.debug(`Allowing unauthenticated access to public endpoint: ${req.path}`);
        return next();
      }
      
      logger.warn('Missing or invalid Authorization header');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Load XSUAA service credentials
    const services = xsenv.getServices({ xsuaa: { label: 'xsuaa' } });
    const xsuaaCredentials = services.xsuaa;

    if (!xsuaaCredentials) {
      logger.error('XSUAA service credentials not found');
      return res.status(500).json({
        error: 'Service Configuration Error',
        message: 'XSUAA service not configured'
      });
    }

    // Create security context and validate JWT
    const securityContext = await new Promise<any>((resolve, reject) => {
      xssec.createSecurityContext(token, xsuaaCredentials, (error: any, securityContext: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(securityContext);
        }
      });
    });

    // Extract user information and scopes
    const userInfo = securityContext.getTokenInfo();
    const scopes = securityContext.getGrantedScopes();
    
    // Attach authentication info to request
    req.authInfo = {
      user: userInfo.getGivenName() + ' ' + userInfo.getFamilyName() || userInfo.getLogonName(),
      email: userInfo.getEmail(),
      scopes: scopes,
      tenant: userInfo.getIdentityZone(),
      userId: userInfo.getLogonName(),
      isAuthenticated: true
    };
    
    req.securityContext = securityContext;

    logger.debug('User authenticated successfully', {
      user: req.authInfo.user,
      scopes: req.authInfo.scopes,
      tenant: req.authInfo.tenant
    });

    next();

  } catch (error) {
    logger.error('Authentication failed:', error);
    
    // Determine error type and response
    let statusCode = 401;
    let errorCode = 'AUTH_FAILED';
    let message = 'Authentication failed';

    if (error instanceof Error) {
      if (error.message.includes('JWT expired')) {
        errorCode = 'TOKEN_EXPIRED';
        message = 'JWT token has expired';
      } else if (error.message.includes('invalid')) {
        errorCode = 'INVALID_TOKEN';
        message = 'Invalid JWT token';
      } else if (error.message.includes('audience')) {
        errorCode = 'INVALID_AUDIENCE';
        message = 'Invalid token audience';
      }
    }

    return res.status(statusCode).json({
      error: 'Authentication Failed',
      message: message,
      code: errorCode
    });
  }
};

/**
 * Middleware to require specific scopes
 * @param requiredScopes Array of required scopes (at least one must be present)
 * @param requireAll If true, all scopes must be present (default: false)
 */
export const requireScope = (
  requiredScopes: string | string[],
  requireAll: boolean = false
) => {
  const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.authInfo?.isAuthenticated) {
      logger.warn('Authorization check failed: User not authenticated');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const userScopes = req.authInfo.scopes || [];
    
    // Add app name prefix to required scopes if not already present
    const appName = process.env.VCAP_APPLICATION ? 
      JSON.parse(process.env.VCAP_APPLICATION).name : 'btp-sap-odata-to-mcp-server';
    
    const normalizedRequiredScopes = scopes.map(scope => {
      return scope.includes('.') ? scope : `${appName}.${scope}`;
    });

    let hasAccess = false;
    
    if (requireAll) {
      // All scopes must be present
      hasAccess = normalizedRequiredScopes.every(scope => userScopes.includes(scope));
    } else {
      // At least one scope must be present
      hasAccess = normalizedRequiredScopes.some(scope => userScopes.includes(scope));
    }

    if (!hasAccess) {
      logger.warn('Authorization check failed: Insufficient permissions', {
        user: req.authInfo.user,
        userScopes: userScopes,
        requiredScopes: normalizedRequiredScopes,
        requireAll
      });
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredScopes: normalizedRequiredScopes,
        userScopes: userScopes
      });
    }

    logger.debug('Authorization successful', {
      user: req.authInfo.user,
      requiredScopes: normalizedRequiredScopes,
      userScopes: userScopes
    });

    next();
  };
};

/**
 * Helper middleware for different access levels
 */
export const requireRead = requireScope(['read', 'discover']);
export const requireWrite = requireScope(['write']);
export const requireDelete = requireScope(['delete']);
export const requireAdmin = requireScope(['admin']);

/**
 * Optional authentication middleware - doesn't fail if no auth present
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if there's an Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth header - continue as anonymous
    logger.debug('No authentication header, continuing as anonymous user');
    req.authInfo = {
      user: 'anonymous',
      scopes: [],
      tenant: 'default',
      userId: 'anonymous',
      isAuthenticated: false
    };
    return next();
  }

  try {
    // Try authentication, but create a custom response handler
    let authFailed = false;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    // Override response methods to detect auth failures
    res.json = function(body: any) {
      if (body.error && (body.code === 'AUTH_HEADER_MISSING' || body.code === 'AUTH_FAILED')) {
        authFailed = true;
        return res; // Don't actually send the response
      }
      return originalJson.call(this, body);
    };
    
    res.status = function(code: number) {
      if (code === 401) {
        authFailed = true;
        return res; // Don't actually send the response
      }
      return originalStatus.call(this, code);
    };

    await authMiddleware(req, res, (err) => {
      // Restore original methods
      res.json = originalJson;
      res.status = originalStatus;
      
      if (authFailed || err) {
        // Authentication failed - continue as anonymous
        logger.debug('Authentication failed, continuing as anonymous user');
        req.authInfo = {
          user: 'anonymous',
          scopes: [],
          tenant: 'default',
          userId: 'anonymous',
          isAuthenticated: false
        };
        return next();
      } else {
        // Authentication succeeded - continue with authenticated user
        return next();
      }
    });
  } catch (error) {
    // Authentication error - continue as anonymous
    logger.debug('Authentication error, continuing as anonymous user:', error);
    req.authInfo = {
      user: 'anonymous',
      scopes: [],
      tenant: 'default',
      userId: 'anonymous',
      isAuthenticated: false
    };
    next();
  }
};