import { Logger } from './logger.js';
import { NETWORK_TIMEOUTS } from '../constants/timeouts.js';

/**
 * Graceful shutdown manager to prevent memory leaks and ensure clean resource cleanup
 */
export class ShutdownManager {
  private logger: Logger;
  private shutdownCallbacks: Array<() => Promise<void> | void> = [];
  private intervals: Set<NodeJS.Timeout> = new Set();
  private isShuttingDown = false;
  private shutdownTimeout: NodeJS.Timeout | null = null;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('ShutdownManager');
    this.setupSignalHandlers();
  }

  /**
   * Register a cleanup callback to be executed during shutdown
   */
  registerCleanupCallback(callback: () => Promise<void> | void, name?: string): void {
    this.shutdownCallbacks.push(callback);
    if (name) {
      this.logger.debug(`Registered cleanup callback: ${name}`);
    }
  }

  /**
   * Register an interval to be tracked and cleared during shutdown
   */
  registerInterval(interval: NodeJS.Timeout, name?: string): NodeJS.Timeout {
    this.intervals.add(interval);
    if (name) {
      this.logger.debug(`Registered interval: ${name}`);
    }
    return interval;
  }

  /**
   * Unregister an interval (when manually cleared)
   */
  unregisterInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT signal, initiating graceful shutdown...');
      this.shutdown('SIGINT').catch(error => {
        this.logger.error('Error during SIGINT shutdown:', error);
        process.exit(1);
      });
    });

    // Handle SIGTERM (termination request)
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM signal, initiating graceful shutdown...');
      this.shutdown('SIGTERM').catch(error => {
        this.logger.error('Error during SIGTERM shutdown:', error);
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      this.logger.error('Uncaught exception:', error);
      this.shutdown('uncaughtException')
        .catch(shutdownError => {
          this.logger.error('Error during exception shutdown:', shutdownError);
        })
        .finally(() => {
          process.exit(1);
        });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled promise rejection:', { reason, promise });
      this.shutdown('unhandledRejection')
        .catch(shutdownError => {
          this.logger.error('Error during rejection shutdown:', shutdownError);
        })
        .finally(() => {
          process.exit(1);
        });
    });
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(reason: string): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress, ignoring additional shutdown request');
      return;
    }

    this.isShuttingDown = true;
    this.logger.info(`Starting graceful shutdown (reason: ${reason})...`);

    // Set a timeout to force exit if shutdown takes too long
    this.shutdownTimeout = setTimeout(() => {
      this.logger.error('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, NETWORK_TIMEOUTS.SHUTDOWN_TIMEOUT); // 30 seconds timeout

    try {
      // Clear all tracked intervals
      this.logger.info(`Clearing ${this.intervals.size} tracked intervals...`);
      for (const interval of this.intervals) {
        clearInterval(interval);
      }
      this.intervals.clear();

      // Execute cleanup callbacks
      this.logger.info(`Executing ${this.shutdownCallbacks.length} cleanup callbacks...`);
      const cleanupPromises = this.shutdownCallbacks.map(async (callback, index) => {
        try {
          await callback();
          this.logger.debug(`Cleanup callback ${index + 1} completed`);
        } catch (error) {
          this.logger.error(`Cleanup callback ${index + 1} failed:`, error);
        }
      });

      await Promise.all(cleanupPromises);

      // Clear the timeout since we completed successfully
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
        this.shutdownTimeout = null;
      }

      this.logger.info('Graceful shutdown completed successfully');

      // Exit gracefully
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);

      // Clear the timeout
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
        this.shutdownTimeout = null;
      }

      process.exit(1);
    }
  }

  /**
   * Get shutdown status
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}
