import winston from 'winston';

/**
 * List of sensitive field names that should be masked in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'jwt',
  'authorization',
  'auth',
  'credential',
  'key',
  'apikey',
  'api_key',
  'client_secret',
  'access_token',
  'refresh_token',
  'bearer',
  'x-csrf-token',
  'cookie',
  'session',
  'private_key',
  'certificate',
];

/**
 * Sanitizes log data by masking sensitive information
 */
function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  // If it's a primitive type, return as-is (strings, numbers, booleans)
  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item));
  }

  // Handle objects
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if the key contains sensitive information
      const isSensitive = SENSITIVE_FIELDS.some(sensitiveField =>
        lowerKey.includes(sensitiveField)
      );

      if (isSensitive) {
        // Mask sensitive data
        if (typeof value === 'string') {
          if (value.length <= 4) {
            sanitized[key] = '***';
          } else {
            sanitized[key] =
              value.substring(0, 2) +
              '*'.repeat(value.length - 4) +
              value.substring(value.length - 2);
          }
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeLogData(value);
      }
    }

    return sanitized;
  }

  return data;
}

/**
 * Secure logger that automatically sanitizes sensitive data
 */
export class Logger {
  private winston: winston.Logger;
  private isDevelopment: boolean;

  constructor(private component: string) {
    this.isDevelopment = process.env.NODE_ENV === 'development';

    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        component: this.component,
        service: 'btp-sap-odata-to-mcp-server',
      },
      transports: [
        new winston.transports.Console({
          stderrLevels: ['error', 'warn', 'info', 'debug'], // All logs to stderr for MCP compatibility
        }),
      ],
    });
  }

  debug(message: string, meta?: unknown): void {
    const sanitizedMeta = this.isDevelopment ? meta : sanitizeLogData(meta);
    this.winston.debug(message, sanitizedMeta);
  }

  info(message: string, meta?: unknown): void {
    const sanitizedMeta = sanitizeLogData(meta);
    this.winston.info(message, sanitizedMeta);
  }

  warn(message: string, meta?: unknown): void {
    const sanitizedMeta = sanitizeLogData(meta);
    this.winston.warn(message, sanitizedMeta);
  }

  error(message: string, meta?: unknown): void {
    const sanitizedMeta = sanitizeLogData(meta);
    this.winston.error(message, sanitizedMeta);
  }

  /**
   * Log only in development mode with full data (for debugging)
   */
  debugSensitive(message: string, meta?: unknown): void {
    if (this.isDevelopment) {
      this.winston.debug(`[DEV-ONLY] ${message}`, meta);
    } else {
      this.winston.debug(message, '[SENSITIVE_DATA_REDACTED_IN_PRODUCTION]');
    }
  }

  /**
   * Manually sanitize data if needed
   */
  static sanitize(data: unknown): unknown {
    return sanitizeLogData(data);
  }
}
