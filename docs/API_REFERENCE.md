# API Reference

> **Reference to Original Project**  
> This API reference extends the tools from [@lemaiwo](https://github.com/lemaiwo)'s [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with enhanced authentication and monitoring features.

## 📋 Overview

The SAP OData MCP Server provides a comprehensive API for interacting with SAP systems through the Model Context Protocol (MCP). This enhanced version includes advanced authentication, session management, and monitoring capabilities.

## 🔧 MCP Tools

### Tool Categories

| Category | Authentication | Description |
|----------|---------------|-------------|
| **Discovery Tools** | None | Public tools for service discovery and metadata |
| **Runtime Tools** | Session ID Required | Authenticated tools for data operations |
| **Administrative Tools** | Admin Role Required | Management and configuration tools |

## 🔍 Discovery Tools (Public Access)

### 1. search-sap-services

**Description**: Discover available SAP OData services across your landscape.

**Parameters**:
```typescript
interface SearchServicesParams {
  query?: string;           // Optional search query
  category?: string;        // Filter by service category
  type?: 'cloud' | 'onprem' | 'all'; // Filter by system type
  limit?: number;           // Maximum results (default: 50)
}
```

**Example Request**:
```json
{
  "tool": "search-sap-services",
  "arguments": {
    "query": "business partner",
    "category": "ERP",
    "type": "cloud",
    "limit": 10
  }
}
```

**Response**:
```json
{
  "services": [
    {
      "id": "s4hana-cloud-bp",
      "name": "SAP S/4HANA Cloud - Business Partner",
      "description": "Business Partner Master Data Management",
      "version": "2024.Q3",
      "type": "cloud",
      "category": "ERP", 
      "status": "active",
      "endpoints": {
        "odata_v2": "/sap/opu/odata/sap/API_BUSINESS_PARTNER/",
        "odata_v4": "/sap/opu/odata4/sap/api_business_partner/"
      },
      "entitySets": [
        {
          "name": "A_BusinessPartner",
          "description": "Business Partner Master Data",
          "operations": ["read", "create", "update", "delete"]
        }
      ]
    }
  ],
  "metadata": {
    "totalFound": 1,
    "query": "business partner",
    "filters": {
      "category": "ERP",
      "type": "cloud"
    }
  }
}
```

### 2. discover-service-entities

**Description**: Get detailed entity information for a specific SAP service.

**Parameters**:
```typescript
interface DiscoverEntitiesParams {
  serviceId: string;        // Required: Service identifier
  includeMetadata?: boolean; // Include detailed metadata (default: false)
  filter?: string;          // Filter entities by name pattern
}
```

**Example Request**:
```json
{
  "tool": "discover-service-entities",
  "arguments": {
    "serviceId": "s4hana-cloud-bp",
    "includeMetadata": true,
    "filter": "BusinessPartner*"
  }
}
```

**Response**:
```json
{
  "serviceId": "s4hana-cloud-bp",
  "serviceName": "SAP S/4HANA Cloud - Business Partner",
  "entities": [
    {
      "name": "A_BusinessPartner",
      "path": "/A_BusinessPartner",
      "description": "Business Partner Master Data",
      "operations": ["read", "create", "update", "delete"],
      "keyProperties": ["BusinessPartner"],
      "properties": [
        {
          "name": "BusinessPartner", 
          "type": "Edm.String",
          "maxLength": 10,
          "nullable": false,
          "isKey": true
        },
        {
          "name": "BusinessPartnerFullName",
          "type": "Edm.String", 
          "maxLength": 81,
          "nullable": true
        }
      ],
      "navigationProperties": [
        {
          "name": "to_BusinessPartnerAddress",
          "relationship": "A_BusinessPartner/to_BusinessPartnerAddress",
          "toRole": "A_BusinessPartnerAddress"
        }
      ]
    }
  ],
  "metadata": {
    "totalEntities": 1,
    "serviceVersion": "2024.Q3",
    "lastUpdated": "2025-09-11T10:00:00Z"
  }
}
```

### 3. get-entity-schema

**Description**: Retrieve comprehensive schema information for a specific entity.

**Parameters**:
```typescript
interface EntitySchemaParams {
  serviceId: string;        // Required: Service identifier
  entityName: string;       // Required: Entity name
  includeAnnotations?: boolean; // Include OData annotations (default: false)
  format?: 'json' | 'xml';  // Response format (default: 'json')
}
```

**Example Request**:
```json
{
  "tool": "get-entity-schema",
  "arguments": {
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner",
    "includeAnnotations": true
  }
}
```

**Response**:
```json
{
  "serviceId": "s4hana-cloud-bp",
  "entityName": "A_BusinessPartner",
  "schema": {
    "namespace": "API_BUSINESS_PARTNER",
    "entityType": "A_BusinessPartnerType",
    "entitySet": "A_BusinessPartner",
    "keys": ["BusinessPartner"],
    "properties": [
      {
        "name": "BusinessPartner",
        "type": "Edm.String",
        "maxLength": 10,
        "nullable": false,
        "annotations": {
          "sap:label": "Business Partner",
          "sap:quickinfo": "Business Partner Number"
        }
      }
    ],
    "navigationProperties": [
      {
        "name": "to_BusinessPartnerAddress",
        "type": "Collection(API_BUSINESS_PARTNER.A_BusinessPartnerAddressType)",
        "partner": "to_BusinessPartner"
      }
    ]
  },
  "metadata": {
    "schemaVersion": "1.0",
    "lastModified": "2025-09-11T10:00:00Z",
    "documentation": "https://api.sap.com/api/API_BUSINESS_PARTNER"
  }
}
```

## 🔐 Runtime Tools (Authentication Required)

### 4. execute-entity-operation

**Description**: Perform CRUD operations on SAP entities with user context and principal propagation.

**Authentication**: Requires valid Session ID

**Parameters**:
```typescript
interface EntityOperationParams {
  session_id: string;       // Required: User session ID
  serviceId: string;        // Required: Service identifier
  entityName: string;       // Required: Entity name
  operation: 'read' | 'read-single' | 'create' | 'update' | 'patch' | 'delete';
  key?: Record<string, any>; // Entity key for single operations
  data?: Record<string, any>; // Data payload for create/update
  queryOptions?: {
    $select?: string;       // Select specific fields
    $expand?: string;       // Expand navigation properties
    $filter?: string;       // Filter conditions
    $orderby?: string;      // Sort order
    $top?: number;          // Limit results
    $skip?: number;         // Skip results
    $count?: boolean;       // Include count
  };
}
```

#### Read Operations

**Read Multiple Entities**:
```json
{
  "tool": "execute-entity-operation",
  "arguments": {
    "session_id": "73846e14-1500-4a25-8217-1b2ceabf53e9",
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner",
    "operation": "read",
    "queryOptions": {
      "$select": "BusinessPartner,BusinessPartnerFullName",
      "$filter": "BusinessPartnerCategory eq '1'",
      "$top": 10,
      "$orderby": "BusinessPartnerFullName asc"
    }
  }
}
```

**Read Single Entity**:
```json
{
  "tool": "execute-entity-operation", 
  "arguments": {
    "session_id": "73846e14-1500-4a25-8217-1b2ceabf53e9",
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner",
    "operation": "read-single",
    "key": {
      "BusinessPartner": "0000100001"
    },
    "queryOptions": {
      "$expand": "to_BusinessPartnerAddress"
    }
  }
}
```

#### Create Operations

**Create Entity**:
```json
{
  "tool": "execute-entity-operation",
  "arguments": {
    "session_id": "73846e14-1500-4a25-8217-1b2ceabf53e9", 
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner",
    "operation": "create",
    "data": {
      "BusinessPartnerCategory": "1",
      "BusinessPartnerFullName": "John Doe Company",
      "BusinessPartnerIsBlocked": false
    }
  }
}
```

#### Update Operations

**Update Entity**:
```json
{
  "tool": "execute-entity-operation",
  "arguments": {
    "session_id": "73846e14-1500-4a25-8217-1b2ceabf53e9",
    "serviceId": "s4hana-cloud-bp", 
    "entityName": "A_BusinessPartner",
    "operation": "update",
    "key": {
      "BusinessPartner": "0000100001"
    },
    "data": {
      "BusinessPartnerFullName": "John Doe Industries",
      "BusinessPartnerIsBlocked": false
    }
  }
}
```

#### Delete Operations

**Delete Entity**:
```json
{
  "tool": "execute-entity-operation",
  "arguments": {
    "session_id": "73846e14-1500-4a25-8217-1b2ceabf53e9",
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner", 
    "operation": "delete",
    "key": {
      "BusinessPartner": "0000100001"
    }
  }
}
```

**Success Response**:
```json
{
  "success": true,
  "operation": "read",
  "entityName": "A_BusinessPartner",
  "data": [
    {
      "BusinessPartner": "0000100001",
      "BusinessPartnerFullName": "ACME Corporation",
      "BusinessPartnerCategory": "1",
      "BusinessPartnerIsBlocked": false
    }
  ],
  "metadata": {
    "count": 1,
    "hasMore": false,
    "executionTime": 245,
    "correlationId": "req-123-456-789"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "ENTITY_NOT_FOUND",
    "message": "Business Partner 0000100001 not found",
    "details": {
      "entityName": "A_BusinessPartner",
      "key": {"BusinessPartner": "0000100001"}
    }
  },
  "metadata": {
    "correlationId": "req-123-456-789",
    "timestamp": "2025-09-11T10:00:00Z"
  }
}
```

## 🔐 Authentication API

### Authentication Flow

#### 1. Get Authentication Instructions

**Request to any authenticated tool without Session ID**:
```json
{
  "tool": "execute-entity-operation",
  "arguments": {
    "serviceId": "s4hana-cloud-bp",
    "entityName": "A_BusinessPartner",
    "operation": "read"
  }
}
```

**Authentication Instructions Response**:
```json
{
  "authenticated": false,
  "error": {
    "code": "SESSION_ID_REQUIRED",
    "message": "Authentication required. Please provide your Session ID to use this tool.",
    "authUrl": "https://your-app.cfapps.region.hana.ondemand.com/auth/",
    "instructions": {
      "step1": "1. Open your browser and navigate to: https://your-app.cfapps.region.hana.ondemand.com/auth/",
      "step2": "2. Complete the SAP IAS authentication process", 
      "step3": "3. Copy the Session ID displayed on the success page",
      "web_method": {
        "step1": "Open browser: https://your-app.cfapps.region.hana.ondemand.com/auth/",
        "step2": "Complete SAP IAS authentication",
        "step3": "Copy the Session ID from the success page and provide it in your next request"
      },
      "quick_start": "To get your Session ID: Navigate to https://your-app.cfapps.region.hana.ondemand.com/auth/ → Authenticate → Copy Session ID → Use in MCP calls"
    }
  }
}
```

#### 2. Web Authentication Process

1. **Navigate to Auth URL**: `https://your-app.cfapps.region.hana.ondemand.com/auth/`
2. **Complete SAP IAS Login**: Standard OAuth2 flow with SAP Identity Authentication
3. **Receive Session ID**: Copy from the success page
4. **Use Session ID**: Include in all authenticated MCP tool calls

### Session Management

#### Session Information

**Endpoint**: `GET /auth/status`

**Response**:
```json
{
  "authenticated": true,
  "sessionId": "73846e14-1500-4a25-8217-1b2ceabf53e9",
  "user": {
    "id": "user123",
    "name": "John Doe", 
    "email": "john.doe@company.com",
    "roles": ["MCPUser"]
  },
  "scopes": ["read", "write"],
  "expiresAt": "2025-09-11T11:00:00Z",
  "remainingTime": 3600
}
```

## 📊 Health and Monitoring API

### Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-11T10:00:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "connectivity": {
      "status": "healthy",
      "responseTime": 150,
      "details": {
        "destinations": {
          "S4HANA_SYSTEM": "healthy",
          "SUCCESSFACTORS": "healthy"
        }
      }
    },
    "authentication": {
      "status": "healthy", 
      "details": {
        "iasService": "healthy",
        "xsuaaService": "healthy"
      }
    },
    "services": {
      "status": "healthy",
      "details": {
        "connectivity": "bound",
        "destination": "bound", 
        "xsuaa": "bound"
      }
    },
    "memory": {
      "status": "healthy",
      "usage": 0.65,
      "details": {
        "used": "330MB",
        "total": "512MB"
      }
    },
    "cloudLogging": {
      "status": "healthy", 
      "details": {
        "cloudLoggingAvailable": true,
        "serviceName": "btp-sap-odata-to-mcp-server"
      }
    }
  }
}
```

### System Information

**Endpoint**: `GET /system/info`

**Response**:
```json
{
  "application": {
    "name": "btp-sap-odata-to-mcp-server",
    "version": "1.0.0",
    "environment": "production",
    "buildDate": "2025-09-11T10:00:00Z"
  },
  "runtime": {
    "nodeVersion": "18.17.0",
    "platform": "linux",
    "memory": {
      "used": 345,
      "available": 512
    },
    "uptime": 86400
  },
  "services": {
    "discovered": 5,
    "healthy": 4,
    "degraded": 1,
    "unhealthy": 0
  },
  "sessions": {
    "active": 3,
    "total": 15
  }
}
```

## 🔧 Administrative API

### Session Management (Admin Only)

**List Active Sessions**:
```
GET /admin/sessions
Authorization: Bearer <admin-token>
```

**Terminate Session**:
```
DELETE /admin/sessions/{sessionId}
Authorization: Bearer <admin-token>
```

### Configuration Management

**Update Log Level**:
```
POST /admin/config/logging
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "level": "debug",
  "components": {
    "auth": "info",
    "tools": "debug"
  }
}
```

**Cache Management**:
```
POST /admin/cache/clear
Authorization: Bearer <admin-token>
```

## 📝 Error Codes Reference

### Authentication Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `SESSION_ID_REQUIRED` | No session ID provided | Follow authentication flow |
| `SESSION_EXPIRED` | Session has expired | Re-authenticate |
| `INVALID_SESSION` | Session ID is invalid | Re-authenticate |
| `INSUFFICIENT_PERMISSIONS` | User lacks required scopes | Contact administrator |

### Service Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `SERVICE_NOT_FOUND` | Service ID not found | Check service discovery |
| `ENTITY_NOT_FOUND` | Entity not found in service | Verify entity name |
| `DESTINATION_ERROR` | Destination configuration issue | Check BTP destination |
| `CONNECTIVITY_ERROR` | Connection to SAP system failed | Check system availability |

### Data Errors

| Code | Description | Resolution |
|------|-------------|------------|
| `VALIDATION_ERROR` | Request data validation failed | Check request format |
| `ODATA_ERROR` | OData service error | Check OData syntax |
| `PERMISSION_DENIED` | SAP system denied access | Check user authorizations |
| `ENTITY_LOCKED` | Entity is locked by another user | Retry later |

## 🔄 Rate Limiting

### Rate Limits

| Tool Category | Limit | Window | Scope |
|---------------|-------|--------|-------|
| Discovery Tools | 100 requests | 15 minutes | Per IP |
| Runtime Tools | 1000 requests | 15 minutes | Per Session |
| Admin Tools | 50 requests | 15 minutes | Per Admin User |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1631234567
X-RateLimit-Window: 900
```

