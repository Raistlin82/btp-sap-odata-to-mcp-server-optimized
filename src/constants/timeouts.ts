/**
 * Timeout and Time-related Constants
 * Centralized constants for timeouts, intervals, and durations
 */

// Time units in milliseconds
export const TIME_UNITS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;

// Network and request timeouts
export const NETWORK_TIMEOUTS = {
  REQUEST_TIMEOUT: 30000,        // 30 seconds
  CONNECTION_TIMEOUT: 10000,     // 10 seconds
  WEBSOCKET_HEARTBEAT: 30000,    // 30 seconds
  SHUTDOWN_TIMEOUT: 30000        // 30 seconds
} as const;

// Session and token lifetimes
export const SESSION_LIFETIMES = {
  TOKEN_CLEANUP_INTERVAL: 5 * TIME_UNITS.MINUTE,    // 5 minutes
  SESSION_MAX_AGE: 24 * TIME_UNITS.HOUR,            // 24 hours
  SESSION_CLEANUP: TIME_UNITS.HOUR,                 // 1 hour
  AUTH_TOKEN_EXPIRY: 8 * TIME_UNITS.HOUR,           // 8 hours
  SHORT_CACHE_TTL: 5 * TIME_UNITS.MINUTE,           // 5 minutes
  MEDIUM_CACHE_TTL: 30 * TIME_UNITS.MINUTE,         // 30 minutes
  LONG_CACHE_TTL: 5 * TIME_UNITS.HOUR               // 5 hours
} as const;

// Analytics and monitoring intervals
export const ANALYTICS_INTERVALS = {
  REALTIME_PROCESSING: 5000,         // 5 seconds
  KPI_REFRESH: 30000,                // 30 seconds
  DASHBOARD_REFRESH: 30000,          // 30 seconds
  HEALTH_CHECK: 60000,               // 1 minute
  PERFORMANCE_MONITOR: 15000         // 15 seconds
} as const;

// Data retention periods
export const DATA_RETENTION = {
  INSIGHTS_SHORT: 24 * TIME_UNITS.HOUR,      // 24 hours
  INSIGHTS_MEDIUM: 48 * TIME_UNITS.HOUR,     // 48 hours
  INSIGHTS_LONG: 7 * TIME_UNITS.DAY,         // 7 days
  ANALYTICS_LONG: 72 * TIME_UNITS.HOUR,      // 72 hours
  CACHE_DEFAULT: 300000                       // 5 minutes (300000 ms)
} as const;

// Alert thresholds (in milliseconds for response times)
export const ALERT_THRESHOLDS = {
  RESPONSE_TIME_HIGH: 5000,      // 5 seconds
  RESPONSE_TIME_MEDIUM: 15000,   // 15 seconds
  MEMORY_WARNING: 50000,         // 50MB
  ANOMALY_THRESHOLD: -5000       // -5000 for negative anomalies
} as const;

/**
 * System and validation constants
 */
export const SYSTEM_CONSTANTS = {
  BYTES_TO_MB: 1024,            // 1024 bytes = 1KB
  SLOW_OPERATION_THRESHOLD: 1000, // 1 second
  TOKEN_EXPIRY_MULTIPLIER: 1000,   // Convert seconds to milliseconds
  BUFFER_SIZE_DEFAULT: 1000,       // Default buffer size
  PERFORMANCE_BASELINE: 1000,      // Base estimate for performance calculations
  ANOMALY_POSITIVE_THRESHOLD: 10000,  // 10k threshold for positive anomalies
  ANOMALY_NEGATIVE_THRESHOLD: -1000,  // -1k threshold for negative anomalies
  SIMULATION_INTERVAL: 2000        // 2 seconds for simulation intervals
} as const;

/**
 * Validation limits for user inputs and system parameters
 */
export const VALIDATION_LIMITS = {
  MAX_STRING_LENGTH: 1000,         // Maximum string length
  MAX_URL_LENGTH: 2000,           // Maximum URL length
  MAX_FILTER_LENGTH: 2000,        // Maximum OData filter length
  MAX_TOP_PARAMETER: 1000,        // Maximum $top parameter for OData queries
  DEFAULT_SANITIZE_LENGTH: 1000   // Default length for string sanitization
} as const;