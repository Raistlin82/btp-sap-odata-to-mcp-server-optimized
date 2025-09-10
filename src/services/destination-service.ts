import { getDestination, HttpDestination } from '@sap-cloud-sdk/connectivity';
import xsenv from '@sap/xsenv';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import { DestinationContext, DestinationType, getDestinationType } from '../types/destination-types.js';

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
                xsuaa: { label: 'xsuaa' }
            });

            this.logger.info('Destination service initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize destination service:', error);
            throw error;
        }
    }

    /**
     * Get destination based on context (design-time or runtime)
     * This is the new context-aware method for dual destination architecture
     */
    async getDestination(context: DestinationContext): Promise<HttpDestination> {
        const destinationType = context.type || getDestinationType(context.operation!);
        const destinationName = this.config.getDestination(destinationType);
        
        this.logger.debug(`Fetching ${destinationType} destination: ${destinationName} for operation: ${context.operation}`);
        
        return await this.fetchDestinationByName(destinationName, context);
    }

    /**
     * Get design-time destination (for discovery and metadata operations)
     */
    async getDesignTimeDestination(context?: Partial<DestinationContext>): Promise<HttpDestination> {
        return await this.getDestination({
            type: 'design-time',
            operation: 'discovery',
            ...context
        });
    }

    /**
     * Get runtime destination (for CRUD operations)
     */
    async getRuntimeDestination(context?: Partial<DestinationContext>): Promise<HttpDestination> {
        return await this.getDestination({
            type: 'runtime',
            operation: 'read',
            ...context
        });
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
    private async fetchDestinationByNameWithJWT(destinationName: string, context: DestinationContext, jwt?: string): Promise<HttpDestination> {
        this.logger.debug(`Fetching destination: ${destinationName} for ${context.type} operation with explicit JWT`);
        
        try {
            // Try environment variables first (for development/testing)
            const envDestination = await this.getFromEnvironment(destinationName);
            if (envDestination) {
                this.logger.info(`Successfully retrieved ${context.type} destination '${destinationName}' from environment variable.`);
                return envDestination;
            }

            // For runtime destinations, log JWT availability
            if (context.type === 'runtime') {
                if (jwt) {
                    this.logger.info(`JWT token provided for runtime destination '${destinationName}' - will use Principal Propagation if configured`);
                } else {
                    this.logger.info(`No JWT token provided for runtime destination '${destinationName}' - will use BasicAuth if configured`);
                }
            }

            // Clean JWT by removing Bearer prefix if present
            const cleanJWT = jwt ? jwt.replace(/^Bearer\s+/i, '') : undefined;
            
            // Use SAP Cloud SDK getDestination with cleaned JWT
            const destinationOptions = {
                destinationName,
                ...(cleanJWT && { jwt: cleanJWT }) // Only include clean JWT if provided
            };

            // Debug JWT format before passing to SAP Cloud SDK
            if (cleanJWT) {
                this.logger.debug(`Original JWT length: ${jwt?.length}, Clean JWT length: ${cleanJWT.length}, Had Bearer prefix: ${jwt?.startsWith('Bearer ')}`);
                try {
                    // Try to decode the JWT header and payload to check format
                    const parts = cleanJWT.split('.');
                    if (parts.length === 3) {
                        this.logger.debug(`JWT has 3 parts (valid structure)`);
                        
                        // Try to decode the header and payload parts to identify the issue
                        try {
                            // Decode header (part 0)
                            const headerBase64 = parts[0];
                            const headerDecoded = Buffer.from(headerBase64, 'base64').toString('utf8');
                            this.logger.debug(`JWT Header decoded: ${headerDecoded}`);
                            
                            // Try to parse header as JSON
                            const headerJSON = JSON.parse(headerDecoded);
                            this.logger.debug(`JWT Header JSON parsed successfully: ${JSON.stringify(headerJSON)}`);
                        } catch (headerErr) {
                            this.logger.error(`JWT Header decoding/parsing failed:`, headerErr);
                        }
                        
                        try {
                            // Decode payload (part 1) - this is likely where the issue is
                            const payloadBase64 = parts[1];
                            this.logger.debug(`JWT Payload Base64 length: ${payloadBase64.length}`);
                            
                            // Check for proper Base64 padding
                            const paddingNeeded = (4 - (payloadBase64.length % 4)) % 4;
                            const paddedPayload = payloadBase64 + '='.repeat(paddingNeeded);
                            this.logger.debug(`JWT Payload with padding: length ${paddedPayload.length}, padding added: ${paddingNeeded}`);
                            
                            const payloadDecoded = Buffer.from(paddedPayload, 'base64').toString('utf8');
                            this.logger.debug(`JWT Payload decoded raw: ${payloadDecoded}`);
                            
                            // Try to parse payload as JSON - this is where the SAP SDK fails
                            const payloadJSON = JSON.parse(payloadDecoded);
                            this.logger.debug(`JWT Payload JSON parsed successfully: ${JSON.stringify(payloadJSON)}`);
                        } catch (payloadErr) {
                            this.logger.error(`JWT Payload decoding/parsing failed - THIS IS THE ROOT CAUSE:`, payloadErr);
                            // Try to get more info about the payload content
                            try {
                                const payloadBase64 = parts[1];
                                const paddingNeeded = (4 - (payloadBase64.length % 4)) % 4;
                                const paddedPayload = payloadBase64 + '='.repeat(paddingNeeded);
                                const payloadDecoded = Buffer.from(paddedPayload, 'base64').toString('utf8');
                                this.logger.error(`Malformed JWT Payload content: ${payloadDecoded.substring(0, 200)}...`);
                            } catch (innerErr) {
                                this.logger.error(`Failed to decode JWT payload for inspection:`, innerErr);
                            }
                        }
                    } else {
                        this.logger.error(`JWT has invalid structure: ${parts.length} parts instead of 3`);
                    }
                } catch (err) {
                    this.logger.error(`JWT format validation failed:`, err);
                }
            }

            const destination = await getDestination(destinationOptions);
            
            if (!destination) {
                throw new Error(`Destination '${destinationName}' not found for ${context.type} operations`);
            }
            
            // Log authentication type and actual usage for debugging
            if (destination.authentication) {
                const hasBasicCredentials = !!(destination.username && destination.password);
                const isPrincipalProp = destination.authentication === 'PrincipalPropagation';
                const hasJWT = !!jwt;
                
                this.logger.info(`Destination '${destinationName}' uses authentication: ${destination.authentication}`);
                
                if (isPrincipalProp && hasJWT) {
                    this.logger.info(`✅ Runtime request will use Principal Propagation with user JWT token`);
                } else if (isPrincipalProp && !hasJWT && hasBasicCredentials) {
                    this.logger.info(`⚠️  Principal Propagation configured but no JWT available - will fallback to BasicAuth`);
                } else if (isPrincipalProp && !hasJWT && !hasBasicCredentials) {
                    this.logger.warn(`❌ Principal Propagation configured but no JWT token or BasicAuth credentials available`);
                } else if (hasBasicCredentials && !isPrincipalProp) {
                    this.logger.info(`✅ Runtime request will use BasicAuthentication with destination credentials`);
                } else {
                    this.logger.info(`Authentication configured: ${destination.authentication}, hasJWT: ${hasJWT}, hasBasicAuth: ${hasBasicCredentials}`);
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
    private async fetchDestinationByName(destinationName: string, context: DestinationContext): Promise<HttpDestination> {
        try {
            // Try environment variables first (for development/testing)
            const envDestination = await this.getFromEnvironment(destinationName);
            if (envDestination) {
                this.logger.info(`Successfully retrieved ${context.type} destination '${destinationName}' from environment variable.`);
                return envDestination;
            }

            // Get JWT token - this is critical for Principal Propagation
            const jwt = this.getJWT(context);
            
            // Clean JWT by removing Bearer prefix if present
            const cleanJWT = jwt ? jwt.replace(/^Bearer\s+/i, '') : undefined;

            // Fallback to SAP Cloud SDK getDestination with proper JWT handling
            const destinationOptions = {
                destinationName,
                ...(cleanJWT && { jwt: cleanJWT }) // Only include clean JWT if available
            };

            // Removed debug logging to reduce log spam

            const destination = await getDestination(destinationOptions);
            
            if (!destination) {
                throw new Error(`Destination '${destinationName}' not found for ${context.type} operations`);
            }
            
            // Log authentication type and actual usage for debugging
            if (destination.authentication) {
                const hasBasicCredentials = !!(destination.username && destination.password);
                const isPrincipalProp = destination.authentication === 'PrincipalPropagation';
                const hasJWT = !!jwt;
                
                this.logger.info(`Destination '${destinationName}' uses authentication: ${destination.authentication}`);
                
                if (isPrincipalProp && hasJWT) {
                    this.logger.info(`✅ Runtime request will use Principal Propagation with user JWT token`);
                } else if (isPrincipalProp && !hasJWT && hasBasicCredentials) {
                    this.logger.info(`⚠️  Principal Propagation configured but no JWT available - will fallback to BasicAuth`);
                } else if (isPrincipalProp && !hasJWT && !hasBasicCredentials) {
                    this.logger.warn(`❌ Principal Propagation configured but no JWT token or BasicAuth credentials available`);
                } else if (hasBasicCredentials && !isPrincipalProp) {
                    this.logger.info(`✅ Runtime request will use BasicAuthentication with destination credentials`);
                } else {
                    this.logger.info(`Authentication configured: ${destination.authentication}, hasJWT: ${hasJWT}, hasBasicAuth: ${hasBasicCredentials}`);
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
                    authentication: 'BasicAuthentication'
                } as HttpDestination;
            }
        } catch (envError) {
            this.logger.debug(`Failed to load destination '${destinationName}' from environment:`, envError);
        }
        return null;
    }

    /**
     * Test if a destination is available and accessible
     */
    async testDestination(destinationType: DestinationType): Promise<{ available: boolean; error?: string }> {
        try {
            const destinationName = this.config.getDestination(destinationType);
            // Use proper context with operation for runtime destinations
            const context = { 
                type: destinationType, 
                operation: destinationType === 'runtime' ? 'read' as const : 'discovery' as const 
            };
            const destination = await this.fetchDestinationByName(destinationName, context);
            
            // Basic connectivity test - just verify we can get the destination
            if (destination && destination.url) {
                return { available: true };
            } else {
                return { available: false, error: 'Destination configuration incomplete' };
            }
        } catch (error) {
            return { 
                available: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
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
            const cleanJWT = jwt ? jwt.replace(/^Bearer\s+/i, '') : undefined;
            
            const destination = await getDestination({
                destinationName,
                ...(cleanJWT && { jwt: cleanJWT })
            });
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
                const envDest = destinations.find((d: Record<string, unknown>) => d.name === destinationName);
                if (envDest) {
                    this.logger.info(`Successfully retrieved destination '${destinationName}' from environment variable.`);
                    return {
                        url: envDest.url,
                        username: envDest.username,
                        password: envDest.password,
                        authentication: 'BasicAuthentication'
                    } as HttpDestination;
                }
            }
        } catch (envError) {
            this.logger.debug('Failed to load from environment destinations:', envError);
        }

        try {
            // Fallback to SAP Cloud SDK getDestination
            const jwt = this.getJWT();
            const cleanJWT = jwt ? jwt.replace(/^Bearer\s+/i, '') : undefined;
            
            const destination = await getDestination({
                destinationName,
                ...(cleanJWT && { jwt: cleanJWT })
            });
            if (!destination) {
                throw new Error(`Destination '${destinationName}' not found in environment variables or BTP destination service`);
            }
            this.logger.info(`Successfully retrieved destination: ${destinationName}`);
            return destination as HttpDestination;
        } catch (error) {
            this.logger.error('Failed to get SAP destination:', error);
            throw error;
        }
    }

    /**
     * Get JWT token for destination access with context-aware handling
     * For Principal Propagation, this extracts the user's JWT token
     * For hybrid destinations, determines whether to use Principal Propagation or fallback to BasicAuth
     */
    private getJWT(context?: DestinationContext): string | undefined {
        // For runtime operations, check if we should use Principal Propagation
        if (context?.type === 'runtime') {
            // Try multiple sources for JWT token in order of preference
            
            // 1. From request context (will be set by auth middleware in real requests)
            if (process.env.CURRENT_USER_JWT) {
                this.logger.debug('Using current user JWT for Principal Propagation');
                return process.env.CURRENT_USER_JWT;
            }
            
            // 2. From auth session (for web-based requests through admin dashboard)
            if (process.env.AUTH_SESSION_JWT) {
                this.logger.debug('Using auth session JWT for Principal Propagation');
                return process.env.AUTH_SESSION_JWT;
            }
            
            // 3. Fallback to technical user JWT (not ideal for Principal Propagation)
            if (process.env.USER_JWT) {
                this.logger.debug('Using technical user JWT as fallback for runtime operations');
                return process.env.USER_JWT;
            }
            
            // 4. No JWT available - destination will fallback to BasicAuth if configured
            this.logger.info('No JWT token available for runtime destination - will use BasicAuthentication fallback if configured');
            return undefined;
        } else {
            // For design-time operations, technical user is usually fine
            // These operations typically don't require Principal Propagation
            const jwt = process.env.USER_JWT || process.env.TECHNICAL_USER_JWT;
            if (jwt) {
                this.logger.debug('Using technical user JWT for design-time operations');
            }
            return jwt;
        }
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