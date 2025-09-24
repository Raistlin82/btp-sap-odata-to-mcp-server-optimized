/**
 * Centralized message configuration system
 * All user-facing and log messages are externalized here
 */

export const Messages = {
  // Authentication Messages
  auth: {
    errors: {
      notConfigured:
        'IAS authentication not configured. Please configure IAS environment variables.',
      tokenExchangeFailed: 'Token exchange failed',
      authenticationFailed: 'Authentication failed',
      tokenRefreshFailed: 'Token refresh failed',
      userInfoRequestFailed: 'User info request failed',
      invalidCredentials: 'Invalid credentials provided',
      sessionExpired: 'Session has expired',
      insufficientPermissions: 'Insufficient permissions for this operation',
      tokenValidationFailed: 'Token validation failed',
      introspectionFailed: 'Token introspection failed',
      xsuaaBindingNotFound: 'No XSUAA service binding found, skipping token exchange',
      securityContextCreationFailed: 'XSUAA security context creation failed',
      noApplicationScopes: 'XSUAA context created but no application scopes found',
    },
    warnings: {
      deprecatedPasswordFlow:
        'Using deprecated password flow. Consider using Authorization Code flow instead.',
      missingConfiguration:
        'IAS configuration missing. Authentication will be disabled. Please set SAP_IAS_URL, SAP_IAS_CLIENT_ID, and SAP_IAS_CLIENT_SECRET environment variables to enable authentication.',
      tokenNotActive: 'Token is not active',
      securityWarning:
        'SECURITY WARNING: decodeJWT() called - this method is deprecated and insecure',
    },
    info: {
      userAuthenticated: 'User authenticated successfully',
      tokenRefreshed: 'Token refreshed successfully',
      clientCredentialsObtained: 'Client credentials token obtained successfully',
      tokenValidated: 'Token validated successfully',
      sessionCreated: 'Session created successfully',
      sessionInvalidated: 'Session invalidated',
      xsuaaServiceFound: 'Found XSUAA service binding',
      securityContextCreated: 'XSUAA security context created successfully',
      applicationScopesFound: 'Returning XSUAA token with application scopes',
    },
    debug: {
      exchangingCode: 'Exchanging authorization code for tokens',
      authenticatingUser: 'Authenticating user with IAS',
      refreshingToken: 'Refreshing token with IAS',
      gettingClientToken: 'Getting client credentials token from IAS',
      retrievedUserInfo: 'Retrieved user info',
      lookingForXsuaa: 'Looking for XSUAA service binding',
      creatingSecurityContext: 'Creating XSUAA security context',
    },
  },

  // Session Management Messages
  session: {
    errors: {
      creationFailed: 'Failed to create session',
      notFound: 'Session not found',
      invalidationFailed: 'Failed to invalidate session',
      cleanupFailed: 'Session cleanup failed',
      lockTimeoutExceeded: 'Session lock timeout exceeded',
      concurrentAccessDenied: 'Concurrent session access denied',
    },
    warnings: {
      multipleActiveSessions: 'Multiple active sessions detected for user',
      sessionNearExpiry: 'Session is near expiry',
      suspiciousActivity: 'Suspicious activity detected in session',
    },
    info: {
      created: 'Session created',
      invalidated: 'Session invalidated',
      cleaned: 'Session cleaned',
      extended: 'Session extended',
      userSessionMapped: 'User session mapped to MCP session',
    },
  },

  // Service Discovery Messages
  service: {
    errors: {
      discoveryFailed: 'Service discovery failed',
      catalogRetrievalFailed: 'Failed to retrieve service catalog',
      metadataParsingFailed: 'Failed to parse service metadata',
      endpointUnreachable: 'Service endpoint unreachable',
      invalidServiceDefinition: 'Invalid service definition',
    },
    warnings: {
      noServicesFound: 'No services found matching criteria',
      deprecatedVersion: 'Service version is deprecated',
      slowResponse: 'Service response time exceeded threshold',
    },
    info: {
      servicesDiscovered: 'Services discovered',
      catalogUpdated: 'Service catalog updated',
      endpointRegistered: 'Service endpoint registered',
    },
  },

  // Destination Management Messages
  destination: {
    errors: {
      notFound: 'Destination not found',
      configurationInvalid: 'Invalid destination configuration',
      authenticationFailed: 'Destination authentication failed',
      connectionFailed: 'Failed to connect to destination',
    },
    warnings: {
      fallbackUsed: 'Using fallback destination',
      certificateExpiring: 'Destination certificate is expiring soon',
    },
    info: {
      connected: 'Connected to destination',
      authenticated: 'Destination authenticated successfully',
      cached: 'Destination configuration cached',
    },
  },

  // Tool Execution Messages
  tools: {
    errors: {
      executionFailed: 'Tool execution failed',
      invalidParameters: 'Invalid tool parameters',
      timeout: 'Tool execution timeout',
      notFound: 'Tool not found',
    },
    warnings: {
      deprecatedTool: 'This tool is deprecated',
      longRunning: 'Tool execution is taking longer than expected',
    },
    info: {
      executing: 'Executing tool',
      completed: 'Tool execution completed',
      cancelled: 'Tool execution cancelled',
    },
  },

  // HTTP/API Messages
  api: {
    errors: {
      badRequest: 'Bad request',
      unauthorized: 'Unauthorized',
      forbidden: 'Forbidden',
      notFound: 'Resource not found',
      methodNotAllowed: 'Method not allowed',
      conflict: 'Resource conflict',
      internalError: 'Internal server error',
      serviceUnavailable: 'Service unavailable',
      gatewayTimeout: 'Gateway timeout',
    },
    warnings: {
      rateLimitNearing: 'Approaching rate limit',
      deprecatedEndpoint: 'This endpoint is deprecated',
    },
    info: {
      requestReceived: 'Request received',
      responsesSent: 'Response sent',
      rateLimitReset: 'Rate limit reset',
    },
  },

  // Configuration Messages
  config: {
    errors: {
      loadFailed: 'Failed to load configuration',
      validationFailed: 'Configuration validation failed',
      requiredMissing: 'Required configuration missing',
    },
    warnings: {
      usingDefaults: 'Using default configuration',
      deprecatedOption: 'Configuration option is deprecated',
    },
    info: {
      loaded: 'Configuration loaded',
      updated: 'Configuration updated',
      validated: 'Configuration validated',
    },
  },

  // Health Check Messages
  health: {
    errors: {
      checkFailed: 'Health check failed',
      dependencyUnhealthy: 'Dependency is unhealthy',
    },
    warnings: {
      degradedPerformance: 'System performance is degraded',
      highMemoryUsage: 'High memory usage detected',
      highCpuUsage: 'High CPU usage detected',
    },
    info: {
      healthy: 'System is healthy',
      ready: 'System is ready',
      live: 'System is live',
    },
  },

  // MCP Protocol Messages
  mcp: {
    errors: {
      protocolViolation: 'MCP protocol violation',
      unsupportedVersion: 'Unsupported MCP version',
      initializationFailed: 'MCP initialization failed',
      connectionLost: 'MCP connection lost',
    },
    warnings: {
      versionMismatch: 'MCP version mismatch detected',
      featureNotSupported: 'MCP feature not supported',
    },
    info: {
      initialized: 'MCP server initialized',
      clientConnected: 'MCP client connected',
      clientDisconnected: 'MCP client disconnected',
      requestProcessed: 'MCP request processed',
    },
  },

  // Generic System Messages
  system: {
    errors: {
      startupFailed: 'System startup failed',
      shutdownFailed: 'System shutdown failed',
      resourceExhausted: 'System resources exhausted',
    },
    warnings: {
      highLoad: 'System under high load',
      maintenanceNeeded: 'System maintenance needed',
    },
    info: {
      started: 'System started',
      stopping: 'System stopping',
      reloading: 'System reloading configuration',
    },
  },
};

/**
 * Format a message with parameters
 */
export function formatMessage(message: string, params?: Record<string, any>): string {
  if (!params) return message;

  return Object.keys(params).reduce((msg, key) => {
    return msg.replace(new RegExp(`{${key}}`, 'g'), String(params[key]));
  }, message);
}

/**
 * Get a message by path (e.g., 'auth.errors.notConfigured')
 */
export function getMessage(path: string, params?: Record<string, any>): string {
  const keys = path.split('.');
  let current: any = Messages;

  for (const key of keys) {
    if (current[key] === undefined) {
      return `Message not found: ${path}`;
    }
    current = current[key];
  }

  if (typeof current !== 'string') {
    return `Invalid message path: ${path}`;
  }

  return formatMessage(current, params);
}
