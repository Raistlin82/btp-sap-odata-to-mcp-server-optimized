# Configuration Guide

> **Reference to Original Project**  
> This configuration extends the setup from [@lemaiwo](https://github.com/lemaiwo)'s [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with additional enterprise features.

## 📋 Configuration Overview

The SAP OData MCP Server supports multiple configuration methods, optimized for different deployment scenarios:

1. **Environment Variables** - For Cloud Foundry and containerized deployments
2. **Configuration Files** - For local development and testing
3. **SAP BTP Service Bindings** - Automatic configuration via VCAP_SERVICES
4. **Runtime Configuration** - Dynamic configuration via API

## 🔧 Core Configuration

### Environment Variables

#### Required Variables

```bash
# SAP Identity Authentication Service (IAS)
SAP_IAS_URL=https://your-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=your-client-id
SAP_IAS_CLIENT_SECRET=your-client-secret

# Server Configuration  
PORT=8080
NODE_ENV=production

# Logging Configuration
LOG_LEVEL=info                    # debug, info, warn, error
SERVICE_NAME=btp-sap-odata-to-mcp-server
SERVICE_VERSION=1.0.0
```

#### Optional Variables

```bash
# Session Management
SESSION_TIMEOUT=3600000           # 1 hour in milliseconds
SESSION_CLEANUP_INTERVAL=300000   # 5 minutes
MAX_SESSIONS_PER_USER=1

# Security Configuration
JWT_EXPIRY=3600                   # JWT token expiry in seconds
CORS_ORIGINS=*                    # CORS allowed origins
SECURITY_HEADERS=true             # Enable security headers

# Performance Tuning
CACHE_TTL=1800000                 # Cache TTL in milliseconds (30 min)
CONNECTION_POOL_SIZE=10           # Max connections per destination
REQUEST_TIMEOUT=30000             # Request timeout in milliseconds
REQUEST_RETRIES=3                 # Number of retry attempts

# Authentication & Authorization
AUTH_PORT=3001                    # Authentication server port
XSUAA_XSAPPNAME=btp-sap-odata-to-mcp-server  # XSUAA app name
USER_JWT=                         # User JWT token (runtime)
TECHNICAL_USER_JWT=               # Technical user JWT token

# MCP Session Management
SAP_MCP_SESSION_ID=               # SAP MCP session identifier
MCP_SESSION_ID=                   # Generic MCP session identifier
SAP_SESSION_ID=                   # SAP session identifier

# MCP Authentication Tokens
SAP_BTP_JWT_TOKEN=                # SAP BTP JWT token
SAP_ACCESS_TOKEN=                 # SAP access token
MCP_AUTH_TOKEN=                   # MCP authentication token

# OData Service Discovery
ODATA_SERVICE_PATTERNS=           # Comma-separated service patterns to include
ODATA_EXCLUSION_PATTERNS=         # Comma-separated service patterns to exclude
ODATA_ALLOW_ALL=false            # Allow all OData services (override patterns)
ODATA_DISCOVERY_MODE=whitelist    # Discovery mode: whitelist, blacklist, all
ODATA_MAX_SERVICES=50            # Maximum number of services to discover

# SAP Destinations Configuration
SAP_DESTINATION_NAME=SAP_SYSTEM   # Primary destination name for design-time
SAP_DESTINATION_NAME_RT=SAP_SYSTEM_RT  # Runtime destination name
SAP_USE_SINGLE_DESTINATION=false  # Use single destination for both design/runtime
destinations=                     # JSON array of destination configurations (for local dev)

# Feature Flags
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true
ENABLE_AUDIT_LOGGING=true
DISABLE_READ_ENTITY_TOOL=false    # Disable read entity tool
```

### Configuration File (.env)

Create a `.env` file in the project root:

```bash
# Copy from template
cp .env.example .env

# Edit with your values
nano .env
```

**Example .env file:**

```env
# ===========================================
# SAP BTP OData MCP Server Configuration
# ===========================================

# SAP IAS Configuration
SAP_IAS_URL=https://afhdupfoc.accounts.ondemand.com
SAP_IAS_CLIENT_ID=955d133c-758b-42c7-b1a5-fa99cd5e6661
SAP_IAS_CLIENT_SECRET=your-secret-here

# Server Settings
PORT=8080
NODE_ENV=development
HOST=0.0.0.0

# Logging
LOG_LEVEL=debug
SERVICE_NAME=btp-sap-odata-to-mcp-server
SERVICE_VERSION=1.0.0

# Session Management
SESSION_TIMEOUT=3600000
MAX_SESSIONS_PER_USER=1

# Development Settings
ENABLE_CORS=true
ENABLE_DEBUG_ROUTES=true
HOT_RELOAD=true

# Role Collections (matches xs-security.json)
ROLE_COLLECTIONS=MCPAdministrator,MCPUser,MCPManager,MCPViewer
ROLE_TEMPLATES=MCPAdmin,MCPEditor,MCPManager,MCPViewer
ADMIN_ROLE_COLLECTION=MCPAdministrator
```

## 🔐 Authentication Configuration

### SAP Identity Authentication Service (IAS)

#### 1. IAS Application Setup

1. **Create Application in IAS**:
   ```
   Application Type: OpenID Connect
   Grant Type: Authorization Code
   ```

2. **Configure Redirect URLs**:
   ```
   Local: http://localhost:8080/auth/callback
   BTP: https://your-app.cfapps.region.hana.ondemand.com/auth/callback
   ```

3. **Set Application Scopes**:
   ```
   openid
   profile
   email
   groups
   ```

#### 2. Role Collections Setup

Configure role collections in BTP Cockpit (based on actual `xs-security.json`):

```yaml
Role Collections:
  - Name: MCPAdministrator
    Description: Full administrative access to SAP MCP OData Server
    Role Template: MCPAdmin
    Scopes:
      - read, write, delete, admin, discover

  - Name: MCPManager
    Description: Manager access with delete permissions
    Role Template: MCPManager
    Scopes:
      - read, write, delete, discover

  - Name: MCPUser
    Description: Standard user access to SAP MCP OData Server
    Role Template: MCPEditor
    Scopes:
      - read, write, discover

  - Name: MCPViewer
    Description: Read-only access to SAP MCP OData Server
    Role Template: MCPViewer
    Scopes:
      - read, discover
```

#### 3. XSUAA Service Configuration

**xs-security.json:**

```json
{
  "xsappname": "sap-mcp-server",
  "tenant-mode": "dedicated",
  "description": "SAP OData MCP Server Security",
  "scopes": [
    {
      "name": "$XSAPPNAME.read",
      "description": "Read access to SAP data"
    },
    {
      "name": "$XSAPPNAME.write", 
      "description": "Write access to SAP data"
    },
    {
      "name": "$XSAPPNAME.delete",
      "description": "Delete access to SAP data"
    },
    {
      "name": "$XSAPPNAME.admin",
      "description": "Administrative access"
    }
  ],
  "role-templates": [
    {
      "name": "MCPUser",
      "description": "Standard MCP User",
      "scope-references": [
        "$XSAPPNAME.read",
        "$XSAPPNAME.write"
      ]
    },
    {
      "name": "MCPAdmin",
      "description": "MCP Administrator", 
      "scope-references": [
        "$XSAPPNAME.read",
        "$XSAPPNAME.write",
        "$XSAPPNAME.delete",
        "$XSAPPNAME.admin"
      ]
    }
  ],
  "role-collections": [
    {
      "name": "MCPAdministrator",
      "description": "MCP Administrator Collection",
      "role-template-references": [
        "$XSAPPNAME.MCPAdmin"
      ]
    },
    {
      "name": "MCPUser", 
      "description": "MCP User Collection",
      "role-template-references": [
        "$XSAPPNAME.MCPUser"
      ]
    }
  ]
}
```

## 🌐 Service Discovery Configuration

### Service Discovery Config

**Location**: `src/config/service-discovery-config.json`

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-09-11T10:00:00Z",
  "services": [
    {
      "id": "s4hana-cloud",
      "name": "SAP S/4HANA Cloud",
      "description": "Enterprise Resource Planning",
      "version": "2024.Q3",
      "type": "cloud",
      "category": "ERP",
      "status": "active",
      "endpoints": {
        "odata_v2": "/sap/opu/odata/sap/",
        "odata_v4": "/sap/opu/odata4/sap/"
      },
      "authentication": {
        "type": "oauth2",
        "principalPropagation": true
      },
      "entitySets": [
        {
          "name": "BusinessPartner",
          "path": "API_BUSINESS_PARTNER/A_BusinessPartner",
          "description": "Business Partner Master Data"
        }
      ]
    }
  ],
  "metadata": {
    "totalServices": 1,
    "categories": ["ERP", "HCM", "Procurement"],
    "supportedVersions": ["odata_v2", "odata_v4"]
  }
}
```

### Destination Configuration

Configure destinations in BTP Cockpit or via API:

```json
{
  "Name": "S4HANA_SYSTEM",
  "Type": "HTTP",
  "URL": "https://your-s4hana-system.com",
  "Authentication": "PrincipalPropagation", 
  "ProxyType": "OnPremise",
  "Description": "SAP S/4HANA On-Premise System"
}
```

## 📊 Logging Configuration

### SAP Cloud Logging Integration

#### Service Instance Creation

```bash
# Create cloud logging service instance
cf create-service cloud-logging dev sap-mcp-cloud-logging

