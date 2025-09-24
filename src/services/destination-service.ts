import { getDestination, HttpDestination } from '@sap-cloud-sdk/connectivity';
import xsenv from '@sap/xsenv';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import { SecureErrorHandler } from '../utils/secure-error-handler.js';
import { JWTUtils } from '../utils/jwt-utils.js';
import {
  DestinationContext,
  DestinationType,
  getDestinationType,
} from '../types/destination-types.js';

export class DestinationService {
  private config: Config;
  private vcapServices!: Record<string, unknown>;

  constructor(
    private logger: Logger,
    config?: Config
  ) {
    this.config = config || new Config();
  }

  async initialize(): Promise<void> {
    try {
      // Load VCAP services
      xsenv.loadEnv();
      this.vcapServices = xsenv.getServices({
        destination: { label: 'destination' },
        connectivity: { label: 'connectivity' },
        xsuaa: { label: 'xsuaa' },
      });

      this.logger.info('Destination service initialized successfully');
    } catch (error) {
      // Check if we're running in Cloud Foundry
      const isCloudFoundry = process.env.VCAP_SERVICES || process.env.CF_INSTANCE_INDEX;

      if (isCloudFoundry) {
        this.logger.error(
          '❌ Failed to initialize destination service in Cloud Foundry environment:',
          error
        );
        throw error; // Critical error in CF - services must be available
      } else {
        this.logger.info(
          'ℹ️  Running in local development mode - destination service fallback active'
        );
        // Don't throw in local development - use fallback configuration
        this.vcapServices = {
          destination: null,
          connectivity: null,
          xsuaa: null,
        };
      }
    }
  }

  /**
   * Get destination based on context (design-time or runtime)
   * This is the new context-aware method for dual destination architecture
   */
  async getDestination(context: DestinationContext): Promise<HttpDestination> {
    const destinationType = context.type || getDestinationType(context.operation!);
    const destinationName = this.config.getDestination(destinationType);

    this.logger.debug(
      `Fetching ${destinationType} destination: ${destinationName} for operation: ${context.operation}`
    );

    return await this.fetchDestinationByName(destinationName, context);
  }

  /**
   * Get design-time destination (for discovery and metadata operations)
   */
  async getDesignTimeDestination(context?: Partial<DestinationContext>): Promise<HttpDestination> {
    return await this.getDestination({
      type: 'design-time',
      operation: 'discovery',
      ...context,
    });
  }

  /**
   * Get runtime destination (for CRUD operations)
   * @deprecated Use getRuntimeDestinationWithJWT for secure JWT handling
   */
  async getRuntimeDestination(context?: Partial<DestinationContext>): Promise<HttpDestination> {
    return await this.getDestination({
      type: 'runtime',
      operation: 'read',
      ...context,
    });
  }

  /**
   * Get runtime destination with secure JWT handling (for CRUD operations)
   */
  async getRuntimeDestinationWithJWT(
    jwt?: string,
    context?: Partial<DestinationContext>
  ): Promise<HttpDestination> {
    const destinationContext = {
      type: 'runtime' as const,
      operation: 'read' as const,
      ...context,
    };

    return jwt
      ? await this.getDestinationWithJWT(destinationContext, jwt)
      : await this.getDestination(destinationContext);
  }

  /**
   * Get destination with JWT token passed directly (thread-safe)
   */
  async getDestinationWithJWT(context: DestinationContext, jwt?: string): Promise<HttpDestination> {
    const destinationType = context.type || getDestinationType(context.operation!);
    const destinationName = this.config.getDestination(destinationType);

    return await this.fetchDestinationByNameWithJWT(destinationName, context, jwt);
  }

