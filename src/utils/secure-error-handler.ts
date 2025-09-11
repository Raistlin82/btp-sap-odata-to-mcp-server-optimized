import { Logger } from './logger.js';

export interface SecureError {
  error: string;
  message: string;
  code: string;
  timestamp?: string;
  requestId?: string;
}

export interface DetailedError extends SecureError {
  details?: unknown;
  stack?: string;
  originalError?: string;
}

/**
 * Secure error handler that prevents information leakage to external users
 * while providing detailed logging for internal debugging
 */
export class SecureErrorHandler {
  private logger: Logger;
  private isDevelopment: boolean;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('SecureErrorHandler');
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Sanitize error for external consumption
   * Removes sensitive information while preserving useful error details
   */
  sanitizeError(error: unknown, context?: {
    operation?: string;
    requestId?: string;
    userId?: string;
  }): SecureError {
    const timestamp = new Date().toISOString();
    const requestId = context?.requestId || 'unknown';

    // Log the full error details internally
    this.logger.error('Error occurred:', {
      error,
      context,
      timestamp,
      requestId
    });

    // Determine error type and create sanitized response
    if (error instanceof Error) {
      return this.sanitizeKnownError(error, { timestamp, requestId });
    }

    if (typeof error === 'object' && error !== null) {
      return this.sanitizeObjectError(error as Record<string, unknown>, { timestamp, requestId });
    }

    // Generic fallback for unknown error types
    return {
      error: 'Internal Server Error',
      message: this.isDevelopment ? String(error) : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp,
      requestId
    };
  }

  /**
   * Sanitize known Error instances
   */
  private sanitizeKnownError(error: Error, meta: { timestamp: string; requestId: string }): SecureError {
    const errorMessage = error.message;
    
    // Authentication/Authorization errors
    if (this.isAuthError(errorMessage)) {
      return {
        error: 'Authentication Failed',
        message: this.sanitizeAuthErrorMessage(errorMessage),
        code: this.getAuthErrorCode(errorMessage),
        ...meta
      };
    }

    // Network/Connection errors
    if (this.isNetworkError(errorMessage)) {
      return {
        error: 'Service Unavailable',
        message: 'Unable to connect to external service',
        code: 'SERVICE_UNAVAILABLE',
        ...meta
      };
    }

    // Validation errors
    if (this.isValidationError(errorMessage)) {
      return {
        error: 'Validation Error',
        message: this.sanitizeValidationError(errorMessage),
        code: 'VALIDATION_ERROR',
        ...meta
      };
    }

    // Configuration errors
    if (this.isConfigError(errorMessage)) {
      return {
        error: 'Configuration Error',
        message: 'Service configuration issue',
        code: 'CONFIG_ERROR',
        ...meta
      };
    }

    // SAP-specific errors
    if (this.isSAPError(errorMessage)) {
      return {
        error: 'SAP Service Error',
        message: this.sanitizeSAPError(errorMessage),
        code: 'SAP_ERROR',
        ...meta
      };
    }

    // Generic server errors
    return {
      error: 'Internal Server Error',
      message: this.isDevelopment ? errorMessage : 'An error occurred while processing your request',
      code: 'INTERNAL_ERROR',
      ...meta
    };
  }

  /**
   * Sanitize object-based errors (e.g., from HTTP clients)
   */
  private sanitizeObjectError(error: Record<string, unknown>, meta: { timestamp: string; requestId: string }): SecureError {
    const statusCode = (error as any).statusCode || (error as any).status;
    const message = error.message || error.error;

    if (typeof statusCode === 'number' && statusCode === 401) {
      return {
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        ...meta
      };
    }

    if (typeof statusCode === 'number' && statusCode === 403) {
      return {
        error: 'Forbidden',
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        ...meta
      };
    }

    if (typeof statusCode === 'number' && statusCode === 404) {
      return {
        error: 'Not Found',
        message: 'Requested resource not found',
        code: 'RESOURCE_NOT_FOUND',
        ...meta
      };
    }

    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return {
        error: 'Client Error',
        message: this.isDevelopment && typeof message === 'string' ? message : 'Invalid request',
        code: 'CLIENT_ERROR',
        ...meta
      };
    }