## 🔍 Query Capabilities

### OData Query Options

| Option | Description | Example |
|--------|-------------|---------|
| `$select` | Select specific fields | `$select=BusinessPartner,BusinessPartnerFullName` |
| `$filter` | Filter results | `$filter=BusinessPartnerCategory eq '1'` |
| `$orderby` | Sort results | `$orderby=BusinessPartnerFullName asc` |
| `$top` | Limit results | `$top=10` |
| `$skip` | Skip results | `$skip=20` |
| `$expand` | Expand navigation properties | `$expand=to_BusinessPartnerAddress` |
| `$count` | Include total count | `$count=true` |

### Filter Operations

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `BusinessPartnerCategory eq '1'` |
| `ne` | Not equals | `BusinessPartnerCategory ne '2'` |
| `gt` | Greater than | `CreatedDate gt datetime'2025-01-01T00:00:00'` |
| `ge` | Greater than or equal | `CreatedDate ge datetime'2025-01-01T00:00:00'` |
| `lt` | Less than | `CreatedDate lt datetime'2025-12-31T23:59:59'` |
| `le` | Less than or equal | `CreatedDate le datetime'2025-12-31T23:59:59'` |
| `and` | Logical AND | `BusinessPartnerCategory eq '1' and IsBlocked eq false` |
| `or` | Logical OR | `BusinessPartnerCategory eq '1' or BusinessPartnerCategory eq '2'` |
| `not` | Logical NOT | `not IsBlocked` |

---

**📖 Related Documentation**:
- [Architecture Overview](ARCHITECTURE.md)
- [Configuration Guide](CONFIGURATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Troubleshooting](TROUBLESHOOTING.md)