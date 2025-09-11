# Configuration Guide

> **Reference to Original Project**  
> This configuration extends the setup from [@lemaiwo](https://github.com/lemaiwo)'s [btp-sap-odata-to-mcp-server](https://github.com/lemaiwo/btp-sap-odata-to-mcp-server) with additional enterprise features.

## 🔧 Environment Variables

### Required Variables
```bash
# SAP Identity Authentication Service (IAS)
SAP_IAS_URL=https://your-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=your-client-id
SAP_IAS_CLIENT_SECRET=your-client-secret

# Server Configuration  
PORT=8080
NODE_ENV=production
LOG_LEVEL=info
```

### Optional Variables
```bash
# Authentication & Authorization
AUTH_PORT=3001
XSUAA_XSAPPNAME=btp-sap-odata-to-mcp-server
USER_JWT=                         # User JWT token (runtime)
TECHNICAL_USER_JWT=               # Technical user JWT token

# Role Collections (matches xs-security.json)
ROLE_COLLECTIONS=MCPAdministrator,MCPUser,MCPManager,MCPViewer
ROLE_TEMPLATES=MCPAdmin,MCPEditor,MCPManager,MCPViewer
ADMIN_ROLE_COLLECTION=MCPAdministrator

# Session Management
SESSION_TIMEOUT=3600000           # 1 hour in milliseconds
MAX_SESSIONS_PER_USER=1

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

# Performance & Timeouts
REQUEST_TIMEOUT=30000             # Request timeout in milliseconds
REQUEST_RETRIES=3                 # Number of retry attempts
CACHE_TTL=1800000                 # Cache TTL in milliseconds (30 min)

# Security
CORS_ORIGINS=http://localhost:*,https://claude.ai
SECURITY_HEADERS=true             # Enable security headers

# Feature Flags
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true
ENABLE_AUDIT_LOGGING=true
DISABLE_READ_ENTITY_TOOL=false    # Disable read entity tool
```

## 🔐 SAP BTP Cockpit Configuration

### Role Collections Setup

Configure these role collections in **BTP Cockpit > Security > Role Collections**:

| Role Collection | Description | Role Template | Scopes |
|----------------|-------------|---------------|---------|
| `MCPAdministrator` | Full administrative access | `MCPAdmin` | read, write, delete, admin, discover |
| `MCPManager` | Manager access with delete permissions | `MCPManager` | read, write, delete, discover |
| `MCPUser` | Standard user access | `MCPEditor` | read, write, discover |
| `MCPViewer` | Read-only access | `MCPViewer` | read, discover |

### User Variables in BTP Cockpit

You can define these **User-Provided Variables** in BTP Cockpit for runtime configuration:

#### In BTP Cockpit > Cloud Foundry > Spaces > [Your Space] > Applications > [App] > User-Provided Variables

```bash
# Service Discovery Override
ODATA_SERVICE_PATTERNS=*API*,*SERVICE*
ODATA_MAX_SERVICES=100

# Performance Tuning
REQUEST_TIMEOUT=45000
CACHE_TTL=2700000

# Feature Toggles
ENABLE_DEBUG_ROUTES=false
ENABLE_ADMIN_INTERFACE=true

# Logging Level Override
LOG_LEVEL=debug
LOG_LEVEL_AUTH=info
LOG_LEVEL_CONNECTIVITY=warn

# Session Configuration
SESSION_TIMEOUT=7200000
MAX_SESSIONS_PER_USER=3
```

### Service Bindings in BTP Cockpit

Ensure these services are bound to your application in **BTP Cockpit > Cloud Foundry > Applications > [App] > Service Bindings**:

- `xsuaa` (Authorization & Authentication)
- `connectivity` (SAP System Connectivity)  
- `destination` (Destination Management)
- `cloud-logging` (SAP Cloud Logging)

## 🏗️ Service Configuration Files

### xs-security.json (XSUAA Configuration)

```json
{
  "xsappname": "btp-sap-odata-to-mcp-server",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.read", "description": "Read access" },
    { "name": "$XSAPPNAME.write", "description": "Write access" },
    { "name": "$XSAPPNAME.delete", "description": "Delete access" },
    { "name": "$XSAPPNAME.admin", "description": "Administrative access" },
    { "name": "$XSAPPNAME.discover", "description": "Service discovery" }
  ],
  "role-templates": [
    {
      "name": "MCPAdmin",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write", "$XSAPPNAME.delete", "$XSAPPNAME.admin", "$XSAPPNAME.discover"]
    },
    {
      "name": "MCPEditor", 
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write", "$XSAPPNAME.discover"]
    },
    {
      "name": "MCPManager",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write", "$XSAPPNAME.delete", "$XSAPPNAME.discover"]
    },
    {
      "name": "MCPViewer",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.discover"]
    }
  ]
}
```

### manifest.yml (Cloud Foundry Deployment)

```yaml
applications:
- name: sap-mcp-server-app
  memory: 512M
  disk_quota: 1G
  instances: 1
  health-check-type: http
  health-check-http-endpoint: /health
  timeout: 60
  env:
    NODE_ENV: production
    LOG_LEVEL: info
    ENABLE_HEALTH_CHECKS: true
  services:
    - sap-mcp-xsuaa
    - sap-mcp-connectivity  
    - sap-mcp-destination
    - sap-mcp-cloud-logging
```

## 🔧 Local Development

### .env File Setup

```bash
# Copy template and configure
cp .env.example .env

# Edit with your values
nano .env
```

### Example .env for Development

```env
# SAP IAS Configuration
SAP_IAS_URL=https://your-tenant.accounts.ondemand.com
SAP_IAS_CLIENT_ID=your-client-id
SAP_IAS_CLIENT_SECRET=your-secret

# Development Settings
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug
ENABLE_CORS=true
ENABLE_DEBUG_ROUTES=true

# Role Collections (must match xs-security.json)
ROLE_COLLECTIONS=MCPAdministrator,MCPUser,MCPManager,MCPViewer
ROLE_TEMPLATES=MCPAdmin,MCPEditor,MCPManager,MCPViewer
ADMIN_ROLE_COLLECTION=MCPAdministrator
```

---

**📖 Next Steps**: [Deployment Guide](DEPLOYMENT.md) | [Architecture Overview](ARCHITECTURE.md)