import { z } from 'zod';
import { VALIDATION_LIMITS } from '../constants/timeouts.js';

/**
 * Validation schemas for MCP tool inputs to prevent injection attacks
 * and ensure data integrity
 */

// Common validation patterns
// Removed unused safeString schema
const entitySetName = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid entity set name');
const serviceName = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_\-./]*$/, 'Invalid service name');
const sessionId = z.string().uuid('Invalid session ID format');
// Removed unused safeUrl schema
const keyValue = z
  .string()
  .min(1)
  .max(500)
  .regex(/^[a-zA-Z0-9_\-'.\s]*$/, 'Invalid key value');

// OData specific patterns
const odataFilter = z
  .string()
  .max(2000)
  .regex(
    /^[a-zA-Z0-9_\s()'\-=<>!and or eq ne gt lt ge le contains startswith endswith,]*$/,
    'Invalid OData filter'
  );
const odataSelect = z
  .string()
  .max(VALIDATION_LIMITS.MAX_STRING_LENGTH)
  .regex(/^[a-zA-Z0-9_,\s]*$/, 'Invalid OData select');
const odataExpand = z
  .string()
  .max(VALIDATION_LIMITS.MAX_STRING_LENGTH)
  .regex(/^[a-zA-Z0-9_,\s/]*$/, 'Invalid OData expand');
const odataOrderBy = z
  .string()
  .max(500)
  .regex(
    /^[a-zA-Z0-9_,\s]+(?:\s+(asc|desc))?(?:,\s*[a-zA-Z0-9_]+(?:\s+(asc|desc))?)*$/,
    'Invalid OData orderBy'
  );

/**
 * Schema for service discovery operations
 */
export const ServiceDiscoverySchema = z.object({
  pattern: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_\-*?.[\]]*$/, 'Invalid pattern')
    .optional(),
  maxResults: z.number().int().min(1).max(100).optional(),
  includeMetadata: z.boolean().optional(),
});

/**
 * Schema for entity discovery operations
 */
export const EntityDiscoverySchema = z.object({
  serviceId: serviceName,
  entityPattern: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_\-*?.[\]]*$/, 'Invalid entity pattern')
    .optional(),
  includeProperties: z.boolean().optional(),
  includeNavigations: z.boolean().optional(),
});

/**
 * Schema for entity schema operations
 */
export const EntitySchemaSchema = z.object({
  serviceId: serviceName,
  entityName: entitySetName,
  includeNavigations: z.boolean().optional(),
  includeConstraints: z.boolean().optional(),
});

/**
 * Schema for entity read operations
 */
export const EntityReadSchema = z.object({
  serviceId: serviceName,
  entitySet: entitySetName,
  key: keyValue.optional(),
  $filter: odataFilter.optional(),
  $select: odataSelect.optional(),
  $expand: odataExpand.optional(),
  $orderby: odataOrderBy.optional(),
  $top: z.number().int().min(1).max(VALIDATION_LIMITS.MAX_STRING_LENGTH).optional(),
  $skip: z.number().int().min(0).max(10000).optional(),
  session_id: sessionId.optional(),
});

/**
 * Schema for entity creation operations
 */
export const EntityCreateSchema = z.object({
  serviceId: serviceName,
  entitySet: entitySetName,
  data: z
    .record(z.string().min(1).max(100), z.unknown())
    .refine(obj => Object.keys(obj).length <= 50, 'Too many properties in entity data'),
  session_id: sessionId.optional(),
});

/**
 * Schema for entity update operations
 */
export const EntityUpdateSchema = z.object({
  serviceId: serviceName,
  entitySet: entitySetName,
  key: keyValue,
  data: z
    .record(z.string().min(1).max(100), z.unknown())
    .refine(obj => Object.keys(obj).length <= 50, 'Too many properties in entity data'),
  session_id: sessionId.optional(),
});

/**
 * Schema for entity delete operations
 */
export const EntityDeleteSchema = z.object({
  serviceId: serviceName,
  entitySet: entitySetName,
  key: keyValue,
  session_id: sessionId.optional(),
});

/**
 * Schema for generic entity operations
 */
