import xsenv from '@sap/xsenv';
import { Logger } from '../utils/logger.js';

// Import SAP logging with fallback
let SAPLogging: any;
try {
  SAPLogging = require('@sap/logging');
} catch (e) {
  console.warn('SAP Logging not available, using fallback');
  SAPLogging = null;
}

/**
 * SAP Cloud Logging Service Integration
 * Provides structured logging compatible with SAP BTP observability
 */
export class CloudLoggingService {
  private sapLogger: any; // SAP Logger instance
  private localLogger: Logger;
  private isCloudLoggingAvailable: boolean = false;
  private serviceName: string;
  private version: string;

  constructor(serviceName: string = 'sap-mcp-server', version: string = '1.0.0') {
    this.serviceName = serviceName;
    this.version = version;
    this.localLogger = new Logger('CloudLoggingService');
    
    this.initializeCloudLogging();
  }

  /**
   * Initialize SAP Cloud Logging service
   */
  private initializeCloudLogging(): void {
    try {
      // Load SAP Cloud Logging service binding
      const services = xsenv.getServices({
        logging: { label: 'application-logs' }
      });

      if (services.logging) {
        // Initialize SAP Logger with Cloud Logging service
        if (SAPLogging) {
          this.sapLogger = SAPLogging.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: 'json',
            output: process.env.NODE_ENV === 'production' ? 'stdout' : 'console'
          });
        } else {
          this.sapLogger = this.createFallbackLogger();
        }

        this.isCloudLoggingAvailable = true;
        this.localLogger.info('✅ SAP Cloud Logging service initialized successfully');
      } else {
        this.initializeFallbackLogger();
        this.localLogger.warn('⚠️  SAP Cloud Logging service not bound, using fallback logger');
      }
    } catch (error) {
      this.initializeFallbackLogger();
      this.localLogger.warn('⚠️  Failed to initialize SAP Cloud Logging, using fallback:', error);
    }
  }

  /**
   * Initialize fallback logger when Cloud Logging is not available
   */
  private initializeFallbackLogger(): void {
    this.sapLogger = this.createFallbackLogger();
    this.isCloudLoggingAvailable = false;
  }
  
  private createFallbackLogger(): any {
    // Create a fallback logger that mimics the SAP logger interface
    return {
      info: (data: any) => this.localLogger.info(typeof data === 'object' ? JSON.stringify(data) : String(data)),
      warn: (data: any) => this.localLogger.warn(typeof data === 'object' ? JSON.stringify(data) : String(data)),
      error: (data: any) => this.localLogger.error(typeof data === 'object' ? JSON.stringify(data) : String(data)),
      debug: (data: any) => this.localLogger.debug(typeof data === 'object' ? JSON.stringify(data) : String(data))
    };
  }

  /**
   * Create structured log entry with BTP-compatible format
   */
  private createStructuredLog(
    level: string,
    message: string,
    context?: Record<string, unknown>
  ): Record<string, unknown> {
    const timestamp = new Date().toISOString();
    
    return {
      '@timestamp': timestamp,
      level: level.toUpperCase(),
      message,
      service: this.serviceName,
      version: this.version,
      component: 'sap-mcp-server',
      correlation_id: context?.correlationId || context?.requestId || this.generateCorrelationId(),
      // Add Cloud Foundry application info if available
      ...(process.env.VCAP_APPLICATION ? {
        cf_app: JSON.parse(process.env.VCAP_APPLICATION)
      } : {}),
      // Add custom context
      ...(context ? { context } : {}),
      // Add performance metrics if available
      ...(context?.performance ? { performance: context.performance } : {})
    };
  }

  /**
   * Log application events with proper structure
   */
  logApplicationEvent(
    level: 'info' | 'warn' | 'error' | 'debug',
    category: string,
    message: string,
    context?: {
      correlationId?: string;
      requestId?: string;
      userId?: string;
      operation?: string;
      duration?: number;
      statusCode?: number;
      errorCode?: string;
      [key: string]: unknown;
    }
  ): void {
    const structuredLog = this.createStructuredLog(level, message, {
      category,
      eventType: 'application',
      ...context
    });

    // Safely call the SAP logger method
    if (typeof this.sapLogger[level] === 'function') {
      this.sapLogger[level](structuredLog);
    } else {
      // Fallback to info level if specific level not available
      this.sapLogger.info(structuredLog);
    }
  }

  /**
   * Log security events (authentication, authorization, etc.)
   */
  logSecurityEvent(
    level: 'info' | 'warn' | 'error',
    eventType: 'authentication' | 'authorization' | 'token_validation' | 'security_violation',
    message: string,
    context?: {
      correlationId?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      result?: 'success' | 'failure';
      reason?: string;
      [key: string]: unknown;
    }
  ): void {
    const structuredLog = this.createStructuredLog(level, message, {
      category: 'security',
      eventType,
      securityEvent: true,
      ...context
    });

    // Safely call the SAP logger method
    if (typeof this.sapLogger[level] === 'function') {
      this.sapLogger[level](structuredLog);
    } else {
      // Fallback to info level if specific level not available
      this.sapLogger.info(structuredLog);
    }
  }

  /**
   * Log SAP integration events
   */
  logSAPIntegrationEvent(
    level: 'info' | 'warn' | 'error' | 'debug',
    eventType: 'destination_access' | 'odata_operation' | 'service_discovery' | 'principal_propagation',
    message: string,
    context?: {
      correlationId?: string;
      destinationName?: string;
      serviceName?: string;
      entitySet?: string;
      operation?: string;
      duration?: number;
      statusCode?: number;
      authType?: string;
      [key: string]: unknown;
    }
  ): void {
    const structuredLog = this.createStructuredLog(level, message, {
      category: 'sap_integration',
      eventType,
      sapEvent: true,
      ...context
    });

    // Safely call the SAP logger method
    if (typeof this.sapLogger[level] === 'function') {
      this.sapLogger[level](structuredLog);
    } else {
      // Fallback to info level if specific level not available
      this.sapLogger.info(structuredLog);
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    operationType: string,
    operationName: string,
    metrics: {
      duration: number;
      memoryUsage?: number;
      requestSize?: number;
      responseSize?: number;
      dbQueries?: number;
      cacheHits?: number;
      correlationId?: string;
      [key: string]: unknown;
    }
  ): void {
    const structuredLog = this.createStructuredLog('info', `Performance metrics for ${operationType}`, {
      category: 'performance',
      eventType: 'metrics',
      operationType,
      operationName,
      metrics,
      performanceEvent: true
    });

    this.sapLogger.info(structuredLog);
  }

  /**
   * Log business events (user actions, important state changes)
   */
  logBusinessEvent(
    eventType: string,
    message: string,
    context?: {
      correlationId?: string;
      userId?: string;
      entityType?: string;
      entityId?: string;
      action?: string;
      result?: 'success' | 'failure';
      [key: string]: unknown;
    }
  ): void {
    const structuredLog = this.createStructuredLog('info', message, {
      category: 'business',
      eventType,
      businessEvent: true,
      ...context
    });

    this.sapLogger.info(structuredLog);
  }

  /**
   * Log system health and status
   */
  logHealthEvent(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    message: string,
    context?: {
      checkType?: string;
      responseTime?: number;
      errorDetails?: string;
      [key: string]: unknown;
    }
  ): void {
    const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
    
    const structuredLog = this.createStructuredLog(level, message, {
      category: 'health',
      eventType: 'health_check',
      component,
      status,
      healthEvent: true,
      ...context
    });

    // Safely call the SAP logger method
    if (typeof this.sapLogger[level] === 'function') {
      this.sapLogger[level](structuredLog);
    } else {
      // Fallback to info level if specific level not available
      this.sapLogger.info(structuredLog);
    }
  }

  /**
   * Create middleware for request logging
   */
  createRequestLoggingMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
      
      // Add correlation ID to request for downstream use
      req.correlationId = correlationId;
      
      // Log request start
      this.logApplicationEvent('info', 'http_request', `${req.method} ${req.path}`, {
        correlationId,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        requestPhase: 'start'
      });

      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(...args: any[]) {
        const duration = Date.now() - startTime;
        
        // Log request completion
        const cloudLogging = req.app.locals.cloudLogging as CloudLoggingService;
        if (cloudLogging) {
          cloudLogging.logApplicationEvent(
            res.statusCode >= 400 ? 'error' : 'info',
            'http_response',
            `${req.method} ${req.path} - ${res.statusCode}`,
            {
              correlationId,
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
              requestPhase: 'complete'
            }
          );

          // Log performance metrics for slow requests
          if (duration > 1000) {
            cloudLogging.logPerformanceMetrics('http_request', `${req.method} ${req.path}`, {
              duration,
              correlationId,
              statusCode: res.statusCode
            });
          }
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get service status
   */
  getStatus(): {
    cloudLoggingAvailable: boolean;
    serviceName: string;
    version: string;
    logLevel: string;
  } {
    return {
      cloudLoggingAvailable: this.isCloudLoggingAvailable,
      serviceName: this.serviceName,
      version: this.version,
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  /**
   * Flush logs (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    try {
      // SAP Logger doesn't have explicit flush, but we can log a shutdown event
      this.logApplicationEvent('info', 'application_shutdown', 'Application shutting down gracefully');
    } catch (error) {
      this.localLogger.error('Error flushing logs:', error);
    }
  }
}