  /**
   * Fetch destination by name with JWT token passed directly (thread-safe)
   */
  private async fetchDestinationByNameWithJWT(
    destinationName: string,
    context: DestinationContext,
    jwt?: string
  ): Promise<HttpDestination> {
    this.logger.debug(
      `Fetching destination: ${destinationName} for ${context.type} operation with explicit JWT`
    );

    try {
      // Try environment variables first (for development/testing)
      const envDestination = await this.getFromEnvironment(destinationName);
      if (envDestination) {
        this.logger.info(
          `Successfully retrieved ${context.type} destination '${destinationName}' from environment variable.`
        );
        return envDestination;
      }

      // For runtime destinations, log JWT availability
      if (context.type === 'runtime') {
        if (jwt) {
          this.logger.info(
            `JWT token provided for runtime destination '${destinationName}' - will use Principal Propagation if configured`
          );
        } else {
          this.logger.info(
            `No JWT token provided for runtime destination '${destinationName}' - will use BasicAuth if configured`
          );
        }
      }

      // Use JWT utility for consistent and secure token handling
      const destinationOptions = JWTUtils.createDestinationOptions(destinationName, jwt);

      // Log JWT validation info securely
      JWTUtils.logTokenInfo(jwt, `${context.type} destination '${destinationName}'`, this.logger);

      const destination = await getDestination(destinationOptions);

      if (!destination) {
        throw new Error(
          `Destination '${destinationName}' not found for ${context.type} operations`
        );
      }

      // Log authentication type and actual usage for debugging
      if (destination.authentication) {
        const hasBasicCredentials = !!(destination.username && destination.password);
        const isPrincipalProp = destination.authentication === 'PrincipalPropagation';
        const hasJWT = !!jwt;

        this.logger.info(
          `Destination '${destinationName}' uses authentication: ${destination.authentication}`
        );

        if (isPrincipalProp && hasJWT) {
          this.logger.info(`✅ Runtime request will use Principal Propagation with user JWT token`);
        } else if (isPrincipalProp && !hasJWT && hasBasicCredentials) {
          this.logger.info(
            `⚠️  Principal Propagation configured but no JWT available - will fallback to BasicAuth`
          );
        } else if (isPrincipalProp && !hasJWT && !hasBasicCredentials) {
          this.logger.warn(
            `❌ Principal Propagation configured but no JWT token or BasicAuth credentials available`
          );
        } else if (hasBasicCredentials && !isPrincipalProp) {
          this.logger.info(
            `✅ Runtime request will use BasicAuthentication with destination credentials`
          );
        } else {
          this.logger.info(
            `Authentication configured: ${destination.authentication}, hasJWT: ${hasJWT}, hasBasicAuth: ${hasBasicCredentials}`
          );
        }
      } else {
        this.logger.warn(`Destination '${destinationName}' has no authentication information`);
      }

      this.logger.info(`Successfully retrieved ${context.type} destination: ${destinationName}`);
      return destination as HttpDestination;
    } catch (error) {
      this.logger.error(`Failed to get ${context.type} destination '${destinationName}':`, error);
      throw error;
    }
  }

  /**
   * Fetch destination by name with context information and JWT handling (legacy - uses environment variables)
   */
  private async fetchDestinationByName(
    destinationName: string,
    context: DestinationContext
  ): Promise<HttpDestination> {
    try {
      // Try environment variables first (for development/testing)
      const envDestination = await this.getFromEnvironment(destinationName);
      if (envDestination) {
        this.logger.info(
          `Successfully retrieved ${context.type} destination '${destinationName}' from environment variable.`
        );
        return envDestination;
      }

      // Get JWT token - this is critical for Principal Propagation
      const jwt = this.getJWT(context);

      // Use JWT utility for consistent token handling
      const destinationOptions = JWTUtils.createDestinationOptions(destinationName, jwt);

      // Log JWT info securely
      JWTUtils.logTokenInfo(
        jwt,
        `${context.type} destination '${destinationName}' (legacy)`,
        this.logger
      );

      // Removed debug logging to reduce log spam

      const destination = await getDestination(destinationOptions);

      if (!destination) {
        throw new Error(
          `Destination '${destinationName}' not found for ${context.type} operations`
        );
      }

      // Log authentication type and actual usage for debugging
      if (destination.authentication) {
        const hasBasicCredentials = !!(destination.username && destination.password);
        const isPrincipalProp = destination.authentication === 'PrincipalPropagation';
        const hasJWT = !!jwt;

        this.logger.info(
          `Destination '${destinationName}' uses authentication: ${destination.authentication}`
        );

        if (isPrincipalProp && hasJWT) {
          this.logger.info(`✅ Runtime request will use Principal Propagation with user JWT token`);
        } else if (isPrincipalProp && !hasJWT && hasBasicCredentials) {
          this.logger.info(
            `⚠️  Principal Propagation configured but no JWT available - will fallback to BasicAuth`
          );
        } else if (isPrincipalProp && !hasJWT && !hasBasicCredentials) {
          this.logger.warn(
            `❌ Principal Propagation configured but no JWT token or BasicAuth credentials available`
          );
        } else if (hasBasicCredentials && !isPrincipalProp) {
          this.logger.info(
            `✅ Runtime request will use BasicAuthentication with destination credentials`
          );
        } else {
          this.logger.info(
            `Authentication configured: ${destination.authentication}, hasJWT: ${hasJWT}, hasBasicAuth: ${hasBasicCredentials}`
          );
        }
      } else {
        this.logger.warn(`Destination '${destinationName}' has no authentication information`);
      }

      this.logger.info(`Successfully retrieved ${context.type} destination: ${destinationName}`);
      return destination as HttpDestination;
    } catch (error) {
      this.logger.error(`Failed to get ${context.type} destination '${destinationName}':`, error);
      throw error;
    }
  }