export const EntityOperationSchema = z.object({
  serviceId: serviceName,
  entitySet: entitySetName,
  operation: z.enum(['read', 'read-single', 'create', 'update', 'delete']),
  key: keyValue.optional(),
  data: z.record(z.string().min(1).max(100), z.unknown()).optional(),
  queryOptions: z
    .object({
      $filter: odataFilter.optional(),
      $select: odataSelect.optional(),
      $expand: odataExpand.optional(),
      $orderby: odataOrderBy.optional(),
      $top: z.number().int().min(1).max(VALIDATION_LIMITS.MAX_STRING_LENGTH).optional(),
      $skip: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
  session_id: sessionId.optional(),
});

/**
 * Schema for health check operations
 */
export const HealthCheckSchema = z.object({
  detailed: z.boolean().optional(),
  includeDestinations: z.boolean().optional(),
});

/**
 * Schema for system information requests
 */
export const SystemInfoSchema = z.object({
  includeConfig: z.boolean().optional(),
  includeDiagnostics: z.boolean().optional(),
});

/**
 * Schema map for different MCP tools
 */
export const ValidationSchemas = {
  // Discovery tools
  'search-sap-services': ServiceDiscoverySchema,
  'discover-service-entities': EntityDiscoverySchema,
  'get-entity-schema': EntitySchemaSchema,

  // CRUD operation tools
  'execute-entity-operation': EntityOperationSchema,
  'sap-odata-read': EntityReadSchema,
  'sap-odata-create': EntityCreateSchema,
  'sap-odata-update': EntityUpdateSchema,
  'sap-odata-delete': EntityDeleteSchema,

  // System tools
  'sap-health-check': HealthCheckSchema,
  'sap-system-info': SystemInfoSchema,
} as const;

/**
 * Validation result interface
 */
export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: z.ZodError;
  };
}

/**
 * Validate input against schema
 */
export function validateInput<T>(
  input: unknown,
  schema: z.ZodSchema<T>,
  context?: string
): ValidationResult<T> {
  try {
    const result = schema.parse(input);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid input${context ? ` for ${context}` : ''}: ${firstIssue?.message || 'Validation failed'}`,
          details: error,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation failed${context ? ` for ${context}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Validate MCP tool input
 */
export function validateMCPToolInput(toolName: string, input: unknown): ValidationResult {
  const schema = ValidationSchemas[toolName as keyof typeof ValidationSchemas];

  if (!schema) {
    // For tools without specific validation, perform basic sanitization
    return validateBasicInput(input, toolName);
  }

  return validateInput(input, schema as z.ZodSchema, toolName);
}

/**
 * Basic input validation for tools without specific schemas
 */
function validateBasicInput(input: unknown, context?: string): ValidationResult {
  if (input === null || input === undefined) {
    return { success: true, data: input };
  }

  if (typeof input === 'object') {
    try {
      // Check for common injection patterns
      const jsonStr = JSON.stringify(input);

      // Check for dangerous patterns
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /\$\{[^}]*\}/g, // Template injection
        /\{\{[^}]*\}\}/g, // Template injection
        /<\?php/gi,
        /<%[^%]*%>/g,
        /exec\s*\(/gi,
        /eval\s*\(/gi,
        /system\s*\(/gi,
        /\|\s*nc\s+/gi,
        /\|\s*sh\s*$/gi,
        /&&\s*\w+/g,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(jsonStr)) {
          return {
            success: false,
            error: {
              code: 'SECURITY_VIOLATION',
              message: `Potentially malicious input detected${context ? ` in ${context}` : ''}`,
            },
          };
        }
      }

      return { success: true, data: input };
    } catch (_error) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: `Invalid input format${context ? ` for ${context}` : ''}`,
        },
      };
    }
  }

  return { success: true, data: input };
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(
  input: string,
  maxLength = VALIDATION_LIMITS.DEFAULT_SANITIZE_LENGTH
): string {
  return input
    .slice(0, maxLength) // Truncate if too long
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>'"]/g, char => {
      // Escape HTML entities
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
      };
      return entities[char] || char;
    });
}
