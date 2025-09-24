/**
 * MCP Compatibility Module
 * Provides compatibility mode for generic MCP clients
 */

export interface CompatibilityOptions {
  /**
   * Enable simplified responses for legacy clients
   */
  simplifiedResponses?: boolean;

  /**
   * Disable UI suggestions in responses
   */
  disableUISuggestions?: boolean;

  /**
   * Use minimal formatting (no emoji, no markdown)
   */
  minimalFormatting?: boolean;

  /**
   * Maximum response length (characters)
   */
  maxResponseLength?: number;

  /**
   * List of client patterns that should use legacy/compatibility mode
   * All other clients receive full features by default
   */
  legacyClients?: string[];

  /**
   * Client identifier for custom handling
   */
  clientId?: string;
}

export class MCPCompatibilityManager {
  private static instance: MCPCompatibilityManager;
  private options: CompatibilityOptions = {};

  private constructor() {
    // Parse legacy clients list from environment (clients that need compatibility mode)
    const legacyClientsEnv = process.env.MCP_LEGACY_CLIENTS || 'cline,windsurf,inspector';
    const legacyClients = legacyClientsEnv
      .split(',')
      .map(client => client.trim().toLowerCase())
      .filter(client => client.length > 0);

    // Check environment for compatibility settings
    // Default behavior: Full features for ALL clients, except those in MCP_LEGACY_CLIENTS
    this.options = {
      simplifiedResponses: process.env.MCP_SIMPLIFIED_RESPONSES === 'true',
      disableUISuggestions: process.env.MCP_DISABLE_UI_SUGGESTIONS === 'true',
      minimalFormatting: process.env.MCP_MINIMAL_FORMATTING === 'true',
      maxResponseLength: process.env.MCP_MAX_RESPONSE_LENGTH
        ? parseInt(process.env.MCP_MAX_RESPONSE_LENGTH)
        : undefined,
      legacyClients,
    };
  }

  public static getInstance(): MCPCompatibilityManager {
    if (!MCPCompatibilityManager.instance) {
      MCPCompatibilityManager.instance = new MCPCompatibilityManager();
    }
    return MCPCompatibilityManager.instance;
  }

  /**
   * Detect client type from headers or connection info
   * Returns the first detected pattern or the full User-Agent for analysis
   */
  public detectClient(headers?: Record<string, string>): string {
    // Get user agent (case insensitive)
    const userAgent = (headers?.['user-agent'] || headers?.['User-Agent'] || '').toLowerCase();

    if (!userAgent) {
      return 'generic';
    }

    // Return the most specific match found, or the full user agent for pattern matching
    if (userAgent.includes('claude')) {
      return 'claude';
    }
    if (userAgent.includes('mcp-inspector')) {
      return 'inspector';
    }
    if (userAgent.includes('cline')) {
      return 'cline';
    }
    if (userAgent.includes('windsurf')) {
      return 'windsurf';
    }

    // Return the user agent for contains matching with MCP_FULL_FEATURE_CLIENTS
    return userAgent;
  }

  /**
   * Check if client should receive full features (inverted logic)
   * Uses contains logic to match User-Agent strings
   */
  public isFullFeatureClient(clientId?: string): boolean {
    if (!clientId) {
      // Default to full features for unknown clients
      return true;
    }

    const normalizedClientId = clientId.toLowerCase();

    // Check if client is in legacy list (should receive compatibility mode)
    const isLegacyClient =
      this.options.legacyClients?.some(pattern =>
        normalizedClientId.includes(pattern.toLowerCase())
      ) || false;

    // Return opposite: if NOT legacy, then full features
    return !isLegacyClient;
  }

  /**
   * Check if UI suggestions should be included
   */
  public shouldIncludeUISuggestions(clientId?: string): boolean {
    // If globally disabled, return false
    if (this.options.disableUISuggestions) {
      return false;
    }

    // If globally forced, return true
    if (process.env.MCP_FORCE_UI_SUGGESTIONS === 'true') {
      return true;
    }

    // For full-feature clients, include UI suggestions (ignore compatibility settings)
    return this.isFullFeatureClient(clientId);
  }

