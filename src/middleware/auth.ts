import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { JWTValidator } from '../utils/jwt-validator.js';
import { SecureErrorHandler } from '../utils/secure-error-handler.js';
import xsenv from '@sap/xsenv';

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
  securityContext?: unknown;
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
  const jwtValidator = new JWTValidator(logger);
  
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

    const token = authHeader; // Keep full Bearer token for validation

    // Use secure JWT validation
    const validationResult = await jwtValidator.validateJWT(token);
    
    if (!validationResult.valid) {
      logger.warn('JWT validation failed:', validationResult.error);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired JWT token',
        code: 'INVALID_TOKEN'
      });
    }

    // Extract user information from validated token
    const userInfo = validationResult.userInfo!;
    const scopes = validationResult.payload?.scopes || [];
    
    // Attach authentication info to request
    req.authInfo = {
      user: userInfo.name || userInfo.sub,
      email: userInfo.email,
      scopes: scopes,
      tenant: validationResult.payload?.tenant || 'default',
      userId: userInfo.sub,
      isAuthenticated: true
    };
    
    // Store the validation result for potential use downstream
    req.securityContext = validationResult.payload;

    logger.debug('User authenticated successfully', {
      user: req.authInfo.user,
      scopes: req.authInfo.scopes,
      tenant: req.authInfo.tenant
    });

    next();

  } catch (error) {
    // Use secure error handler to prevent information leakage
    const errorHandler = new SecureErrorHandler(logger);
    const secureError = errorHandler.sanitizeError(error, {
      operation: 'authentication',
      requestId: req.headers['x-request-id'] as string
    });
    
    return res.status(401).json(secureError);
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
    
    // Get xsappname from XSUAA service binding for correct scope prefix
    let xsappname = process.env.XSUAA_XSAPPNAME || 'btp-sap-odata-to-mcp-server'; // Default fallback for local dev
    try {
      const services: any = xsenv.getServices({ xsuaa: { label: 'xsuaa' } });
      if (services.xsuaa && services.xsuaa.xsappname) {
        xsappname = services.xsuaa.xsappname;
        logger.debug(`Using xsappname '${xsappname}' for scope validation.`);
      } else {
        logger.warn('XSUAA service not found or xsappname missing, using fallback name.');
      }
    } catch (error) {
      logger.warn('Could not determine xsappname from service bindings, using fallback.', { error: error instanceof Error ? error.message : String(error) });
    }
    
    // Additional scope validation: also check for scopes that already contain the full app identifier
    // This handles cases where scopes are already in the format: {full-xsappname}.{scope}
    const additionalScopeChecks = scopes.map(scope => {
      // If scope already contains a dot, it might be a full scope name
      if (scope.includes('.')) {
        return scope;
      }
      // Also check for scopes that might match user scopes directly (for compatibility)
      return userScopes.find(userScope => userScope.endsWith(`.${scope}`));
    }).filter((scope): scope is string => Boolean(scope));
    
    const normalizedRequiredScopes = scopes.map(scope => {
      return scope.includes('.') ? scope : `${xsappname}.${scope}`;
    });

    let hasAccess = false;
    
    if (requireAll) {
      // All scopes must be present
      hasAccess = normalizedRequiredScopes.every(scope => userScopes.includes(scope)) ||
                  additionalScopeChecks.every(scope => userScopes.includes(scope));
    } else {
      // At least one scope must be present - check both normalized scopes and additional scope patterns
      hasAccess = normalizedRequiredScopes.some(scope => userScopes.includes(scope)) ||
                  additionalScopeChecks.some(scope => userScopes.includes(scope)) ||
                  // Also check if any user scope ends with the required scope (for flexible matching)
                  scopes.some(scope => userScopes.some(userScope => userScope.endsWith(`.${scope}`)));
    }

    if (!hasAccess) {
      logger.warn('Authorization check failed: Insufficient permissions', {
        user: req.authInfo.user,
        userScopes: userScopes,
        requiredScopes: normalizedRequiredScopes,
        additionalScopeChecks: additionalScopeChecks,
        xsappname: xsappname,
        originalScopes: scopes,
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
      additionalScopeChecks: additionalScopeChecks,
      userScopes: userScopes,
      xsappname: xsappname
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