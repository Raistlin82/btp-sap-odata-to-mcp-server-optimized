# Configuration Guide

This guide provides a comprehensive overview of all the necessary configurations for the SAP BTP OData to MCP Server, from local development to production deployment on SAP BTP.

## Table of Contents
- [Environment Variables](#environment-variables)
- [OData Discovery Configuration](#odata-discovery-configuration)
- [Authentication Configuration](#authentication-configuration)
- [Cloud Foundry Deployment](#cloud-foundry-deployment)
- [Security Configuration](#security-configuration)
- [Deployment Configuration](#deployment-configuration)

## Environment Variables

Environment variables are the primary method for configuring the application. They can be defined in an `.env` file for local development or as "User-Provided Variables" in the BTP Cockpit.

### Core Configuration (Required)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SAP_IAS_URL` | URL of the SAP Identity Authentication Service tenant | `https://your-tenant.accounts.ondemand.com` |
| `SAP_IAS_CLIENT_ID` | Client ID for the OAuth application in IAS | `abc-def-123` |
| `SAP_IAS_CLIENT_SECRET`| Client Secret for the OAuth application in IAS | `your-secret` |
| `PORT` | The port on which the Express server will listen | `8080` |
| `NODE_ENV` | The application's operating environment | `production` or `development` |

### Destination Configuration

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SAP_DESTINATION_NAME` | Name of the BTP destination used for service discovery | `SAP_S4HANA_Design` |
| `SAP_DESTINATION_NAME_RT`| Name of the BTP destination used at runtime (for data calls) | `SAP_S4HANA_Runtime` |
| `SAP_USE_SINGLE_DESTINATION`| If `true`, uses `SAP_DESTINATION_NAME` for everything | `false` |
| `destinations` | For local development, a JSON array that simulates the Destination service | `[{"name":"MyDest","url":"..."}]` |

## OData Discovery Configuration

The OData discovery system has been simplified to use pattern-based filtering, making it easier to manage which services are exposed through the MCP server.

### Discovery Modes

The system supports four discovery modes, configured via `ODATA_DISCOVERY_MODE`:

#### 1. Pattern Mode (Recommended)
Best for development and most production scenarios. Uses include/exclude patterns to filter services.

```bash
ODATA_DISCOVERY_MODE=pattern
ODATA_INCLUDE_PATTERNS=*API*,Z*,Y*
ODATA_EXCLUDE_PATTERNS=*_TEST*,*_TEMP*,*_DEBUG*,*_INTERNAL*
ODATA_MAX_SERVICES=50
```

**Pattern Syntax:**
- `*API*` - Matches any service containing "API"
- `Z*` - Matches services starting with "Z" (SAP custom namespace)
- `*_TEST` - Matches services ending with "_TEST"
- Use comma to separate multiple patterns

#### 2. Business Mode
For production environments with defined business domains.

```bash
ODATA_DISCOVERY_MODE=business
ODATA_BUSINESS_DOMAINS=sales,finance,hr
```

**Available Domains:**
- `sales` - Sales and CRM services
- `finance` - Financial and accounting services
- `hr` - Human resources services
- `procurement` - Purchasing services
- `logistics` - Supply chain services
- `manufacturing` - Production services

#### 3. Whitelist Mode
For maximum security - only explicitly listed services are exposed.

```bash
ODATA_DISCOVERY_MODE=whitelist
ODATA_WHITELIST_SERVICES=API_SALES_ORDER_SRV,API_BUSINESS_PARTNER
```

#### 4. All Mode
For development/testing only - exposes all discovered services.

```bash
ODATA_DISCOVERY_MODE=all
ODATA_MAX_SERVICES=100  # Safety limit
```

### Discovery Configuration Variables

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `ODATA_DISCOVERY_MODE` | Discovery mode: `pattern`, `business`, `whitelist`, or `all` | `pattern` | `pattern` |
| `ODATA_INCLUDE_PATTERNS` | Comma-separated patterns to include (pattern mode) | - | `*API*,Z*` |
| `ODATA_EXCLUDE_PATTERNS` | Comma-separated patterns to exclude (pattern mode) | - | `*_TEST*,*_TEMP*` |
| `ODATA_BUSINESS_DOMAINS` | Comma-separated business domains (business mode) | - | `sales,finance` |
| `ODATA_WHITELIST_SERVICES` | Comma-separated service names (whitelist mode) | - | `API_SALES_ORDER_SRV` |
| `ODATA_MAX_SERVICES` | Maximum number of services to discover | `50` | `100` |
| `ODATA_REFRESH_INTERVAL` | Service refresh interval | `1h` | `30m` |

### Migration from Legacy Configuration

If you're migrating from the old complex configuration system:

**Old Configuration:**
```yaml
discovery:
  allow_all: false
  whitelist_mode: true
  blacklist_patterns: ["*internal*", "*test*"]
  whitelist_services: ["service1", "service2"]
```

**New Configuration:**
```bash
# If using whitelist_mode=true with specific services:
ODATA_DISCOVERY_MODE=whitelist
ODATA_WHITELIST_SERVICES=service1,service2

# If using patterns:
ODATA_DISCOVERY_MODE=pattern
ODATA_EXCLUDE_PATTERNS=*internal*,*test*
```

## Authentication Configuration

The server supports multiple authentication mechanisms through a modular factory pattern.

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `AUTH_MECHANISM` | Authentication type: `ias`, `oauth2`, `jwt`, `basic`, `apikey`, or `custom` | `ias` | `ias` |
| `AUTH_SESSION_TIMEOUT` | Session timeout in milliseconds | `3600000` | `7200000` |
| `AUTH_TOKEN_REFRESH` | Enable automatic token refresh | `true` | `true` |
| `AUTH_STRICT_MODE` | Enforce strict authentication validation | `false` | `true` |

### Logging Configuration

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `LOG_LEVEL` | Console log level | `info` | `debug` |
| `CLOUD_LOGGING_ENABLED` | Enable structured cloud logging | `true` | `true` |
| `LOG_CORRELATION_ID_HEADER` | Header name for request correlation | `x-correlation-id` | `x-request-id` |
| `PERFORMANCE_METRICS_ENABLED` | Enable performance metrics | `true` | `false` |

### AI & Analytics Configuration

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `AI_FEATURES_ENABLED` | Enable AI-powered features | `true` | `true` |
| `AI_CONFIDENCE_THRESHOLD` | Minimum confidence for AI actions | `0.75` | `0.8` |
| `MAX_DATA_POINTS_FOR_ANALYSIS` | Max data points for AI analysis | `1000` | `5000` |
| `STREAMING_POLL_INTERVAL` | Real-time data polling interval (ms) | `5000` | `10000` |

### UI Tools Configuration

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `UI_TOOLS_ENABLED` | Enable UI generation tools | `true` | `false` |
| `UI_DEFAULT_THEME` | Default SAP UI theme | `sap_horizon` | `sap_fiori_3` |
| `UI_FORM_VALIDATION_STRICT` | Strict form validation | `true` | `false` |
| `UI_DASHBOARD_REFRESH_INTERVAL` | Dashboard refresh (seconds) | `30` | `60` |
| `UI_MAX_GRID_ROWS` | Max rows per grid page | `100` | `50` |
| `UI_REPORT_TIMEOUT` | Report generation timeout (ms) | `30000` | `60000` |

## Cloud Foundry Deployment

### Setting Environment Variables via CF CLI

```bash
# Login to Cloud Foundry
cf login -a https://api.cf.eu30.hana.ondemand.com

# Target your org and space
cf target -o your-org -s your-space

# Set discovery configuration
cf set-env btp-sap-odata-to-mcp-server ODATA_DISCOVERY_MODE pattern
cf set-env btp-sap-odata-to-mcp-server ODATA_INCLUDE_PATTERNS "*API*,Z*"
cf set-env btp-sap-odata-to-mcp-server ODATA_EXCLUDE_PATTERNS "*_TEST*,*_TEMP*"

# Set authentication configuration
cf set-env btp-sap-odata-to-mcp-server AUTH_MECHANISM ias
cf set-env btp-sap-odata-to-mcp-server AUTH_SESSION_TIMEOUT 7200000

# Apply changes
cf restage btp-sap-odata-to-mcp-server
```

### Configuration via manifest.yml

```yaml
applications:
- name: btp-sap-odata-to-mcp-server
  memory: 512M
  instances: 1
  buildpack: nodejs_buildpack
  env:
    # OData Discovery
    ODATA_DISCOVERY_MODE: pattern
    ODATA_INCLUDE_PATTERNS: "*API*,Z*"
    ODATA_EXCLUDE_PATTERNS: "*_TEST*,*_TEMP*,*_DEBUG*"
    ODATA_MAX_SERVICES: 50

    # Authentication
    AUTH_MECHANISM: ias
    AUTH_SESSION_TIMEOUT: 3600000

    # Logging
    LOG_LEVEL: info
    CLOUD_LOGGING_ENABLED: true
```

### Configuration via mta.yaml

```yaml
modules:
  - name: sap-mcp-server
    type: nodejs
    parameters:
      memory: 512M
    properties:
      # OData Discovery
      ODATA_DISCOVERY_MODE: pattern
      ODATA_INCLUDE_PATTERNS: "*API*,Z*"
      ODATA_EXCLUDE_PATTERNS: "*_TEST*,*_TEMP*"

      # Authentication
      AUTH_MECHANISM: ias
      AUTH_SESSION_TIMEOUT: 3600000
```

### Viewing Current Configuration

```bash
# View all environment variables
cf env btp-sap-odata-to-mcp-server

# View specific configuration
cf env btp-sap-odata-to-mcp-server | grep ODATA_
```

### Best Practices for Production

1. **Use Pattern or Whitelist Mode**: Never use `all` mode in production
2. **Set Maximum Limits**: Always configure `ODATA_MAX_SERVICES`
3. **Exclude Test Services**: Always exclude test/debug patterns
4. **Monitor Discovery**: Check logs after configuration changes
5. **Use Business Mode**: For stable production environments with defined domains

## Security Configuration

### xs-security.json

Defines the application's security model for SAP BTP XSUAA service.

```json
{
  "xsappname": "btp-sap-odata-to-mcp-server",
  "tenant-mode": "shared",
  "scopes": [
    { "name": "$XSAPPNAME.read", "description": "Read access" },
    { "name": "$XSAPPNAME.write", "description": "Write access" },
    { "name": "$XSAPPNAME.admin", "description": "Administrative access" }
  ],
  "role-templates": [
    {
      "name": "MCPViewer",
      "description": "Read-only access",
      "scope-references": ["$XSAPPNAME.read"]
    },
    {
      "name": "MCPEditor",
      "description": "Read and write access",
      "scope-references": ["$XSAPPNAME.read", "$XSAPPNAME.write"]
    },
    {
      "name": "MCPAdmin",
      "description": "Full administrative access",
      "scope-references": ["$XSAPPNAME.admin"]
    }
  ]
}
```

### Role Collection Setup

1. Navigate to **BTP Cockpit > Security > Role Collections**
2. Create a new collection (e.g., `MCP_Users`)
3. Add roles from the templates (e.g., `MCPEditor`)
4. Assign the collection to users or groups

## Deployment Configuration

### mta.yaml Structure

```yaml
_schema-version: '3.1'
ID: btp-sap-odata-to-mcp-server
version: 1.0.0

modules:
  - name: sap-mcp-server
    type: nodejs
    path: ./
    parameters:
      memory: 512M
      disk-quota: 1024M
      command: npm run start
    requires:
      - name: sap-mcp-destination
      - name: sap-mcp-connectivity
      - name: sap-mcp-xsuaa
      - name: sap-mcp-application-logs

resources:
  - name: sap-mcp-destination
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: sap-mcp-connectivity
    type: org.cloudfoundry.managed-service
    parameters:
      service: connectivity
      service-plan: lite

  - name: sap-mcp-xsuaa
    type: org.cloudfoundry.managed-service
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json

  - name: sap-mcp-application-logs
    type: org.cloudfoundry.managed-service
    parameters:
      service: application-logs
      service-plan: lite
```

## Troubleshooting

### Common Issues

1. **No services discovered**
   - Check `ODATA_DISCOVERY_MODE` and related patterns
   - Verify destination configuration
   - Check service naming conventions

2. **Too many services discovered**
   - Add more specific exclude patterns
   - Reduce `ODATA_MAX_SERVICES`
   - Switch to whitelist mode

3. **Authentication failures**
   - Verify IAS configuration
   - Check `AUTH_MECHANISM` setting
   - Validate client credentials

4. **Cloud Logging warnings**
   - Normal if application-logs service not bound
   - System automatically falls back to console logging

---

**Next Steps**: [Deployment Guide](./DEPLOYMENT.md) | [User Guide](./USER_GUIDE.md) | [Architecture](./ARCHITECTURE.md)