# Bind to application
cf bind-service sap-mcp-server-mcp_noprod_space sap-mcp-cloud-logging

# Restage application
cf restage sap-mcp-server-mcp_noprod_space
```

#### Logging Configuration

**Environment Variables:**

```bash
# Logging Service Configuration
CLOUD_LOGGING_ENABLED=true
LOG_FORMAT=json                   # json, text
LOG_CORRELATION_ID=true          # Enable correlation tracking
LOG_REQUEST_RESPONSE=true        # Log HTTP requests/responses
LOG_PERFORMANCE_METRICS=true     # Log performance data

# Log Levels by Component
LOG_LEVEL_AUTH=info
LOG_LEVEL_TOOLS=debug  
LOG_LEVEL_CONNECTIVITY=warn
LOG_LEVEL_HEALTH=info
```

#### Custom Log Configuration

**Location**: `src/config/logging-config.json`

```json
{
  "logLevel": "info",
  "enableCloudLogging": true,
  "enableCorrelationId": true,
  "enableRequestLogging": true,
  "enablePerformanceMetrics": true,
  "logFormat": "json",
  "components": {
    "auth": {
      "level": "info",
      "enableAuditLog": true,
      "maskSensitiveData": true
    },
    "tools": {
      "level": "debug",
      "logParameters": false,
      "logResults": false
    },
    "connectivity": {
      "level": "warn", 
      "logHeaders": false,
      "logPayloads": false
    }
  },
  "filters": {
    "excludeHealthChecks": true,
    "excludeStaticAssets": true,
    "includeUserContext": true
  }
}
```

## ⚡ Performance Configuration

### Caching Configuration

```bash
# Cache Settings
ENABLE_CACHING=true
CACHE_TTL_SERVICES=1800000        # 30 minutes
CACHE_TTL_SCHEMAS=900000          # 15 minutes
CACHE_TTL_METADATA=3600000        # 1 hour
CACHE_MAX_SIZE=1000               # Max cache entries
CACHE_CLEANUP_INTERVAL=300000     # 5 minutes
```

### Connection Pool Configuration

```bash
# Connection Pool Settings
CONNECTION_POOL_SIZE=10           # Max connections per destination
CONNECTION_IDLE_TIMEOUT=300000    # 5 minutes
CONNECTION_REQUEST_TIMEOUT=30000   # 30 seconds
CONNECTION_RETRY_ATTEMPTS=3
CONNECTION_RETRY_DELAY=1000       # 1 second
```

## 🔍 Health Check Configuration

### Health Check Settings

```bash
# Health Check Configuration
ENABLE_HEALTH_CHECKS=true
HEALTH_CHECK_INTERVAL=30000       # 30 seconds
HEALTH_CHECK_TIMEOUT=10000        # 10 seconds
HEALTH_CHECK_RETRIES=3

