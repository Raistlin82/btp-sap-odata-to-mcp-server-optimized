import xsenv from '@sap/xsenv';

export class Config {
    private config: Map<string, unknown> = new Map();

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

    private loadConfiguration(): void {
        // Load from environment variables
        this.config.set('sap.destinationName', process.env.SAP_DESTINATION_NAME || 'SAP_SYSTEM');
        this.config.set('request.timeout', parseInt(process.env.REQUEST_TIMEOUT || '30000'));
        this.config.set('request.retries', parseInt(process.env.REQUEST_RETRIES || '3'));
        this.config.set('log.level', process.env.LOG_LEVEL || 'info');
        this.config.set('node.env', process.env.NODE_ENV || 'development');
        
        // OData service discovery configuration
        this.loadODataServiceConfig();
        
        // Load configuration from CF services (user-provided services)
        this.loadFromCFServices();
        
        // Load from VCAP services if available
        try {
            xsenv.loadEnv();
            const vcapServices = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : {};
            this.config.set('vcap.services', vcapServices);
        } catch (error) {
            console.warn('Failed to load VCAP services:', error);
        }
    }

    private loadODataServiceConfig(): void {
        // OData service filtering configuration
        // Can be set via environment variables or will use defaults
        
        // Service patterns - supports glob patterns and regex
        const servicePatterns = process.env.ODATA_SERVICE_PATTERNS;
        if (servicePatterns) {
            try {
                // Try parsing as JSON array first
                const patterns = JSON.parse(servicePatterns);
                this.config.set('odata.servicePatterns', Array.isArray(patterns) ? patterns : [patterns]);
            } catch {
                // Fallback to comma-separated string
                this.config.set('odata.servicePatterns', servicePatterns.split(',').map(p => p.trim()));
            }
        } else {
            // Default patterns - include all services
            this.config.set('odata.servicePatterns', ['*']);
        }

        // Service exclusion patterns
        const exclusionPatterns = process.env.ODATA_EXCLUSION_PATTERNS;
        if (exclusionPatterns) {
            try {
                const patterns = JSON.parse(exclusionPatterns);
                this.config.set('odata.exclusionPatterns', Array.isArray(patterns) ? patterns : [patterns]);
            } catch {
                this.config.set('odata.exclusionPatterns', exclusionPatterns.split(',').map(p => p.trim()));
            }
        } else {
            this.config.set('odata.exclusionPatterns', []);
        }

        // Allow all services flag - if true, ignores patterns and includes all
        this.config.set('odata.allowAllServices', process.env.ODATA_ALLOW_ALL === 'true' || process.env.ODATA_ALLOW_ALL === '*');
        
        // Discovery mode: 'all', 'whitelist', 'regex'
        this.config.set('odata.discoveryMode', process.env.ODATA_DISCOVERY_MODE || 'whitelist');
        
        // Maximum services to discover (prevents overwhelming the system)
        this.config.set('odata.maxServices', parseInt(process.env.ODATA_MAX_SERVICES || '50'));
    }

    /**
     * Load configuration from Cloud Foundry user-provided services
     * Service name: 'odata-config' or 'mcp-odata-config'
     */
    private loadFromCFServices(): void {
        try {
            // Try to load from user-provided services
            const services = xsenv.getServices({
                odataConfig: { label: 'user-provided', name: 'odata-config' },
                mcpConfig: { label: 'user-provided', name: 'mcp-odata-config' }
            });

            // Check for odata-config service first
            let configService = services.odataConfig || services.mcpConfig;
            
            if (configService && (configService as any).credentials) {
                const creds = (configService as any).credentials;
                
                // Override OData configuration if provided in the service
                if (creds.ODATA_ALLOW_ALL !== undefined) {
                    this.config.set('odata.allowAllServices', creds.ODATA_ALLOW_ALL === 'true' || creds.ODATA_ALLOW_ALL === '*');
                }
                
                if (creds.ODATA_SERVICE_PATTERNS) {
                    try {
                        const patterns = typeof creds.ODATA_SERVICE_PATTERNS === 'string' 
                            ? JSON.parse(creds.ODATA_SERVICE_PATTERNS)
                            : creds.ODATA_SERVICE_PATTERNS;
                        this.config.set('odata.servicePatterns', Array.isArray(patterns) ? patterns : [patterns]);
                    } catch {
                        this.config.set('odata.servicePatterns', creds.ODATA_SERVICE_PATTERNS.split(',').map((p: string) => p.trim()));
                    }
                }
                
                if (creds.ODATA_EXCLUSION_PATTERNS) {
                    try {
                        const patterns = typeof creds.ODATA_EXCLUSION_PATTERNS === 'string'
                            ? JSON.parse(creds.ODATA_EXCLUSION_PATTERNS)
                            : creds.ODATA_EXCLUSION_PATTERNS;
                        this.config.set('odata.exclusionPatterns', Array.isArray(patterns) ? patterns : [patterns]);
                    } catch {
                        this.config.set('odata.exclusionPatterns', creds.ODATA_EXCLUSION_PATTERNS.split(',').map((p: string) => p.trim()));
                    }
                }
                
                if (creds.ODATA_DISCOVERY_MODE) {
                    this.config.set('odata.discoveryMode', creds.ODATA_DISCOVERY_MODE);
                }
                
                if (creds.ODATA_MAX_SERVICES) {
                    this.config.set('odata.maxServices', parseInt(creds.ODATA_MAX_SERVICES));
                }

                console.log('✅ Loaded OData configuration from CF user-provided service');
            }
        } catch (error) {
            // CF services not available or not configured - use environment variables
            console.log('ℹ️  CF user-provided services not available, using environment variables');
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
                console.warn(`Invalid regex pattern: ${pattern}`, error);
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
            console.warn(`Invalid glob pattern: ${pattern}`, error);
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
            maxServices: this.get('odata.maxServices', 50)
        };
    }
}