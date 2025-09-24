import { Logger } from '../utils/logger.js';
import { CloudLoggingService } from './cloud-logging-service.js';
import { DestinationService } from './destination-service.js';
import { TokenStore } from './token-store.js';
import { IASAuthService } from './ias-auth-service.js';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  duration: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
  environment: {
    nodeEnv: string;
    region?: string;
    space?: string;
    organization?: string;
  };
}

/**
 * Comprehensive health monitoring service for SAP BTP deployment
 */
export class HealthService {
  private logger: Logger;
  private cloudLogging?: CloudLoggingService;
  private destinationService?: DestinationService;
  private tokenStore?: TokenStore;
  private authService?: IASAuthService;
  private startTime: number;

  constructor(
    cloudLogging?: CloudLoggingService,
    destinationService?: DestinationService,
    tokenStore?: TokenStore,
    authService?: IASAuthService
  ) {
    this.logger = new Logger('HealthService');
    this.cloudLogging = cloudLogging;
    this.destinationService = destinationService;
    this.tokenStore = tokenStore;
    this.authService = authService;
    this.startTime = Date.now();
  }

  /**
   * Kubernetes-compatible liveness probe
   * Should return 200 if the application is running (even if degraded)
   */
  async livenessProbe(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Basic application liveness - can we respond to requests?
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      // Check if memory usage is critically high (>90% of max heap)
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      if (heapUsedPercent > 90) {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          error: `Critical memory usage: ${heapUsedPercent.toFixed(1)}%`,
          details: { memoryUsage, uptime },
        };
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          uptime,
          memoryUsage: {
            heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
            heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`,
            heapUsedPercent: `${heapUsedPercent.toFixed(1)}%`,
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Kubernetes-compatible readiness probe
   * Should return 200 only when the application is ready to receive traffic
   */
  async readinessProbe(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const checks = await Promise.allSettled([
        this.checkDestinationService(),
        this.checkAuthenticationService(),
        this.checkTokenStore(),
      ]);

      const failedChecks = checks.filter((check, index) => {
        return (
          check.status === 'rejected' ||
          (check.status === 'fulfilled' && check.value.status === 'unhealthy')
        );
      });

      const status =
        failedChecks.length === 0 ? 'healthy' : failedChecks.length <= 1 ? 'degraded' : 'unhealthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          totalChecks: checks.length,
          failedChecks: failedChecks.length,
          checkedComponents: ['destination', 'authentication', 'tokenStore'],
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Comprehensive health check for monitoring and debugging
   */
  async deepHealthCheck(): Promise<SystemHealth> {
    const startTime = Date.now();

    const checks: Record<string, HealthCheckResult> = {};

    // Run all health checks in parallel
    const [liveness, destination, auth, tokenStore, cloudLogging, memory, vcap] =
      await Promise.allSettled([
        this.livenessProbe(),
        this.checkDestinationService(),
        this.checkAuthenticationService(),
        this.checkTokenStore(),
        this.checkCloudLogging(),
        this.checkMemoryUsage(),
        this.checkVCAPServices(),
      ]);

    // Collect results
    checks.liveness =
      liveness.status === 'fulfilled'
        ? liveness.value
        : this.createErrorResult('liveness', liveness.reason);
    checks.destination =
      destination.status === 'fulfilled'
        ? destination.value
        : this.createErrorResult('destination', destination.reason);
    checks.authentication =
      auth.status === 'fulfilled'
        ? auth.value
        : this.createErrorResult('authentication', auth.reason);
    checks.tokenStore =
      tokenStore.status === 'fulfilled'
        ? tokenStore.value
        : this.createErrorResult('tokenStore', tokenStore.reason);
    checks.cloudLogging =
      cloudLogging.status === 'fulfilled'
        ? cloudLogging.value
        : this.createErrorResult('cloudLogging', cloudLogging.reason);
    checks.memory =
      memory.status === 'fulfilled'
        ? memory.value
        : this.createErrorResult('memory', memory.reason);
    checks.vcapServices =
      vcap.status === 'fulfilled'
        ? vcap.value
        : this.createErrorResult('vcapServices', vcap.reason);

    // Determine overall health
    const healthyCount = Object.values(checks).filter(check => check.status === 'healthy').length;
    const degradedCount = Object.values(checks).filter(check => check.status === 'degraded').length;
    const unhealthyCount = Object.values(checks).filter(
      check => check.status === 'unhealthy'
    ).length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Log health check results
    this.cloudLogging?.logHealthEvent(
      'system',
      overall,
      `Health check completed: ${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy`,
      {
        duration: Date.now() - startTime,
        checkCount: Object.keys(checks).length,
      }
    );

    return {
      overall,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime,
      checks,
      environment: this.getEnvironmentInfo(),
    };
  }

  /**
   * Check destination service health
   */
  private async checkDestinationService(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.destinationService) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: { message: 'Destination service not initialized' },
      };
    }

    try {
      // Test both design-time and runtime destinations
      const [designTimeTest, runtimeTest] = await Promise.allSettled([
        this.destinationService.testDestination('design-time'),
        this.destinationService.testDestination('runtime'),
      ]);

      const designTimeOk = designTimeTest.status === 'fulfilled' && designTimeTest.value.available;
      const runtimeOk = runtimeTest.status === 'fulfilled' && runtimeTest.value.available;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (designTimeOk && runtimeOk) {
        status = 'healthy';
      } else if (designTimeOk || runtimeOk) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          designTime: designTimeOk,
          runtime: runtimeOk,
          designTimeError:
            designTimeTest.status === 'fulfilled' ? designTimeTest.value.error : 'Test failed',
          runtimeError:
            runtimeTest.status === 'fulfilled' ? runtimeTest.value.error : 'Test failed',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check authentication service health
   */
  private async checkAuthenticationService(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.authService) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: { message: 'Authentication service not initialized' },
      };
    }

    try {
      const isConfigured = this.authService.isProperlyConfigured();

      return {
        status: isConfigured ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          configured: isConfigured,
          hasCredentials: !!(process.env.SAP_IAS_CLIENT_ID && process.env.SAP_IAS_CLIENT_SECRET),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check token store health
   */
  private async checkTokenStore(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.tokenStore) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: { message: 'Token store not initialized' },
      };
    }

    try {
      const stats = await this.tokenStore.getStats();

      // Consider unhealthy if too many expired sessions (indicates cleanup issues)
      const expiredRatio = stats.expiredSessions / (stats.totalSessions || 1);

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (expiredRatio > 0.5) {
        status = 'unhealthy';
      } else if (expiredRatio > 0.2) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          totalSessions: stats.totalSessions,
          activeUsers: stats.activeUsers,
          expiredSessions: stats.expiredSessions,
          expiredRatio: `${(expiredRatio * 100).toFixed(1)}%`,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check cloud logging status
   */
  private async checkCloudLogging(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.cloudLogging) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: { message: 'Cloud logging not initialized' },
      };
    }

    try {
      const status = this.cloudLogging.getStatus();

      return {
        status: status.cloudLoggingAvailable ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: status,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (heapUsedPercent > 90) {
        status = 'unhealthy';
      } else if (heapUsedPercent > 75) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(1)}MB`,
          heapUsedPercent: `${heapUsedPercent.toFixed(1)}%`,
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(1)}MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(1)}MB`,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check VCAP services configuration
   */
  private async checkVCAPServices(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const vcapServices = process.env.VCAP_SERVICES ? JSON.parse(process.env.VCAP_SERVICES) : {};
      const vcapApplication = process.env.VCAP_APPLICATION
        ? JSON.parse(process.env.VCAP_APPLICATION)
        : {};

      const hasDestination = !!(vcapServices.destination || vcapServices['destination']);
      const hasXSUAA = !!(vcapServices.xsuaa || vcapServices['authorization']);
      const hasConnectivity = !!(vcapServices.connectivity || vcapServices['connectivity']);

      const serviceCount = Object.keys(vcapServices).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (hasDestination && hasXSUAA) {
        status = 'healthy';
      } else if (hasDestination || hasXSUAA || serviceCount > 0) {
        status = 'degraded';
      } else {
        status = 'degraded'; // Running locally or with env vars
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: {
          servicesCount: serviceCount,
          hasDestination,
          hasXSUAA,
          hasConnectivity,
          applicationName: vcapApplication.application_name,
          spaceId: vcapApplication.space_id,
          instanceIndex: vcapApplication.instance_index,
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        details: { message: 'VCAP services not available (local development)' },
      };
    }
  }

  /**
   * Get environment information
   */
  private getEnvironmentInfo(): SystemHealth['environment'] {
    try {
      const vcapApplication = process.env.VCAP_APPLICATION
        ? JSON.parse(process.env.VCAP_APPLICATION)
        : {};

      return {
        nodeEnv: process.env.NODE_ENV || 'development',
        region: vcapApplication.cf_api?.split('.')[1],
        space: vcapApplication.space_name,
        organization: vcapApplication.organization_name,
      };
    } catch {
      return {
        nodeEnv: process.env.NODE_ENV || 'development',
      };
    }
  }

  /**
   * Create error result for failed health checks
   */
  private createErrorResult(component: string, error: any): HealthCheckResult {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      duration: 0,
      error: error instanceof Error ? error.message : `${component} check failed`,
    };
  }
}