    if (typeof statusCode === 'number' && statusCode >= 500) {
      return {
        error: 'External Service Error',
        message: 'External service is currently unavailable',
        code: 'EXTERNAL_SERVICE_ERROR',
        ...meta
      };
    }

    return {
      error: 'Internal Server Error',
      message: this.isDevelopment && typeof message === 'string' ? message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      ...meta
    };
  }

  /**
   * Check if error is authentication related
   */
  private isAuthError(message: string): boolean {
    const authKeywords = [
      'authentication', 'unauthorized', 'invalid token', 'expired token',
      'jwt', 'bearer', 'credentials', 'login', 'permission'
    ];
    return authKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Check if error is network related
   */
  private isNetworkError(message: string): boolean {
    const networkKeywords = [
      'connection', 'timeout', 'network', 'econnrefused', 'enotfound',
      'fetch failed', 'socket', 'dns'
    ];
    return networkKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Check if error is validation related
   */
  private isValidationError(message: string): boolean {
    const validationKeywords = [
      'validation', 'invalid input', 'bad request', 'malformed',
      'schema', 'required field', 'invalid format'
    ];
    return validationKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Check if error is configuration related
   */
  private isConfigError(message: string): boolean {
    const configKeywords = [
      'not configured', 'configuration', 'missing env', 'credentials not found',
      'service not available', 'vcap', 'binding'
    ];
    return configKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Check if error is SAP related
   */
  private isSAPError(message: string): boolean {
    const sapKeywords = [
      'sap', 'odata', 'destination', 'xsuaa', 'principal propagation',
      'connectivity', 'cloud connector', 's/4hana'
    ];
    return sapKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Sanitize authentication error messages
   */
  private sanitizeAuthErrorMessage(message: string): string {
    if (message.toLowerCase().includes('expired')) {
      return 'Authentication token has expired';
    }
    if (message.toLowerCase().includes('invalid')) {
      return 'Invalid authentication credentials';
    }
    if (message.toLowerCase().includes('permission')) {
      return 'Insufficient permissions for this operation';
    }
    return 'Authentication required';
  }

  /**
   * Get authentication error code
   */
  private getAuthErrorCode(message: string): string {
    if (message.toLowerCase().includes('expired')) return 'TOKEN_EXPIRED';
    if (message.toLowerCase().includes('invalid')) return 'INVALID_TOKEN';
    if (message.toLowerCase().includes('permission')) return 'INSUFFICIENT_PERMISSIONS';
    return 'AUTH_FAILED';
  }

  /**
   * Sanitize validation error messages
   */
  private sanitizeValidationError(message: string): string {
    // Remove sensitive information from validation messages
    return this.isDevelopment ? 
      message : 
      'Invalid input provided. Please check your request and try again.';
  }

  /**
   * Sanitize SAP error messages
   */
  private sanitizeSAPError(message: string): string {
    if (message.toLowerCase().includes('destination')) {
      return 'Unable to connect to SAP system';
    }
    if (message.toLowerCase().includes('principal propagation')) {
      return 'Authentication with SAP system failed';
    }
    if (message.toLowerCase().includes('odata')) {
      return 'SAP service request failed';
    }
    return this.isDevelopment ? message : 'SAP service error occurred';
  }

  /**
   * Create detailed error for development/logging
   */
  createDetailedError(error: unknown, context?: {
    operation?: string;
    requestId?: string;
    userId?: string;
  }): DetailedError {
    const secureError = this.sanitizeError(error, context);
    
    if (!this.isDevelopment) {
      return secureError;
    }

    // Add detailed information in development
    return {
      ...secureError,
      details: context,
      stack: error instanceof Error ? error.stack : undefined,
      originalError: String(error)
    };
  }
}