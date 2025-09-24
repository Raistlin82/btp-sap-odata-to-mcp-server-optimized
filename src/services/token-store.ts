import { randomUUID } from 'node:crypto';
import { Logger } from '../utils/logger.js';
import { TokenData } from './ias-auth-service.js';
import { SESSION_LIFETIMES } from '../constants/timeouts.js';

export interface StoredTokenData extends TokenData {
  sessionId: string;
  createdAt: number;
  lastUsedAt: number;
  clientInfo?: {
    userAgent?: string;
    clientId?: string;
    ipAddress?: string;
  };
}

/**
 * In-memory token store with optional Redis backing
 * For production, consider using Redis or database for persistence
 */
export class TokenStore {
  private tokens = new Map<string, StoredTokenData>();
  private userSessions = new Map<string, string[]>(); // user -> sessionIds[]
  private logger: Logger;
  private cleanupInterval: NodeJS.Timeout;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('TokenStore');

    // Clean up expired tokens every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, SESSION_LIFETIMES.TOKEN_CLEANUP_INTERVAL);
  }

  /**
   * Store a new token with generated or custom session ID
   * For MCP clients, allow multiple sessions per user to prevent frequent re-authentication
   */
  async set(tokenData: TokenData, clientInfo?: any, customSessionId?: string): Promise<string> {
    const sessionId = customSessionId || randomUUID();

    // For MCP clients, don't remove previous sessions to avoid frequent re-authentication issues
    // Only clean up when sessions are actually expired to improve user experience
    const isMCPClient =
      clientInfo?.userAgent?.toLowerCase().includes('mcp') ||
      clientInfo?.clientId?.toLowerCase().includes('mcp') ||
      clientInfo?.userAgent?.toLowerCase().includes('claude') ||
      clientInfo?.userAgent?.toLowerCase().includes('copilot');

    if (!isMCPClient && clientInfo?.clientId) {
      // Only for non-MCP clients, maintain single session per client
      await this.removePreviousClientSessions(tokenData.user, clientInfo.clientId);
    }

    const storedTokenData: StoredTokenData = {
      ...tokenData,
      sessionId,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      clientInfo: {
        userAgent: clientInfo?.userAgent,
        clientId: clientInfo?.clientId,
        ipAddress: clientInfo?.ipAddress,
      },
    };

    this.tokens.set(sessionId, storedTokenData);

    // Track sessions per user (can be multiple for different clients)
    const userSessions = this.userSessions.get(tokenData.user) || [];
    userSessions.push(sessionId);
    this.userSessions.set(tokenData.user, userSessions);

    const clientId = clientInfo?.clientId || clientInfo?.userAgent || 'unknown';
    this.logger.info(
      `New session created for user: ${tokenData.user}, client: ${clientId}, session: ${sessionId}`
    );

    // TODO: In production, also store in Redis/database
    // await this.storeInRedis(sessionId, storedTokenData);

    return sessionId;
  }

  /**
   * Get token by session ID
   */
  async get(sessionId: string): Promise<StoredTokenData | null> {
    const tokenData = this.tokens.get(sessionId);

    if (!tokenData) {
      // TODO: In production, check Redis/database as fallback
      // const redisData = await this.getFromRedis(sessionId);
      // if (redisData) {
      //   this.tokens.set(sessionId, redisData); // Cache in memory
      //   return redisData;
      // }
      return null;
    }

    // Check if token is expired
    if (tokenData.expiresAt <= Date.now()) {
      this.logger.warn(`Token expired for session: ${sessionId}`);
      await this.remove(sessionId);
      return null;
    }

    // Update last used timestamp
    tokenData.lastUsedAt = Date.now();
    this.tokens.set(sessionId, tokenData);

    return tokenData;
  }

  /**
   * Get all sessions for a user
   */
  async getByUser(username: string): Promise<StoredTokenData[]> {
    const sessionIds = this.userSessions.get(username) || [];
    const validTokens: StoredTokenData[] = [];

    for (const sessionId of sessionIds) {
      const tokenData = await this.get(sessionId);
      if (tokenData) {
        validTokens.push(tokenData);
      }
    }

    return validTokens;
  }

  /**
   * Get token by client information (for web clients)
   */
  async getByClientId(clientId: string): Promise<StoredTokenData | null> {
    for (const [sessionId, tokenData] of this.tokens.entries()) {
      if (tokenData.clientInfo?.clientId === clientId) {
        // Check if token is still valid
        const validToken = await this.get(sessionId);
        return validToken;
      }
    }
    return null;
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(sessionId: string): Promise<boolean> {
    const tokenData = this.tokens.get(sessionId);
    if (tokenData) {
      tokenData.lastUsedAt = Date.now();
      this.tokens.set(sessionId, tokenData);
      return true;
    }
    return false;
  }

  /**
   * Update token data (e.g., after refresh)
   */
  async update(sessionId: string, tokenData: TokenData): Promise<boolean> {
    const existingData = this.tokens.get(sessionId);

    if (!existingData) {
      this.logger.warn(`Attempted to update non-existent session: ${sessionId}`);
      return false;
    }

    const updatedData: StoredTokenData = {
      ...existingData,
      ...tokenData,
      sessionId, // Keep original session ID
      lastUsedAt: Date.now(),
    };

    this.tokens.set(sessionId, updatedData);
    this.logger.info(`Token updated for session: ${sessionId}`);

    // TODO: Update in Redis/database
    // await this.storeInRedis(sessionId, updatedData);

    return true;
  }

  /**
   * Remove token by session ID
   */
  async remove(sessionId: string): Promise<boolean> {
    const tokenData = this.tokens.get(sessionId);

    if (!tokenData) {
      return false;
    }

    // Remove from main store
    this.tokens.delete(sessionId);

    // Remove from user sessions
    const userSessions = this.userSessions.get(tokenData.user) || [];
    const updatedSessions = userSessions.filter(id => id !== sessionId);

    if (updatedSessions.length === 0) {
      this.userSessions.delete(tokenData.user);
    } else {
      this.userSessions.set(tokenData.user, updatedSessions);
    }

    this.logger.info(`Token removed for session: ${sessionId}`);

    // TODO: Remove from Redis/database
    // await this.removeFromRedis(sessionId);

    return true;
  }

  /**
   * Remove all tokens for a user (logout all sessions)
   */
  async removeByUser(username: string): Promise<number> {
    const sessionIds = this.userSessions.get(username) || [];
    let removedCount = 0;

    for (const sessionId of sessionIds) {
      if (await this.remove(sessionId)) {
        removedCount++;
      }
    }

    this.logger.info(`Removed ${removedCount} sessions for user: ${username}`);
    return removedCount;
  }

  /**
   * Remove previous sessions for a user but keep global sessions
   */
  async removeUserSessions(username: string): Promise<number> {
    const sessionIds = this.userSessions.get(username) || [];
    let removedCount = 0;

    for (const sessionId of sessionIds) {
      // Don't remove global sessions
      if (sessionId !== 'global_user_auth') {
        if (await this.remove(sessionId)) {
          removedCount++;
        }
      }
    }

    this.logger.info(`Cleaned up ${removedCount} previous sessions for user: ${username}`);
    return removedCount;
  }

  /**
   * Remove ALL sessions for a user (for single session logic)
   */
  async removeAllUserSessions(username: string): Promise<number> {
    const sessionIds = this.userSessions.get(username) || [];
    let removedCount = 0;

    for (const sessionId of sessionIds) {
      if (await this.remove(sessionId)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.info(
        `Removed ${removedCount} existing sessions for user: ${username} (single session policy)`
      );
    }
    return removedCount;
  }

  /**
   * Remove previous sessions for the same user+client combination
   */
  async removePreviousClientSessions(username: string, clientIdentifier: string): Promise<number> {
    const sessionIds = this.userSessions.get(username) || [];
    let removedCount = 0;

    for (const sessionId of sessionIds) {
      const tokenData = this.tokens.get(sessionId);
      if (
        tokenData &&
        (tokenData.clientInfo?.clientId === clientIdentifier ||
          tokenData.clientInfo?.userAgent === clientIdentifier)
      ) {
        if (await this.remove(sessionId)) {
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      this.logger.info(
        `Removed ${removedCount} previous sessions for user: ${username}, client: ${clientIdentifier}`
      );
    }
    return removedCount;
  }

  /**
   * Check if a session exists and is valid
   */
  async exists(sessionId: string): Promise<boolean> {
    const tokenData = await this.get(sessionId);
    return tokenData !== null;
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  async getAllSessions(): Promise<StoredTokenData[]> {
    const activeSessions: StoredTokenData[] = [];

    for (const [sessionId] of this.tokens.entries()) {
      const tokenData = await this.get(sessionId);
      if (tokenData) {
        activeSessions.push(tokenData);
      }
    }

    return activeSessions;
  }

  /**
   * Get session statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeUsers: number;
    expiredSessions: number;
    oldestSession: number | null;
    newestSession: number | null;
  }> {
    const allSessions = await this.getAllSessions();
    const now = Date.now();
    let expiredCount = 0;
    let oldestSession: number | null = null;
    let newestSession: number | null = null;

    // Count expired sessions in the map
    for (const [, tokenData] of this.tokens.entries()) {
      if (tokenData.expiresAt <= now) {
        expiredCount++;
      } else {
        if (!oldestSession || tokenData.createdAt < oldestSession) {
          oldestSession = tokenData.createdAt;
        }
        if (!newestSession || tokenData.createdAt > newestSession) {
          newestSession = tokenData.createdAt;
        }
      }
    }

    return {
      totalSessions: this.tokens.size,
      activeUsers: this.userSessions.size,
      expiredSessions: expiredCount,
      oldestSession,
      newestSession,
    };
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, tokenData] of this.tokens.entries()) {
      if (tokenData.expiresAt <= now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.remove(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Shutdown the token store
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.tokens.clear();
    this.userSessions.clear();
    this.logger.info('Token store shut down');
  }

  // TODO: Redis integration methods for production
  // private async storeInRedis(sessionId: string, tokenData: StoredTokenData): Promise<void> {
  //   // Implementation for Redis storage
  // }

  // private async getFromRedis(sessionId: string): Promise<StoredTokenData | null> {
  //   // Implementation for Redis retrieval
  // }

  // private async removeFromRedis(sessionId: string): Promise<void> {
  //   // Implementation for Redis removal
  // }
}
