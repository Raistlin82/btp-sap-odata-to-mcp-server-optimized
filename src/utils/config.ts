// Configuration management system for SAP BTP integration
// Handles environment variables, Cloud Foundry services, and runtime configuration

import xsenv from '@sap/xsenv';
import { Logger } from './logger.js';
import {
  DestinationConfig,
  DestinationValidationResult,
  DestinationType,
} from '../types/destination-types.js';
import { NETWORK_TIMEOUTS } from '../constants/timeouts.js';

/**
 * Centralized configuration management with multi-source support
 * Supports environment variables, Cloud Foundry services, and runtime updates
 */
export class Config {
  private config: Map<string, unknown> = new Map(); // Internal configuration cache
  private logger = new Logger('Config'); // Configuration-specific logger

  /**
   * Initialize configuration from all available sources
   * Loads from environment variables, VCAP services, and CF user-provided services
   */
  constructor() {
    this.loadConfiguration();
  }

  /**
   * Reload OData configuration from environment variables and CF services
   * This allows runtime configuration changes without restart
   */
  async reloadODataConfig(): Promise<void> {
    this.loadODataServiceConfig();
    this.loadFromCFServices();
  }

  /**
   * Load configuration from all available sources with proper fallbacks
   * Priority: Environment variables > VCAP services > defaults
   */
  private loadConfiguration(): void {
    // Load SAP destination configuration
    this.loadDestinationConfig();

    // Load network and system configuration with fallbacks
    this.config.set(
      'request.timeout',
      parseInt(process.env.REQUEST_TIMEOUT || String(NETWORK_TIMEOUTS.REQUEST_TIMEOUT))
    );
    this.config.set('request.retries', parseInt(process.env.REQUEST_RETRIES || '3'));
    this.config.set('log.level', process.env.LOG_LEVEL || 'info');
    this.config.set('node.env', process.env.NODE_ENV || 'development');

    // Load OData service discovery configuration
    this.loadODataServiceConfig();

    // Load configuration from CF user-provided services
    this.loadFromCFServices();

    // Load from VCAP services (Cloud Foundry service bindings)
    try {
      xsenv.loadEnv(); // Load environment with @sap/xsenv
      const vcapServices = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : {};
      this.config.set('vcap.services', vcapServices);
    } catch (error) {
      this.logger.warn('Failed to load VCAP services', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private loadODataServiceConfig(): void {
    // OData service filtering configuration
    // Can be set via environment variables or will use defaults

    // Service include patterns - supports glob patterns and regex
    // Support both new (ODATA_INCLUDE_PATTERNS) and legacy (ODATA_SERVICE_PATTERNS) variable names
    const servicePatterns =
      process.env.ODATA_INCLUDE_PATTERNS || process.env.ODATA_SERVICE_PATTERNS;
    if (servicePatterns) {
      try {
        // Try parsing as JSON array first
        const patterns = JSON.parse(servicePatterns);
        this.config.set('odata.servicePatterns', Array.isArray(patterns) ? patterns : [patterns]);
      } catch {
        // Fallback to comma-separated string
        this.config.set(
          'odata.servicePatterns',
          servicePatterns.split(',').map(p => p.trim())
        );
      }
    } else {
      // Default patterns - include all services
      this.config.set('odata.servicePatterns', ['*']);
    }

    // Service exclusion patterns
    // Support both new (ODATA_EXCLUDE_PATTERNS) and legacy (ODATA_EXCLUSION_PATTERNS) variable names
    const exclusionPatterns =
      process.env.ODATA_EXCLUDE_PATTERNS || process.env.ODATA_EXCLUSION_PATTERNS;
    if (exclusionPatterns) {
      try {
        const patterns = JSON.parse(exclusionPatterns);
        this.config.set('odata.exclusionPatterns', Array.isArray(patterns) ? patterns : [patterns]);
      } catch {
        this.config.set(
          'odata.exclusionPatterns',
          exclusionPatterns.split(',').map(p => p.trim())
        );
      }
    } else {
      this.config.set('odata.exclusionPatterns', []);
    }

    // Allow all services flag - if true, ignores patterns and includes all
    this.config.set(
      'odata.allowAllServices',
      process.env.ODATA_ALLOW_ALL === 'true' || process.env.ODATA_ALLOW_ALL === '*'
    );

    // Discovery mode: 'all', 'whitelist', 'regex'
    this.config.set('odata.discoveryMode', process.env.ODATA_DISCOVERY_MODE || 'whitelist');

    // Maximum services to discover (prevents overwhelming the system)
    this.config.set('odata.maxServices', parseInt(process.env.ODATA_MAX_SERVICES || '50'));
  }

  /**
   * Load destination configuration from environment variables
   * Supports dual destination architecture with backward compatibility
   */
  private loadDestinationConfig(): void {
    // Load destination configuration from environment variables
    const designTimeDestination = process.env.SAP_DESTINATION_NAME || 'SAP_SYSTEM';
    const runtimeDestination = process.env.SAP_DESTINATION_NAME_RT || 'SAP_SYSTEM_RT';
    const useSingleDestination = process.env.SAP_USE_SINGLE_DESTINATION === 'true';

    // Set configuration
    this.config.set('sap.destinationName', designTimeDestination);
    this.config.set('sap.destinationNameRT', runtimeDestination);
    this.config.set('sap.useSingleDestination', useSingleDestination);

    // Log configuration for debugging (only in development)
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      this.logger.debug('Destination Configuration', {
        designTime: designTimeDestination,
        runtime: runtimeDestination,
        singleDestinationMode: useSingleDestination,
      });
    }
  }

  /**
   * Load configuration from Cloud Foundry user-provided services
   * Service name: 'odata-config' or 'mcp-odata-config'
   * Enhanced to support destination configuration
   */
  private loadFromCFServices(): void {
    try {
      // Try to load from user-provided services
      const services = xsenv.getServices({
        odataConfig: { label: 'user-provided', name: 'odata-config' },
        mcpConfig: { label: 'user-provided', name: 'mcp-odata-config' },
      });

      // Check for odata-config service first
      const configService = services.odataConfig || services.mcpConfig;

      if (configService && (configService as any).credentials) {
        const creds = (configService as any).credentials;

        // Override OData configuration if provided in the service
        if (creds.ODATA_ALLOW_ALL !== undefined) {
          this.config.set(
            'odata.allowAllServices',
            creds.ODATA_ALLOW_ALL === 'true' || creds.ODATA_ALLOW_ALL === '*'
          );
        }

        // Support both new (ODATA_INCLUDE_PATTERNS) and legacy (ODATA_SERVICE_PATTERNS) variable names
        const includePatterns = creds.ODATA_INCLUDE_PATTERNS || creds.ODATA_SERVICE_PATTERNS;
        if (includePatterns) {
          try {
            const patterns =
              typeof includePatterns === 'string' ? JSON.parse(includePatterns) : includePatterns;
            this.config.set(
              'odata.servicePatterns',
              Array.isArray(patterns) ? patterns : [patterns]
            );
          } catch {
            this.config.set(
              'odata.servicePatterns',
              includePatterns.split(',').map((p: string) => p.trim())
            );
          }
        }

        // Support both new (ODATA_EXCLUDE_PATTERNS) and legacy (ODATA_EXCLUSION_PATTERNS) variable names
        const excludePatterns = creds.ODATA_EXCLUDE_PATTERNS || creds.ODATA_EXCLUSION_PATTERNS;
        if (excludePatterns) {
          try {
            const patterns =
              typeof excludePatterns === 'string' ? JSON.parse(excludePatterns) : excludePatterns;
            this.config.set(
              'odata.exclusionPatterns',
              Array.isArray(patterns) ? patterns : [patterns]
            );
          } catch {
            this.config.set(
              'odata.exclusionPatterns',
              excludePatterns.split(',').map((p: string) => p.trim())
            );
          }
        }

        if (creds.ODATA_DISCOVERY_MODE) {
          this.config.set('odata.discoveryMode', creds.ODATA_DISCOVERY_MODE);
        }

        if (creds.ODATA_MAX_SERVICES) {
          this.config.set('odata.maxServices', parseInt(creds.ODATA_MAX_SERVICES));
        }

        // Load destination configuration from CF service
        if (creds.SAP_DESTINATION_NAME) {
          this.config.set('sap.destinationName', creds.SAP_DESTINATION_NAME);
        }

        if (creds.SAP_DESTINATION_NAME_RT) {
          this.config.set('sap.destinationNameRT', creds.SAP_DESTINATION_NAME_RT);
        }

        if (creds.SAP_USE_SINGLE_DESTINATION !== undefined) {
          this.config.set('sap.useSingleDestination', creds.SAP_USE_SINGLE_DESTINATION === 'true');
        }

        this.logger.info(
          'Loaded OData and Destination configuration from CF user-provided service'
        );
      }
    } catch (_error) {
      // CF services not available or not configured - use environment variables
      this.logger.info('CF user-provided services not available, using environment variables');
    }
  }

  get<T = string>(key: string, defaultValue?: T): T {
    const value = this.config.get(key);
    if (value === undefined) {
      return defaultValue as T;
    }
    return value as T;
  }

  set(key: string, value: unknown): void {
    this.config.set(key, value);
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }

  /**
   * Check if a service ID matches the configured patterns
   */
  isServiceAllowed(serviceId: string): boolean {
    const allowAll = this.get('odata.allowAllServices', false);
    if (allowAll) {
      return true;
    }

    // discoveryMode is not used, so removed for cleanup
    const servicePatterns = this.get('odata.servicePatterns', []);
    const exclusionPatterns = this.get('odata.exclusionPatterns', []);

    // Check exclusion patterns first
    if (this.matchesAnyPattern(serviceId, exclusionPatterns)) {
      return false;
    }

    // If no inclusion patterns are defined, allow all (unless excluded)
    if (!servicePatterns || servicePatterns.length === 0) {
      return true;
    }

    // Check inclusion patterns
    return this.matchesAnyPattern(serviceId, servicePatterns);
  }

  /**
   * Check if a string matches any of the given patterns
   * Supports glob-style patterns (* and ?) and basic regex
   */
  private matchesAnyPattern(value: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchesPattern(value, pattern));
  }

  /**
   * Check if a string matches a pattern
   * Supports:
   * - Exact match
   * - Glob patterns with * (matches any characters) and ? (matches single character)
   * - Regex patterns (if they start and end with /)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (!pattern) return false;

    // Exact match
    if (pattern === value) return true;

    // Regex pattern (enclosed in forward slashes)
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        return regex.test(value);
      } catch (error) {
        this.logger.warn('Invalid regex pattern', {
          pattern,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }

    // Glob pattern - convert to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.'); // ? matches single character

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(value);
    } catch (error) {
      this.logger.warn('Invalid glob pattern', {
        pattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get the maximum number of services to discover
   */
  getMaxServices(): number {
    return this.get('odata.maxServices', 50);
  }

  /**
   * Get service filtering configuration for logging/debugging
   */
  getServiceFilterConfig(): Record<string, unknown> {
    return {
      allowAllServices: this.get('odata.allowAllServices', false),
      discoveryMode: this.get('odata.discoveryMode', 'whitelist'),
      servicePatterns: this.get('odata.servicePatterns', []),
      exclusionPatterns: this.get('odata.exclusionPatterns', []),
      maxServices: this.get('odata.maxServices', 50),
    };
  }

  /**
   * Get design-time destination name (for discovery and metadata)
   */
  getDesignTimeDestination(): string {
    return this.get('sap.destinationName', 'SAP_SYSTEM') as string;
  }

  /**
   * Get runtime destination name (for CRUD operations)
   * Falls back to design-time destination if single destination mode is enabled
   */
  getRuntimeDestination(): string {
    const useSingle = this.get('sap.useSingleDestination', false) as boolean;
    if (useSingle) {
      return this.getDesignTimeDestination();
    }
    return this.get('sap.destinationNameRT', 'SAP_SYSTEM_RT') as string;
  }

  /**
   * Check if single destination mode is enabled
   */
  isDualDestinationMode(): boolean {
    return !this.get('sap.useSingleDestination', false);
  }

  /**
   * Get destination name based on type
   */
  getDestination(type: DestinationType): string {
    return type === 'design-time' ? this.getDesignTimeDestination() : this.getRuntimeDestination();
  }

  /**
   * Get complete destination configuration
   */
  getDestinationConfig(): DestinationConfig {
    return {
      designTimeDestination: this.getDesignTimeDestination(),
      runtimeDestination: this.getRuntimeDestination(),
      useSingleDestination: !this.isDualDestinationMode(),
    };
  }

  /**
   * Validate destination configuration and provide corrections
   */
  validateDestinationConfig(): DestinationValidationResult {
    const config = this.getDestinationConfig();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required validations
    if (!config.designTimeDestination) {
      errors.push('Design-time destination is required');
    }

    // Logic validations
    if (!config.useSingleDestination && !config.runtimeDestination) {
      warnings.push('Runtime destination not specified, will fallback to single destination');
      config.useSingleDestination = true;
    }

    // Duplicate validation
    if (
      config.designTimeDestination === config.runtimeDestination &&
      !config.useSingleDestination
    ) {
      warnings.push('Runtime destination same as design-time, single destination mode recommended');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedConfig: config,
    };
  }

  /**
   * Reload destination configuration (for runtime changes)
   */
  async reloadDestinationConfig(): Promise<void> {
    this.loadDestinationConfig();
    this.loadFromCFServices();

    // Validate the new configuration
    const validation = this.validateDestinationConfig();
    if (validation.warnings.length > 0) {
      this.logger.warn('Destination configuration warnings', { warnings: validation.warnings });
    }

    if (!validation.isValid) {
      this.logger.error('Destination configuration errors', { errors: validation.errors });
      throw new Error('Invalid destination configuration');
    }

    this.logger.info('Destination configuration reloaded successfully');
  }
}
