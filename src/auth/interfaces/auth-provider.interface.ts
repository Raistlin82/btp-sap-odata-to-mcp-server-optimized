/**
 * Authentication provider interface for modular authentication
 * Allows easy replacement and testing of different auth providers
 */

export interface TokenData {
  token: string;
  user: string;
  scopes: string[];
  expiresAt: number;
  refreshToken?: string;
}

export interface ValidationResult {
  valid: boolean;
  userInfo?: UserInfo;
  error?: string;
}

export interface UserInfo {
  id: string;
  email?: string;
  name?: string;
  groups?: string[];
  scopes?: string[];
  metadata?: Record<string, any>;
}

export interface AuthCredentials {
  username?: string;
  password?: string;
  code?: string;
  redirectUri?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * Base authentication provider interface
 * All auth providers must implement this interface
 */
export interface IAuthProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Authenticate user with credentials
   */
  authenticate(credentials: AuthCredentials): Promise<TokenData>;

  /**
   * Validate a token
   */
  validate(token: string): Promise<ValidationResult>;

  /**
   * Refresh an expired token
   */
  refresh(refreshToken: string): Promise<TokenData>;

  /**
   * Get user information from token
   */
  getUserInfo(token: string): Promise<UserInfo>;

  /**
   * Revoke a token (optional)
   */
  revoke?(token: string): Promise<void>;

  /**
   * Get provider configuration
   */
  getConfiguration(): Record<string, any>;
}

/**
 * OAuth2 specific authentication provider
 */
export interface IOAuth2Provider extends IAuthProvider {
  /**
   * Generate authorization URL for OAuth2 flow
   */
  generateAuthorizationUrl(redirectUri: string, state?: string): string;

  /**
   * Exchange authorization code for tokens
   */
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenData>;

  /**
   * Get client credentials token (for app-to-app auth)
   */
  getClientCredentialsToken?(): Promise<TokenData>;
}