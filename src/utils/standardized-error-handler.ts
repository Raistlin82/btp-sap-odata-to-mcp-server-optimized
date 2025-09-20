/**
 * Standardized error handling system with security-aware error sanitization
 * Replaces multiple error handling patterns with a unified approach
 */

import { Logger } from './logger.js';
import { Messages } from '../i18n/messages.js';

export enum ErrorType {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  SAP_SERVICE = 'SAP_SERVICE',
  MCP_PROTOCOL = 'MCP_PROTOCOL',
  CONFIGURATION = 'CONFIGURATION',
  SYSTEM = 'SYSTEM',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  resource?: string;
  sessionId?: string;
  clientIp?: string;
  userAgent?: string;
  timestamp?: number;
  additionalData?: Record<string, any>;
}

export interface StandardizedError {
  code: string;
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
  statusCode: number;
  context?: ErrorContext;
  details?: string;
  timestamp: number;
  requestId?: string;
}

export interface ErrorHandlingOptions {
  sanitizeForProduction?: boolean;
  includeStackTrace?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  notifyMonitoring?: boolean;
}

/**
 * Standardized error handler with security-aware sanitization
 */
export class StandardizedErrorHandler {
  private logger: Logger;
  private isProduction: boolean;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('StandardizedErrorHandler');
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Handle and standardize any error with proper sanitization
   */
  handle(
    error: unknown,
    context?: ErrorContext,
    options?: ErrorHandlingOptions
  ): StandardizedError {
    const standardizedError = this.standardizeError(error, context);
    const sanitizedError = this.sanitizeError(standardizedError, options);

    // Log the error with appropriate level
    this.logError(sanitizedError, options);

    // Notify monitoring systems if configured
    if (options?.notifyMonitoring !== false) {
      this.notifyMonitoring(sanitizedError);
    }

    return sanitizedError;
  }

  /**
   * Create standardized error for authentication issues
   */
  createAuthenticationError(
    message?: string,
    context?: ErrorContext,
    statusCode = 401
  ): StandardizedError {
    return {
      code: 'AUTH_001',
      message: message || Messages.auth.errors.authenticationFailed,
      type: ErrorType.AUTHENTICATION,
      severity: ErrorSeverity.MEDIUM,
      statusCode,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Create standardized error for validation issues
   */
  createValidationError(
    message: string,
    details?: string,
    context?: ErrorContext
  ): StandardizedError {
    return {
      code: 'VAL_001',
      message,
      type: ErrorType.VALIDATION,
      severity: ErrorSeverity.LOW,
      statusCode: 400,
      details,
      context,
      timestamp: Date.now()
    };
  }

  /**
   * Standardize any error into our format
   */
  private standardizeError(error: unknown, context?: ErrorContext): StandardizedError {
    const timestamp = Date.now();
    const requestId = context?.requestId || this.generateRequestId();

    // Handle already standardized errors
    if (this.isStandardizedError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
        requestId
      };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        code: this.getErrorCode(error),
        message: this.getSafeErrorMessage(error),
        type: this.determineErrorType(error),
        severity: this.determineSeverity(error),
        statusCode: this.getStatusCode(error),
        details: this.isProduction ? undefined : error.stack,
        context,
        timestamp,
        requestId
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: 'GEN_001',
        message: error,
        type: ErrorType.SYSTEM,
        severity: ErrorSeverity.MEDIUM,
        statusCode: 500,
        context,
        timestamp,
        requestId
      };
    }

    // Handle unknown error types
    return {
      code: 'UNK_001',
      message: Messages.api.errors.internalError,
      type: ErrorType.SYSTEM,
      severity: ErrorSeverity.HIGH,
      statusCode: 500,
      details: this.isProduction ? undefined : JSON.stringify(error),
      context,
      timestamp,
      requestId
    };
  }

  /**
   * Sanitize error for safe client transmission
   */
  private sanitizeError(
    error: StandardizedError,
    options?: ErrorHandlingOptions
  ): StandardizedError {
    const sanitizeForProduction = options?.sanitizeForProduction ?? this.isProduction;

    if (!sanitizeForProduction) {
      return error;
    }

    // Remove sensitive information in production
    const sanitized: StandardizedError = {
      code: error.code,
      message: this.sanitizeMessage(error.message, error.type),
      type: error.type,
      severity: error.severity,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
      requestId: error.requestId
    };

    // Only include safe context fields in production
    if (error.context) {
      sanitized.context = {
        requestId: error.context.requestId,
        operation: error.context.operation,
        timestamp: error.context.timestamp
      };
    }

    return sanitized;
  }

  /**
   * Sanitize error message based on error type
   */
  private sanitizeMessage(message: string, type: ErrorType): string {
    switch (type) {
      case ErrorType.AUTHENTICATION:
        return Messages.auth.errors.authenticationFailed;
      case ErrorType.AUTHORIZATION:
        return Messages.auth.errors.insufficientPermissions;
      case ErrorType.SYSTEM:
      case ErrorType.CONFIGURATION:
        return Messages.api.errors.internalError;
      default:
        return message;
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: StandardizedError, options?: ErrorHandlingOptions): void {
    const logLevel = options?.logLevel || this.getLogLevel(error.severity);
    const logData = {
      code: error.code,
      type: error.type,
      severity: error.severity,
      statusCode: error.statusCode,
      context: error.context,
      requestId: error.requestId,
      details: error.details
    };

    switch (logLevel) {
      case 'error':
        this.logger.error(error.message, logData);
        break;
      case 'warn':
        this.logger.warn(error.message, logData);
        break;
      case 'info':
        this.logger.info(error.message, logData);
        break;
      case 'debug':
        this.logger.debug(error.message, logData);
        break;
    }
  }

  /**
   * Notify monitoring systems (placeholder for future implementation)
   */
  private notifyMonitoring(error: StandardizedError): void {
    // Future: Integrate with monitoring systems like Dynatrace, New Relic, etc.
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.logger.error('CRITICAL ERROR - Monitoring notification needed', {
        code: error.code,
        message: error.message,
        context: error.context
      });
    }
  }

  /**
   * Utility methods
   */
  private isStandardizedError(error: unknown): error is StandardizedError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'type' in error &&
      'severity' in error
    );
  }

  private getErrorCode(error: Error): string {
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    return 'ERR_001';
  }

  private getSafeErrorMessage(error: Error): string {
    // Filter out sensitive information from error messages
    const sensitivePatterns = [
      /password[=:]\\s*[^\\s]+/gi,
      /token[=:]\\s*[^\\s]+/gi,
      /secret[=:]\\s*[^\\s]+/gi,
      /authorization[=:]\\s*[^\\s]+/gi
    ];

    let message = error.message;
    for (const pattern of sensitivePatterns) {
      message = message.replace(pattern, '[REDACTED]');
    }

    return message;
  }

  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('auth') || name.includes('auth')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return ErrorType.AUTHORIZATION;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('network') || message.includes('timeout')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('sap') || message.includes('odata')) {
      return ErrorType.SAP_SERVICE;
    }
    if (message.includes('config')) {
      return ErrorType.CONFIGURATION;
    }

    return ErrorType.SYSTEM;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  private getStatusCode(error: Error): number {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    return 500;
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instance for easy access
export const standardErrorHandler = new StandardizedErrorHandler();