# Individual Check Configuration
HEALTH_CHECK_CONNECTIVITY=true
HEALTH_CHECK_AUTHENTICATION=true
HEALTH_CHECK_SERVICES=true
HEALTH_CHECK_MEMORY=true
HEALTH_CHECK_LOGGING=true
```

### Custom Health Checks

**Location**: `src/config/health-config.json`

```json
{
  "enabled": true,
  "interval": 30000,
  "timeout": 10000,
  "retries": 3,
  "checks": {
    "connectivity": {
      "enabled": true,
      "timeout": 5000,
      "destinations": ["S4HANA_SYSTEM", "SUCCESSFACTORS"]
    },
    "authentication": {
      "enabled": true,
      "checkIAS": true,
      "checkXSUAA": true,
      "timeout": 3000
    },
    "services": {
      "enabled": true,
      "checkBinding": true,
      "services": ["connectivity", "destination", "xsuaa"]
    },
    "memory": {
      "enabled": true,
      "threshold": 0.8,
      "gcThreshold": 0.9
    },
    "logging": {
      "enabled": true,
      "checkCloudLogging": true
    }
  }
}
```

## 🛡️ Security Configuration

### Security Headers

```bash
# Security Configuration  
ENABLE_SECURITY_HEADERS=true
ENABLE_HELMET=true
ENABLE_CORS=true
CORS_ORIGINS=https://claude.ai,https://localhost:*
CORS_CREDENTIALS=true
CORS_MAX_AGE=86400

