/**
 * In-memory session manager implementation
 * Thread-safe session management with automatic cleanup
 */

import {
  ISessionManager,
  Session,
  SessionMetadata,
  SessionCreateOptions
} from '../interfaces/session-manager.interface.js';
import { UserInfo } from '../interfaces/auth-provider.interface.js';
import { Logger } from '../../utils/logger.js';
import { Messages } from '../../i18n/messages.js';
import { randomBytes } from 'crypto';

export class MemorySessionManager implements ISessionManager {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private logger: Logger;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTtl = 3600000; // 1 hour default TTL

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('MemorySessionManager');

    // Start automatic cleanup every 5 minutes
    this.startAutoCleanup();
  }

  /**
   * Create a new session with proper locking
   */
  async create(
    userInfo: UserInfo,
    token: string,
    options?: SessionCreateOptions
  ): Promise<Session> {
    const sessionId = this.generateSessionId();

    // Acquire lock for session creation
    await this.acquireLock(sessionId);

    try {
      const now = Date.now();
      const ttl = options?.ttl ? options.ttl * 1000 : this.defaultTtl;

      const metadata: SessionMetadata = {
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: now + ttl,
        ...options?.metadata
      };

      const session: Session = {
        id: sessionId,
        userId: userInfo.id,
        userInfo,
        token,
        scopes: userInfo.scopes || [],
        metadata
      };

      // Store session
      this.sessions.set(sessionId, session);

      // Track user sessions
      if (!this.userSessions.has(userInfo.id)) {
        this.userSessions.set(userInfo.id, new Set());
      }
      this.userSessions.get(userInfo.id)!.add(sessionId);

      this.logger.info(`${Messages.session.info.created}: ${sessionId} for user ${userInfo.id}`);

      return session;
    } finally {
      this.releaseLock(sessionId);
    }
  }

  /**
   * Get session by ID with validation
   */
  async get(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.metadata.expiresAt < Date.now()) {
      await this.invalidate(sessionId, 'Session expired');
      return null;
    }

    // Update last accessed time
    session.metadata.lastAccessedAt = Date.now();

    return session;
  }

  /**
   * Update session with locking
   */
  async update(sessionId: string, updates: Partial<Session>): Promise<void> {
    await this.acquireLock(sessionId);

    try {
      const session = this.sessions.get(sessionId);

      if (!session) {
        throw new Error(Messages.session.errors.notFound);
      }

      // Apply updates (excluding id and userId)
      if (updates.userInfo) session.userInfo = updates.userInfo;
      if (updates.token) session.token = updates.token;
      if (updates.scopes) session.scopes = updates.scopes;
      if (updates.metadata) {
        session.metadata = { ...session.metadata, ...updates.metadata };
      }

      session.metadata.lastAccessedAt = Date.now();
    } finally {
      this.releaseLock(sessionId);
    }
  }

  /**
   * Invalidate session with reason logging
   */
  async invalidate(sessionId: string, reason?: string): Promise<void> {
    await this.acquireLock(sessionId);

    try {
      const session = this.sessions.get(sessionId);

      if (!session) {
        return; // Already invalidated
      }

      // Remove from sessions map
      this.sessions.delete(sessionId);

      // Remove from user sessions
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }

      this.logger.info(
        `${Messages.session.info.invalidated}: ${sessionId} for user ${session.userId}` +
        (reason ? ` (${reason})` : '')
      );
    } finally {
      this.releaseLock(sessionId);
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllForUser(userId: string, reason?: string): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet || userSessionSet.size === 0) {
      return 0;
    }

    const sessionIds = Array.from(userSessionSet);
    let invalidatedCount = 0;

    // Invalidate each session
    for (const sessionId of sessionIds) {
      await this.invalidate(sessionId, reason);
      invalidatedCount++;
    }

    return invalidatedCount;
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    // Find expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.metadata.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    }

    // Invalidate expired sessions
    for (const sessionId of expiredSessions) {
      await this.invalidate(sessionId, 'Expired');
    }

    if (expiredSessions.length > 0) {
      this.logger.info(`${Messages.session.info.cleaned}: ${expiredSessions.length} expired sessions`);
    }

    return expiredSessions.length;
  }

  /**
   * Get all active sessions for a user
   */
  async getActiveSessionsForUser(userId: string): Promise<Session[]> {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet || userSessionSet.size === 0) {
      return [];
    }

    const sessions: Session[] = [];
    const now = Date.now();

    for (const sessionId of userSessionSet) {
      const session = this.sessions.get(sessionId);
      if (session && session.metadata.expiresAt > now) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Check if session is valid
   */
  async isValid(sessionId: string): Promise<boolean> {
    const session = await this.get(sessionId);
    return session !== null;
  }

  /**
   * Extend session TTL
   */
  async extend(sessionId: string, additionalTtl: number): Promise<void> {
    await this.acquireLock(sessionId);

    try {
      const session = this.sessions.get(sessionId);

      if (!session) {
        throw new Error(Messages.session.errors.notFound);
      }

      session.metadata.expiresAt += additionalTtl * 1000;
      session.metadata.lastAccessedAt = Date.now();

      this.logger.info(`${Messages.session.info.extended}: ${sessionId} by ${additionalTtl} seconds`);
    } finally {
      this.releaseLock(sessionId);
    }
  }

  /**
   * Generate cryptographically secure session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Acquire lock for session operations
   */
  private async acquireLock(sessionId: string): Promise<void> {
    const existingLock = this.sessionLocks.get(sessionId);

    if (existingLock) {
      // Wait for existing lock to release
      await existingLock;
    }

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.sessionLocks.set(sessionId, lockPromise);

    // Store release function for later use
    (lockPromise as any).release = releaseLock!;
  }

  /**
   * Release lock for session
   */
  private releaseLock(sessionId: string): void {
    const lock = this.sessionLocks.get(sessionId);

    if (lock && (lock as any).release) {
      (lock as any).release();
      this.sessionLocks.delete(sessionId);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error) => {
        this.logger.error(Messages.session.errors.cleanupFailed, error);
      });
    }, 300000);
  }

  /**
   * Stop automatic cleanup (for shutdown)
   */
  public stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session statistics
   */
  public getStats(): {
    totalSessions: number;
    totalUsers: number;
    avgSessionsPerUser: number;
  } {
    const totalSessions = this.sessions.size;
    const totalUsers = this.userSessions.size;
    const avgSessionsPerUser = totalUsers > 0 ? totalSessions / totalUsers : 0;

    return {
      totalSessions,
      totalUsers,
      avgSessionsPerUser
    };
  }
}