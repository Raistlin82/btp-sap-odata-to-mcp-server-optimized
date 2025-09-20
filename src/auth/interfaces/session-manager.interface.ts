/**
 * Session management interface for secure session handling
 */

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}

export interface Session {
  id: string;
  userId: string;
  userInfo: UserInfo;
  token: string;
  scopes: string[];
  metadata: SessionMetadata;
}

export interface SessionCreateOptions {
  ttl?: number; // Time to live in seconds
  metadata?: Partial<SessionMetadata>;
}

/**
 * Session manager interface for handling user sessions
 */
export interface ISessionManager {
  /**
   * Create a new session
   */
  create(userInfo: UserInfo, token: string, options?: SessionCreateOptions): Promise<Session>;

  /**
   * Get session by ID
   */
  get(sessionId: string): Promise<Session | null>;

  /**
   * Update session (touch/extend)
   */
  update(sessionId: string, updates: Partial<Session>): Promise<void>;

  /**
   * Invalidate session
   */
  invalidate(sessionId: string, reason?: string): Promise<void>;

  /**
   * Invalidate all sessions for a user
   */
  invalidateAllForUser(userId: string, reason?: string): Promise<number>;

  /**
   * Clean up expired sessions
   */
  cleanup(): Promise<number>;

  /**
   * Get all active sessions for a user
   */
  getActiveSessionsForUser(userId: string): Promise<Session[]>;

  /**
   * Check if session is valid
   */
  isValid(sessionId: string): Promise<boolean>;

  /**
   * Extend session TTL
   */
  extend(sessionId: string, additionalTtl: number): Promise<void>;
}

import { UserInfo } from './auth-provider.interface.js';