# Content Security Policy
CSP_DEFAULT_SRC="'self'"
CSP_SCRIPT_SRC="'self' 'unsafe-inline'"
CSP_STYLE_SRC="'self' 'unsafe-inline'"
CSP_IMG_SRC="'self' data: https:"
```

### Rate Limiting

```bash
# Rate Limiting Configuration
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW=900000          # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000      # Max requests per window
RATE_LIMIT_SKIP_SUCCESS=false
RATE_LIMIT_HEADERS=true
```

## 🔧 Development Configuration

### Local Development

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "NODE_ENV=development nodemon --exec tsx src/index.ts",
    "dev:debug": "NODE_ENV=development DEBUG=* nodemon --exec tsx src/index.ts",
    "dev:watch": "NODE_ENV=development tsx watch src/index.ts",
    "build": "tsc && cp -r src/public dist/",
    "start": "NODE_ENV=production node dist/index.js",
    "test": "NODE_ENV=test jest",
    "test:watch": "NODE_ENV=test jest --watch"
  }
}
```

### Development Environment Variables

```bash
# Development Configuration
NODE_ENV=development
DEBUG=sap:*,mcp:*
HOT_RELOAD=true
ENABLE_DEBUG_ROUTES=true
ENABLE_REQUEST_LOGGING=true
MOCK_AUTHENTICATION=false
MOCK_SAP_SERVICES=false

# Development Tools
ENABLE_SWAGGER_UI=true
ENABLE_ADMIN_INTERFACE=true
ENABLE_METRICS_ENDPOINT=true
```

## 🚀 Production Configuration

### Production Optimizations

```bash
# Production Configuration
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_DEBUG_ROUTES=false
ENABLE_SWAGGER_UI=false
ENABLE_ADMIN_INTERFACE=false

# Performance Optimizations
NODE_OPTIONS="--max-old-space-size=512"
UV_THREADPOOL_SIZE=4
NODE_CLUSTER_WORKERS=1

# Security Hardening
HELMET_ENABLED=true
HIDE_POWERED_BY=true
TRUST_PROXY=1
```

### Production Deployment

**manifest.yml:**

```yaml
applications:
- name: sap-mcp-server-prod
  memory: 512M
  disk_quota: 1G
  instances: 2
  health-check-type: http
  health-check-http-endpoint: /health
  timeout: 60
  env:
    NODE_ENV: production
    LOG_LEVEL: info
    ENABLE_HEALTH_CHECKS: true
    SESSION_TIMEOUT: 3600000
  services:
    - sap-mcp-xsuaa
    - sap-mcp-connectivity  
    - sap-mcp-destination
    - sap-mcp-cloud-logging
```

## 📝 Configuration Validation

### Environment Validation

The application validates configuration on startup:

```typescript
interface ConfigValidation {
  required: string[]      // Required environment variables
  optional: string[]      // Optional with defaults
  validation: {
    [key: string]: (value: string) => boolean
  }
}
```

### Configuration Schema

**Location**: `src/utils/config-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["SAP_IAS_URL", "SAP_IAS_CLIENT_ID", "SAP_IAS_CLIENT_SECRET"],
  "properties": {
    "SAP_IAS_URL": {
      "type": "string",
      "format": "uri"
    },
    "SAP_IAS_CLIENT_ID": {
      "type": "string",
      "minLength": 1
    },
    "SAP_IAS_CLIENT_SECRET": {
      "type": "string", 
      "minLength": 1
    },
    "PORT": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 8080
    }
  }
}
```

## 🔄 Configuration Management

### Configuration Sources (Priority Order)

1. **Command Line Arguments** (highest priority)
2. **Environment Variables**
3. **Configuration Files** (.env, config/*.json)
4. **VCAP_SERVICES** (SAP BTP service bindings)
5. **Default Values** (lowest priority)

### Dynamic Configuration

Some configuration can be updated at runtime via API:

```bash
# Update log level
curl -X POST /admin/config/logging \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level": "debug"}'

# Update cache settings  
curl -X POST /admin/config/cache \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ttl": 900000}'
```

---

**📖 Related Documentation**:
- [Architecture Overview](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Reference](API_REFERENCE.md)
- [Troubleshooting](TROUBLESHOOTING.md)