  /**
   * Get destination from environment variables
   */
  private async getFromEnvironment(destinationName: string): Promise<HttpDestination | null> {
    try {
      const envDestinations = process.env.destinations;
      if (!envDestinations) {
        return null;
      }

      const destinations = JSON.parse(envDestinations);
      const envDest = destinations.find((d: Record<string, unknown>) => d.name === destinationName);

      if (envDest) {
        return {
          url: envDest.url,
          username: envDest.username,
          password: envDest.password,
          authentication: 'BasicAuthentication',
        } as HttpDestination;
      }
    } catch (envError) {
      this.logger.debug(
        `Failed to load destination '${destinationName}' from environment:`,
        envError
      );
    }
    return null;
  }

  /**
   * Test if a destination is available and accessible
   * @deprecated Use testDestinationWithJWT for secure JWT handling
   */
  async testDestination(
    destinationType: DestinationType
  ): Promise<{ available: boolean; error?: string }> {
    return this.testDestinationWithJWT(destinationType);
  }

  /**
   * Test if a destination is available and accessible with secure JWT handling
   */
  async testDestinationWithJWT(
    destinationType: DestinationType,
    jwt?: string
  ): Promise<{ available: boolean; error?: string }> {
    try {
      const destinationName = this.config.getDestination(destinationType);
      // Use proper context with operation for runtime destinations
      const context = {
        type: destinationType,
        operation: destinationType === 'runtime' ? ('read' as const) : ('discovery' as const),
      };

      // Use secure JWT passing instead of environment variables
      const destination = jwt
        ? await this.fetchDestinationByNameWithJWT(destinationName, context, jwt)
        : await this.fetchDestinationByName(destinationName, context);

      // Basic connectivity test - just verify we can get the destination
      if (destination && destination.url) {
        return { available: true };
      } else {
        return { available: false, error: 'Destination configuration incomplete' };
      }
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a destination exists (without throwing errors)
   */
  async exists(destinationName: string): Promise<boolean> {
    try {
      const envDest = await this.getFromEnvironment(destinationName);
      if (envDest) {
        return true;
      }

      const jwt = this.getJWT();
      const destinationOptions = JWTUtils.createDestinationOptions(destinationName, jwt);
      const destination = await getDestination(destinationOptions);
      return destination !== null;
    } catch {
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getDesignTimeDestination() or getRuntimeDestination() instead
   */
  async getSAPDestination(): Promise<HttpDestination> {
    // Use the same logic as getsapDestination, but update naming
    const destinationName = this.config.get('sap.destinationName', 'SAP_SYSTEM');
    this.logger.debug(`Fetching destination: ${destinationName}`);
    try {
      const envDestinations = process.env.destinations;
      if (envDestinations) {
        const destinations = JSON.parse(envDestinations);
        const envDest = destinations.find(
          (d: Record<string, unknown>) => d.name === destinationName
        );
        if (envDest) {
          this.logger.info(
            `Successfully retrieved destination '${destinationName}' from environment variable.`
          );
          return {
            url: envDest.url,
            username: envDest.username,
            password: envDest.password,
            authentication: 'BasicAuthentication',
          } as HttpDestination;
        }
      }
    } catch (envError) {
      this.logger.debug('Failed to load from environment destinations:', envError);
    }

    try {
      // Fallback to SAP Cloud SDK getDestination
      const jwt = this.getJWT();
      const destinationOptions = JWTUtils.createDestinationOptions(destinationName, jwt);
      const destination = await getDestination(destinationOptions);
      if (!destination) {
        throw new Error(
          `Destination '${destinationName}' not found in environment variables or BTP destination service`
        );
      }
      this.logger.info(`Successfully retrieved destination: ${destinationName}`);
      return destination as HttpDestination;
    } catch (error) {
      this.logger.error('Failed to get SAP destination:', error);
      throw error;
    }
  }

  /**
   * @deprecated This method is deprecated and will be removed. Use getDestinationWithJWT() instead.
   * JWT tokens should be passed explicitly to methods rather than relying on global environment variables.
   */
  private getJWT(context?: DestinationContext): string | undefined {
    // Note: This method provides secure fallback JWT handling for internal operations
    // Design-time operations use technical user JWT, runtime operations return undefined

    // For design-time operations, technical user JWT is acceptable for service discovery
    if (context?.type === 'design-time') {
      const jwt = process.env.USER_JWT || process.env.TECHNICAL_USER_JWT;
      if (jwt) {
        this.logger.debug('Using technical user JWT for design-time operations');
      }
      return jwt;
    }

    // For runtime operations, no fallback to global JWTs - explicit JWT passing required
    this.logger.debug('Runtime operations require explicit JWT token passing for security');
    return undefined;
  }

  getDestinationCredentials() {
    return (this.vcapServices?.destination as { credentials?: unknown })?.credentials;
  }

  getConnectivityCredentials() {
    return (this.vcapServices?.connectivity as { credentials?: unknown })?.credentials;
  }

  getXSUAACredentials() {
    return (this.vcapServices?.xsuaa as { credentials?: unknown })?.credentials;
  }
}