  /**
   * Format response based on client compatibility
   */
  public formatResponse(response: any, clientId?: string): any {
    // Full-feature clients get unmodified responses (ignore compatibility settings)
    if (this.isFullFeatureClient(clientId) && !this.options.simplifiedResponses) {
      return response;
    }

    // Non-full-feature clients get compatibility processing
    let simplified = response;

    if (typeof response === 'object' && response !== null) {
      simplified = { ...response };

      // Remove UI suggestions for non-full-feature clients (unless globally forced)
      if (!this.shouldIncludeUISuggestions(clientId)) {
        delete simplified.uiSuggestions;
        delete simplified.suggestions;
        delete simplified.recommendedTools;
        delete simplified.nextSteps;
      }

      // Apply minimal formatting for non-full-feature clients
      if (this.options.minimalFormatting || !this.isFullFeatureClient(clientId)) {
        if (simplified.description && simplified.description.length > 500) {
          simplified.description = simplified.description.substring(0, 497) + '...';
        }

        // Remove emoji from strings
        if (simplified.message) {
          simplified.message = this.removeEmoji(simplified.message);
        }
        if (simplified.status) {
          simplified.status = this.removeEmoji(simplified.status);
        }
      }

      // Limit response size
      if (this.options.maxResponseLength) {
        const responseStr = JSON.stringify(simplified);
        if (responseStr.length > this.options.maxResponseLength) {
          simplified = {
            ...simplified,
            truncated: true,
            originalSize: responseStr.length,
          };
        }
      }
    }

    return simplified;
  }

  /**
   * Remove emoji from text
   */
  private removeEmoji(text: string): string {
    return text
      .replace(
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
        ''
      )
      .trim();
  }

  /**
   * Simplify tool descriptions based on client compatibility
   */
  public simplifyToolDescription(description: string, clientId?: string): string {
    // Full-feature clients get full descriptions (unless globally configured otherwise)
    if (this.isFullFeatureClient(clientId) && !this.options.simplifiedResponses) {
      return description;
    }

    // Non-full-feature clients get simplified descriptions

    // Remove examples and complex formatting
    let simplified = description;

    // Remove code examples
    simplified = simplified.replace(/```[\s\S]*?```/g, '');

    // Remove emoji
    simplified = this.removeEmoji(simplified);

    // Remove excessive newlines
    simplified = simplified.replace(/\n{3,}/g, '\n\n');

    // Limit length
    if (simplified.length > 300) {
      simplified = simplified.substring(0, 297) + '...';
    }

    return simplified.trim();
  }

  /**
   * Get compatibility settings
   */
  public getSettings(): CompatibilityOptions {
    return { ...this.options };
  }

  /**
   * Update compatibility settings
   */
  public updateSettings(options: Partial<CompatibilityOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Helper function to wrap tool responses
 */
export function wrapToolResponse(response: any, toolName: string, clientId?: string): any {
  const manager = MCPCompatibilityManager.getInstance();

  // Full-feature clients get unwrapped responses (unless globally configured otherwise)
  const shouldWrapResponse =
    manager.getSettings().simplifiedResponses || !manager.isFullFeatureClient(clientId);

  if (shouldWrapResponse) {
    return {
      success: true,
      tool: toolName,
      data: manager.formatResponse(response, clientId),
      timestamp: new Date().toISOString(),
    };
  }

  // Full response for full-feature clients
  return response;
}

/**
 * Middleware for detecting client type
 */
export function detectClientMiddleware(req: any, res: any, next: any): void {
  const manager = MCPCompatibilityManager.getInstance();
  const clientId = manager.detectClient(req.headers);

  // Attach client info to request
  req.mcpClient = clientId;
  req.mcpCompatibility = manager.getSettings();

  next();
}
