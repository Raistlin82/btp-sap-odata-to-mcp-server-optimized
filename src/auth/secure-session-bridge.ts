/**
 * Secure session bridge between MCP sessions and user authentication sessions
 * Replaces the unsafe global session management in index.ts
 */

import { ISessionManager, Session } from './interfaces/session-manager.interface.js';
import { UserInfo } from './interfaces/auth-provider.interface.js';
import { Logger } from '../utils/logger.js';
// Removed unused Messages import
import { randomUUID } from 'crypto';

export interface MCPSession {
  id: string;
  server: any; // MCPServer type
  transport: any; // StreamableHTTPServerTransport type
  createdAt: Date;
  userSessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Secure bridge between MCP protocol sessions and user authentication sessions
 */
export class SecureSessionBridge {
  private mcpSessions: Map<string, MCPSession> = new Map();
  private mcpToUserMapping: Map<string, string> = new Map();
  private userToMcpMapping: Map<string, Set<string>> = new Map();
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private logger: Logger;
  private sessionManager: ISessionManager;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(sessionManager: ISessionManager, logger?: Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger || new Logger('SecureSessionBridge');

    // Start automatic cleanup
    this.startAutoCleanup();
  }

  /**
   * Create new MCP session
   */
  async createMCPSession(
    server: any,
    transport: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    const sessionId = randomUUID();

    await this.acquireLock(sessionId);

    try {
      const mcpSession: MCPSession = {
        id: sessionId,
        server,
        transport,
        createdAt: new Date(),
        metadata,
      };

      this.mcpSessions.set(sessionId, mcpSession);

      this.logger.info(`MCP session created: ${sessionId}`);
      return sessionId;
    } finally {
      this.releaseLock(sessionId);
    }
  }

  /**
   * Associate MCP session with user session (secure)
   */
  async associateMCPSessionWithUser(mcpSessionId: string, userSessionId: string): Promise<void> {
    // Verify user session exists
    const userSession = await this.sessionManager.get(userSessionId);
    if (!userSession) {
      throw new Error(`User session not found: ${userSessionId}`);
    }

    await this.acquireLock(mcpSessionId);

    try {
      const mcpSession = this.mcpSessions.get(mcpSessionId);
      if (!mcpSession) {
        throw new Error(`MCP session not found: ${mcpSessionId}`);
      }

      // Check if MCP session is already associated
      if (mcpSession.userSessionId) {
        this.logger.warn(
          `MCP session ${mcpSessionId} already associated with user session ${mcpSession.userSessionId}`
        );
        return;
      }

      // Update MCP session
      mcpSession.userSessionId = userSessionId;
      this.mcpSessions.set(mcpSessionId, mcpSession);

      // Update mappings
      this.mcpToUserMapping.set(mcpSessionId, userSessionId);

      // Track user to MCP mappings
      if (!this.userToMcpMapping.has(userSessionId)) {
        this.userToMcpMapping.set(userSessionId, new Set());
      }
      this.userToMcpMapping.get(userSessionId)!.add(mcpSessionId);

      this.logger.info(
        `MCP session ${mcpSessionId} associated with user session ${userSessionId} ` +
          `(user: ${userSession.userInfo.id})`
      );
    } finally {
      this.releaseLock(mcpSessionId);
    }
  }

  /**
   * Get user session for MCP session
   */
  async getUserSessionForMCP(mcpSessionId: string): Promise<Session | null> {
    const userSessionId = this.mcpToUserMapping.get(mcpSessionId);
    if (!userSessionId) {
      return null;
    }

    return this.sessionManager.get(userSessionId);
  }

  /**
   * Get user info for MCP session
   */
  async getUserInfoForMCP(mcpSessionId: string): Promise<UserInfo | null> {
    const userSession = await this.getUserSessionForMCP(mcpSessionId);
    return userSession?.userInfo || null;
  }

  /**
   * Get all MCP sessions for user
   */
  getMCPSessionsForUser(userSessionId: string): MCPSession[] {
    const mcpSessionIds = this.userToMcpMapping.get(userSessionId);
    if (!mcpSessionIds) {
      return [];
    }

    const mcpSessions: MCPSession[] = [];
    for (const mcpSessionId of mcpSessionIds) {
      const session = this.mcpSessions.get(mcpSessionId);
      if (session) {
        mcpSessions.push(session);
      }
    }

    return mcpSessions;
  }

  /**
   * Auto-associate MCP session with user (for backward compatibility)
   */
  async createAutoAssociation(userSessionId: string): Promise<boolean> {
    // Find most recent unassociated MCP session
    let candidateSession: MCPSession | null = null;
    let candidateId: string | null = null;

    for (const [mcpSessionId, mcpSession] of this.mcpSessions.entries()) {
      if (!mcpSession.userSessionId) {
        if (!candidateSession || mcpSession.createdAt > candidateSession.createdAt) {
          candidateSession = mcpSession;
          candidateId = mcpSessionId;
        }
      }
    }

    if (candidateId && candidateSession) {
      try {
        await this.associateMCPSessionWithUser(candidateId, userSessionId);
        this.logger.info(
          `Auto-associated MCP session ${candidateId} with user session ${userSessionId}`
        );
        return true;
      } catch (error) {
        this.logger.error(`Auto-association failed:`, error);
        return false;
      }
    }

    return false;
  }

