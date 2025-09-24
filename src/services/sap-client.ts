import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { HttpDestination } from '@sap-cloud-sdk/connectivity';
import { DestinationService } from './destination-service.js';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import {
  DestinationContext,
  OperationType,
  isRuntimeOperation,
} from '../types/destination-types.js';

export class SAPClient {
  private designTimeDestination: HttpDestination | null = null;
  private runtimeDestination: HttpDestination | null = null;
  private config: Config;

  constructor(
    private destinationService: DestinationService,
    private logger: Logger
  ) {
    this.config = new Config();
  }

  /**
   * Get destination based on operation context
   */
  async getDestination(context: DestinationContext): Promise<HttpDestination> {
    const isRuntime = context.type === 'runtime' || isRuntimeOperation(context.operation!);

    if (isRuntime) {
      if (!this.runtimeDestination) {
        this.runtimeDestination = await this.destinationService.getRuntimeDestination(context);
      }
      return this.runtimeDestination;
    } else {
      if (!this.designTimeDestination) {
        this.designTimeDestination =
          await this.destinationService.getDesignTimeDestination(context);
      }
      return this.designTimeDestination;
    }
  }

  /**
   * Get destination with JWT token passed directly (thread-safe)
   */
  async getDestinationWithJWT(context: DestinationContext, jwt?: string): Promise<HttpDestination> {
    // For thread-safety, always fetch fresh destination when JWT is involved
    return await this.destinationService.getDestinationWithJWT(context, jwt);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use context-aware methods instead
   */
  async getDestination_legacy(): Promise<HttpDestination> {
    return this.getDestination({ type: 'design-time', operation: 'discovery' });
  }

  /**
   * Execute HTTP request with context-aware destination selection and JWT handling
   */
  async executeRequest(options: {
    url: string;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    data?: unknown;
    headers?: Record<string, string>;
    context?: DestinationContext;
    operation?: OperationType;
    jwt?: string; // JWT token for Principal Propagation
  }) {
    // Determine operation context
    const context = options.context || {
      type: this.getDestinationTypeForMethod(options.method),
      operation: options.operation || this.getOperationForMethod(options.method),
    };

    try {
      // Pass JWT directly to destination service - no global environment variables
      const destination = await this.getDestinationWithJWT(context, options.jwt);

      const requestOptions = {
        method: options.method,
        url: options.url,
        data: options.data,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
      };

      this.logger.debug(`Executing ${options.method} request to ${options.url}`);

      if (!destination.url) {
        throw new Error('Destination URL is not configured');
      }

      const response = await executeHttpRequest(destination as HttpDestination, requestOptions);

      this.logger.debug(`Request completed successfully`);
      return response;
    } catch (error) {
      this.logger.error(`Request failed:`, error);
      throw this.handleError(error);
    }
    // No cleanup needed - JWT passed directly without global variables
  }

  async readEntitySet(
    servicePath: string,
    entitySet: string,
    queryOptions?: {
      $filter?: string;
      $select?: string;
      $expand?: string;
      $orderby?: string;
      $top?: number;
      $skip?: number;
    }
  ) {
    let url = `${servicePath}${entitySet}`;

    if (queryOptions) {
      const params = new URLSearchParams();
      Object.entries(queryOptions).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });

      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }

    return this.executeRequest({
      method: 'GET',
      url,
    });
  }

  async readEntity(servicePath: string, entitySet: string, key: string) {
    const url = `${servicePath}${entitySet}('${key}')`;

    return this.executeRequest({
      method: 'GET',
      url,
    });
  }

  async createEntity(servicePath: string, entitySet: string, data: unknown) {
    const url = `${servicePath}${entitySet}`;

    return this.executeRequest({
      method: 'POST',
      url,
      data,
    });
  }

  async updateEntity(servicePath: string, entitySet: string, key: string, data: unknown) {
    const url = `${servicePath}${entitySet}('${key}')`;

    return this.executeRequest({
      method: 'PATCH',
      url,
      data,
    });
  }

  async deleteEntity(servicePath: string, entitySet: string, key: string) {
    const url = `${servicePath}${entitySet}('${key}')`;

    return this.executeRequest({
      method: 'DELETE',
      url,
    });
  }

  /**
   * Determine destination type based on HTTP method
   */
  private getDestinationTypeForMethod(method: string): 'design-time' | 'runtime' {
    // GET methods for metadata/discovery use design-time
    // All other methods (POST, PATCH, PUT, DELETE) use runtime
    return method === 'GET' ? 'design-time' : 'runtime';
  }

  /**
   * Determine operation type based on HTTP method
   */
  private getOperationForMethod(method: string): OperationType {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'read';
      case 'POST':
        return 'create';
      case 'PATCH':
      case 'PUT':
        return 'update';
      case 'DELETE':
        return 'delete';
      default:
        return 'read';
    }
  }

  /**
   * Execute discovery operations (uses design-time destination)
   */
  async discoverServices(): Promise<any> {
    return this.executeRequest({
      url: '/sap/opu/odata/IWFND/CATALOGSERVICE/',
      method: 'GET',
      context: {
        type: 'design-time',
        operation: 'discovery',
      },
    });
  }

  /**
   * Get metadata for a service (uses design-time destination)
   */
  async getMetadata(servicePath: string): Promise<any> {
    return this.executeRequest({
      url: `${servicePath}$metadata`,
      method: 'GET',
      context: {
        type: 'design-time',
        operation: 'metadata',
      },
    });
  }

  /**
   * Execute CRUD operations (uses runtime destination with Principal Propagation support)
   */
  async executeCRUDOperation(
    operation: OperationType,
    url: string,
    data?: unknown,
    jwt?: string
  ): Promise<any> {
    const method = this.getHttpMethodForOperation(operation);
    return this.executeRequest({
      url,
      method,
      data,
      jwt, // Forward JWT for Principal Propagation
      context: {
        type: 'runtime',
        operation,
      },
    });
  }

  /**
   * Get HTTP method for CRUD operation
   */
  private getHttpMethodForOperation(operation: OperationType): 'GET' | 'POST' | 'PATCH' | 'DELETE' {
    switch (operation) {
      case 'read':
        return 'GET';
      case 'create':
        return 'POST';
      case 'update':
        return 'PATCH';
      case 'delete':
        return 'DELETE';
      default:
        return 'GET';
    }
  }

  /**
   * Clear cached destinations (useful for configuration changes)
   */
  clearDestinationCache(): void {
    this.designTimeDestination = null;
    this.runtimeDestination = null;
    this.logger.info('Destination cache cleared');
  }

  private handleError(error: unknown): Error {
    if (
      typeof error === 'object' &&
      error !== null &&
      'rootCause' in error &&
      (
        error as {
          rootCause?: {
            response?: {
              status: number;
              data?: { error?: { message?: string } };
              statusText?: string;
            };
          };
        }
      ).rootCause?.response
    ) {
      const response = (
        error as {
          rootCause: {
            response: {
              status: number;
              data?: { error?: { message?: string } };
              statusText?: string;
            };
          };
        }
      ).rootCause.response;
      return new Error(
        `SAP API Error ${response.status}: ${response.data?.error?.message || response.statusText}`
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
