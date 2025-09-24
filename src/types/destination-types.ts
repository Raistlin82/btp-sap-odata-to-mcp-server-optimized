/**
 * Destination context types for dual destination architecture
 *
 * Design-time: Used for service discovery, metadata parsing, schema analysis
 * Runtime: Used for actual CRUD operations (Create, Read, Update, Delete)
 */

export type DestinationType = 'design-time' | 'runtime';

export type OperationType =
  | 'discovery' // Service discovery operations
  | 'metadata' // Metadata and schema parsing
  | 'create' // Create operations
  | 'read' // Read operations
  | 'update' // Update operations
  | 'delete'; // Delete operations

export interface DestinationContext {
  type: DestinationType;
  operation?: OperationType;
  serviceId?: string;
  entityName?: string;
  jwt?: string; // JWT token for Principal Propagation
  userId?: string; // Optional user ID for auditing
}

export interface DestinationConfig {
  designTimeDestination: string;
  runtimeDestination: string;
  useSingleDestination: boolean;
}

export interface DestinationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedConfig: DestinationConfig;
}

/**
 * Utility function to determine destination type based on operation
 */
export function getDestinationType(operation: OperationType): DestinationType {
  switch (operation) {
    case 'discovery':
    case 'metadata':
      return 'design-time';
    case 'create':
    case 'read':
    case 'update':
    case 'delete':
      return 'runtime';
    default:
      return 'runtime'; // Default to runtime for unknown operations
  }
}

/**
 * Check if operation requires runtime destination
 */
export function isRuntimeOperation(operation: OperationType): boolean {
  return getDestinationType(operation) === 'runtime';
}

/**
 * Check if operation requires design-time destination
 */
export function isDesignTimeOperation(operation: OperationType): boolean {
  return getDestinationType(operation) === 'design-time';
}