  /**
   * Get current user session (most recent associated)
   */
  async getCurrentUserSession(): Promise<Session | null> {
    let mostRecentSession: { userSessionId: string; createdAt: Date } | null = null;

    // Find most recent MCP session with user association
    for (const mcpSession of this.mcpSessions.values()) {
      if (mcpSession.userSessionId) {
        if (!mostRecentSession || mcpSession.createdAt > mostRecentSession.createdAt) {
          mostRecentSession = {
            userSessionId: mcpSession.userSessionId,
            createdAt: mcpSession.createdAt,
          };
        }
      }
    }

    if (mostRecentSession) {
      return this.sessionManager.get(mostRecentSession.userSessionId);
    }

    return null;
  }

  /**
   * Close MCP session
   */
  async closeMCPSession(mcpSessionId: string): Promise<void> {
    await this.acquireLock(mcpSessionId);

    try {
      const mcpSession = this.mcpSessions.get(mcpSessionId);
      if (!mcpSession) {
        return;
      }

      // Close transport
      if (mcpSession.transport && typeof mcpSession.transport.close === 'function') {
        mcpSession.transport.close();
      }

      // Remove from all mappings
      this.mcpSessions.delete(mcpSessionId);
      const userSessionId = this.mcpToUserMapping.get(mcpSessionId);

      if (userSessionId) {
        this.mcpToUserMapping.delete(mcpSessionId);

        const userMcpSessions = this.userToMcpMapping.get(userSessionId);
        if (userMcpSessions) {
          userMcpSessions.delete(mcpSessionId);
          if (userMcpSessions.size === 0) {
            this.userToMcpMapping.delete(userSessionId);
          }
        }
      }

      this.logger.info(`MCP session closed: ${mcpSessionId}`);
    } finally {
      this.releaseLock(mcpSessionId);
    }
  }

  /**
   * Clean up expired MCP sessions
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const expiredSessions: string[] = [];

    // Find expired MCP sessions
    for (const [mcpSessionId, mcpSession] of this.mcpSessions.entries()) {
      if (now - mcpSession.createdAt.getTime() > maxAge) {
        expiredSessions.push(mcpSessionId);
      }
    }

    // Close expired sessions
    for (const sessionId of expiredSessions) {
      await this.closeMCPSession(sessionId);
    }

    // Also cleanup user sessions
    await this.sessionManager.cleanup();

    if (expiredSessions.length > 0) {
      this.logger.info(`Cleaned up ${expiredSessions.length} expired MCP sessions`);
    }

    return expiredSessions.length;
  }

  /**
   * Invalidate all sessions for user
   */
  async invalidateUserSessions(userSessionId: string, reason?: string): Promise<void> {
    // Get all MCP sessions for user
    const mcpSessions = this.getMCPSessionsForUser(userSessionId);

    // Close all MCP sessions
    for (const mcpSession of mcpSessions) {
      await this.closeMCPSession(mcpSession.id);
    }

    // Invalidate user session
    await this.sessionManager.invalidate(userSessionId, reason);

    this.logger.info(
      `Invalidated user session ${userSessionId} and ${mcpSessions.length} MCP sessions` +
        (reason ? ` (${reason})` : '')
    );
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalMcpSessions: number;
    associatedMcpSessions: number;
    unassociatedMcpSessions: number;
    uniqueUsers: number;
  } {
    const totalMcpSessions = this.mcpSessions.size;
    const associatedMcpSessions = this.mcpToUserMapping.size;
    const unassociatedMcpSessions = totalMcpSessions - associatedMcpSessions;
    const uniqueUsers = this.userToMcpMapping.size;

    return {
      totalMcpSessions,
      associatedMcpSessions,
      unassociatedMcpSessions,
      uniqueUsers,
    };
  }

  /**
   * Check if MCP session is associated with valid user session
   */
  async isValidMCPSession(mcpSessionId: string): Promise<boolean> {
    const mcpSession = this.mcpSessions.get(mcpSessionId);
    if (!mcpSession) {
      return false;
    }

    // If not associated with user, it's still valid
    if (!mcpSession.userSessionId) {
      return true;
    }

    // Check if user session is still valid
    return this.sessionManager.isValid(mcpSession.userSessionId);
  }

  /**
   * Private helper: acquire lock
   */
  private async acquireLock(sessionId: string): Promise<void> {
    const existingLock = this.sessionLocks.get(sessionId);

    if (existingLock) {
      await existingLock;
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    this.sessionLocks.set(sessionId, lockPromise);
    (lockPromise as any).release = releaseLock!;
  }

  /**
   * Private helper: release lock
   */
  private releaseLock(sessionId: string): void {
    const lock = this.sessionLocks.get(sessionId);
    if (lock && (lock as any).release) {
      (lock as any).release();
      this.sessionLocks.delete(sessionId);
    }
  }

  /**
   * Start automatic cleanup
   */
  private startAutoCleanup(): void {
    // Cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(error => {
        this.logger.error('Session bridge cleanup failed:', error);
      });
    }, 600000);
  }

  /**
   * Stop automatic cleanup
   */
  public stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Shutdown cleanup
   */
  async shutdown(): Promise<void> {
    this.stopAutoCleanup();

    // Close all MCP sessions
    const sessionIds = Array.from(this.mcpSessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeMCPSession(sessionId);
    }

    this.logger.info('Session bridge shutdown completed');
  }
}
